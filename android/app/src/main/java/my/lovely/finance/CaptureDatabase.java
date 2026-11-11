package my.lovely.finance;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.DatabaseUtils;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.os.SystemClock;

import java.util.ArrayList;
import java.util.List;

/**
 * The capture queue: the apps to listen to, the notifications the listener caught from them and the
 * events of the listener itself. Kept natively because the listener runs while there is no WebView
 * (ADR-0003).
 *
 * <p>A file of its own, opened with the SQLite of the platform. The main database belongs to
 * {@code @capacitor-community/sqlite}, whose SQLCipher is another copy of SQLite, and two copies on
 * one file in one process corrupt it. The schema lives here rather than in the migrations of the app
 * and changes only through {@link #onUpgrade}.
 */
final class CaptureDatabase extends SQLiteOpenHelper {
    static final String ORIGIN_POSTED = "posted";
    // Found in the shade when the listener connected: it was posted while nobody listened
    static final String ORIGIN_RESTORED = "restored";

    static final String EVENT_CONNECTED = "connected";
    static final String EVENT_DISCONNECTED = "disconnected";
    static final String EVENT_REBIND_REQUESTED = "rebind_requested";

    private static final String NAME = "capture.db";
    private static final int VERSION = 3;

    private static CaptureDatabase instance;

    static synchronized CaptureDatabase get(Context context) {
        if (instance == null) instance = new CaptureDatabase(context.getApplicationContext());
        return instance;
    }

    private CaptureDatabase(Context context) {
        super(context, NAME, null, VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE sources (package_name TEXT PRIMARY KEY NOT NULL)");
        db.execSQL(
            "CREATE TABLE notifications ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "package_name TEXT NOT NULL, "
                + "notification_key TEXT NOT NULL, "
                + "posted_at INTEGER NOT NULL, "
                + "captured_at INTEGER NOT NULL, "
                + "origin TEXT NOT NULL, "
                + "title TEXT, "
                + "text TEXT, "
                + "big_text TEXT, "
                + "sub_text TEXT, "
                + "lines TEXT, "
                + "fingerprint TEXT NOT NULL UNIQUE)"
        );
        db.execSQL("CREATE INDEX notifications_captured_at ON notifications (captured_at)");
        db.execSQL(
            "CREATE TABLE listener_events ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "kind TEXT NOT NULL, "
                + "at INTEGER NOT NULL, "
                + "uptime_ms INTEGER NOT NULL)"
        );
        createSkippedNotifications(db);
    }

    // One step per version, never edited once released. SQLiteOpenHelper runs them in a transaction
    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2) deleteNotificationsWithoutAmount(db);
        if (oldVersion < 3) createSkippedNotifications(db);
    }

    // Version 3: notifications of a chosen app the amount filter dropped — the app and the time only,
    // never the text, so a missing card operation can be told from a listener that was not running.
    // The same notification found again in the shade is the same app and post time and counts once
    private static void createSkippedNotifications(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE skipped_notifications ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "package_name TEXT NOT NULL, "
                + "posted_at INTEGER NOT NULL, "
                + "captured_at INTEGER NOT NULL, "
                + "UNIQUE (package_name, posted_at))"
        );
    }

    // Version 2 keeps only notifications that name an amount (ADR-0004): what version 1 captured
    // from a chosen SMS app — private conversations among it — goes the same way
    private static void deleteNotificationsWithoutAmount(SQLiteDatabase db) {
        List<String> ids = new ArrayList<>();
        String[] columns = new String[] { "id", "title", "text", "big_text", "sub_text", "lines" };
        try (Cursor cursor = db.query("notifications", columns, null, null, null, null, null)) {
            while (cursor.moveToNext()) {
                boolean hasAmount = CaptureAmounts.containsAmount(
                    cursor.getString(1),
                    cursor.getString(2),
                    cursor.getString(3),
                    cursor.getString(4),
                    cursor.getString(5)
                );
                if (!hasAmount) ids.add(cursor.getString(0));
            }
        }
        for (String id : ids) db.delete("notifications", "id = ?", new String[] { id });
    }

    boolean isSource(String packageName) {
        return DatabaseUtils.queryNumEntries(getReadableDatabase(), "sources", "package_name = ?", new String[] { packageName }) > 0;
    }

    List<String> getSources() {
        List<String> packageNames = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query("sources", new String[] { "package_name" }, null, null, null, null, null)) {
            while (cursor.moveToNext()) packageNames.add(cursor.getString(0));
        }
        return packageNames;
    }

    void setSourceEnabled(String packageName, boolean enabled) {
        SQLiteDatabase db = getWritableDatabase();
        if (enabled) {
            ContentValues values = new ContentValues();
            values.put("package_name", packageName);
            db.insertWithOnConflict("sources", null, values, SQLiteDatabase.CONFLICT_IGNORE);
        } else {
            db.delete("sources", "package_name = ?", new String[] { packageName });
        }
    }

    // False when a notification with the same fingerprint is already in the queue
    boolean insertNotification(ContentValues values) {
        return getWritableDatabase().insertWithOnConflict("notifications", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1;
    }

    // False when this notification was already counted
    boolean insertSkippedNotification(String packageName, long postedAt) {
        ContentValues values = new ContentValues();
        values.put("package_name", packageName);
        values.put("posted_at", postedAt);
        values.put("captured_at", System.currentTimeMillis());
        return getWritableDatabase().insertWithOnConflict("skipped_notifications", null, values, SQLiteDatabase.CONFLICT_IGNORE) != -1;
    }

    void insertListenerEvent(String kind) {
        ContentValues values = new ContentValues();
        values.put("kind", kind);
        values.put("at", System.currentTimeMillis());
        // Time since the phone booted: a connect a few seconds after it is the listener coming back
        // after a restart of the phone
        values.put("uptime_ms", SystemClock.elapsedRealtime());
        getWritableDatabase().insert("listener_events", null, values);
    }

    void deleteOlderThan(long time) {
        SQLiteDatabase db = getWritableDatabase();
        String[] args = new String[] { String.valueOf(time) };
        db.delete("notifications", "captured_at < ?", args);
        db.delete("skipped_notifications", "captured_at < ?", args);
        db.delete("listener_events", "at < ?", args);
    }

    Cursor queryNotifications(int limit) {
        return getReadableDatabase().query(
            "notifications",
            new String[] { "id", "package_name", "posted_at", "captured_at", "origin", "title", "text", "big_text", "sub_text", "lines" },
            null,
            null,
            null,
            null,
            "id DESC",
            String.valueOf(limit)
        );
    }

    Cursor querySkippedNotifications(int limit) {
        return getReadableDatabase().query(
            "skipped_notifications",
            new String[] { "id", "package_name", "posted_at" },
            null,
            null,
            null,
            null,
            "id DESC",
            String.valueOf(limit)
        );
    }

    Cursor queryListenerEvents(int limit) {
        return getReadableDatabase().query(
            "listener_events",
            new String[] { "id", "kind", "at", "uptime_ms" },
            null,
            null,
            null,
            null,
            "id DESC",
            String.valueOf(limit)
        );
    }
}

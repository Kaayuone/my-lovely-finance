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
    private static final int VERSION = 1;

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
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Version 1 is the first one: the step to each later version goes here
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

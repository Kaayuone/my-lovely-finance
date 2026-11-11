package my.lovely.finance;

import android.app.Notification;
import android.content.ContentValues;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

/**
 * Catches the notifications of the apps the person chose and writes them, raw, into the capture
 * queue (ADR-0003). The system starts the process of the app for it with no activity and no WebView,
 * so nothing here may depend on either: parsing and drafts are the business of the app once it is
 * opened.
 *
 * <p>Deliberately small: a crash in the background is seen by nobody, and every line here runs in
 * it. Whether the listener needs {@code requestRebind()} on its own after a disconnect is what the
 * device checks of stage 0 decide; until then it only records the disconnect, and the capture screen
 * asks for a rebind on a tap ({@link CapturePlugin}).
 */
public class CaptureListenerService extends NotificationListenerService {
    private static final String TAG = "CaptureListener";
    private static final long RETENTION_MS = 90L * 24 * 60 * 60 * 1000;

    // Seen by the plugin in the same process: whether the system has this listener bound right now
    private static volatile boolean connected;
    private static volatile Runnable changeListener;

    // The callbacks arrive on the main thread. One writer thread keeps them off it and keeps the
    // writes in the order of the callbacks
    private final ExecutorService writer = Executors.newSingleThreadExecutor();

    // A write to the queue; answers whether the queue changed, so the screen reloads only then
    private interface Write {
        boolean run();
    }

    static boolean isConnected() {
        return connected;
    }

    static void setChangeListener(Runnable listener) {
        changeListener = listener;
    }

    @Override
    public void onListenerConnected() {
        connected = true;
        write(() -> {
            CaptureDatabase db = CaptureDatabase.get(this);
            db.insertListenerEvent(CaptureDatabase.EVENT_CONNECTED);
            db.deleteOlderThan(System.currentTimeMillis() - RETENTION_MS);
            // What was posted while the listener was unbound and still hangs in the shade. Already
            // captured ones match their fingerprint and are skipped
            StatusBarNotification[] active = getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification notification : active) {
                    capture(db, notification, CaptureDatabase.ORIGIN_RESTORED);
                }
            }
            return true;
        });
    }

    @Override
    public void onListenerDisconnected() {
        connected = false;
        write(() -> {
            CaptureDatabase.get(this).insertListenerEvent(CaptureDatabase.EVENT_DISCONNECTED);
            return true;
        });
    }

    @Override
    public void onNotificationPosted(StatusBarNotification notification) {
        write(() -> capture(CaptureDatabase.get(this), notification, CaptureDatabase.ORIGIN_POSTED));
    }

    @Override
    public void onDestroy() {
        // The base class reports the disconnect from here through onListenerDisconnected, which
        // still needs the writer: it stops only after that. Already queued writes still run
        super.onDestroy();
        connected = false;
        writer.shutdown();
    }

    // An exception escaping a worker thread ends the whole process, so every write catches its own
    private void write(Write work) {
        try {
            writer.execute(() -> {
                // A failure halfway may still have written something, so the screen reloads then too
                boolean changed = true;
                try {
                    changed = work.run();
                } catch (RuntimeException e) {
                    Log.e(TAG, "Failed to write to the capture queue", e);
                }
                try {
                    if (changed) notifyChanged();
                } catch (RuntimeException e) {
                    Log.e(TAG, "Failed to tell the app about a capture", e);
                }
            });
        } catch (RejectedExecutionException e) {
            Log.e(TAG, "The capture queue writer has already stopped", e);
        }
    }

    private void notifyChanged() {
        Runnable listener = changeListener;
        if (listener != null) listener.run();
    }

    // Answers whether the notification went into the queue
    private boolean capture(CaptureDatabase db, StatusBarNotification sbn, String origin) {
        String packageName = sbn.getPackageName();
        if (packageName.equals(getPackageName())) return false;

        Notification notification = sbn.getNotification();
        // A group summary repeats its children, and an ongoing notification (a player, a download)
        // is not an operation
        if ((notification.flags & (Notification.FLAG_GROUP_SUMMARY | Notification.FLAG_ONGOING_EVENT)) != 0) return false;
        if (!db.isSource(packageName)) return false;

        Bundle extras = notification.extras;
        String title = string(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text = string(extras.getCharSequence(Notification.EXTRA_TEXT));
        String bigText = string(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        String subText = string(extras.getCharSequence(Notification.EXTRA_SUB_TEXT));
        String lines = lines(notification);
        if (title == null && text == null && bigText == null && lines == null) return false;
        // A chosen SMS app or messenger also carries private conversations: only a notification
        // that names an amount of money is kept (ADR-0004). Of the rest, the app and the time are
        // counted, so a card operation the filter dropped shows up on the capture screen
        if (!CaptureAmounts.containsAmount(title, text, bigText, subText, lines)) {
            return db.insertSkippedNotification(packageName, sbn.getPostTime());
        }

        ContentValues values = new ContentValues();
        values.put("package_name", packageName);
        values.put("notification_key", sbn.getKey());
        values.put("posted_at", sbn.getPostTime());
        values.put("captured_at", System.currentTimeMillis());
        values.put("origin", origin);
        values.put("title", title);
        values.put("text", text);
        values.put("big_text", bigText);
        values.put("sub_text", subText);
        values.put("lines", lines);
        values.put("fingerprint", fingerprint(packageName, sbn.getKey(), title, text, bigText, lines));
        return db.insertNotification(values);
    }

    // A messenger (an SMS app among them) keeps the newest message last in its MessagingStyle; an
    // inbox-style notification lists its lines instead of one text
    private static String lines(Notification notification) {
        NotificationCompat.MessagingStyle messaging = NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(notification);
        if (messaging != null) {
            List<NotificationCompat.MessagingStyle.Message> messages = messaging.getMessages();
            if (!messages.isEmpty()) return string(messages.get(messages.size() - 1).getText());
        }

        CharSequence[] textLines = notification.extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (textLines == null || textLines.length == 0) return null;
        StringBuilder joined = new StringBuilder();
        for (CharSequence line : textLines) {
            if (joined.length() > 0) joined.append('\n');
            joined.append(line);
        }
        return string(joined);
    }

    private static String string(CharSequence value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private static String fingerprint(String... parts) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String part : parts) {
                if (part != null) digest.update(part.getBytes(StandardCharsets.UTF_8));
                // Keeps ("ab", null) and ("a", "b") apart
                digest.update((byte) 0);
            }
            StringBuilder hex = new StringBuilder();
            for (byte b : digest.digest()) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            // Every Android has SHA-256
            throw new IllegalStateException(e);
        }
    }
}

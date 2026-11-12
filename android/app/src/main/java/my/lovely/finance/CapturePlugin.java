package my.lovely.finance;

import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.provider.Telephony;
import android.service.notification.NotificationListenerService;
import android.util.Base64;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * The app side of notification capture: the access of the listener, the apps it listens to, the
 * capture queue as a journal and its move into the drafts of the app (ADR-0003). The JavaScript half
 * is {@code services/capture}, the registration is in {@code MainActivity}.
 *
 * <p>Notification access has no permission dialog: the system grants it only on its own settings
 * page. From Android 11 that page can be opened on the switch of this one listener; below it — and
 * where a vendor build has no such page — on the list of every listener, then on «App info».
 */
@CapacitorPlugin(name = "Capture")
public class CapturePlugin extends Plugin {
    private static final int MAX_LIMIT = 500;
    // The list shows the icon at 2.5rem: 96px stays sharp on a phone and keeps ~150 icons small
    private static final int ICON_SIZE_PX = 96;

    @Override
    public void load() {
        CaptureListenerService.setChangeListener(() -> getBridge().executeOnMainThread(() -> notifyListeners("changed", new JSObject())));
    }

    @Override
    protected void handleOnDestroy() {
        CaptureListenerService.setChangeListener(null);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("accessGranted", NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.getPackageName()));
        result.put("listenerConnected", CaptureListenerService.isConnected());
        result.put("sdkInt", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        boolean opened = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent listener = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            listener.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, listenerComponent().flattenToString());
            opened = start(listener);
        }
        if (!opened) opened = start(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) || start(appDetails());

        JSObject result = new JSObject();
        result.put("opened", opened);
        call.resolve(result);
    }

    // «App info», where Android 13+ hides «Allow restricted settings» for an APK installed from a file
    @PluginMethod
    public void openAppDetails(PluginCall call) {
        JSObject result = new JSObject();
        result.put("opened", start(appDetails()));
        call.resolve(result);
    }

    @PluginMethod
    public void requestRebind(PluginCall call) {
        try {
            NotificationListenerService.requestRebind(listenerComponent());
            CaptureDatabase.get(getContext()).insertListenerEvent(CaptureDatabase.EVENT_REBIND_REQUESTED);
            call.resolve();
        } catch (RuntimeException e) {
            call.reject("Failed to request a rebind of the notification listener", e);
        }
    }

    // The apps with an icon in the launcher: the bank apps and the SMS app are among them, and their
    // visibility needs only the <queries> entry of the manifest, not QUERY_ALL_PACKAGES
    @PluginMethod
    public void getLaunchableApps(PluginCall call) {
        PackageManager packageManager = getContext().getPackageManager();
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        Set<String> packageNames = new LinkedHashSet<>();
        for (ResolveInfo info : packageManager.queryIntentActivities(launcher, 0)) {
            String packageName = info.activityInfo.applicationInfo.packageName;
            if (!packageName.equals(getContext().getPackageName())) packageNames.add(packageName);
        }

        String defaultSms = Telephony.Sms.getDefaultSmsPackage(getContext());
        JSArray apps = new JSArray();
        for (String packageName : packageNames) apps.put(app(packageName, defaultSms));
        JSObject result = new JSObject();
        result.put("apps", apps);
        call.resolve(result);
    }

    @PluginMethod
    public void getSources(PluginCall call) {
        String defaultSms = Telephony.Sms.getDefaultSmsPackage(getContext());
        JSArray sources = new JSArray();
        for (String packageName : CaptureDatabase.get(getContext()).getSources()) {
            sources.put(app(packageName, defaultSms));
        }
        JSObject result = new JSObject();
        result.put("sources", sources);
        call.resolve(result);
    }

    // One app at a time rather than the whole list: two quick taps cannot overwrite each other
    @PluginMethod
    public void setSourceEnabled(PluginCall call) {
        String packageName = call.getString("packageName");
        Boolean enabled = call.getBoolean("enabled");
        if (packageName == null || enabled == null) {
            call.reject("packageName and enabled are required");
            return;
        }
        CaptureDatabase.get(getContext()).setSourceEnabled(packageName, enabled);
        call.resolve();
    }

    @PluginMethod
    public void getNotifications(PluginCall call) {
        Map<String, String> labels = new HashMap<>();
        JSArray notifications = new JSArray();
        try (Cursor cursor = CaptureDatabase.get(getContext()).queryNotifications(limit(call))) {
            while (cursor.moveToNext()) notifications.put(notification(cursor, labels));
        }
        JSObject result = new JSObject();
        result.put("notifications", notifications);
        call.resolve(result);
    }

    // What the app has not moved into its drafts yet, oldest first (ADR-0003). Called on every start
    // and return to the app, so a failure of the queue rejects the call instead of ending the process
    @PluginMethod
    public void getPendingNotifications(PluginCall call) {
        Map<String, String> labels = new HashMap<>();
        JSArray notifications = new JSArray();
        try (Cursor cursor = CaptureDatabase.get(getContext()).queryPendingNotifications(limit(call))) {
            while (cursor.moveToNext()) {
                JSObject notification = notification(cursor, labels);
                notification.put("fingerprint", cursor.getString(10));
                notifications.put(notification);
            }
        } catch (RuntimeException e) {
            call.reject("Failed to read the pending notifications of the capture queue", e);
            return;
        }
        JSObject result = new JSObject();
        result.put("notifications", notifications);
        call.resolve(result);
    }

    // Only after the drafts of a batch are committed: the queue stops handing out every notification
    // up to this id
    @PluginMethod
    public void acknowledgeNotifications(PluginCall call) {
        // An id that fits an int arrives as an Integer, and getLong answers null for it
        Object upToId = call.getData().opt("upToId");
        if (!(upToId instanceof Number)) {
            call.reject("upToId is required");
            return;
        }
        try {
            CaptureDatabase.get(getContext()).acknowledgeNotifications(((Number) upToId).longValue());
            call.resolve();
        } catch (RuntimeException e) {
            call.reject("Failed to acknowledge the notifications of the capture queue", e);
        }
    }

    @PluginMethod
    public void getSkippedNotifications(PluginCall call) {
        Map<String, String> labels = new HashMap<>();
        JSArray skipped = new JSArray();
        try (Cursor cursor = CaptureDatabase.get(getContext()).querySkippedNotifications(limit(call))) {
            while (cursor.moveToNext()) {
                String packageName = cursor.getString(1);
                JSObject notification = new JSObject();
                notification.put("id", cursor.getLong(0));
                notification.put("packageName", packageName);
                notification.put("appLabel", label(packageName, labels));
                notification.put("postedAt", cursor.getLong(2));
                skipped.put(notification);
            }
        }
        JSObject result = new JSObject();
        result.put("skipped", skipped);
        call.resolve(result);
    }

    @PluginMethod
    public void getListenerEvents(PluginCall call) {
        JSArray events = new JSArray();
        try (Cursor cursor = CaptureDatabase.get(getContext()).queryListenerEvents(limit(call))) {
            while (cursor.moveToNext()) {
                JSObject event = new JSObject();
                event.put("id", cursor.getLong(0));
                event.put("kind", cursor.getString(1));
                event.put("at", cursor.getLong(2));
                event.put("uptimeMs", cursor.getLong(3));
                events.put(event);
            }
        }
        JSObject result = new JSObject();
        result.put("events", events);
        call.resolve(result);
    }

    // A row of the notifications table read in the journal column order
    private JSObject notification(Cursor cursor, Map<String, String> labels) {
        String packageName = cursor.getString(1);
        JSObject notification = new JSObject();
        notification.put("id", cursor.getLong(0));
        notification.put("packageName", packageName);
        notification.put("appLabel", label(packageName, labels));
        notification.put("postedAt", cursor.getLong(2));
        notification.put("capturedAt", cursor.getLong(3));
        notification.put("origin", cursor.getString(4));
        notification.put("title", cursor.getString(5));
        notification.put("text", cursor.getString(6));
        notification.put("bigText", cursor.getString(7));
        notification.put("subText", cursor.getString(8));
        notification.put("lines", cursor.getString(9));
        return notification;
    }

    private ComponentName listenerComponent() {
        return new ComponentName(getContext(), CaptureListenerService.class);
    }

    private Intent appDetails() {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
    }

    // `resolveActivity` answers nothing for the settings of other packages on API 30+ without a
    // <queries> entry, so the start itself is the test
    private boolean start(Intent intent) {
        try {
            getActivity().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    private static int limit(PluginCall call) {
        return Math.max(1, Math.min(MAX_LIMIT, call.getInt("limit", 50)));
    }

    // The default SMS app is marked: an SMS app the person never opens looks like the one they use
    private JSObject app(String packageName, String defaultSmsPackage) {
        PackageManager packageManager = getContext().getPackageManager();
        String label = packageName;
        String icon = null;
        try {
            ApplicationInfo application = packageManager.getApplicationInfo(packageName, 0);
            label = application.loadLabel(packageManager).toString();
            icon = iconDataUrl(application.loadIcon(packageManager));
        } catch (PackageManager.NameNotFoundException e) {
            // Removed since it was chosen: the package name stands for the label, with no icon
        }

        JSObject app = new JSObject();
        app.put("packageName", packageName);
        app.put("label", label);
        app.put("icon", icon);
        app.put("isDefaultSms", packageName.equals(defaultSmsPackage));
        return app;
    }

    private static String iconDataUrl(Drawable drawable) {
        try {
            Bitmap bitmap = Bitmap.createBitmap(ICON_SIZE_PX, ICON_SIZE_PX, Bitmap.Config.ARGB_8888);
            drawable.setBounds(0, 0, ICON_SIZE_PX, ICON_SIZE_PX);
            drawable.draw(new Canvas(bitmap));
            ByteArrayOutputStream png = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, png);
            bitmap.recycle();
            return "data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP);
        } catch (RuntimeException e) {
            // An icon that does not draw leaves the row without one rather than the list empty
            return null;
        }
    }

    // An app removed since it was chosen keeps its package name as the label
    private String label(String packageName, Map<String, String> cache) {
        String cached = cache.get(packageName);
        if (cached != null) return cached;
        PackageManager packageManager = getContext().getPackageManager();
        String label;
        try {
            label = packageManager.getApplicationLabel(packageManager.getApplicationInfo(packageName, 0)).toString();
        } catch (PackageManager.NameNotFoundException e) {
            label = packageName;
        }
        cache.put(packageName, label);
        return label;
    }
}

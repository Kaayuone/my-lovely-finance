package my.lovely.finance;

import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The app side of notification capture: the access of the listener, the apps it listens to and the
 * capture queue as a journal (ADR-0003). The JavaScript half is {@code services/capture}, the
 * registration is in {@code MainActivity}.
 *
 * <p>Notification access has no permission dialog: the system grants it only on its own settings
 * page. From Android 11 that page can be opened on the switch of this one listener; below it — and
 * where a vendor build has no such page — on the list of every listener, then on «App info».
 */
@CapacitorPlugin(name = "Capture")
public class CapturePlugin extends Plugin {
    private static final int MAX_LIMIT = 500;

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
        Map<String, String> labels = new LinkedHashMap<>();
        for (ResolveInfo info : packageManager.queryIntentActivities(launcher, 0)) {
            ApplicationInfo application = info.activityInfo.applicationInfo;
            if (application.packageName.equals(getContext().getPackageName())) continue;
            if (!labels.containsKey(application.packageName)) {
                labels.put(application.packageName, application.loadLabel(packageManager).toString());
            }
        }

        JSArray apps = new JSArray();
        for (Map.Entry<String, String> entry : labels.entrySet()) apps.put(app(entry.getKey(), entry.getValue()));
        JSObject result = new JSObject();
        result.put("apps", apps);
        call.resolve(result);
    }

    @PluginMethod
    public void getSources(PluginCall call) {
        Map<String, String> labels = new HashMap<>();
        JSArray sources = new JSArray();
        for (String packageName : CaptureDatabase.get(getContext()).getSources()) {
            sources.put(app(packageName, label(packageName, labels)));
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
            while (cursor.moveToNext()) {
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
                notifications.put(notification);
            }
        }
        JSObject result = new JSObject();
        result.put("notifications", notifications);
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

    private static JSObject app(String packageName, String label) {
        JSObject app = new JSObject();
        app.put("packageName", packageName);
        app.put("label", label);
        return app;
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

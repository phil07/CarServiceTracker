package de.philipp07.carservicetracker;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.Constraints;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

// Speichert die fälligen Wartungen (Momentaufnahme aus der Web-App) und startet den Hintergrund-Job,
// der auch läuft, wenn die App geschlossen ist.
@CapacitorPlugin(name = "ReminderStore")
public class ReminderStorePlugin extends Plugin {

    static final String PREFS = "reminders";
    static final String KEY_JSON = "snapshot";
    static final String WORK_NAME = "service-reminders";

    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json fehlt");
            return;
        }
        prefs(getContext()).edit().putString(KEY_JSON, json).apply();
        PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(ReminderWorker.class, 12, TimeUnit.HOURS).build();
        WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, work);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        prefs(getContext()).edit().remove(KEY_JSON).apply();
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK_NAME);
        call.resolve();
    }

    // Schalter „Bei neuer Version benachrichtigen“: prüft alle 12 Stunden auf neue GitHub-Releases.
    @PluginMethod
    public void setUpdateCheck(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        String version = call.getString("version", "");
        prefs(getContext()).edit().putBoolean("updateNotify", enabled).putString("currentVersion", version).apply();
        if (enabled) {
            Constraints c = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
            PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(ReleaseCheckWorker.class, 12, TimeUnit.HOURS).setConstraints(c).build();
            WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork("release-check", ExistingPeriodicWorkPolicy.KEEP, work);
        } else {
            WorkManager.getInstance(getContext()).cancelUniqueWork("release-check");
        }
        call.resolve();
    }

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}

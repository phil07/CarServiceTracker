package de.philipp07.carservicetracker;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Scanner;

// Prüft im Hintergrund auf eine neuere GitHub-Release und meldet sie einmal.
public class ReleaseCheckWorker extends Worker {

    private static final String CHANNEL = "app-updates";
    private static final int NOTIFICATION_ID = 4712;
    private static final String REPO = "phil07/CarServiceTracker";

    public ReleaseCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences sp = ReminderStorePlugin.prefs(ctx);
        if (!sp.getBoolean("updateNotify", false)) return Result.success();
        int current = number(sp.getString("currentVersion", ""));
        if (current == 0) return Result.success();
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL("https://api.github.com/repos/" + REPO + "/releases/latest").openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("Accept", "application/vnd.github+json");
            if (conn.getResponseCode() != 200) return Result.success();
            String body;
            try (InputStream in = conn.getInputStream()) {
                body = new Scanner(in, "UTF-8").useDelimiter("\\A").next();
            }
            String tag = new JSONObject(body).optString("tag_name", "");
            if (number(tag) <= current) return Result.success();
            if (tag.equals(sp.getString("notifiedTag", ""))) return Result.success();
            if (Build.VERSION.SDK_INT >= 33
                    && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                return Result.success();
            }
            if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return Result.success();
            show(ctx, tag);
            sp.edit().putString("notifiedTag", tag).apply();
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    static int number(String v) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+)").matcher(v == null ? "" : v);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private void show(Context ctx, String tag) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "App-Updates", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Neue Versionen der App");
            nm.createNotificationChannel(ch);
        }
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = PendingIntent.getActivity(ctx, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("Neue Version " + tag)
                .setContentText("Öffne die App und tippe auf Installieren.")
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        nm.notify(NOTIFICATION_ID, n);
    }
}

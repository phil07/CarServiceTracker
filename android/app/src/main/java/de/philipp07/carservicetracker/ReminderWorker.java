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

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;

// Prüft die gespeicherte Momentaufnahme und zeigt höchstens einmal pro Tag eine Benachrichtigung.
public class ReminderWorker extends Worker {

    private static final String CHANNEL = "service-reminders";
    private static final int NOTIFICATION_ID = 4711;

    public ReminderWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences sp = ReminderStorePlugin.prefs(ctx);
        String raw = sp.getString(ReminderStorePlugin.KEY_JSON, null);
        if (raw == null) return Result.success();

        try {
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            List<JSONObject> due = new ArrayList<>();
            JSONArray items = new JSONObject(raw).optJSONArray("items");
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject it = items.getJSONObject(i);
                    String from = it.optString("from", "");
                    // Ohne Datum (z. B. kilometerbasiert) gibt es hier nichts zu prüfen.
                    if (from.isEmpty() || from.compareTo(today) > 0) continue;
                    due.add(it);
                }
            }
            if (due.isEmpty()) return Result.success();

            StringBuilder sig = new StringBuilder();
            List<String> lines = new ArrayList<>();
            for (JSONObject it : due) {
                String key = it.optString("key");
                boolean overdue = !it.optString("due", "").isEmpty() && it.optString("due").compareTo(today) < 0;
                sig.append(key).append(overdue ? ":o," : ":w,");
                lines.add((overdue ? "⚠️ " : "") + it.optString("category") + " – " + it.optString("vehicle")
                        + (overdue ? " (überfällig)" : ""));
            }
            Collections.sort(lines);
            String signature = sig.toString();

            // Heute schon mit genau diesen Fälligkeiten benachrichtigt? Dann nicht erneut.
            if (today.equals(sp.getString("lastDay", "")) && signature.equals(sp.getString("lastSig", ""))) {
                return Result.success();
            }
            if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return Result.success();
            if (Build.VERSION.SDK_INT >= 33
                    && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                return Result.success();
            }

            show(ctx, due.size(), lines);
            sp.edit().putString("lastDay", today).putString("lastSig", signature).apply();
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private void show(Context ctx, int count, List<String> lines) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Erinnerungen", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Fällige Wartungen und Fristen");
            nm.createNotificationChannel(ch);
        }
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        StringBuilder body = new StringBuilder();
        for (int i = 0; i < lines.size() && i < 5; i++) {
            if (i > 0) body.append('\n');
            body.append(lines.get(i));
        }
        if (lines.size() > 5) body.append("\n… und ").append(lines.size() - 5).append(" weitere");
        String title = count == 1 ? "Wartung fällig" : count + " Wartungen fällig";
        Notification n = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(lines.get(0))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body.toString()))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        nm.notify(NOTIFICATION_ID, n);
    }
}

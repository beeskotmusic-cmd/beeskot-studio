package com.beeskot.studio;

// BEESKOT · le facteur du téléphone.
// Il reçoit les messages de Firebase et fabrique lui-même la notification,
// pour pouvoir y mettre le rond DARI brodé en couleur (la « grande image » à droite).
//   · appli à l'écran : on laisse l'appli afficher son petit message (comme avant), pas de notification ;
//   · appli en fond ou fermée : vraie notification (petite icône blanche + rond DARI en couleur).
// Les anciens messages « notification » de Google (anciennes appli) passent toujours par le chemin normal.

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class Facteur extends MessagingService {

    private static final String CANAL = "beeskot";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage m) {
        Map<String, String> d = m.getData();
        // ancien format (Google affiche lui-même) ou message sans titre : comportement d'avant
        if (m.getNotification() != null || d == null || !d.containsKey("titre")) { super.onMessageReceived(m); return; }
        // appli à l'écran : l'appli montre son petit message, pas de notification en double
        if (aLEcran()) { super.onMessageReceived(m); return; }
        try { montrer(d); } catch (Exception e) { /* jamais planter pour une notification */ }
    }

    private boolean aLEcran() {
        ActivityManager.RunningAppProcessInfo p = new ActivityManager.RunningAppProcessInfo();
        ActivityManager.getMyMemoryState(p);
        return p.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND;
    }

    private void montrer(Map<String, String> d) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel c = new NotificationChannel(CANAL, "BEESKOT Studio", NotificationManager.IMPORTANCE_HIGH);
            c.setDescription("Tâches, rendez-vous, notes et morceaux du groupe");
            nm.createNotificationChannel(c);
        }
        String titre = d.get("titre"), texte = d.containsKey("texte") ? d.get("texte") : "", id = d.containsKey("id") ? d.get("id") : "";
        String onglet = d.containsKey("onglet") ? d.get("onglet") : "accueil";

        // toucher la notification : ouvre l'appli sur le bon onglet (l'appli lit « onglet » comme avant)
        Intent ouvrir = new Intent(this, MainActivity.class);
        ouvrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        ouvrir.putExtra("google.message_id", id.isEmpty() ? String.valueOf(System.currentTimeMillis()) : id);
        ouvrir.putExtra("onglet", onglet);
        int num = (id.isEmpty() ? String.valueOf(System.nanoTime()) : id).hashCode();
        PendingIntent pi = PendingIntent.getActivity(this, num, ouvrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Bitmap rond = BitmapFactory.decodeResource(getResources(), R.drawable.notif_rond_dari);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_notif)
            .setColor(ContextCompat.getColor(this, R.color.notifRouge))
            .setLargeIcon(rond)
            .setContentTitle(titre)
            .setContentText(texte)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(texte))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi);
        // même fiche = même notification (elle se remplace au lieu de s'empiler)
        nm.notify(id.isEmpty() ? "beeskot" : id, id.isEmpty() ? (int) (System.currentTimeMillis() % 100000) : 1, b.build());
    }
}

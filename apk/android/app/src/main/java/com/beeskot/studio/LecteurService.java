package com.beeskot.studio;

// BEESKOT · le petit lecteur d'Android (écran verrouillé, haut de l'écran, écouteurs).
// Il vit tant qu'un son est en cours : il garde l'appli éveillée pour que la musique continue
// quand l'appli est fermée, et il renvoie les boutons à l'appli (LecteurPlugin).

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

public class LecteurService extends Service {

    static class Etat { String titre = "BEESKOT Studio", sousTitre = "BEESKOT"; boolean joue, prec, suiv; double t, d; }

    static LecteurService moi;
    static Etat enAttente;

    private static final String CANAL = "beeskot-lecteur";
    private static final int NUM = 4242;
    private MediaSessionCompat session;
    private Etat etat = new Etat();
    private Bitmap rond;
    private boolean devant;

    @Override
    public void onCreate() {
        super.onCreate();
        moi = this;
        rond = BitmapFactory.decodeResource(getResources(), R.drawable.notif_rond_dari);
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel c = new NotificationChannel(CANAL, "Lecteur", NotificationManager.IMPORTANCE_LOW);   // sans son ni vibration
            c.setDescription("Le morceau en cours, avec lecture / pause");
            c.setShowBadge(false);
            nm.createNotificationChannel(c);
        }
        session = new MediaSessionCompat(this, "BEESKOT");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { LecteurPlugin.action("jouer", 0); }
            @Override public void onPause() { LecteurPlugin.action("pause", 0); }
            @Override public void onSkipToNext() { LecteurPlugin.action("suiv", 0); }
            @Override public void onSkipToPrevious() { LecteurPlugin.action("prec", 0); }
            @Override public void onSeekTo(long ms) { LecteurPlugin.action("aller", ms / 1000.0); }
            @Override public void onStop() { LecteurPlugin.action("arreter", 0); }
        });
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String a = intent != null ? intent.getAction() : null;
        if (a != null) {                                            // un bouton du petit lecteur
            if ("jouer".equals(a)) LecteurPlugin.action(etat.joue ? "pause" : "jouer", 0);
            else LecteurPlugin.action(a, 0);
            if ("arreter".equals(a)) arreter();
            else if (!devant) montrer(etat);                        // Android exige qu'on se remontre vite
            return START_NOT_STICKY;
        }
        montrer(enAttente != null ? enAttente : etat);
        enAttente = null;
        return START_NOT_STICKY;
    }

    void montrer(Etat e) {
        etat = e;
        long d = Math.max(0, Math.round(e.d * 1000)), t = Math.max(0, Math.round(e.t * 1000));
        session.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, e.titre)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, e.sousTitre)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, rond)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, d > 0 ? d : -1)
            .build());
        long gestes = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_STOP;
        if (d > 0) gestes |= PlaybackStateCompat.ACTION_SEEK_TO;
        if (e.prec) gestes |= PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;
        if (e.suiv) gestes |= PlaybackStateCompat.ACTION_SKIP_TO_NEXT;
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(gestes)
            .setState(e.joue ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, t, e.joue ? 1f : 0f)
            .build());

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(R.drawable.ic_notif)
            .setColor(ContextCompat.getColor(this, R.color.notifRouge))
            .setLargeIcon(rond)
            .setContentTitle(e.titre)
            .setContentText(e.sousTitre)
            .setContentIntent(ouvrirAppli())
            .setDeleteIntent(bouton("arreter", 5))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setOngoing(e.joue);
        int n = 0; int[] compact;
        if (e.prec) { b.addAction(android.R.drawable.ic_media_previous, "Précédent", bouton("prec", 1)); n++; }
        b.addAction(e.joue ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, e.joue ? "Pause" : "Lecture", bouton("jouer", 2));
        int iJouer = n; n++;
        if (e.suiv) { b.addAction(android.R.drawable.ic_media_next, "Suivant", bouton("suiv", 3)); n++; }
        compact = n == 3 ? new int[]{0, 1, 2} : n == 2 ? new int[]{0, 1} : new int[]{iJouer};
        b.setStyle(new androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(compact));
        Notification notif = b.build();

        if (e.joue) {                                               // en lecture : on reste « devant » pour que la musique continue
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
            ServiceCompat.startForeground(this, NUM, notif, type);
            devant = true;
        } else {                                                    // en pause : le petit lecteur reste, mais on peut le balayer
            if (devant) { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH); devant = false; }
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NUM, notif);
        }
    }

    void arreter() {
        if (devant) { ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE); devant = false; }
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NUM);
        stopSelf();
    }

    private PendingIntent bouton(String a, int code) {
        Intent i = new Intent(this, LecteurService.class).setAction(a);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private PendingIntent ouvrirAppli() {
        Intent i = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 9, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) { LecteurPlugin.action("pause", 0); arreter(); super.onTaskRemoved(rootIntent); }   // l'appli balayée : on s'arrête

    @Override
    public void onDestroy() { if (session != null) { session.setActive(false); session.release(); } moi = null; super.onDestroy(); }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}

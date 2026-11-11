package com.beeskot.studio;

// BEESKOT · le pont entre le lecteur de l'appli (le mini-lecteur du bas) et le petit lecteur d'Android.
//   JS → Android : Lecteur.maj({ titre, sousTitre, joue, t, d, prec, suiv })   (t et d en secondes)
//                  Lecteur.arreter()
//   Android → JS : événement « action » { action: 'jouer' | 'pause' | 'prec' | 'suiv' | 'aller' | 'arreter', t }

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Lecteur")
public class LecteurPlugin extends Plugin {

    static LecteurPlugin moi;

    @Override
    public void load() { moi = this; }

    // appelé par le service quand on touche un bouton du petit lecteur (ou des écouteurs)
    static void action(String a, double t) {
        LecteurPlugin p = moi; if (p == null) return;
        JSObject o = new JSObject(); o.put("action", a); o.put("t", t);
        p.notifyListeners("action", o, true);
    }

    @PluginMethod
    public void maj(PluginCall call) {
        LecteurService.Etat e = new LecteurService.Etat();
        e.titre = call.getString("titre", "BEESKOT Studio");
        e.sousTitre = call.getString("sousTitre", "BEESKOT");
        e.joue = Boolean.TRUE.equals(call.getBoolean("joue", false));
        e.t = call.getDouble("t", 0.0);
        e.d = call.getDouble("d", 0.0);
        e.prec = Boolean.TRUE.equals(call.getBoolean("prec", false));
        e.suiv = Boolean.TRUE.equals(call.getBoolean("suiv", false));
        try {
            LecteurService s = LecteurService.moi;
            if (s != null) s.montrer(e);
            else if (e.joue) {                                       // on ne démarre le service qu'au moment où un son commence (appli à l'écran)
                LecteurService.enAttente = e;
                ContextCompat.startForegroundService(getContext(), new Intent(getContext(), LecteurService.class));
            }
            call.resolve();
        } catch (Exception ex) { call.reject("lecteur : " + ex.getMessage()); }
    }

    @PluginMethod
    public void arreter(PluginCall call) {
        LecteurService s = LecteurService.moi; if (s != null) s.arreter();
        LecteurService.enAttente = null;
        call.resolve();
    }
}

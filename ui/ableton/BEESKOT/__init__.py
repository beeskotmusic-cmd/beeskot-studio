# =====================================================================
# BEESKOT Studio — petit « pont » pour Ableton Live 12.
# Ableton le charge comme une surface de contrôle (Préférences > Link, Tempo & MIDI).
# Il écoute uniquement sur CE PC (127.0.0.1, port 9877) et répond à BEESKOT Studio :
#   lire les pistes, les renommer, les colorer, vérifier qu'elles sont gelées.
# Il ne fait rien tout seul et ne touche jamais aux fichiers.
# =====================================================================
from __future__ import absolute_import
import socket
import json

try:
    from _Framework.ControlSurface import ControlSurface
except ImportError:                       # (hors d'Ableton, pour les essais)
    ControlSurface = object

PORT = 9877
VERSION = "2"


def create_instance(c_instance):
    return PontBeeskot(c_instance)


class PontBeeskot(ControlSurface):

    def __init__(self, c_instance):
        ControlSurface.__init__(self, c_instance)
        self._clients = []
        self._srv = None
        try:
            self._srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._srv.bind(("127.0.0.1", PORT))
            self._srv.listen(4)
            self._srv.setblocking(False)
            self.log_message("BEESKOT : pont prêt sur le port %d" % PORT)
        except Exception as e:
            self.log_message("BEESKOT : pont impossible à ouvrir : %s" % e)
            self._srv = None

    def disconnect(self):
        for c in self._clients:
            try:
                c[0].close()
            except Exception:
                pass
        if self._srv:
            self._srv.close()
        ControlSurface.disconnect(self)

    # Ableton appelle ceci environ 10 fois par seconde : on regarde s'il y a une demande.
    def update_display(self):
        ControlSurface.update_display(self)
        self.tic()

    def tic(self):
        if not self._srv:
            return
        try:
            c, _ = self._srv.accept()
            c.setblocking(False)
            self._clients.append([c, b""])
        except (BlockingIOError, OSError):
            pass
        for cl in list(self._clients):
            c = cl[0]
            try:
                data = c.recv(65536)
                if not data:
                    raise ConnectionError()
                cl[1] += data
                while b"\n" in cl[1]:
                    ligne, cl[1] = cl[1].split(b"\n", 1)
                    rep = self.traiter(ligne)
                    c.setblocking(True)
                    c.sendall((json.dumps(rep) + "\n").encode("utf-8"))
                    c.setblocking(False)
            except BlockingIOError:
                pass
            except Exception:
                try:
                    c.close()
                except Exception:
                    pass
                self._clients.remove(cl)

    # ---------------------------------------------------------------
    def traiter(self, ligne):
        try:
            req = json.loads(ligne.decode("utf-8"))
            cmd = req.get("cmd")
            if cmd == "ping":
                return {"ok": True, "version": VERSION, "tempo": self.song().tempo}
            if cmd == "pistes":
                return {"ok": True, "tempo": self.song().tempo, "pistes": self.pistes()}
            if cmd == "appliquer":
                return self.appliquer(req.get("pistes", []))
            if cmd == "capacites":
                return self.capacites()
            if cmd == "deplacer":
                return self.deplacer(int(req.get("de", -1)), int(req.get("vers", -1)))
            if cmd == "geler":
                return self.geler(int(req.get("i", -1)))
            return {"ok": False, "erreur": "commande inconnue"}
        except Exception as e:
            return {"ok": False, "erreur": str(e)}

    def pistes(self):
        out = []
        for i, t in enumerate(self.song().tracks):
            groupe = None
            try:
                if t.is_grouped and t.group_track:
                    groupe = t.group_track.name
            except Exception:
                pass
            out.append({
                "i": i,
                "nom": t.name,
                "couleur": t.color,
                "dossier": bool(getattr(t, "is_foldable", False)),
                "groupe": groupe,
                "midi": bool(getattr(t, "has_midi_input", False)),
                "gelee": bool(getattr(t, "is_frozen", False)),
                "gelable": bool(getattr(t, "can_be_frozen", False)),
            })
        return out

    def appliquer(self, liste):
        pistes = list(self.song().tracks)
        faits = 0
        for p in liste:
            i = int(p.get("i", -1))
            if i < 0 or i >= len(pistes):
                continue
            t = pistes[i]
            if p.get("ancien") is not None and t.name != p.get("ancien"):
                continue                      # la piste a changé entre-temps : on n'y touche pas
            if p.get("nom"):
                t.name = p["nom"]
            if p.get("couleur") is not None:
                t.color = int(p["couleur"])
            faits += 1
        return {"ok": True, "faits": faits}

    # ---------------------------------------------------------------
    # Le « détecteur » : ce que CETTE version d'Ableton permet vraiment
    def capacites(self):
        song = self.song()
        t0 = song.tracks[0] if len(song.tracks) else None
        noms_song = [n for n in dir(song) if not n.startswith("_")]
        noms_piste = [n for n in dir(t0) if not n.startswith("_")] if t0 else []
        deplacer = [n for n in noms_song if "move" in n.lower() and "track" in n.lower()]
        geler = [n for n in noms_piste if n.lower() in ("freeze", "freeze_track", "set_frozen")]
        return {"ok": True, "deplacer": deplacer, "geler": geler,
                "live": "%s.%s.%s" % (self.application().get_major_version(), self.application().get_minor_version(), self.application().get_bugfix_version()) if hasattr(self, "application") else "?"}

    def deplacer(self, de, vers):
        song = self.song()
        for n in ("move_track",):
            f = getattr(song, n, None)
            if f:
                f(de, vers)
                return {"ok": True}
        return {"ok": False, "erreur": "Ableton ne permet pas de déplacer les pistes depuis le pont"}

    def geler(self, i):
        pistes = list(self.song().tracks)
        if i < 0 or i >= len(pistes):
            return {"ok": False, "erreur": "piste inconnue"}
        for n in ("freeze", "freeze_track"):
            f = getattr(pistes[i], n, None)
            if f:
                f()
                return {"ok": True}
        return {"ok": False, "erreur": "Ableton ne permet pas de geler depuis le pont"}

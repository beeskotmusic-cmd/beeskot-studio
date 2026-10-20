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
VERSION = "1"


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

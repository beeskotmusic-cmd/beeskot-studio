#!/usr/bin/env python3
# Fabrique page.html (la page de l'invité, à coller chez Google) à partir de :
#   page.source.html (la mise en page) + page.script.html (le programme) + guest.css (le propre à l'invité).
# Le look vient des VRAIS fichiers du logiciel (ui/style, ui/look…), lus par la page sur GitHub via jsDelivr
# (gratuit, le dépôt est public) : si le look du logiciel change, la page suit en changeant le numéro de version ci-dessous.
# Usage : python3 fabriquer.py [numéro de commit]   puis recoller page.html chez Google (voir LISEZ-MOI).
import os, subprocess, sys
ICI = os.path.dirname(os.path.abspath(__file__))
def lire(p): return open(os.path.join(ICI, p), encoding='utf8').read()
commit = sys.argv[1] if len(sys.argv) > 1 else subprocess.check_output(['git', '-C', ICI, 'rev-parse', 'HEAD']).decode().strip()
BASE = 'https://cdn.jsdelivr.net/gh/beeskotmusic-cmd/beeskot-studio@%s/ui/' % commit
liens = ''.join('<link rel="stylesheet" href="%sstyle/%s.css">\n' % (BASE, f) for f in ('base', 'dari-look', 'beeskot', 'externe'))
css = lire('guest.css').replace('{{POUCE}}', BASE + 'pictos/A_pouce.png')
out = lire('page.source.html').replace('{{CSS}}', css).replace('{{LINKS}}', liens).replace('{{SCRIPT}}', lire('page.script.html')).replace('{{LOGO}}', BASE + 'look/logo-beeskot-studio.png')
assert '{{' not in out
open(os.path.join(ICI, 'page.html'), 'w', encoding='utf8').write(out)
print('page.html :', round(len(out) / 1024), 'Ko, look =', commit[:7])

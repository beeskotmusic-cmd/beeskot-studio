#!/usr/bin/env python3
"""Fabrique ui/lighttoast/toast.html à partir de toast-original.html (le TOAST de Pierre / Dari).
Pour une nouvelle version de TOAST : remplacer toast-original.html puis lancer  python3 adapter.py
Ce qu'il change : retire l'en-tête parasite, polices locales, mp4-muxer local, pistes audio en plus (stems),
pont avec BEESKOT Studio (enregistrer sur le Drive), cadre masqué quand TOAST est dans l'onglet,
+ habillage.css (même look que le logiciel) et lecteur.js (musique Bibliothèque/Médias/PC, vues, lecture, plein écran, pictos)."""
import re, os, sys
ici = os.path.dirname(os.path.abspath(__file__))
lire = lambda n: open(os.path.join(ici, n), encoding='utf8').read()
s = lire('toast-original.html')

def remplace(a, b, n=1):
    global s
    if a not in s: sys.exit('INTROUVABLE : ' + a[:80])
    s = s.replace(a, b, n)

# 1. l'en-tête parasite (première ligne) et la fin en double
lignes = s.split('\n')
if lignes[0].startswith('<!doctype html><html><head>'): s = '\n'.join(lignes[1:])
s = re.sub(r'</script></body></html>\s*</body></html>\s*$', '</script></body></html>\n', s)
# 2. polices du logiciel (fichiers locaux, pas internet)
s = re.sub(r'<link rel="preconnect"[^>]*><link rel="preconnect"[^>]*><link href="https://fonts\.googleapis\.com[^>]*>', '<link rel="stylesheet" href="../style/fonts.css">', s, count=1)
s = s.replace('"Barlow Semi Condensed"', '"Work Sans"').replace("'Barlow Semi Condensed'", "'Work Sans'").replace('Barlow Semi Condensed', 'Work Sans')
# 3. mp4-muxer : le fichier du dossier d'abord, internet en secours
remplace('const vs=["5.1.3"', 'const loc=true;const vs=["5.1.3"')
remplace('const next=()=>{if(k>=vs.length)return res(false);const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/mp4-muxer@"+vs[k++]+"/build/mp4-muxer.js";',
         'let first=true;const next=()=>{if(k>=vs.length&&!first)return res(false);const s=document.createElement("script");if(first){first=false;s.src="mp4-muxer.js"}else s.src="https://cdn.jsdelivr.net/npm/mp4-muxer@"+vs[k++]+"/build/mp4-muxer.js";')
# 4. pistes audio en plus : le panneau
remplace('<input type="file" id="pfile" accept=".json,application/json" hidden></section>', '<input type="file" id="pfile" accept=".json,application/json" hidden></section>\n' + lire('stems.html'))
# 5. enregistrer sur le Drive : le choix dans la section 1
remplace('<input type="checkbox" id="psa" checked> avec l\'audio</label>', '<input type="checkbox" id="psa" checked> avec l\'audio</label>' + lire('dbs.html').strip())
remplace('async function writeProject(name,blob){', 'async function writeProject(name,blob){\n  if(toDrive()){await DBS.envoyer(blob,name,"Projets");return name+" (Drive)"}')
remplace('const a=$("dl");const bl=new Blob(ch,{type:mt});', 'const a=$("dl");const bl=new Blob(ch,{type:mt});setTimeout(()=>afterExport(bl,"video-led."+ext),0);')
remplace('dl._name=dl.download=is3?"video-3d.mp4":"video-led-"+mode+".mp4";', 'dl._name=dl.download=is3?"video-3d.mp4":"video-led-"+mode+".mp4";afterExport(bl,dl._name);')
# 6. les repères des pistes en plus sont gardés dans le projet
remplace('pal,ptypes,etypes,fxev,ecol};', 'pal,ptypes,etypes,fxev,ecol,stems:stemsSave(),membres:window.v3&&v3.getMembres?v3.getMembres():undefined,decor:window.v3&&v3.getDecor?v3.getDecor():undefined};')
remplace('manual=normPeches(o.manual,ptypes.length);', 'stemsLoad(o.stems);if(o.membres&&window.v3&&v3.setMembres)v3.setMembres(o.membres);if(o.decor&&window.v3&&v3.setDecor)v3.setDecor(o.decor);manual=normPeches(o.manual,ptypes.length);')
# 6b. vue 3D : modèle « STUDIO BEESKOT » + membres du groupe (scene3.js) — voir le haut de scene3.js
remplace('const XF={x:0,z:0,c:1,s:0};const setXF=(x,z,yaw)=>{XF.x=x;XF.z=z;XF.c=Math.cos(yaw);XF.s=Math.sin(yaw)};\nconst V=(p,n,c,id)=>A.push(p[0]*XF.c+p[2]*XF.s+XF.x,p[1],-p[0]*XF.s+p[2]*XF.c+XF.z,',
         'const XF={x:0,z:0,c:1,s:0,k:1};const setXF=(x,z,yaw,k=1)=>{XF.x=x;XF.z=z;XF.c=Math.cos(yaw);XF.s=Math.sin(yaw);XF.k=k};\nconst V=(p,n,c,id)=>A.push(p[0]*XF.k*XF.c+p[2]*XF.k*XF.s+XF.x,p[1]*XF.k,-p[0]*XF.k*XF.s+p[2]*XF.k*XF.c+XF.z,')
remplace('function human(o){setXF(o.x,o.z,o.yaw||0);', 'function human(o){setXF(o.x,o.z,o.yaw||0,o.k||1);')
remplace('if(o.prop)o.prop();', 'humanPlus(o,H,hy);if(o.prop)o.prop();')
remplace(' ell(0,hy-.018,.094', ' if(!o.sil){ell(0,hy-.018,.094')   # en silhouette : pas de nez, yeux, lèvres (ils feraient des contours bizarres)
remplace('HR,8,4);mat0(.22,16)});', 'HR,8,4);mat0(.22,16)})}')
remplace('const P=path3(Hp,K,An,6);mat0(.05,6);sweep(P.map(q=>q.p),P.map(q=>prof(LS,q.s)),PA,14);ell(K[0],K[1],K[2],.066,.066,.066,PA,10,8);',
         'const P=path3(Hp,K,An,6);if(o.short){mat0(.22,16);sweep(P.map(q=>q.p),P.map(q=>prof(LP,q.s)*.92),SK,14);ell(K[0],K[1],K[2],.058,.058,.058,SK,10,8);const P2=path3(Hp,K,An,6,.42);mat0(.05,6);sweep(P2.map(q=>q.p),P2.map(q=>prof(LS,q.s)+.014),PA,14);if(o.chaussettes){const P3=path3(Hp,K,An,6,1,.82);sweep(P3.map(q=>q.p),P3.map(q=>prof(LP,q.s)*.92+.006),o.chaussettes,12)}}else{mat0(.05,6);sweep(P.map(q=>q.p),P.map(q=>prof(LS,q.s)),PA,14);ell(K[0],K[1],K[2],.066,.066,.066,PA,10,8)}')
remplace('mat0(.06,6);\nconst ARM_STAND=', 'R.deco=[s0,cnt()-s0];\nmat0(.06,6);\nconst ARM_STAND=')
remplace('// guitariste assis en tailleur', 'R2.deco=[s0,cnt()-s0];\n// guitariste assis en tailleur')
remplace('const G=new Float32Array(A),NV=cnt();', lire('scene3.js') + '\nconst G=new Float32Array(A),NV=cnt();')
remplace('uniform vec2 uTP[${NT3}];', 'uniform vec2 uTP[${NT3}];uniform vec2 uTY[${NT3}];')
remplace('uniform vec3 uAm;', 'uniform vec3 uAm;uniform float uSi;')
remplace('float nv=clamp(dot(n,v),0.,1.);vec3 c=alb*lit+sp*.8+vE*1.15+alb*uAm*pow(1.-nv,3.)*2.2;', 'float nv=clamp(dot(n,v),0.,1.);vec3 c=uSi>.5?lit*(.025+.95*pow(1.-nv,2.2)):alb*lit+sp*.8+vE*1.15+alb*uAm*pow(1.-nv,3.)*2.2;')
remplace('float py=clamp(vP.y,.08,TH-.03);', 'float py=clamp(vP.y,uTY[i].x+.03,uTY[i].y-.03);')
remplace('float f=(TH-py)/HS-.5;', 'float f=(uTY[i].y-py)/((uTY[i].y-uTY[i].x)/${NS}.)-.5;')
remplace('function draw(){const{M:Mx,e}=view();', 'function draw(){setLights();const{M:Mx,e}=view();')
remplace('gl.uniform2fv(u.TP,TP);', 'gl.uniform2fv(u.TP,TP);setTY();')
remplace('const SC=SCN==2?R2:R;dr_(SC.floor);dr_(SC.wall);', 'const SC=SCN==3?R3:SCN==2?R2:R;dr_(SC.floor);dr_(SC.wall);if(membresActifs()&&SC.deco)dr_(SC.deco);')
remplace('TUBES.forEach(([x,z],i)=>{const a=', 'TUB().forEach(([x,z],i)=>{const a=')
remplace('gl.uniform4f(us.Pl,0,1,0,.004);dr_(SC.person);gl.uniform4f(us.Pl,0,0,1,WALLZ+.004);dr_(SC.person)}', 'gl.uniform4f(us.Pl,0,1,0,.004);drP(SC);gl.uniform4f(us.Pl,0,0,1,WALLZ+.004);drP(SC)}')
remplace('gl.useProgram(pg);dr_(R.tube);dr_(SC.person);', 'gl.useProgram(pg);drO();drP(SC);')
remplace('dr_(R.glow)', 'drG()')
remplace('<option value="1">OPP1</option><option value="2">MOTHER3</option></select>', '<option value="1">OPP1</option><option value="2">MOTHER3</option><option value="3">STUDIO BEESKOT</option></select>')
remplace('let SCN=1;try{if(localStorage.getItem("v3scn")=="2")SCN=2}catch(e){}', 'let SCN=3;try{const q=localStorage.getItem("v3scn");if(q=="1"||q=="2"||q=="3")SCN=+q;if(!localStorage.getItem("v3scn3")){SCN=3;localStorage.setItem("v3scn3","1")}}catch(e){}')
remplace('window.v3=({cam,draw,EM,setFmt,setScene,', 'window.v3=({cam,draw,EM,setFmt,setScene,getMembres:()=>JSON.parse(JSON.stringify(MEMB)),setMembres,...decorAPI,')
# 7. le code et le style ajoutés
remplace('</script></body></html>', lire('dbs.js') + '\n' + lire('stems.js') + '\n' + lire('lecteur.js') + '\n</script></body></html>')
remplace('</style>', lire('dbs.css') + '\n' + lire('habillage.css') + '\n</style>')
# 8. titre
open(os.path.join(ici, '..', 'ui', 'lighttoast', 'toast.html'), 'w', encoding='utf8').write(s)
print('ok', len(s), 'caractères')

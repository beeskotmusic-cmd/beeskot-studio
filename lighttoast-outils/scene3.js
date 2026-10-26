// ===== BEESKOT Studio : modèle 3 « STUDIO BEESKOT » + membres du groupe (poses, tenues, instruments) =====
// Inséré par adapter.py dans la vue 3D, juste avant la création du tampon WebGL (mêmes outils : box, cyl, ell, loft, sweep, human…).
// ---------- le studio (pièce des photos) ----------
const R3={},X3=1.45;  // le studio est étroit : les murs de côté sont au bord du tapis
const W3=[.72,.7,.65],RED3=[.62,.13,.08],WOOD3=[.6,.44,.27],MET3=[.2,.2,.22],BLK3=[.05,.05,.055];
mat0(.15,10);quad([-X3,0,FRONTZ],[X3,0,FRONTZ],[X3,0,WALLZ],[-X3,0,WALLZ],[0,1,0],[.52,.53,.55]);R3.floor=[cnt()-6,6];
s0=cnt();mat0(.08,8);
quad([-X3,0,WALLZ],[X3,0,WALLZ],[X3,3.2,WALLZ],[-X3,3.2,WALLZ],[0,0,1],W3);
quad([-X3,0,FRONTZ],[-X3,0,WALLZ],[-X3,3.2,WALLZ],[-X3,3.2,FRONTZ],[1,0,0],W3);
quad([X3,0,WALLZ],[X3,0,FRONTZ],[X3,3.2,FRONTZ],[X3,3.2,WALLZ],[-1,0,0],W3);
quad([-X3,3.2,WALLZ],[X3,3.2,WALLZ],[X3,3.2,FRONTZ],[-X3,3.2,FRONTZ],[0,-1,0],[.7,.69,.66]);
quad([X3,0,FRONTZ],[-X3,0,FRONTZ],[-X3,3.2,FRONTZ],[X3,3.2,FRONTZ],[0,0,-1],W3);
// plinthes rouges
mat0(.2,14);box(0,.05,WALLZ+.015,X3*2,.1,.03,RED3);box(-X3+.015,.05,(WALLZ+FRONTZ)/2,.03,.1,FRONTZ-WALLZ,RED3);box(X3-.015,.05,(WALLZ+FRONTZ)/2,.03,.1,FRONTZ-WALLZ,RED3);
// deux grandes fenêtres étroites (cadre rouge) et leurs rideaux rayés marron
[-.55,.55].forEach(cx=>{mat0(.7,60);box(cx,1.55,WALLZ+.01,.42,1.9,.01,[.04,.07,.05]);
 mat0(.25,16);box(cx-.235,1.55,WALLZ+.03,.05,2.0,.05,RED3);box(cx+.235,1.55,WALLZ+.03,.05,2.0,.05,RED3);box(cx,2.53,WALLZ+.03,.52,.06,.05,RED3);box(cx,.57,WALLZ+.03,.52,.06,.05,RED3);
 mat0(4.04,6);[-1,1].forEach(sg=>{for(let k=0;k<4;k++)box(cx+sg*(.3+k*.035),1.5,WALLZ+.07,.035,2.0,.03,k%2?[.36,.27,.18]:[.26,.19,.13])})});
// étagère rouge en hauteur (mur de gauche) + mousse noire + matériel posé dessus
mat0(.25,16);box(-X3+.24,2.32,-.4,.46,.05,2.8,RED3);[-1.6,-.4,.8].forEach(z=>{box(-X3+.03,2.12,z,.04,.42,.06,RED3);box(-X3+.2,2.12,z,.3,.04,.06,RED3)});
mat0(4.02,6);box(-X3+.22,2.18,-.4,.36,.15,2.5,BLK3);mat0(.3,20);box(-X3+.25,2.47,-1.3,.34,.26,.42,[.08,.08,.09]);box(-X3+.25,2.44,.4,.3,.2,.5,[.1,.09,.08]);
// panneau de mousse gris-vert au plafond, lampe ronde
mat0(4.02,6);box(-.35,3.15,-1.1,1.2,.08,2.9,[.2,.24,.2]);mat0(.6,30);ell(.65,3.13,-.4,.24,.08,.24,[1,.97,.9],16,8);
// la batterie (bordeaux), au fond, tournée vers la caméra
function drumKit(){const SHL=[.32,.05,.07],HD=[.92,.9,.85],GLD=[.78,.62,.3];
 mat0(.7,50);cyl([0,.3,.5],[0,.3,.88],.27,SHL,-1,22);mat0(.4,30);cyl([0,.3,.88],[0,.3,.885],.262,HD,-1,22);
 mat0(.7,50);[[-.22,.82,.55,.12,.13],[.18,.82,.55,.13,.14],[.55,.5,.5,.2,.22],[-.3,.62,.32,.17,.1]].forEach(([x,y,z,r,l])=>{cyl([x,y-l/2,z],[x,y+l/2,z],r,SHL,-1,20);mat0(.4,30);cyl([x,y+l/2,z],[x,y+l/2+.004,z],r-.005,HD,-1,20);mat0(.7,50)});
 mat0(.7,60);[[-.6,1.28,.6,.2],[.6,1.2,.62,.22],[-.55,.95,.3,.16]].forEach(([x,y,z,r])=>{cyl([x,0,z],[x,y,z],.011,MET3,-1,8);cyl([x,y,z],[x,y+.012,z],r,GLD,-1,24)})}
// tapis persan
mat0(3.02,4);quad([-1.2,.006,1.0],[1.2,.006,1.0],[1.2,.006,-2.8],[-1.2,.006,-2.8],[0,1,0],[.4,.12,.11]);
// fauteuils en velours marron (à droite)
function fauteuil(x,z,yaw){setXF(x,z,yaw);const VC=[.36,.18,.1];mat0(4.05,6);box(0,.25,0,.8,.3,.75,VC);box(0,.62,-.32,.8,.7,.14,VC);[-1,1].forEach(sg=>box(sg*.35,.48,0,.12,.28,.75,VC));mat0(.3,20);[[-.33,-.3],[.33,-.3],[-.33,.3],[.33,.3]].forEach(([a,b])=>box(a,.05,b,.06,.1,.06,[.15,.08,.05]));setXF(0,0,0)}
// bureau (mur de gauche, devant) : 2 écrans, clavier maître
function bureau(x,z,yaw){setXF(x,z,yaw);mat0(.25,16);box(0,.75,0,1.7,.05,.75,WOOD3);[[-.8,-.33],[.8,-.33],[-.8,.33],[.8,.33]].forEach(([a,b])=>box(a,.37,b,.05,.74,.05,[.2,.15,.1]));
mat0(.5,40);[-.38,.32].forEach(x=>{box(x,1.08,-.25,.58,.36,.03,[.03,.03,.03]);box(x,1.08,-.233,.54,.32,.004,[.62,.68,.74]);box(x,.88,-.27,.05,.2,.05,[.05,.05,.05])});
mat0(.3,20);box(0,.8,.12,1.0,.04,.22,[.08,.08,.08]);box(0,.825,.16,.92,.012,.12,[.9,.89,.85]);setXF(0,0,0)}
// lampe sur pied, guitares au mur de droite
function lampe(x,z){setXF(x,z,0);mat0(.4,30);cyl([0,0,0],[0,1.45,0],.015,MET3,-1,8);cyl([0,0,0],[0,.02,0],.14,MET3,-1,14);mat0(.2,10);cyl([0,1.35,0],[0,1.6,0],.2,[.95,.78,.5],-1,18,.12);setXF(0,0,0)}
mat0(.5,40);[[-.9,[.55,.33,.15]],[-.2,[.16,.1,.07]]].forEach(([z,c])=>{ell(X3-.07,1.25,z,.035,.22,.16,c,16,10);cyl([X3-.07,1.42,z],[X3-.07,2.05,z],.02,[.3,.2,.1],-1,8)});
R3.wall=[s0,cnt()-s0];
// ---------- LE DÉCOR QUI BOUGE (éditeur) : lumières, panneau LED, batterie, meubles, membres ----------
// Chaque modèle a sa disposition (LAY[1], LAY[2], LAY[3]) : gardée sur ce PC et dans le projet.
// les 5 lumières du studio : 2 tubes de part et d'autre des fenêtres, 2 tubes derrière la caméra, 1 panneau LED en hauteur
const TUBES3=[[-1.12,WALLZ+.14],[1.12,WALLZ+.14],[-.9,3.0],[.9,3.0],[0,3.42]],PANY=[1.75,2.55];
const DEF_LAY=()=>({1:{t:TUBES.map(p=>[...p]),o:{},m:[]},2:{t:TUBES.map(p=>[...p]),o:{},m:[]},
 3:{t:TUBES3.map(p=>[...p]),py:[...PANY],pyaw:0,o:{drum:{x:0,z:-3.2,yaw:0},f1:{x:X3-.45,z:1.35,yaw:-Math.PI/2},f2:{x:X3-.45,z:2.4,yaw:-Math.PI/2},bureau:{x:-X3+.42,z:2.2,yaw:Math.PI/2},lampe:{x:X3-.3,z:.75,yaw:0}},m:[]}});
let LAY=DEF_LAY();try{const q=JSON.parse(localStorage.getItem("toast.decor")||"null");if(q)LAY=normLay(q)}catch(e){}
function normLay(q){const d=DEF_LAY(),n=v=>Number.isFinite(+v)?+v:0;[1,2,3].forEach(k=>{const a=q&&q[k];if(!a)return;
 if(Array.isArray(a.t)&&a.t.length==NT3)d[k].t=a.t.map(p=>[n(p[0]),n(p[1])]);if(k==3&&Array.isArray(a.py))d[k].py=[n(a.py[0]),n(a.py[1])];if(k==3)d[k].pyaw=n(a.pyaw);
 if(a.o)Object.keys(d[k].o).forEach(c=>{if(a.o[c])d[k].o[c]={x:n(a.o[c].x),z:n(a.o[c].z),yaw:n(a.o[c].yaw)}});
 if(Array.isArray(a.m))d[k].m=a.m.slice(0,6).map(p=>p?{x:n(p.x),z:n(p.z),yaw:n(p.yaw)}:null)});return d}
const panX=(x,z,w,y0,y1,c,id)=>quad([w/2,y0,0],[-w/2,y0,0],[-w/2,y1,0],[w/2,y1,0],[0,0,-1],c,id);
// les tubes (et le panneau) de la scène affichée ; glow = le halo lumineux autour
function tubesGeo(sc,glow){const L=LAY[sc],T=L.t;T.forEach(([x,z],i)=>{
 if(sc==3&&i==4){const[y0,y1]=L.py,H=(y1-y0)/NS;setXF(x,z,L.pyaw||0);
  if(glow){for(let k=0;k<NS;k++){const b=y1-k*H;panX(0,0,1.12,b-H,b,[1,1,1],i*NS+k)}}
  else{mat0(.3,20);setXF(x,z+.01,L.pyaw||0);panX(0,0,1.1,y0-.04,y1+.04,[.06,.06,.065]);setXF(x,z,L.pyaw||0);mat0(0,1);for(let k=0;k<NS;k++){const b=y1-k*H;panX(0,0,1.0,b-H+.002,b-.002,[.08,.08,.09],i*NS+k)}}
  setXF(0,0,0);return}
 const H=(TH-.05)/NS;if(glow){for(let k=0;k<NS;k++){const y1=TH-k*H,y0=y1-H;cyl([x,y0,z],[x,y1,z],.16,[1,1,1],i*NS+k,14,undefined,false)}return}
 mat0(0,1);cyl([x,0,z],[x,.05,z],.1,[.1,.1,.11],-1,18);cyl([x,TH+.02,z],[x,TH+.07,z],.07,[.1,.1,.11],-1,14);for(let k=0;k<NS;k++){const y1=TH-k*H,y0=y1-H;cyl([x,y0+.004,z],[x,y1-.004,z],.045,[.08,.08,.09],i*NS+k,14,undefined,false)}})}
function meublesGeo(sc){const O=LAY[sc].o;if(sc!=3)return;
 setXF(O.drum.x,O.drum.z,O.drum.yaw);drumKit();fauteuil(O.f1.x,O.f1.z,O.f1.yaw);fauteuil(O.f2.x,O.f2.z,O.f2.yaw);bureau(O.bureau.x,O.bureau.z,O.bureau.yaw);lampe(O.lampe.x,O.lampe.z);setXF(0,0,0)}
// lumières de la scène affichée : positions (x, z) et hauteurs (bas, haut) de chacune
const TYa=new Float32Array(NT3*2);
const TUB=()=>LAY[SCN].t;
function setLights(){TUB().forEach(([x,z],i)=>{TP[i*2]=x;TP[i*2+1]=z});for(let i=0;i<NT3;i++){const pan=SCN==3&&i==4;TYa[i*2]=pan?LAY[3].py[0]:.05;TYa[i*2+1]=pan?LAY[3].py[1]:TH}}
let uTY_=null;const setTY=()=>{if(!uTY_)uTY_=gl.getUniformLocation(pg,"uTY");gl.uniform2fv(uTY_,TYa)};

// ---------- les membres : looks (d'après les photos), poses, instruments ----------
const LOOKS={
 yacine:{nom:"Yacine",k:1.05,skin:[.64,.45,.33],eye:[.16,.09,.05],beard:"pleine",beardC:[.05,.04,.04],hairC:[.05,.04,.04],chapeau:"bonnet",boucle:1,
  tenues:{jour:{shirt:[.3,.22,.17],sleeve:.45,pants:[.1,.13,.26],short:1,chaussettes:[.88,.88,.86],shoe:[.88,.88,.86],chapC:[.06,.06,.07]},
          scene:{shirt:[.5,.22,.1],sleeve:.92,pants:[.48,.21,.1],shoe:[.07,.05,.04],chapC:[.6,.32,.16]}}},
 baptiste:{nom:"Baptiste",k:1.0,skin:[.93,.76,.65],eye:[.25,.18,.1],beard:"pleine",beardC:[.42,.24,.12],cheveux:"milong",hairC:[.42,.29,.16],lunettes:[.06,.06,.07],
  tenues:{jour:{shirt:[.64,.72,.84],sleeve:.78,pants:[.07,.07,.08],shoe:[.88,.88,.86]},
          scene:{shirt:[.32,.47,.66],sleeve:.92,gilet:[.07,.05,.05],pants:[.45,.28,.15],shoe:[.25,.13,.07]}}},
 pierre:{nom:"Pierre",k:.95,skin:[.92,.74,.62],eye:[.22,.14,.08],beard:"moustache",beardC:[.18,.11,.07],cheveux:"court",hairC:[.17,.11,.07],lunettes:[.72,.72,.74],
  tenues:{jour:{shirt:[.5,.38,.1],sleeve:.45,pants:[.09,.1,.18],shoe:[.08,.07,.07]},
          scene:{shirt:[.42,.21,.1],sleeve:.92,col:1,pants:[.13,.09,.07],shoe:[.25,.13,.07]}}}};
const INV=[[.85,.66,.52],[.55,.38,.28],[.95,.8,.7]],INVS=[[.75,.75,.78],[.2,.35,.3],[.6,.2,.2]];
const lookDe=(q,i)=>LOOKS[q]||{nom:"Invité",k:1,skin:INV[i%3],eye:[.15,.1,.06],cheveux:"court",hairC:[.12,.08,.06],
  tenues:{jour:{shirt:INVS[i%3],sleeve:.9,pants:[.15,.17,.25],shoe:[.08,.07,.07]},scene:{shirt:INVS[(i+1)%3],sleeve:.92,pants:[.12,.1,.08],shoe:[.2,.12,.07]}}};
const SEATED={k:[-.03,.38],a:.38};
const POSES={
 debout:{hip:.92,arm:ARM_STAND,leg:LEG_STAND},
 leves:{hip:.92,arm:{e:[.33,.74,.04],w:[.36,1.0,.08]},leg:LEG_STAND},
 croises:{hip:.92,armSplit:{L:{e:[.24,.22,.1],w:[-.08,.32,.15]},R:{e:[.24,.26,.12],w:[-.06,.36,.17]}},leg:LEG_STAND},
 assis:{hip:.56,arm:{e:[.27,.12,.1],w:[.2,.08,.32]},leg:{k:[-.03,.4],a:.4},siege:1},
 tailleur:{hip:.17,arm:{e:[.28,.15,.1],w:[.22,.02,.25]},legs:[{K:[-.38,.1,.18],A:[.1,.07,.34]},{K:[.38,.1,.18],A:[-.1,.09,.37]}]},
 chant:{hip:.92,armSplit:{L:ARM_STAND,R:{e:[.22,.25,.2],w:[.07,.52,.3]}},leg:LEG_STAND,inst:"micro"},
 guitare:{hip:.92,armSplit:{L:{e:[.3,.25,.12],w:[.42,.4,.25]},R:{e:[.27,.15,.1],w:[.06,.12,.2]}},leg:LEG_STAND,inst:"guitare"},
 basse:{hip:.92,armSplit:{L:{e:[.3,.32,.1],w:[.4,.5,.2]},R:{e:[.27,.18,.08],w:[.06,.08,.2]}},leg:LEG_STAND,inst:"basse"},
 batterie:{hip:.58,arm:{e:[.3,.12,.12],w:[.2,.18,.42]},leg:SEATED,siege:1,inst:"batterie"},
 piano:{hip:.58,arm:{e:[.26,.1,.14],w:[.17,.23,.5]},leg:SEATED,siege:1,inst:"piano"},
 congas:{hip:.58,armSplit:{L:{e:[.28,.1,.18],w:[.1,.17,.42]},R:{e:[.28,.1,.18],w:[.1,.17,.42]}},legs:[{K:[-.17,.55,.36],A:[-.22,.085,.42]},{K:[.17,.55,.36],A:[.22,.085,.42]}],siege:1,inst:"congas"}};
const PROPS={
 siege:h=>()=>{mat0(.4,40);cyl([0,0,-.02],[0,h-.17,-.02],.022,MET3,-1,8);for(let k=0;k<3;k++){const a=k*2.094+.5;cyl([Math.cos(a)*.2,0,Math.sin(a)*.2-.02],[0,.2,-.02],.012,MET3,-1,6)}mat0(.1,8);cyl([0,h-.18,-.02],[0,h-.12,-.02],.18,[.06,.05,.05],-1,18)},
 micro:()=>{mat0(.5,50);cyl([0,0,.42],[0,.02,.42],.14,MET3,-1,14);cyl([0,0,.42],[0,1.5,.36],.012,MET3,-1,8);cyl([0,1.5,.36],[0,1.57,.22],.018,[.1,.1,.11],-1,10);ell(0,1.59,.19,.032,.036,.032,[.55,.55,.57],10,8)},
 guitare:()=>{const H=.92;mat0(.4,40);ell(.05,H,.16,.17,.21,.055,[.6,.36,.16],20,10);ell(.05,H+.03,.215,.05,.05,.004,[.05,.04,.03],12,6);cyl([-.05,H+.1,.17],[-.52,H+.4,.22],.02,[.3,.2,.12],-1,8);box(-.56,H+.43,.225,.08,.1,.03,[.15,.1,.06])},
 basse:()=>{const H=.92;mat0(.6,60);ell(.1,H+.05,.14,.13,.18,.03,[.86,.7,.46],18,10);ell(.07,H+.07,.172,.07,.1,.004,[.95,.92,.85],12,6);cyl([.02,H+.15,.14],[-.55,H+.65,.18],.017,[.75,.5,.25],-1,8);box(-.6,H+.7,.18,.05,.1,.02,[.75,.5,.25])},
 batterie:()=>drumKit(),
 piano:()=>{mat0(.4,40);box(0,.82,.6,1.1,.07,.32,[.08,.08,.09]);box(0,.862,.64,1.0,.015,.15,[.92,.9,.86]);for(let k=0;k<20;k++)if(k%7!=2&&k%7!=6)box(-.47+k*.05,.875,.6,.024,.015,.08,[.04,.04,.04]);mat0(.5,50);cyl([-.4,0,.5],[.4,.78,.7],.012,MET3,-1,6);cyl([.4,0,.5],[-.4,.78,.7],.012,MET3,-1,6)},
 congas:()=>{mat0(.6,50);sweep([[0,.0,.48],[0,.25,.46],[0,.5,.44],[0,.72,.42]],[.1,.14,.135,.12],[.08,.32,.15],18);mat0(.4,30);cyl([0,.72,.42],[0,.725,.42],.118,[.9,.86,.78],-1,18);mat0(.8,70);cyl([0,.69,.42],[0,.73,.42],.127,[.75,.75,.78],-1,18)}};
// détails qui manquent au personnage d'origine : coiffures, barbes, lunettes, bonnet, boucle d'oreille, gilet, col roulé
function humanPlus(o,H,hy){const L=o.L,T=o.T;if(!L)return;
 if(L.cheveux=="milong"){const C=L.hairC;mat0(.38,26);ell(0,hy+.1,-.005,.1,.075,.116,C,22,12);ell(0,hy+.03,-.055,.096,.1,.074,C,16,10);[-1,1].forEach(sg=>ell(sg*.083,hy+.035,-.015,.028,.06,.08,C,10,8));ell(.02,hy+.13,.045,.088,.032,.06,C,12,6)}
 else if(L.cheveux=="court"){const C=L.hairC;mat0(.3,20);ell(0,hy+.095,0,.094,.058,.108,C,22,12);ell(0,hy+.02,-.05,.088,.085,.066,C,16,10)}
 if(L.beard){const C=L.beardC,f=L.beard=="pleine"?1:.72;mat0(.08,6);ell(0,hy-.105,.05,.072*f+.01,.05*f,.05,C,16,10);[-1,1].forEach(sg=>ell(sg*.064,hy-.085,.022,.024,.036*f,.048,C,10,8));if(!o.sil)ell(0,hy-.048,.094,.036,.01,.012,C,10,6)}
 if(L.lunettes&&!o.sil){const C=L.lunettes;mat0(.6,60);[-1,1].forEach(sg=>{const pts=[];for(let i=0;i<=16;i++){const a=i/16*Math.PI*2;pts.push([sg*.037+Math.cos(a)*.028,hy+.016+Math.sin(a)*.024,.106])}sweep(pts,pts.map(()=>.0032),C,6,1,1,false);cyl([sg*.064,hy+.02,.104],[sg*.093,hy+.02,0],.0028,C,-1,6)});cyl([-.01,hy+.022,.108],[.01,hy+.022,.108],.003,C,-1,6)}
 if(L.chapeau=="bonnet"){const C=T.chapC||[.06,.06,.07];mat0(4.05,6);loft([{y:hy+.02,rx:.1,rz:.112,cx:0,cz:-.006},{y:hy+.07,rx:.103,rz:.115,cx:0,cz:-.006},{y:hy+.12,rx:.088,rz:.1,cx:0,cz:-.008},{y:hy+.15,rx:.055,rz:.062,cx:0,cz:-.01},{y:hy+.162,rx:.002,rz:.002,cx:0,cz:-.01}],C,26);loft([{y:hy+.015,rx:.106,rz:.118,cx:0,cz:-.006},{y:hy+.07,rx:.109,rz:.121,cx:0,cz:-.006}],C,26)}
 if(L.boucle&&!o.sil){mat0(.8,80);ell(.093,hy-.045,0,.007,.009,.007,[.8,.8,.82],8,6)}
 if(T.gilet){mat0(4.05,6);loft([{y:H+.11,rx:.166,rz:.116,cx:0,cz:0},{y:H+.2,rx:.158,rz:.11,cx:0,cz:.002},{y:H+.3,rx:.172,rz:.114,cx:0,cz:.004},{y:H+.38,rx:.19,rz:.124,cx:0,cz:.008},{y:H+.47,rx:.2,rz:.126,cx:0,cz:.008}],T.gilet,30)}
 if(T.col){mat0(.05,6);sweep([[0,H+.52,-.006],[0,H+.6,-.002],[0,H+.645,.004]],[.064,.06,.058],T.shirt,16)}}
// places dans chaque modèle : batteur derrière la batterie, chanteur au centre, les autres autour
const SPOTS={
 1:{pl:[{x:0,z:-1.6},{x:-1.25,z:-2.95,yaw:.38},{x:1.2,z:-2.95,yaw:-.4},{x:-2.1,z:-1.3,yaw:.5},{x:2.1,z:-1.3,yaw:-.5},{x:0,z:-.6}],chair:{x:0,z:-2.08},drum:{x:-2.3,z:-2.9,yaw:.4,kit:0}},
 2:{pl:[{x:-.25,z:-1.15,yaw:.28},{x:-1.15,z:-1.6,yaw:.35},{x:.9,z:-1.3,yaw:-.3},{x:.1,z:-3.15,yaw:-.1},{x:-2.4,z:-.9,yaw:.5},{x:2.4,z:-.9,yaw:-.5}],drum:{x:1.65,z:-3.15,yaw:-.18,kit:1},piano:{x:-1.7,z:-2.6,yaw:.06,kb:1}},
 3:{pl:[{x:.42,z:-.95,yaw:-.08},{x:-.7,z:-1.6,yaw:.3},{x:.85,z:-1.85,yaw:-.3},{x:-.65,z:-.25,yaw:.2},{x:.75,z:-.15,yaw:-.2},{x:0,z:.5}],drum:{x:0,z:-3.2,yaw:0,kit:1}}};
const POSE_LISTE=Object.keys(POSES);
const DEF_M=()=>({n:3,orig:false,sil:true,l:[{qui:"baptiste",pose:"batterie",tenue:"jour",rot:0},{qui:"pierre",pose:"basse",tenue:"jour",rot:0},{qui:"yacine",pose:"chant",tenue:"jour",rot:0},{qui:"invite",pose:"debout",tenue:"jour",rot:0},{qui:"invite",pose:"croises",tenue:"jour",rot:0},{qui:"invite",pose:"leves",tenue:"jour",rot:0}]});
let MEMB=DEF_M();try{const q=JSON.parse(localStorage.getItem("toast.membres")||"null");if(q&&Array.isArray(q.l))MEMB=normM(q)}catch(e){}
function normM(q){const d=DEF_M();return{n:Math.max(0,Math.min(6,+q.n||0)),orig:!!q.orig,sil:q.sil!==false,l:d.l.map((x,i)=>{const y=q.l[i]||{};return{qui:y.qui in LOOKS||y.qui=="invite"?y.qui:x.qui,pose:POSES[y.pose]?y.pose:x.pose,tenue:y.tenue=="scene"?"scene":"jour",rot:Math.max(-180,Math.min(180,+y.rot||0))}})}}
const membresActifs=()=>SCN==3||!MEMB.orig;
let PLACES=[];
function construireMembres(sc){const S=SPOTS[sc],pl=S.pl.map(p=>({...p})),l=MEMB.l.slice(0,MEMB.n);let chair=S.chair?{...S.chair}:null,drum=S.drum?{...S.drum}:null,piano=S.piano?{...S.piano}:null;PLACES=[];
 if(sc==3&&drum){const d=LAY[3].o.drum;drum={x:d.x,z:d.z,yaw:d.yaw,kit:1}}
 const ord=l.map((m,i)=>i).sort((a,b)=>(l[b].pose=="chant")-(l[a].pose=="chant"));
 for(const i of ord){const m=l[i],P=POSES[m.pose]||POSES.debout,L=lookDe(m.qui,i),T=L.tenues[m.tenue]||L.tenues.jour;let sp,inst=P.inst,siege=!!P.siege;
  if(m.pose=="batterie"&&drum){sp=drum;if(drum.kit)inst=null;drum=null}
  else if(m.pose=="piano"&&piano){sp=piano;if(piano.kb)inst=null;piano=null}
  else if(m.pose=="assis"&&chair){sp=chair;siege=false;chair=null}
  else sp=pl.shift()||{x:(i-2.5)*.7,z:.6};
  const ov=LAY[sc].m[i],rot=(m.rot||0)*Math.PI/180;sp=ov?{x:ov.x,z:ov.z,yaw:ov.yaw+rot}:{...sp,yaw:(sp.yaw||0)+rot};PLACES[i]={x:sp.x,z:sp.z,yaw:sp.yaw||0};
  const props=[];if(siege)props.push(PROPS.siege(P.hip));if(inst&&PROPS[inst])props.push(PROPS[inst]);
  human({x:sp.x,z:sp.z,yaw:sp.yaw||0,k:L.k,hip:P.hip,skin:L.skin,shirt:T.shirt,pants:T.pants,shoe:T.shoe,hair:L.hairC||L.beardC||[.1,.07,.05],style:"bald",sleeve:T.sleeve,eye:L.eye,
   short:T.short,chaussettes:T.chaussettes,sil:MEMB.sil,L,T,arm:P.arm,armSplit:P.armSplit,leg:P.leg,legs:P.legs,prop:()=>props.forEach(f=>f())})}
 setXF(0,0,0)}
// tampon des membres (refait seulement quand le modèle ou les membres changent)
let bfM=null,nM=0,cleM="";
function tamponMembres(){const cle=SCN+"|"+JSON.stringify(MEMB)+JSON.stringify(LAY[SCN].m)+JSON.stringify(LAY[3].o.drum);if(cle===cleM&&bfM)return;cleM=cle;
 const a0=A.length;construireMembres(SCN);const arr=new Float32Array(A.slice(a0));A.length=a0;nM=arr.length/12;
 if(!bfM)bfM=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bfM);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,bf)}
const ptrs=b=>{gl.bindBuffer(gl.ARRAY_BUFFER,b);[[3,0],[3,3],[3,6],[1,9],[1,10],[1,11]].forEach(([k,o],i)=>gl.vertexAttribPointer(i,k,gl.FLOAT,false,48,o*4))};
// silhouettes : les membres sont noirs, seuls leurs contours prennent la couleur des tubes
let uSi_=null;
function drP(SC){if(!membresActifs())return dr_(SC.person);tamponMembres();if(!nM)return;const surPg=gl.getParameter(gl.CURRENT_PROGRAM)===pg&&MEMB.sil;if(surPg){if(!uSi_)uSi_=gl.getUniformLocation(pg,"uSi");gl.uniform1f(uSi_,1)}
 ptrs(bfM);gl.drawArrays(gl.TRIANGLES,0,nM);ptrs(bf);if(surPg)gl.uniform1f(uSi_,0)}
function setMembres(m){MEMB=normM(m||DEF_M());try{localStorage.setItem("toast.membres",JSON.stringify(MEMB))}catch(e){}draw()}
// ---------- tampons du décor qui bouge : tubes + meubles (+ repère de l'objet choisi), et halos ----------
let bfO=null,nO=0,cleO="",bfG=null,nG=0,cleG="";
function tamponDe(geo){const a0=A.length;geo();const arr=new Float32Array(A.slice(a0));A.length=a0;return arr}
function charge(b,arr){if(!b)b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,bf);return b}
function drO(){const cle=SCN+"|"+JSON.stringify(LAY[SCN])+"|"+(EDIT&&SEL?SEL.id:"");if(cle!==cleO||!bfO){cleO=cle;
  const arr=tamponDe(()=>{tubesGeo(SCN,false);meublesGeo(SCN);if(EDIT&&SEL){const c=centre(SEL);if(c){mat0(0,1);cyl([c.x,.004,c.z],[c.x,.014,c.z],.42,[1,.62,.15],-1,32);cyl([c.x,.004,c.z],[c.x,.016,c.z],.36,[.05,.04,.03],-1,32)}}});
  bfO=charge(bfO,arr);nO=arr.length/12}
 if(nO){ptrs(bfO);gl.drawArrays(gl.TRIANGLES,0,nO);ptrs(bf)}}
function drG(){const cle=SCN+"|"+JSON.stringify(LAY[SCN].t)+(SCN==3?JSON.stringify([LAY[3].py,LAY[3].pyaw]):"");if(cle!==cleG||!bfG){cleG=cle;const arr=tamponDe(()=>tubesGeo(SCN,true));bfG=charge(bfG,arr);nG=arr.length/12}
 if(nG){ptrs(bfG);gl.drawArrays(gl.TRIANGLES,0,nG);ptrs(bf)}}

// ---------- L'ÉDITEUR : clic sur un objet = le choisir ; glisser = le déplacer ; molette = le tourner ----------
let EDIT=false,SEL=null,GLI=null,surSel=null,rafE=0;
const NOMS_O={drum:"Batterie",f1:"Fauteuil 1",f2:"Fauteuil 2",bureau:"Bureau",lampe:"Lampe"};
function objets(){const L=LAY[SCN],out=[];
 (MEMB.n&&membresActifs()?PLACES.slice(0,MEMB.n):[]).forEach((p,i)=>{if(p)out.push({id:"m"+i,nom:(lookDe(MEMB.l[i].qui,i).nom)+" ("+(i+1)+")",x:p.x,z:p.z,y:1.05,yaw:p.yaw,tourne:1})});
 L.t.forEach(([x,z],i)=>{const pan=SCN==3&&i==4;out.push({id:"t"+i,nom:pan?"Panneau LED (lumière 5)":"Tube "+(i+1),x,z,y:pan?(L.py[0]+L.py[1])/2:1.25,tourne:pan,pan})});
 if(SCN==3)Object.keys(L.o).forEach(k=>{const o=L.o[k];out.push({id:"o"+k,nom:NOMS_O[k]||k,x:o.x,z:o.z,y:k=="drum"?.6:k=="lampe"?1.2:.5,yaw:o.yaw,tourne:k!="lampe"})});
 return out}
function centre(sel){return objets().find(o=>o.id==sel.id)||null}
function ecran(o){const{M}=view(),v=[o.x,o.y,o.z,1],c=[0,1,2,3].map(r=>M[r]*v[0]+M[4+r]*v[1]+M[8+r]*v[2]+M[12+r]*v[3]);if(c[3]<=.01)return null;
 const r=cvs.getBoundingClientRect();return{x:r.left+(c[0]/c[3]*.5+.5)*r.width,y:r.top+(.5-c[1]/c[3]*.5)*r.height}}
function sol(ev,h=0){const r=cvs.getBoundingClientRect(),nx=(ev.clientX-r.left)/r.width*2-1,ny=1-(ev.clientY-r.top)/r.height*2,{e}=view();
 const zz=nrm(sub(e,cam.T)),xx=nrm(cross([0,1,0],zz)),yy=cross(zz,xx),t=Math.tan(Math.PI/6),ar=cvs.width/cvs.height,d=nrm(add(add(mul(zz,-1),mul(xx,nx*t*ar)),mul(yy,ny*t)));
 if(Math.abs(d[1])<1e-4)return null;const k=(h-e[1])/d[1];if(k<=0||k>40)return null;return[e[0]+d[0]*k,e[2]+d[2]*k]}
function choisir(ev){let best=null,bd=46;objets().forEach(o=>{const p=ecran(o);if(!p)return;const d=Math.hypot(p.x-ev.clientX,p.y-ev.clientY);if(d<bd){bd=d;best=o}});return best}
const limX=()=>(SCN==3?X3:WX)-.15;
function poser(id,x,z,yaw){const L=LAY[SCN];x=Math.max(-limX(),Math.min(limX(),x));z=Math.max(WALLZ+.1,Math.min(FRONTZ-.1,z));
 if(id[0]=="m"){const i=+id.slice(1),p=PLACES[i]||{yaw:0},rot=((MEMB.l[i]||{}).rot||0)*Math.PI/180,f=yaw==null?p.yaw:yaw;L.m[i]={x,z,yaw:f-rot};PLACES[i]={x,z,yaw:f}}
 else if(id[0]=="t"){const i=+id.slice(1);L.t[i]=[x,z];if(yaw!=null&&SCN==3&&i==4)L.pyaw=yaw}
 else{const o=L.o[id.slice(1)];o.x=x;o.z=z;if(yaw!=null)o.yaw=yaw}}
function redessiner(){if(rafE)return;rafE=requestAnimationFrame(()=>{rafE=0;draw()})}
function garderDecor(){try{localStorage.setItem("toast.decor",JSON.stringify(LAY))}catch(e){}}
function dire(){if(surSel)surSel(SEL?SEL.nom:"",SEL&&SEL.pan)}
cvs.addEventListener("pointerdown",ev=>{if(!EDIT)return;const o=choisir(ev);SEL=o;dire();if(!o){redessiner();return}
 const{e}=view(),zz=nrm(sub(e,cam.T)),r=cvs.getBoundingClientRect();
 // glisser à l'écran : gauche / droite = de côté ; haut / bas = plus loin / plus près (à la vitesse de l'objet, quelle que soit sa distance)
 GLI={id:o.id,x0:o.x,z0:o.z,mx:ev.clientX,my:ev.clientY,k:2*Math.tan(Math.PI/6)*Math.hypot(e[0]-o.x,e[1]-o.y,e[2]-o.z)/r.height,xr:nrm([zz[2],0,-zz[0]]),fw:nrm([-zz[0],0,-zz[2]])};cvs.setPointerCapture(ev.pointerId);ev.stopImmediatePropagation();redessiner()},true);
cvs.addEventListener("pointermove",ev=>{if(!EDIT||!GLI)return;ev.stopImmediatePropagation();const g=GLI,a=(ev.clientX-g.mx)*g.k,b=-(ev.clientY-g.my)*g.k*1.6;poser(g.id,g.x0+g.xr[0]*a+g.fw[0]*b,g.z0+g.xr[2]*a+g.fw[2]*b,null);redessiner()},true);
cvs.addEventListener("pointerup",ev=>{if(!EDIT||!GLI)return;ev.stopImmediatePropagation();GLI=null;garderDecor();redessiner()},true);
cvs.addEventListener("wheel",ev=>{if(!EDIT||!SEL)return;const o=centre(SEL);if(!o||!o.tourne)return;ev.preventDefault();ev.stopImmediatePropagation();
 poser(o.id,o.x,o.z,(o.yaw||0)+(ev.deltaY>0?1:-1)*Math.PI/12);garderDecor();redessiner()},{capture:true,passive:false});
cvs.addEventListener("dblclick",ev=>{if(EDIT)ev.stopImmediatePropagation()},true);
const decorAPI={
 editer(on){EDIT=!!on;if(!EDIT)SEL=null;cvs.style.cursor=EDIT?"pointer":"";dire();draw()},
 surChoix(f){surSel=f},
 monter(d){const L=LAY[3];if(!(SEL&&SEL.pan))return;const h=L.py[1]-L.py[0],y0=Math.max(.2,Math.min(3.1-h,L.py[0]+d));L.py=[y0,y0+h];garderDecor();draw()},
 reset(){const d=DEF_LAY();LAY[SCN]=d[SCN];SEL=null;dire();garderDecor();draw()},
 getDecor:()=>JSON.parse(JSON.stringify(LAY)),_t:{sol,objets,ecran},
 setDecor(q){LAY=normLay(q||{});SEL=null;dire();garderDecor();draw()}};

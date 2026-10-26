// ===== BEESKOT Studio : musique (Bibliothèque / Médias / Ce PC), vues des vidéos, barre de lecture, plein écran, pictos =====
(()=>{
const LS={get:(k,d)=>{try{const v=localStorage.getItem("toast."+k);return v==null?d:v}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem("toast."+k,v)}catch(e){}}};
const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const msg=t=>{$("st").textContent=t};

// ---------- 1. LA MUSIQUE : d'où vient le son ----------
async function chargerOctets(bytes,nom){const p=pendingProj;pendingProj=null;await loadAudio(bytes,nom,p)}
const fichierCh=$("file"),src=el("div","lt-src");
fichierCh.before(src);
src.innerHTML=(DBS?'<div class="lt-seg" role="tablist" aria-label="D\'où vient la musique"><button type="button" data-s="biblio">Bibliothèque</button><button type="button" data-s="medias">Médias</button><button type="button" data-s="pc">Ce PC</button></div>':'')+
 '<div class="lt-z" data-z="biblio"><label class="lt-lab">Morceau<select id="ltMorceau"><option value="">— choisir —</option></select></label><label class="lt-lab">Version<select id="ltVersion"><option value="">—</option></select></label></div>'+
 '<div class="lt-z" data-z="medias"><button type="button" class="lt-pri" id="ltMed">🎵 Choisir dans Médias…</button></div>'+
 '<div class="lt-z" data-z="pc"><button type="button" class="lt-pri" id="ltPc">💻 Choisir un fichier…</button></div>';
$("ltPc").onclick=()=>fichierCh.click();
let morceaux=[];
function mode(m){
  if(!DBS)m="pc";LS.set("src",m);
  src.querySelectorAll(".lt-seg button").forEach(b=>b.classList.toggle("on",b.dataset.s==m));
  src.querySelectorAll(".lt-z").forEach(z=>z.classList.toggle("lt-hidden",z.dataset.z!=m));
  if(m=="biblio")remplirMorceaux();
}
src.querySelectorAll(".lt-seg button").forEach(b=>b.onclick=()=>mode(b.dataset.s));
async function remplirMorceaux(){
  const s=$("ltMorceau"),avant=s.value||LS.get("morceau","");
  try{morceaux=await DBS.morceaux()}catch(e){morceaux=[]}
  s.innerHTML='<option value="">— choisir —</option>'+morceaux.map(m=>`<option value="${esc(m.id)}">${esc(m.nom)}</option>`).join("");
  s.value=avant;if(s.value!==avant)s.value="";
  if(s.value)remplirVersions(false);
}
async function remplirVersions(charger){
  const s=$("ltVersion"),id=$("ltMorceau").value;
  if(!id){s.innerHTML='<option value="">—</option>';return}
  s.innerHTML='<option value="">recherche…</option>';
  let l=[];try{l=await DBS.versions(id)}catch(e){}
  if($("ltMorceau").value!==id)return;
  s.innerHTML=l.length?l.map((o,i)=>`<option value="${esc(o.v)}">${i===0?"★ ":""}${o.ou} ${esc(o.nom)}</option>`).join(""):'<option value="">aucun export : ajoute-le dans la fiche (Bibliothèque › Exports)</option>';
  const avant=LS.get("version","");if(avant&&l.some(o=>o.v===avant))s.value=avant;
  if(charger&&l.length)chargerVersion();
}
async function chargerVersion(){
  const s=$("ltVersion"),v=s.value;if(!v)return;LS.set("version",v);
  const nom=(s.selectedOptions[0]||{}).textContent.replace(/^★ /,"").replace(/^\S+ /,"");
  msg("Chargement de « "+nom+" »…");
  try{const r=await DBS.lireVersion(v,nom);await chargerOctets(r.bytes,r.nom)}catch(e){msg("Impossible de charger ce fichier : "+(e&&e.message||e))}
}
$("ltMorceau").onchange=()=>{LS.set("morceau",$("ltMorceau").value);LS.set("version","");remplirVersions(true)};
$("ltVersion").onchange=chargerVersion;
// Médias : la fenêtre de choix du logiciel (musiques seulement)
async function depuisMedias(titre,plusieurs){
  const l=await DBS.choisirMusiques(titre);if(!l||!l.length)return [];
  return plusieurs?l:[l[0]];
}
$("ltMed").onclick=async()=>{
  try{const l=await depuisMedias("Une musique pour Light Toast",false);if(!l.length)return;msg("Chargement de « "+l[0].nom+" »…");const r=await DBS.lireMedia(l[0]);await chargerOctets(r.bytes,r.nom)}
  catch(e){msg("Impossible de charger ce fichier : "+(e&&e.message||e))}
};
mode(LS.get("src",DBS?"biblio":"pc"));

// pistes audio en plus : Médias ou Ce PC (le reste ne change pas)
const stf=$("stfile");
if(stf){const r=el("div","lt-ligne");
  r.innerHTML=(DBS?'<button type="button" id="ltStMed">🎵 Depuis Médias…</button>':'')+'<button type="button" id="ltStPc">💻 Depuis ce PC…</button>';
  stf.before(r);$("ltStPc").onclick=()=>stf.click();
  if(DBS)$("ltStMed").onclick=async()=>{
    try{const l=await depuisMedias("Pistes audio en plus (stems)",true);if(!l.length)return;$("stinfo").textContent="Chargement…";
      const dt=new DataTransfer();for(const x of l){const r=await DBS.lireMedia(x);dt.items.add(new File([r.bytes],r.nom))}
      stf.files=dt.files;stf.dispatchEvent(new Event("change"))}catch(e){$("stinfo").textContent="Impossible de charger : "+(e&&e.message||e)}};
}

// ---------- 2. LES VIDÉOS : les deux / tubes / vue 3D, plein écran, barre de lecture ----------
const vids=$("vids"),ltv=el("div"),vues=el("div","lt-vues");ltv.id="ltv";
vues.innerHTML='<div class="lt-seg" aria-label="Vidéos affichées"><button type="button" data-v="deux">Les deux</button><button type="button" data-v="tubes">Tubes LED</button><button type="button" data-v="3d">Vue 3D</button></div><button type="button" class="lt-fs" id="ltFs" title="Plein écran (Échap pour quitter)">⛶ Plein écran</button>';
vids.before(vues);vids.before(ltv);ltv.append(vids);
const bar=el("div","lt-bar");
bar.innerHTML='<button type="button" class="lt-pri" id="ltPlay" title="Lecture / pause (barre d\'espace)">▶</button><button type="button" id="ltStop" title="Arrêter et revenir au début">⏹</button><input type="range" class="lt-pos" id="ltPos" min="0" max="1000" value="0" aria-label="Position dans le morceau"><span class="lt-temps" id="ltT">0:00 / 0:00</span>';
ltv.append(bar);
function vue(v){LS.set("vue",v);ltv.className="v-"+v;vues.querySelectorAll("[data-v]").forEach(b=>b.classList.toggle("on",b.dataset.v==v));
  setTimeout(()=>{window.dispatchEvent(new Event("resize"));if(window.v3&&v3.draw)try{v3.draw()}catch(e){}},30)}
vues.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>vue(b.dataset.v));
vue(LS.get("vue","deux"));
$("ltFs").onclick=()=>goFs(ltv);
document.addEventListener("fullscreenchange",()=>{const fe=document.fullscreenElement;
  if(fe===ltv&&window.v3&&!ltv.classList.contains("v-tubes")){try{const p=v3.portrait(),seul=ltv.classList.contains("v-3d");v3.setSize(p?(seul?1080:720):(seul?1920:1280),p?(seul?1920:1280):(seul?1080:720));v3.draw();v3big=true}catch(e){}}});

const mmss=t=>{t=Math.max(0,t||0);const m=Math.floor(t/60),s=Math.floor(t%60);return m+":"+String(s).padStart(2,"0")};
let glisse=false,repr=false,etat=null;
$("ltPlay").onclick=()=>{
  if(!buf){msg("Charge d'abord un morceau (section 1).");return}
  if(rec&&rec.state=="recording")return;
  if(raf){const t=curT;stopAll();curT=startT=t;setPh(t);return}   // pause : on garde la position
  playFrom(curT>=dur-.2?0:curT);
};
$("ltStop").onclick=()=>{if(rec&&rec.state=="recording")return;stopAll();curT=startT=0;if(buf)setPh(0)};
$("ltPos").oninput=()=>{if(!buf)return;glisse=true;const t=$("ltPos").value/1000*dur;
  if(raf){repr=true;stopAll()}curT=startT=t;setPh(t);$("ltT").textContent=mmss(t)+" / "+mmss(dur)};
$("ltPos").onchange=()=>{glisse=false;if(repr){repr=false;playFrom(curT)}};
setInterval(()=>{if(document.hidden)return;
  const on=!!raf;if(on!==etat){etat=on;$("ltPlay").textContent=on?"❚❚":"▶";$("ltPlay").title=on?"Pause (barre d'espace)":"Lecture (barre d'espace)"}
  if(!glisse){$("ltPos").value=dur?Math.round(curT/dur*1000):0;$("ltT").textContent=mmss(curT)+" / "+mmss(dur)}},150);

// ---------- 2b. LES MEMBRES DANS LA VUE 3D : combien, qui, quelle pose, quelle tenue, tournés comment ----------
if(window.v3&&v3.getMembres){
  const QUI=[["yacine","Yacine"],["baptiste","Baptiste"],["pierre","Pierre"],["invite","Invité"]];
  const POSE=[["debout","Debout"],["leves","Bras levés"],["croises","Bras croisés"],["assis","Assis"],["tailleur","Assis en tailleur"],["chant","Chante (micro)"],["guitare","Guitare"],["basse","Basse"],["batterie","Batterie"],["piano","Piano"],["congas","Congas"]];
  const opts=(l,v)=>l.map(([k,n])=>`<option value="${k}"${k==v?" selected":""}>${n}</option>`).join("");
  const bt=el("button","","👥 Membres");bt.type="button";bt.id="ltMembBt";bt.title="Les membres dans la vue 3D : combien, qui, pose, tenue";
  vues.insertBefore(bt,$("ltFs"));
  const bx=el("div","lt-memb lt-hidden");ltv.after(bx);
  const ouvert=LS.get("membOuvert","0")=="1";if(ouvert){bx.classList.remove("lt-hidden");bt.classList.add("on")}
  bt.onclick=()=>{const o=bx.classList.toggle("lt-hidden");bt.classList.toggle("on",!o);LS.set("membOuvert",o?"0":"1")};
  function rendre(){const m=v3.getMembres();
    bx.innerHTML=`<div class="lt-ligne"><label class="lt-lab lt-in">Membres sur scène<select id="ltMn">${[0,1,2,3,4,5,6].map(n=>`<option${n==m.n?" selected":""}>${n}</option>`).join("")}</select></label>
      <label class="leg" title="Membres en ombres noires : seuls les contours prennent la couleur des lumières"><input type="checkbox" id="ltMs"${m.sil?" checked":""}> silhouettes</label><label class="leg"><input type="checkbox" id="ltMo"${m.orig?" checked":""}> personnages d'origine dans OPP1 et MOTHER3</label><button type="button" id="ltMr" title="Revenir à Yacine, Baptiste et Pierre">Réinitialiser</button></div>`+
      m.l.slice(0,m.n).map((x,i)=>`<div class="lt-mrow" data-i="${i}"><b class="lt-mnum">${i+1}</b>
        <select data-k="qui" aria-label="Qui">${opts(QUI,x.qui)}</select><select data-k="pose" aria-label="Pose">${opts(POSE,x.pose)}</select>
        <select data-k="tenue" aria-label="Tenue">${opts([["jour","Tous les jours"],["scene","Scène 70s"]],x.tenue)}</select>
        <label class="lt-lab lt-in lt-rot">Tourner<input type="range" data-k="rot" min="-180" max="180" step="5" value="${x.rot}"></label></div>`).join("");
    $("ltMn").onchange=()=>{const q=v3.getMembres();q.n=+$("ltMn").value;v3.setMembres(q);rendre()};
    $("ltMo").onchange=()=>{const q=v3.getMembres();q.orig=$("ltMo").checked;v3.setMembres(q)};$("ltMs").onchange=()=>{const q=v3.getMembres();q.sil=$("ltMs").checked;v3.setMembres(q)};
    $("ltMr").onclick=()=>{v3.setMembres(null);rendre()};
    bx.querySelectorAll(".lt-mrow [data-k]").forEach(c=>{const ev=c.type=="range"?"input":"change";c.addEventListener(ev,()=>{const q=v3.getMembres(),i=+c.closest(".lt-mrow").dataset.i;q.l[i][c.dataset.k]=c.type=="range"?+c.value:c.value;v3.setMembres(q)})});
  }
  rendre();
  // un projet ouvert peut changer les membres : on remet le panneau à jour
  const sm=v3.setMembres;v3.setMembres=m=>{sm(m);if(!bx.contains(document.activeElement))rendre()};
}

// ---------- 2c. L'ÉDITEUR DE DÉCOR (vue 3D) ----------
if(window.v3&&v3.editer){
  const be=el("button","","✎ Éditer le décor");be.type="button";be.id="ltEdBt";be.title="Déplacer les membres, les tubes, le panneau LED, la batterie et les meubles dans la vue 3D";
  vues.insertBefore(be,$("ltFs"));
  const eb=el("div","lt-edit lt-hidden");$("v3w").append(eb);
  eb.innerHTML='<span class="lt-edsel" id="ltEdSel">Clique sur un membre, un tube, le panneau ou un meuble</span><span class="lt-edaide">glisser = déplacer · molette = tourner</span><span class="lt-edh lt-hidden" id="ltEdH"><button type="button" id="ltEdUp" title="Monter le panneau">▲</button><button type="button" id="ltEdDn" title="Descendre le panneau">▼</button></span><button type="button" id="ltEdR" title="Remet ce modèle 3D comme au départ">Réinitialiser</button><button type="button" class="lt-pri" id="ltEdOk">Terminé</button>';
  const fin=on=>{be.classList.toggle("on",on);eb.classList.toggle("lt-hidden",!on);v3.editer(on);if(on&&ltv.classList.contains("v-tubes"))vue("3d")};
  be.onclick=()=>fin(!be.classList.contains("on"));$("ltEdOk").onclick=()=>fin(false);
  $("ltEdR").onclick=()=>v3.reset();$("ltEdUp").onclick=()=>v3.monter(.1);$("ltEdDn").onclick=()=>v3.monter(-.1);
  v3.surChoix((nom,pan)=>{$("ltEdSel").textContent=nom?"Choisi : "+nom:"Clique sur un membre, un tube, le panneau ou un meuble";$("ltEdH").classList.toggle("lt-hidden",!pan)});
}

// ---------- 3. LES PICTOS MAISON (les mêmes que dans le logiciel) ----------
const PIC=(()=>{try{return parent.BK&&parent.BK.pictos}catch(e){return null}})();
if(PIC){
  const cles=Object.keys(PIC).map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")),RE=new RegExp("("+cles.join("|")+")️?","g");
  const EXCLUS="script,style,textarea,input,select,option,title,canvas,.pic";
  const texte=n=>{const t=n.nodeValue;if(!t||!RE.test(t)){RE.lastIndex=0;return}RE.lastIndex=0;
    const f=document.createDocumentFragment();let d=0,m;
    while((m=RE.exec(t))){if(m.index>d)f.append(t.slice(d,m.index));const s=document.createElement("span"),nom=PIC[m[1]],u="url(../pictos/"+nom+".png)";
      if(nom[0]=="A"){s.className="pic a";s.style.webkitMaskImage=u;s.style.maskImage=u}else{s.className="pic";s.style.backgroundImage=u}
      s.textContent=m[0];f.append(s);d=m.index+m[0].length}
    if(d<t.length)f.append(t.slice(d));n.parentNode.replaceChild(f,n)};
  const traiter=r=>{if(!r||r.nodeType!==1||r.closest(EXCLUS))return;const w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentNode&&n.parentNode.closest&&n.parentNode.closest(EXCLUS)?2:1}),l=[];let n;while((n=w.nextNode()))l.push(n);l.forEach(texte)};
  traiter(document.body);
  new MutationObserver(ms=>ms.forEach(m=>{if(m.type=="childList")m.addedNodes.forEach(n=>traiter(n.nodeType==3?n.parentNode:n));else traiter(m.target.parentNode)}))
    .observe(document.body,{childList:true,subtree:true,characterData:true});
}
})();

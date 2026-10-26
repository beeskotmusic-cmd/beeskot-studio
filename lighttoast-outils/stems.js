// ===== Pistes audio en plus (stems) : on repère les attaques et on les montre comme pêches possibles =====
const STEMS=[],SCOL=["#ff6b6b","#4fd1c5","#f6c453","#9f7aea","#68d391","#f687b3","#63b3ed","#fbd38d"];
let stemId=0;
function stemEnv(b){ // niveau du son toutes les 4 ms (fenêtre ~12 ms)
  const sr=b.sampleRate,hop=Math.max(1,Math.round(sr*.004)),win=hop*3,n=b.length,nc=b.numberOfChannels,nb=Math.floor(n/hop),env=new Float32Array(nb);
  const ch=[...Array(nc)].map((_,k)=>b.getChannelData(k));
  for(let i=0;i<nb;i++){let s=0,c=0;const a=i*hop,e=Math.min(n,a+win);for(let j=a;j<e;j+=2){let m=0;for(const d of ch)m+=d[j]*d[j];s+=m/nc;c++}env[i]=Math.sqrt(s/Math.max(1,c))}
  return{env,hop,sr,win};
}
function stemDetect(s){ // attaques : maximum local assez fort, qui monte nettement ; au moins « écart mini » entre deux
  const{env,hop,sr,win}=s.E,nb=env.length;let mx=0;for(let i=0;i<nb;i++)if(env[i]>mx)mx=env[i];
  if(mx<=0){s.times=[];return}
  const lvl=mx*(.02+.5*(1-s.sens/100)),gh=Math.max(2,Math.round(s.gap/1000*sr/hop/2)),back=8,cand=[];
  for(let i=back;i<nb-2;i++){const v=env[i];if(v<lvl)continue;let ok=true;
    for(let j=Math.max(0,i-gh);j<=Math.min(nb-1,i+gh)&&ok;j++)if(env[j]>v||(env[j]==v&&j<i))ok=false;
    if(!ok)continue;let lo=v;for(let j=i-back;j<i;j++)if(env[j]<lo)lo=env[j];
    if(v>=lo*1.6)cand.push({t:(i*hop+win/2)/sr,v})}
  cand.sort((a,b)=>b.v-a.v);const keep=[],gs=s.gap/1000;
  for(const c of cand){if(!keep.some(k=>Math.abs(k.t-c.t)<gs))keep.push(c)}
  s.times=keep.map(k=>Math.round(k.t*1000)/1000).sort((a,b)=>a-b);
}
function stemRender(){
  const L=$("stl");$("stinfo").textContent=STEMS.length?STEMS.length+" piste(s) en plus":"Aucune piste en plus.";
  L.innerHTML="";
  STEMS.forEach(s=>{
    const d=document.createElement("div");d.className="stem";d.style.setProperty("--sc",s.col);
    const opts=ptypes.map((p,j)=>`<option value="${j}"${j==s.pc?" selected":""}>${pn(j)}</option>`).join("");
    d.innerHTML=`<div class="row"><span class="sdot"></span><b class="sname"></b><span class="leg sn"></span></div>
<div class="grid" style="grid-template-columns:1fr 1fr">
<label class="ctl"><b>Sensibilité <span class="sv1">${s.sens}</span></b><input type="range" class="ssens" min="1" max="100" value="${s.sens}"></label>
<label class="ctl"><b>Écart mini <span class="sv2">${s.gap}</span> ms</b><input type="range" class="sgap" min="40" max="800" step="10" value="${s.gap}"></label></div>
<div class="row"><label class="ctl k">Type de pêche :<select class="spc">${opts}</select></label>
<label class="leg"><input type="checkbox" class="sshow"${s.show?" checked":""}> voir sur la frise</label>
<button class="g screate">Créer les pêches</button><button class="g sdel">Retirer</button></div>`;
    d.querySelector(".sname").textContent=s.name;
    const info=()=>{d.querySelector(".sn").textContent=s.times.length+" pêche(s) possible(s)"+(s.E?"":" · audio non rechargé (réglages figés)")};info();
    const redo=()=>{if(!s.E)return;stemDetect(s);info();drawTL()};
    const sens=d.querySelector(".ssens"),gap=d.querySelector(".sgap");
    sens.disabled=gap.disabled=!s.E;
    sens.oninput=()=>{s.sens=+sens.value;d.querySelector(".sv1").textContent=s.sens;redo()};
    gap.oninput=()=>{s.gap=+gap.value;d.querySelector(".sv2").textContent=s.gap;redo()};
    d.querySelector(".spc").onchange=e=>{s.pc=+e.target.value};
    d.querySelector(".sshow").onchange=e=>{s.show=e.target.checked;drawTL()};
    d.querySelector(".sdel").onclick=()=>{STEMS.splice(STEMS.indexOf(s),1);stemRender();drawTL()};
    d.querySelector(".screate").onclick=()=>{
      if(!buf){alert("Charge d'abord le morceau.");return}
      if(!s.times.length){alert("Aucun repère à poser.");return}
      if(s.times.length>300&&!confirm(s.times.length+" pêches d'un coup : c'est beaucoup. Continuer ? (Ctrl+Z pour annuler)"))return;
      const j=Math.min(s.pc,ptypes.length-1);let n=0;
      for(const t of s.times){if(manual.some(m=>m.c==j&&Math.abs(m.t-t)<.02))continue;manual.push({t:$("snap").checked?snapPeak(t):t,c:j});n++}
      applyManual();$("st").textContent=n+" pêche(s) posée(s) depuis « "+s.name+" » (Ctrl+Z pour annuler)."};
    d.querySelector(".spc").addEventListener("focus",e=>{const sel=e.target;sel.innerHTML=ptypes.map((p,j)=>`<option value="${j}"${j==s.pc?" selected":""}>${pn(j)}</option>`).join("")});
    L.append(d)});
}
$("stfile").onchange=async e=>{
  const fs=[...e.target.files];e.target.value="";if(!fs.length)return;
  actx=actx||new (window.AudioContext||window.webkitAudioContext)();
  for(const f of fs){
    $("stinfo").textContent="Analyse de « "+f.name+" »…";
    try{const b=await actx.decodeAudioData(await f.arrayBuffer());
      const s={id:++stemId,name:f.name.replace(/\.[^.]+$/,""),col:SCOL[STEMS.length%SCOL.length],sens:70,gap:120,pc:0,show:true,times:[],E:stemEnv(b)};
      stemDetect(s);STEMS.push(s)}
    catch(err){alert("Impossible de lire « "+f.name+" ».")}
  }
  stemRender();drawTL();
};
function stemsSave(){return STEMS.map(s=>({name:s.name,col:s.col,sens:s.sens,gap:s.gap,pc:s.pc,show:s.show,times:s.times}))}
function stemsLoad(a){ // le stem lui-même n'est pas gardé : seulement ses repères
  STEMS.length=0;if(!Array.isArray(a)){stemRender();return}
  a.slice(0,16).forEach(q=>{if(!q||!Array.isArray(q.times))return;
    STEMS.push({id:++stemId,name:String(q.name||"Piste").slice(0,60),col:/^#[0-9a-f]{6}$/i.test(q.col)?q.col:SCOL[STEMS.length%SCOL.length],sens:numIn(q.sens,70,1,100),gap:numIn(q.gap,120,40,800),pc:numIn(q.pc,0,0,17),show:q.show!==false,times:q.times.map(Number).filter(t=>isFinite(t)&&t>=0).slice(0,4000),E:null})});
  stemRender();
}
// les repères sur la frise : une trace légère sur toute la hauteur + un petit triangle dans la piste des pêches
const _drawTL=drawTL;
drawTL=function(){
  _drawTL();
  if(!buf||!STEMS.length)return;
  const c=$("tl"),x=c.getContext("2d"),w=c.width,h=c.height,L=v1-v0;
  STEMS.forEach(s=>{if(!s.show)return;
    x.fillStyle=s.col;x.strokeStyle=s.col;
    x.globalAlpha=.28;x.lineWidth=1;x.beginPath();
    s.times.forEach(t=>{if(t<v0||t>v1)return;const px=Math.round((t-v0)/L*w)+.5;x.moveTo(px,LANE_END);x.lineTo(px,h)});x.stroke();
    x.globalAlpha=.95;
    s.times.forEach(t=>{if(t<v0||t>v1)return;const px=(t-v0)/L*w;x.beginPath();x.moveTo(px-4,LANE_P-1);x.lineTo(px+4,LANE_P-1);x.lineTo(px,LANE_P-8);x.closePath();x.fill()});
    x.globalAlpha=1});
};

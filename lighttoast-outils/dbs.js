// ===== le pont avec BEESKOT Studio (seulement quand TOAST est dans l'onglet « Light Toast ») =====
const DBS=(()=>{try{return window.parent!==window&&parent.BKToast?parent.BKToast:null}catch(e){return null}})();
if(DBS){document.documentElement.classList.add("dbs");$("destw").hidden=false;$("dopen").hidden=false;
  try{const d=localStorage.getItem("toast.dest");if(d)$("dest").value=d}catch(e){}
  $("dest").onchange=()=>{try{localStorage.setItem("toast.dest",$("dest").value)}catch(e){}}}
const toDrive=()=>!!DBS&&$("dest").value=="drive";
async function afterExport(bl,name){
  if(!toDrive())return;$("st").textContent="Envoi de la vidéo au Drive…";
  try{await DBS.envoyer(bl,name,"Vidéos");$("st").textContent="Vidéo envoyée au Drive : Light Toast / Vidéos / "+name}
  catch(e){$("st").textContent="Envoi au Drive impossible : "+(e&&e.message||e)}
}
$("dopen").onclick=async()=>{
  let l;try{l=(await DBS.lister("Projets")).filter(f=>/\.json$/i.test(f.name))}catch(e){alert("Drive : "+(e&&e.message||e));return}
  if(!l.length){alert("Aucun projet dans le Drive (dossier Light Toast / Projets).");return}
  const v=document.createElement("div");v.style.cssText="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:grid;place-items:center";
  const b=document.createElement("section");b.style.cssText="max-width:520px;width:92%;max-height:80vh;overflow:auto;display:flex;flex-direction:column;gap:6px";
  b.innerHTML="<h2>Projets dans le Drive</h2>";
  l.forEach(f=>{const x=document.createElement("button");x.className="g";x.style.textAlign="left";
    x.textContent=f.name.replace(/\.json$/i,"")+"  ·  "+new Date(f.modifiedTime).toLocaleDateString("fr-CA");
    x.onclick=async()=>{x.disabled=true;x.textContent="Ouverture…";
      try{const o=JSON.parse(await(await DBS.lire(f.id)).text());if(o.app!="pulse-led"&&!Array.isArray(o.secs))throw 0;v.remove();await openProject(o)}
      catch(err){v.remove();alert("Ce projet ne s'ouvre pas.")}};b.append(x)});
  const nn=document.createElement("button");nn.className="g";nn.textContent="Annuler";nn.onclick=()=>v.remove();b.append(nn);
  v.onclick=e=>{if(e.target===v)v.remove()};v.append(b);document.body.append(v);
};

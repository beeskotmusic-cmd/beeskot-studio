// =====================================================================
// LES NOTIFICATIONS sur les téléphones du groupe (appli Android).
//
//   quelqu'un fait une action (PC ou téléphone)  →  BK.notif.envoyer()  →  le facteur (notif-web/worker.js, Cloudflare)
//                                                                        →  Firebase (gratuit)  →  les téléphones des AUTRES
//
//   Ce qui déclenche une notification : la liste REGLES ci-dessous, c'est tout. Pour en ajouter une : une ligne dans REGLES.
//   Tant que la clé du groupe n'existe pas (Réglages › BEESKOT Mobile › Notifications), rien ne part : le logiciel marche comme avant.
//   Le téléphone s'inscrit tout seul auprès du facteur à l'ouverture de l'appli (prénom de Réglages › Ce téléphone).
//   Rien n'est payant : pas de clé facturée, Firebase Cloud Messaging et le Worker Cloudflare sont gratuits.
// =====================================================================
(() => {
  const URL_FACTEUR = 'https://notif.beeskot-music.workers.dev/';
  const moi = () => BK.reglage('nomPc', '') || '';
  const meme = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const jourFr = d => { try { return new Date(d + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return d || ''; } };
  const nomMorceau = id => ((BK.db.cache.morceaux || {})[id] || {}).nom || '';

  // ---------- CE QUI DÉCLENCHE UNE NOTIFICATION ----------
  // Chaque règle reçoit la fiche (f), si elle est nouvelle (neuf) et sa version d'avant (av, ou null).
  // Elle renvoie rien (pas de notification) ou { pour, titre, texte, onglet, [calme] }.
  //   pour  : 'autres' (tout le monde sauf celui qui a fait l'action) ou une liste de prénoms
  //   calme : une clé ; pas plus d'une notification par quart d'heure pour cette clé (ex. dix notes d'affilée = une seule notification)
  const REGLES = {
    taches(f, neuf, av) {
      if (!f.qui || f.fait || meme(f.qui, moi()) || (!neuf && av && meme(av.qui, f.qui))) return;
      return meme(f.qui, 'BEESKOT') ? { pour: 'autres', titre: 'Nouvelle tâche pour le groupe', texte: f.texte, onglet: 'taches' }
        : { pour: [f.qui], titre: moi() + ' t\'a donné une tâche', texte: f.texte, onglet: 'taches' };
    },
    evenements(f, neuf, av) {
      const quand = jourFr(f.date) + (f.heure ? ' · ' + f.heure : '') + (f.lieu ? ' · ' + f.lieu : '');
      if (neuf) return { pour: 'autres', titre: 'Nouveau rendez-vous : ' + (f.titre || f.type || ''), texte: quand, onglet: 'agenda' };
      if (av && (av.date !== f.date || (av.heure || '') !== (f.heure || ''))) return { pour: 'autres', titre: 'Rendez-vous déplacé : ' + (f.titre || f.type || ''), texte: quand, onglet: 'agenda' };
    },
    notesmix(f, neuf, av) {
      const rep = (f.reponses || []).length > ((av && av.reponses) || []).length;
      if (!neuf && !rep) return;
      return { pour: 'autres', titre: moi() + (rep ? ' a répondu à une note' : ' a laissé des notes de mix'), texte: nomMorceau(f.morceau) || f.texte, onglet: 'ecoute', calme: 'mix-' + (f.morceau || '') };
    },
    notesvid(f, neuf, av) {
      const rep = (f.reponses || []).length > ((av && av.reponses) || []).length;
      if (!neuf && !rep) return;
      return { pour: 'autres', titre: moi() + (rep ? ' a répondu à une note' : ' a laissé des notes sur une vidéo'), texte: f.videoNom || f.texte, onglet: 'notesvid', calme: 'vid-' + (f.video || f.videoNom || '') };
    },
    morceaux(f, neuf, av) {
      if (neuf) return { pour: 'autres', titre: 'Nouveau morceau dans la Bibliothèque', texte: f.nom, onglet: 'biblio' };
      if (!av) return;
      if (f.statut === 'sorti' && av.statut !== 'sorti') return { pour: 'autres', titre: f.nom + ' est sorti', texte: 'Bravo le groupe.', onglet: 'biblio' };
      if ((f.fait || 0) > (av.fait || 0)) { const e = BK.etapes && BK.etapes[f.fait]; return { pour: 'autres', titre: f.nom + (e ? ' passe à l\'étape ' + e.nom : ' : toutes les étapes sont faites'), texte: moi() + ' a fait avancer le morceau.', onglet: 'biblio' }; }
      if (f.exportPrincipal && f.exportPrincipal !== av.exportPrincipal) return { pour: 'autres', titre: 'Nouvelle version de ' + f.nom, texte: moi() + ' a choisi une nouvelle version à écouter.', onglet: 'biblio', calme: 'exp-' + f.id };
    },
  };

  const N = BK.notif = {
    URL: URL_FACTEUR, REGLES,
    _cle: undefined,
    // la clé du groupe (rangée dans le Drive avec les autres réglages partagés) ; '' = notifications pas encore réglées
    async cle(relire) {
      if (N._cle !== undefined && !relire) return N._cle;
      try { const d = (await BK.db.liste('config')).find(x => x.id === 'notif'); N._cle = (d && d.cle) || ''; } catch (e) { N._cle = N._cle || ''; }
      return N._cle;
    },
    async creerCle() {
      const o = new Uint8Array(24); crypto.getRandomValues(o);
      const cle = Array.from(o, x => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[x % 57]).join('');
      await BK.db.ecrire('config', { id: 'notif', cle }, { sansAnnuler: true }); N._cle = cle; return cle;
    },
    // parler au facteur. Ne casse jamais rien : en cas de souci, renvoie { erreur } et le logiciel continue.
    async poster(corps) {
      const cle = await N.cle(); if (!cle) return { erreur: 'pas réglé' };
      try { const r = await fetch(URL_FACTEUR, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ cle, ...corps }) }); return await r.json(); }
      catch (e) { return { erreur: 'facteur injoignable' }; }
    },
    envoyer(m) { return N.poster({ de: moi(), sauf: BK.reglage('notif.appareil', '') || undefined, ...m }); },
    // le rappel d'un rendez-vous : la veille à 18 h (heure de l'appareil qui l'a créé)
    rappel(f) {
      if (!f || !f.id || !f.date) return;
      const d = new Date(f.date + 'T18:00'); d.setDate(d.getDate() - 1); if (isNaN(d)) return;
      return N.poster({ rappel: { id: f.id, quand: d.toISOString(), titre: 'Demain : ' + (f.titre || f.type || 'rendez-vous'), texte: [f.heure, f.lieu].filter(Boolean).join(' · ') || jourFr(f.date), onglet: 'agenda' } });
    },
    // appelé à chaque fiche écrite par un membre (voir plus bas)
    surEcriture(col, f, neuf, av) {
      const regle = REGLES[col]; if (!regle || !moi()) return;
      let m; try { m = regle(f, neuf, av); } catch (e) { console.warn('notif', e); }
      if (col === 'evenements' && (neuf || !av || av.date !== f.date || av.titre !== f.titre || av.heure !== f.heure || av.lieu !== f.lieu)) N.rappel(f);
      if (!m || !String(m.texte || m.titre || '').trim()) return;
      if (m.calme) { const c = BK.reglage('notif.calme', {}), t = Date.now(); if (t - (c[m.calme] || 0) < 15 * 60e3) return;
        for (const k of Object.keys(c)) if (t - c[k] > 864e5) delete c[k]; c[m.calme] = t; BK.regler('notif.calme', c); }
      N.envoyer({ pour: m.pour, titre: m.titre, texte: m.texte || '', onglet: m.onglet });
    },

    // ---------- sur le téléphone (appli Android) : s'inscrire auprès du facteur ----------
    plugin: () => (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) || null,
    etatTel: 'inconnu',                                        // 'actif' | 'refuse' | 'absent' (pas l'appli, ou appli trop ancienne) | 'inconnu'
    async inscrire(demander) {
      const P = N.plugin(); if (!P) { N.etatTel = 'absent'; return; }
      if (!moi() || !(await N.cle())) return;
      try {
        let p = await P.checkPermissions();
        if (p.receive !== 'granted' && (demander || p.receive === 'prompt' || p.receive === 'prompt-with-rationale')) p = await P.requestPermissions();
        if (p.receive !== 'granted') { N.etatTel = 'refuse'; return; }
        if (!N._ecoute) { N._ecoute = true;
          P.addListener('registration', t => { const jeton = t && t.value; if (!jeton) return;
            let ap = BK.reglage('notif.appareil', ''); if (!ap) { ap = 'tel-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); BK.regler('notif.appareil', ap); }
            const sig = moi() + '|' + jeton, vu = BK.reglage('notif.inscrit', {});
            if (vu.sig === sig && Date.now() - (vu.t || 0) < 7 * 864e5) { N.etatTel = 'actif'; return; }          // déjà inscrit avec ce prénom : on ne redit rien pendant une semaine
            N.poster({ inscrire: { appareil: ap, qui: moi(), jeton } }).then(r => { if (r && r.ok) { BK.regler('notif.inscrit', { sig, t: Date.now() }); N.etatTel = 'actif'; N.redessiner(); } }); });
          P.addListener('registrationError', e => { console.warn('notif : inscription refusée', e); N.etatTel = 'absent'; N.redessiner(); });
          // l'appli est ouverte : un petit message en haut, pas de notification Android en double
          P.addListener('pushNotificationReceived', n => { BK.avis && BK.avis([n.title, n.body].filter(Boolean).join(' · '), 6000); BK.fil && BK.fil.maj && BK.fil.maj(); });
          // on a touché la notification : l'appli s'ouvre sur le bon onglet
          P.addListener('pushNotificationActionPerformed', a => { const o = a && a.notification && a.notification.data && a.notification.data.onglet; if (o && document.getElementById('p-' + o)) BK.ouvrir(o); });
        }
        try { await P.createChannel({ id: 'beeskot', name: 'BEESKOT Studio', description: 'Tâches, rendez-vous, notes et morceaux du groupe', importance: 4, visibility: 1 }); } catch (e) {}
        await P.register();
      } catch (e) { console.warn('notif', e); N.etatTel = 'absent'; }
      N.redessiner();
    },

    // ---------- la case « Notifications » de Réglages › BEESKOT Mobile ----------
    _zone: null,
    redessiner() { if (N._zone && N._zone.isConnected) N.dessiner(N._zone); },
    async dessiner(z) {
      if (!z) return; N._zone = z;
      const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const cle = await N.cle(true), tel = !!window.BK_MOBILE, P = N.plugin();
      let etat = null; if (cle) etat = await N.poster({ etat: true });
      const noms = etat && etat.telephones ? [...new Set(etat.telephones.map(t => t.qui))] : [];
      const ligne = !cle ? 'Pas encore réglées : il manque la clé du groupe.'
        : etat && etat.erreur ? 'Le facteur ne répond pas (' + etat.erreur + ') : voir notif-web/LISEZ-MOI.txt.'
        : !etat.pret ? 'Clé du groupe reconnue, mais le compte Firebase n\'est pas encore collé chez Cloudflare.'
        : noms.length ? 'Prêtes · téléphones inscrits : ' + noms.join(', ') + '.' : 'Prêtes, mais aucun téléphone inscrit : ouvrez l\'appli Android sur chaque téléphone.';
      const ici = !tel ? '' : !P ? '<span class="nt">Ce téléphone : les notifications arrivent dans l\'appli Android BEESKOT (pas dans Chrome). Si tu es dans l\'appli, mets-la à jour :</span><a class="btn sm pri" style="text-decoration:none;align-self:flex-start" href="' + (BK.LIEN_APK || '') + '" target="_blank" rel="noopener">Mettre à jour l\'appli</a>'
        : N.etatTel === 'actif' ? '<span class="nt">Ce téléphone : <b>notifications activées</b> pour ' + esc(moi()) + '.</span>'
        : N.etatTel === 'refuse' ? '<span class="nt">Ce téléphone : notifications refusées. Réglages du téléphone › Applis › BEESKOT Studio › Notifications : autorise, puis reviens ici.</span>'
        : '<span class="nt">Ce téléphone : pas encore activé.</span>';
      z.innerHTML = `<div class="ligne-titre"><span class="lb">Notifications</span><span class="dymo sm">Android</span></div>
        <span class="nt">Une tâche pour toi, un rendez-vous (et son rappel la veille à 18 h), des notes sur un mix ou une vidéo, un morceau qui avance : les autres membres reçoivent une notification sur leur téléphone.</span>
        <span class="nt" role="status"><b>${esc(ligne)}</b></span>${ici}
        <div class="chips" style="margin-top:8px">
          ${!cle && !tel ? '<button class="btn sm pri" data-nf="creer">Créer la clé du groupe</button>' : ''}
          ${cle && !tel ? '<button class="btn sm" data-nf="copier">Copier la clé du groupe</button>' : ''}
          ${cle && tel && P && N.etatTel !== 'actif' ? '<button class="btn sm pri" data-nf="activer">Activer sur ce téléphone</button>' : ''}
          ${cle ? '<button class="btn sm" data-nf="essai">Envoyer un essai à tout le monde</button>' : ''}
        </div><span class="nt" id="nfMsg" role="status"></span>`;
      const dire = t => { const m = z.querySelector('#nfMsg'); if (m) m.textContent = t; };
      z.onclick = async e => { const b = e.target.closest('[data-nf]'); if (!b) return; const a = b.dataset.nf;
        if (a === 'creer') { try { await N.creerCle(); } catch (er) { return dire('Clé pas créée : ' + (er.message || er)); } await N.dessiner(z); return z.querySelector('#nfMsg').textContent = 'Clé créée. « Copier la clé du groupe », puis colle-la chez Cloudflare (secret CLE) : voir notif-web/LISEZ-MOI.txt.'; }
        if (a === 'copier') { try { await navigator.clipboard.writeText(await N.cle()); dire('Clé copiée. Ne la colle que chez Cloudflare (secret CLE).'); } catch (er) { dire('Copie impossible ici.'); } }
        if (a === 'activer') { await N.inscrire(true); }
        if (a === 'essai') { dire('Envoi…'); const r = await N.poster({ de: '', pour: 'tous', titre: 'BEESKOT Studio', texte: 'Essai de notification envoyé par ' + (moi() || 'un membre') + '.', onglet: 'accueil' });
          dire(r && r.ok ? (r.envoyes ? 'Envoyé à ' + r.envoyes + ' téléphone(s).' : 'Aucun téléphone inscrit pour l\'instant.') + (r.rates ? ' ' + r.rates + ' raté(s).' : '') : 'Pas envoyé : ' + ((r && r.erreur) || 'erreur')); } };
    },
  };

  // ---------- le branchement : chaque fiche écrite / retirée par un membre passe ici (jamais ce que le logiciel écrit tout seul) ----------
  const journal0 = BK.journalAuto;
  BK.journalAuto = function (col, f, neuf, opts) {
    try { if (REGLES[col] && !(opts && (opts.sansAnnuler || opts.graine)) && !f.miette && !f.graine) {
      let av = null; try { const p = (BK.db.photo[col] || {})[f.id]; av = p ? JSON.parse(p) : null; } catch (e) {}
      const copie = JSON.parse(JSON.stringify(f)); setTimeout(() => N.surEcriture(col, copie, neuf, av), 0); } } catch (e) { console.warn('notif', e); }
    return journal0 && journal0.apply(this, arguments);
  };
  const suppr0 = BK.db.supprimer.bind(BK.db);
  BK.db.supprimer = function (col, id, o) {
    try { if (col === 'evenements' && !(o && o.sansAnnuler) && moi()) { const f = (BK.db.cache.evenements || {})[id];
      N.poster({ annuler: id }); if (f && !f.miette && f.date >= BK.auj()) N.envoyer({ pour: 'autres', titre: 'Rendez-vous retiré : ' + (f.titre || f.type || ''), texte: jourFr(f.date), onglet: 'agenda' }); } } catch (e) {}
    return suppr0(col, id, o);
  };
  // le téléphone s'inscrit une fois le logiciel démarré (et se réinscrit si on change de prénom)
  window.addEventListener('load', () => setTimeout(() => N.inscrire(false), 4000));
})();

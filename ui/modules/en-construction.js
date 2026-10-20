// =====================================================================
// Page commune aux onglets pas encore construits
// =====================================================================
BK.module('_en-construction', function (page, o) {
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit chantier">
        <span class="dymo">En construction</span>
        <span class="nt" style="font-size:14px;max-width:420px;text-align:center">L'onglet « ${o.titre} » arrive dans une prochaine version. Il apparaîtra ici après une mise à jour.</span>
      </section>
    </div>`;
});

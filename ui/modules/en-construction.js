// =====================================================================
// Page commune aux onglets pas encore construits
// =====================================================================
BK.module('_en-construction', function (page, o) {
  $('.grid', page).innerHTML = `
    <div class="cols">
      <section class="pane vit chantier">
        <span class="dymo">Incoming</span>
        <span class="nt" style="font-size:14px;max-width:440px;text-align:center">« ${o.titre} » arrive dans une prochaine version : tout ce qu'il faut pour préparer de bonnes répètes et de bons concerts. Pas encore là, mais ça s'en vient.</span>
      </section>
    </div>`;
});

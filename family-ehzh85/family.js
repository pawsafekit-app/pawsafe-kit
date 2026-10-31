// PawSafe Family Pack — hasta 5 mascotas extra, cada una con su QR, y diseño a juego.
(function () {
  'use strict';
  var K = window.PSKit, esc = PS.esc, CFG = window.PAWSAFE_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var q = new URLSearchParams(location.search);
  if (q.get('demo')) {
    K.setNoSave(true); K.demoPet(K.S(), 'dog');
    if (q.get('demo') === 'family') {
      var c2 = K.newPet(); K.demoPet(c2, 'cat'); var c3 = K.newPet(); K.demoPet(c3, 'dog'); c3.pet.name = 'Rocky';
      K.store().pets.push(c2, c3); K.store().match = q.get('match') === '1';
    }
    K.store().unlocks.familyPack = true;
  } else { K.unlock('familyPack'); }
  var store = K.store();
  var MAX = K.MAX_PETS;

  var savedTimer;
  function save() {
    var ok = K.save(), el = $('#saved');
    el.textContent = ok ? 'Saved on this device ✓' : 'Could not save. Download a backup from your kit.'; el.classList.toggle('bad', !ok);
    clearTimeout(savedTimer); if (ok) savedTimer = setTimeout(function () { el.textContent = ''; }, 2500);
  }

  function renderCards() {
    $('#count').textContent = store.pets.length + ' of ' + MAX;
    $('#fcards').innerHTML = store.pets.map(function (p, i) {
      var sp = K.styled(i), c = K.effStyle(sp), url = PS.foundUrl(PS.foundPayload(p.pet, p.tag, null, sp.color)), qr = PS.qrSvg(url);
      return '<div class="fcard" style="--c:' + c.c + '">' +
        '<div class="petline">' + (p.photo.id ? '<img alt="" src="' + p.photo.id + '">' : '<div class="ph0">no photo</div>') +
        '<div><b>' + (p.pet.name.trim() ? esc(p.pet.name.trim()) : 'Pet ' + (i + 1) + ' (no name yet)') + '</b>' +
        '<span class="xnote">' + K.speciesLabel(p.pet.species) + (i === 0 ? ' · main pet' : '') + '</span></div></div>' +
        '<div class="row"><div class="qrp" title="This pet\'s own QR">' + qr.svg + '</div><div class="tag0">Its own QR tag page. Opens with its name, note and contact buttons.</div></div>' +
        '<div class="photo-actions"><a class="btn ghost small" href="../index.html?pet=' + i + '">Edit &amp; print</a>' +
        (i > 0 ? '<button type="button" class="btn danger small" data-del="' + i + '">Remove</button>' : '') + '</div></div>';
    }).join('');
    $('#add-pet').hidden = store.pets.length >= MAX;
    $('#add-msg').textContent = store.pets.length >= MAX ? 'You have reached the limit: your main pet plus 5 more.' :
      'Adding a pet opens your kit on the new pet so you can fill in the details and photo. Owner name, phone and address are copied from Pet 1 (you can change them).';
  }
  $('#fcards').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    var i = +b.dataset.del;
    if (!confirm('Remove ' + (store.pets[i].pet.name || 'this pet') + ' from the kit? Download a backup from your kit first if you want to keep it.')) return;
    store.pets.splice(i, 1); if (store.active >= store.pets.length) store.active = 0; save(); renderAll();
  });
  $('#add-pet').addEventListener('click', function () {
    if (store.pets.length >= MAX) return;
    var p0 = store.pets[0], np = K.newPet();
    np.color = p0.color; np.tag.owner = p0.tag.owner; np.tag.phone = p0.tag.phone; np.tag.address = p0.tag.address;
    store.pets.push(np); store.active = store.pets.length - 1; save();
    location.href = '../index.html?pet=' + store.active;
  });
  $('#match').addEventListener('change', function (e) { store.match = e.target.checked; save(); renderAll(); });
  $$('input[name=fc]').forEach(function (r) { r.addEventListener('change', function () { if (r.checked) { store.pets[0].color = r.value; save(); renderAll(); } }); });
  $('#o-paper').addEventListener('change', function (e) { store.pets[0].print.paper = e.target.value; save(); renderDocs(); });
  $('#o-tag').addEventListener('change', function (e) { store.pets[0].print.tagSize = e.target.value; save(); renderDocs(); });

  function fit(forPrint) {
    var d = $('#docs'), P = K.PAPER[store.pets[0].print.paper] || K.PAPER.letter, px = P.w * 96 / 25.4, avail = d.clientWidth - 16;
    d.style.setProperty('--z', forPrint ? 1 : Math.min(1, avail / px).toFixed(4));
  }
  function renderDocs() {
    var s0 = store.pets[0], d = $('#docs');
    K.applyStyle(d, s0, false);
    $('#page-style').textContent = '@page { size: ' + (s0.print.paper === 'a4' ? 'A4' : 'letter') + '; margin: 0; }';
    var b = K.buildFamilyTags(store.pets.map(function (p, i) { return K.styled(i); }), s0.print.paper, s0.print.tagSize);
    d.innerHTML = b.html;
    var w = b.warnings.slice();
    if (location.protocol === 'file:' && !(CFG.publicBaseUrl || '').trim()) w.unshift('Test mode: the QR codes point to this computer, so a phone cannot open them yet. After publishing, set publicBaseUrl in config.js.');
    store.pets.forEach(function (p, i) { if (!PS.normalizePhone(p.tag.phone)) w.push((p.pet.name || 'Pet ' + (i + 1)) + ' has no WhatsApp phone: its tag page will show the name and note only.'); });
    $('#warn').innerHTML = w.map(function (m) { return '<p class="warn">' + esc(m) + '</p>'; }).join('');
    fit();
  }
  function renderAll() {
    $('#match').checked = !!store.match;
    $$('input[name=fc]').forEach(function (r) { r.checked = r.value === store.pets[0].color; });
    $('#o-paper').value = store.pets[0].print.paper; $('#o-tag').value = store.pets[0].print.tagSize;
    renderCards(); renderDocs();
  }
  $('#btn-print').addEventListener('click', function () { fit(true); setTimeout(function () { window.print(); }, 60); });
  window.addEventListener('afterprint', function () { fit(); });
  window.addEventListener('resize', function () { fit(); });
  renderAll();
})();

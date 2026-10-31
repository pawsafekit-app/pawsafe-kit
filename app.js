// PawSafe Kit — formulario, recorte de foto, documentos imprimibles, guardado.
(function () {
  'use strict';

  var CFG = window.PAWSAFE_CONFIG || {};
  var K = window.PSKit;
  var esc = PS.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var PAPER = K.PAPER, TAGS = K.TAGS, ASPECT = K.ASPECT;
  var store = K.store();
  function S() { return K.S(); }
  function featureOn(name) { return K.featureOn(name); }
  var MAX_PETS = K.MAX_PETS;

  var saveTimer, savedTimer;
  var demoMode = false;   // ?demo=1 es solo para pruebas: no pisa tus datos guardados
  function save() {
    if (K.save()) setSaved('Saved on this device ✓');
    else setSaved('Could not save (storage full or blocked). Download a backup.', true);
  }
  function setSaved(msg, bad) {
    var el = $('#saved'); el.textContent = msg; el.classList.toggle('bad', !!bad);
    clearTimeout(savedTimer);
    if (!bad) savedTimer = setTimeout(function () { el.textContent = ''; }, 2500);
  }

  // ---------- binding ----------
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) {
    var ks = p.split('.'), last = ks.pop();
    ks.reduce(function (a, k) { return a[k]; }, o)[last] = v;
  }
  function syncInputs() {
    $$('[data-bind]').forEach(function (el) {
      var v = getPath(S(), el.dataset.bind);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = (el.value === v);
      else el.value = v == null ? '' : v;
    });
  }
  function onBind(e) {
    var el = e.target.closest && e.target.closest('[data-bind]');
    if (!el) return;
    if (el.type === 'radio' && !el.checked) return;
    setPath(S(), el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
    changed();
  }
  document.addEventListener('input', onBind);
  document.addEventListener('change', onBind);

  var renderTimer;
  function changed() {
    updateUI();
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 250);
    clearTimeout(renderTimer); renderTimer = setTimeout(renderDocs, 120);
  }

  // ---------- family ----------
  function renderFamily() {
    var list = $('#family-list');
    list.innerHTML = S().family.map(function (f, i) {
      return '<div class="fam-row">' +
        '<input type="text" data-fi="' + i + '" data-ff="name" value="' + esc(f.name) + '" maxlength="30" placeholder="Name (e.g. Laura)" aria-label="Person name">' +
        '<input type="text" data-fi="' + i + '" data-ff="role" value="' + esc(f.role) + '" maxlength="30" placeholder="Role (e.g. Mom)" aria-label="Role">' +
        '<button type="button" class="x" data-fdel="' + i + '" aria-label="Remove person">×</button></div>';
    }).join('');
  }
  $('#family-list').addEventListener('input', function (e) {
    var el = e.target; if (el.dataset.fi === undefined) return;
    S().family[+el.dataset.fi][el.dataset.ff] = el.value; changed();
  });
  $('#family-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fdel]'); if (!b) return;
    S().family.splice(+b.dataset.fdel, 1);
    if (!S().family.length) S().family.push({ name: '', role: '' });
    renderFamily(); changed();
  });
  $('#fam-add').addEventListener('click', function () {
    if (S().family.length >= 12) return;
    S().family.push({ name: '', role: '' }); renderFamily(); changed();
    var inputs = $$('#family-list input'); inputs[inputs.length - 2].focus();
  });

  // ---------- recorte de foto ----------
  var srcImg = null, cropKey = 'id', FW = 220;
  var frame = $('#crop-frame'), cimg = $('#crop-img'), zoom = $('#crop-zoom');

  function cropGeom(key, fw) {
    var a = ASPECT[key], fh = fw * a.h / a.w;
    var iw = srcImg.naturalWidth, ih = srcImg.naturalHeight;
    var s0 = Math.max(fw / iw, fh / ih);
    return { a: a, fw: fw, fh: fh, iw: iw, ih: ih, s0: s0 };
  }
  function clampCrop(key) {
    var c = S().photo.crops[key], g = cropGeom(key, 1000);
    c.z = Math.min(4, Math.max(1, c.z));
    var s = g.s0 * c.z, hw = (g.fw / 2) / s / g.iw, hh = (g.fh / 2) / s / g.ih;
    c.cx = Math.min(1 - hw, Math.max(hw, c.cx));
    c.cy = Math.min(1 - hh, Math.max(hh, c.cy));
  }
  function layoutCrop() {
    if (!srcImg) return;
    FW = Math.min(240, Math.max(160, $('#cropper').clientWidth - 8 || 220));
    clampCrop(cropKey);
    var g = cropGeom(cropKey, FW), c = S().photo.crops[cropKey], s = g.s0 * c.z;
    frame.style.width = FW + 'px'; frame.style.height = g.fh + 'px';
    cimg.style.width = g.iw * s + 'px'; cimg.style.height = g.ih * s + 'px';
    cimg.style.left = (FW / 2 - c.cx * g.iw * s) + 'px';
    cimg.style.top = (g.fh / 2 - c.cy * g.ih * s) + 'px';
    zoom.value = c.z;
    $('#crop-size').innerHTML = 'Final size on paper: <b>' + ASPECT[cropKey].label + '</b>';
  }
  function renderCrop(key, ow, oh) {
    var g = cropGeom(key, 1000), c = S().photo.crops[key], s = g.s0 * c.z;
    var hw = (g.fw / 2) / s, hh = (g.fh / 2) / s;
    var cv = document.createElement('canvas'); cv.width = ow; cv.height = oh;
    var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ow, oh);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(srcImg, c.cx * g.iw - hw, c.cy * g.ih - hh, 2 * hw, 2 * hh, 0, 0, ow, oh);
    return cv;
  }
  var commitTimer;
  function commit(keys) {
    clearTimeout(commitTimer);
    commitTimer = setTimeout(function () {
      if (!srcImg) return;
      (keys || ['id', 'cert']).forEach(function (k) {
        clampCrop(k);
        S().photo[k] = renderCrop(k, ASPECT[k].out[0], ASPECT[k].out[1]).toDataURL('image/jpeg', 0.88);
        if (k === 'id') S().photo.thumb = renderCrop('id', 30, 40).toDataURL('image/jpeg', 0.35).split(',')[1];
      });
      changed();
    }, 160);
  }
  function loadSource(dataUrl, thenCommit) {
    var im = new Image();
    im.onload = function () {
      srcImg = im; cimg.src = dataUrl;
      $('#cropper').hidden = false; $('#photo-clear').hidden = false;
      layoutCrop();
      if (thenCommit) commit();
    };
    im.src = dataUrl;
  }
  function pickPhoto(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var m = 1400, k = Math.min(1, m / Math.max(im.naturalWidth, im.naturalHeight));
      var cv = document.createElement('canvas');
      cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      S().photo.src = cv.toDataURL('image/jpeg', 0.86);
      S().photo.crops = { id: { cx: 0.5, cy: 0.5, z: 1 }, cert: { cx: 0.5, cy: 0.5, z: 1 } };
      cimg.src = S().photo.src;
      loadSource(S().photo.src, true);
    };
    im.onerror = function () { URL.revokeObjectURL(url); alert('That file could not be read as an image.'); };
    im.src = url;
  }
  function clearPhoto() {
    var p = S().photo; p.src = p.id = p.cert = p.thumb = null; srcImg = null;
    $('#cropper').hidden = true; $('#photo-clear').hidden = true; cimg.removeAttribute('src');
    changed();
  }
  $('#photo-pick').addEventListener('click', function () { $('#photo-file').click(); });
  $('#photo-file').addEventListener('change', function (e) { pickPhoto(e.target.files[0]); e.target.value = ''; });
  $('#photo-clear').addEventListener('click', clearPhoto);
  $$('#crop-tabs input').forEach(function (r) {
    r.addEventListener('change', function () { cropKey = r.value; layoutCrop(); });
  });
  zoom.addEventListener('input', function () {
    S().photo.crops[cropKey].z = +zoom.value; layoutCrop(); commit([cropKey]);
  });
  (function drag() {
    var down = null;
    frame.addEventListener('pointerdown', function (e) {
      if (!srcImg) return; down = { x: e.clientX, y: e.clientY }; frame.setPointerCapture(e.pointerId);
    });
    frame.addEventListener('pointermove', function (e) {
      if (!down) return;
      var g = cropGeom(cropKey, FW), c = S().photo.crops[cropKey], s = g.s0 * c.z;
      c.cx -= (e.clientX - down.x) / (g.iw * s); c.cy -= (e.clientY - down.y) / (g.ih * s);
      down = { x: e.clientX, y: e.clientY }; layoutCrop();
    });
    function up() { if (down) { down = null; commit([cropKey]); } }
    frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', up);
    frame.addEventListener('wheel', function (e) {
      if (!srcImg) return; e.preventDefault();
      var c = S().photo.crops[cropKey]; c.z *= Math.exp(-e.deltaY * 0.0015); layoutCrop(); commit([cropKey]);
    }, { passive: false });
  })();

  // ---------- backup ----------
  $('#bk-download').addEventListener('click', function () {
    K.exportBackup();
    $('#bk-msg').textContent = 'Backup downloaded. Keep the file somewhere safe.';
  });
  $('#bk-import').addEventListener('click', function () { $('#bk-file').click(); });
  $('#bk-file').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = ''; if (!f) return;
    K.importBackup(f).then(function (ok) {
      store = K.store();
      if (ok) { srcImg = null; loadAll(); setSaved('Saved on this device ✓'); $('#bk-msg').textContent = 'Backup imported ✓'; }
      else if (ok === false) $('#bk-msg').textContent = 'That file is not a PawSafe backup.';
    });
  });
  $('#bk-reset').addEventListener('click', function () {
    if (!confirm('Erase everything on this device and start over? Download a backup first if you want to keep it.')) return;
    var un = store.unlocks;
    store = K.setStore(K.freshStore()); store.unlocks = un; srcImg = null; loadAll(); save();
  });

  // ---------- varias mascotas (Family Pack) ----------
  function renderPetBar() {
    var bar = $('#petbar'), on = featureOn('familyPack');
    bar.hidden = !on; if (!on) return;
    $('#pet-tabs').innerHTML = store.pets.map(function (p, i) {
      return '<button type="button" class="tab' + (i === store.active ? ' on' : '') + '" data-pet="' + i + '">' + esc(p.pet.name || ('Pet ' + (i + 1))) + '</button>';
    }).join('') + (store.pets.length < MAX_PETS ? '<button type="button" class="tab" data-addpet>+ Add pet</button>' : '');
    $('#pet-del').hidden = store.active === 0;
    $('#pet-match').hidden = !(store.match && store.active > 0);
  }
  function switchPet(i) { store.active = i; srcImg = null; K.save(); loadAll(); }
  $('#pet-tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.addpet !== undefined) {
      if (store.pets.length >= MAX_PETS) return;
      var np = K.newPet(); np.color = store.pets[0].color; np.tag.owner = store.pets[0].tag.owner; np.tag.phone = store.pets[0].tag.phone; np.tag.address = store.pets[0].tag.address;
      store.pets.push(np); switchPet(store.pets.length - 1);
    } else if (b.dataset.pet !== undefined) switchPet(+b.dataset.pet);
  });
  $('#pet-del').addEventListener('click', function () {
    if (store.active === 0 || !confirm('Remove this pet from the kit? Download a backup first if you want to keep it.')) return;
    store.pets.splice(store.active, 1); switchPet(Math.min(store.active, store.pets.length - 1));
  });

  // ---------- UI ----------
  function updateUI() {
    var s = S();
    $('#f-bdate').hidden = s.pet.birthMode !== 'date';
    $('#f-age').hidden = s.pet.birthMode !== 'age';
    var ph = $('#phone-msg'), raw = s.tag.phone.trim(), ok = PS.normalizePhone(raw);
    if (raw && !ok) { ph.textContent = 'Use international format with country code, e.g. +1 555 123 4567.'; ph.classList.add('bad'); }
    else { ph.classList.remove('bad'); ph.textContent = ok ? 'WhatsApp number: ' + ok : 'International format with country code. It can be yours or a separate emergency number. Without a phone, the page shows only the name and note, with no WhatsApp button.'; }
    $('#o-tag-wrap').hidden = document.body.dataset.tab !== 'tag';
    $$('[data-feature]').forEach(function (el) { el.hidden = !featureOn(el.dataset.feature); });
    renderPetBar();
  }
  function setView(v) { document.body.dataset.view = v; window.scrollTo(0, 0); if (v === 'docs') fit(); }
  function setTab(t) {
    document.body.dataset.tab = t;
    $$('[data-tab-btn]').forEach(function (b) { b.classList.toggle('on', b.dataset.tabBtn === t); });
    var cap = {
      id: 'Pet ID Card · 85.6 × 54 mm, front and back · photo 3 × 4 cm (1.2 × 1.6 in)',
      birth: 'Birth Certificate · Letter or A4 · photo 4 × 5 cm (1.6 × 2.0 in)',
      vacc: 'Vaccination Card · foldable, 2 pages (print page 1, flip on the long edge, print page 2) · photo 3 × 4 cm (1.2 × 1.6 in)',
      tag: 'QR ID Tag · front and back side by side · cut along the dashed line'
    };
    $('#caption').textContent = cap[t]; updateUI(); fit();
  }
  $$('[data-tab-btn]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tabBtn); }); });
  $$('[data-view-btn]').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.viewBtn); }); });
  $('#btn-edit').addEventListener('click', function () { setView('edit'); setTimeout(function () { $('#f-name').focus(); }, 50); });
  $('#btn-to-docs').addEventListener('click', function () { setView('docs'); });

  function printDocs(all) {
    document.body.dataset.print = all ? 'all' : 'tab';
    fit(true);
    setTimeout(function () { window.print(); }, 60);
  }
  window.addEventListener('afterprint', function () { delete document.body.dataset.print; fit(); });
  $('#btn-print').addEventListener('click', function () { printDocs(false); });
  $('#btn-print-all').addEventListener('click', function () { printDocs(true); });

  // escala de la vista previa al ancho disponible
  function fit(forPrint) {
    var d = $('#docs'), p = PAPER[S().print.paper] || PAPER.letter;
    var px = p.w * 96 / 25.4, avail = d.clientWidth - 16;
    d.style.setProperty('--z', forPrint ? 1 : Math.min(1, avail / px).toFixed(4));
  }
  window.addEventListener('resize', function () { fit(); if (srcImg) layoutCrop(); });

  function renderDocs() {
    var s = K.styled(), d = $('#docs');
    K.applyStyle(d, s, false);
    $('#page-style').textContent = '@page { size: ' + (s.print.paper === 'a4' ? 'A4' : 'letter') + '; margin: 0; }';
    var b = K.build(s), warnings = b.warnings, lastFound = b.lastFound;
    d.innerHTML = b.html;
    if (location.protocol === 'file:' && !(CFG.publicBaseUrl || '').trim()) {
      warnings.unshift('Test mode: the QR points to this computer, so a phone cannot open it yet. On the QR Tag tab, use the “Open tag page” link to check it here. After publishing, set publicBaseUrl in config.js.');
    }
    var w = $('#warn');
    w.innerHTML = warnings.map(function (m) { return '<p class="warn">' + esc(m) + '</p>'; }).join('') +
      '<p class="tagline" data-only="tag"><a id="open-found" target="_blank" rel="noopener" href="' + esc(lastFound) + '">Open tag page</a> · QR link length: ' + lastFound.length + ' characters</p>';
    fit();
  }

  // ---------- arranque ----------
  function loadAll() {
    syncInputs(); renderFamily();
    var ph = S().photo;
    if (ph.src) loadSource(ph.src, false); else { srcImg = null; $('#cropper').hidden = true; $('#photo-clear').hidden = true; }
    updateUI(); renderDocs();
  }

  var q = new URLSearchParams(location.search);
  if (q.get('demo')) {
    demoMode = true; K.setNoSave(true);
    K.demoPet(S(), 'dog');
    if (q.get('demo') === 'family') {   // prueba: 3 mascotas, desbloqueado
      var c2 = K.newPet(); K.demoPet(c2, 'cat'); var c3 = K.newPet(); K.demoPet(c3, 'dog'); c3.pet.name = 'Rocky'; c3.pet.species = 'dog';
      store.pets.push(c2, c3); store.unlocks.familyPack = true;
    }
  }
  if (q.get('pet') && store.pets[+q.get('pet')]) store.active = +q.get('pet');
  if (q.get('paper') === 'a4') S().print.paper = 'a4';
  if (q.get('tag') && TAGS[q.get('tag')]) S().print.tagSize = q.get('tag');
  loadAll();
  if (q.get('demo')) { loadSource(S().photo.src, false); }
  setTab(['id', 'birth', 'vacc', 'tag'].indexOf(q.get('tab')) >= 0 ? q.get('tab') : 'id');
  setView(q.get('view') === 'docs' ? 'docs' : q.get('view') === 'edit' ? 'edit' : (S().pet.name ? 'docs' : 'edit'));
  if (q.get('printstyle')) document.body.dataset.print = q.get('printstyle');   // solo pruebas de PDF
  if (q.get('print')) setTimeout(function () { printDocs(q.get('print') === 'all'); }, 400);
})();

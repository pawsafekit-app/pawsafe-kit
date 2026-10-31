// PawSafe Studio — editor de los 4 documentos. Guarda en el mismo localStorage que el kit.
(function () {
  'use strict';
  var K = window.PSKit, esc = PS.esc, CFG = window.PAWSAFE_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DOCN = { id: 'Pet ID', birth: 'Certificate', vacc: 'Vaccination card', tag: 'QR tag' };
  var ELN = { photo: 'photo', name: 'name' };

  var q = new URLSearchParams(location.search);
  if (q.get('demo')) {
    K.setNoSave(true); K.demoPet(K.S(), 'dog');
    if (q.get('demo') === 'family') { var c2 = K.newPet(); K.demoPet(c2, 'cat'); K.store().pets.push(c2); }
    if (q.get('tpl') && K.TPL[q.get('tpl')]) K.S().studio.tpl = q.get('tpl');
    if (q.get('main')) K.S().studio.main = '#' + q.get('main');
    if (q.get('font') && K.FONTS[q.get('font')]) K.S().studio.font = q.get('font');
    if (q.get('bg')) K.S().studio.bgType = q.get('bg');
    if (q.get('bgc')) K.S().studio.bgColor = '#' + q.get('bgc');
  } else { K.unlock('studio'); }
  var store = K.store();
  if (q.get('pet') && store.pets[+q.get('pet')]) store.active = +q.get('pet');
  function S() { return K.S(); }

  var savedTimer;
  function save() {
    var ok = K.save(), el = $('#saved');
    el.textContent = ok ? 'Saved on this device ✓' : 'Could not save. Download a backup.'; el.classList.toggle('bad', !ok);
    clearTimeout(savedTimer); if (ok) savedTimer = setTimeout(function () { el.textContent = ''; }, 2500);
  }

  // ---------- controles ----------
  function buildStatic() {
    $('#tpl-grid').innerHTML = Object.keys(K.TPL).map(function (k) {
      return '<button type="button" class="tplbtn" data-tpl="' + k + '"><i></i><b>' + K.TPL[k].name + '</b><span>' + K.TPL[k].note + '</span></button>';
    }).join('');
    $('#bg-type').innerHTML = '<option value="">Template default</option>' + Object.keys(K.BGS).map(function (k) { return '<option value="' + k + '">' + K.BGS[k] + '</option>'; }).join('');
    $('#font-pick').innerHTML = '<option value="">Template default</option>' + Object.keys(K.FONTS).map(function (k) { return '<option value="' + k + '">' + K.FONTS[k].name + '</option>'; }).join('');
  }
  function syncControls() {
    var s = S(), st = s.studio, e = K.effStyle(s);
    $('#pickblock').hidden = store.pets.length < 2;
    $('#pet-pick').innerHTML = store.pets.map(function (p, i) { return '<option value="' + i + '"' + (i === store.active ? ' selected' : '') + '>' + esc(p.pet.name || ('Pet ' + (i + 1))) + '</option>'; }).join('');
    $$('.tplbtn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tpl === st.tpl);
      $('i', b).style.background = 'linear-gradient(90deg,' + e.c + ' 0 55%,' + e.l + ' 55%)';
    });
    $('#c-main').value = e.c; $('#c-accent').value = e.d; $('#c-light').value = e.l;
    $('#bg-type').value = st.bgType; $('#bg-color').value = /^#[0-9a-f]{6}$/i.test(e.bgColor) ? e.bgColor : '#ffffff';
    $('#bg-color').disabled = e.bgType === 'none';
    $('#font-pick').value = st.font; $('#font-prev').style.fontFamily = e.font;
    $('#font-prev').textContent = (s.pet.name.trim() || 'Max') + ' · Born in Miami';
    $('#o-paper').value = s.print.paper; $('#o-tag').value = s.print.tagSize;
    $('#bg-msg').textContent = e.dark ? 'Dark backgrounds use a lot of ink and are harder to read. Text turns white automatically.' : 'Light backgrounds print best and use less ink.';
  }
  function changed(full) { save(); if (full !== false) syncControls(); renderDocs(); }

  $('#tpl-grid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tpl]'); if (!b) return;
    var st = S().studio; st.tpl = b.dataset.tpl; st.font = ''; st.bgType = ''; st.bgColor = ''; changed();
  });
  [['#c-main', 'main'], ['#c-accent', 'accent'], ['#c-light', 'light'], ['#bg-color', 'bgColor']].forEach(function (c) {
    $(c[0]).addEventListener('input', function (e) { S().studio[c[1]] = e.target.value; save(); renderDocs(); if (c[1] === 'main') { var ef = K.effStyle(S()); $('#c-accent').value = ef.d; $('#c-light').value = ef.l; } });
  });
  $('#c-reset').addEventListener('click', function () { var st = S().studio; st.main = st.accent = st.light = ''; changed(); });
  $('#bg-type').addEventListener('change', function (e) { var st = S().studio; st.bgType = e.target.value; if (!e.target.value) st.bgColor = ''; changed(); });
  $('#font-pick').addEventListener('change', function (e) { S().studio.font = e.target.value; changed(); });
  $('#o-paper').addEventListener('change', function (e) { S().print.paper = e.target.value; changed(); });
  $('#o-tag').addEventListener('change', function (e) { S().print.tagSize = e.target.value; changed(); });
  $('#pet-pick').addEventListener('change', function (e) { store.active = +e.target.value; selKey = null; save(); syncControls(); renderDocs(); });
  $('#bk-download').addEventListener('click', function () { K.exportBackup(); $('#bk-msg').textContent = 'Backup downloaded. Keep the file somewhere safe.'; });
  $('#bk-import').addEventListener('click', function () { $('#bk-file').click(); });
  $('#bk-file').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = ''; if (!f) return;
    K.importBackup(f).then(function (ok) {
      store = K.store();
      if (ok) { selKey = null; syncControls(); renderDocs(); save(); $('#bk-msg').textContent = 'Backup imported ✓'; }
      else if (ok === false) $('#bk-msg').textContent = 'That file is not a PawSafe backup.';
    });
  });

  // ---------- mover / agrandar ----------
  var selKey = null;
  function setSel(key) {
    selKey = key;
    var mv = S().studio.mv, m = key && mv[key];
    $('#selbox').hidden = !key; $('#sel-none').hidden = !!key;
    if (key) {
      var a = key.split('.'); $('#sel-name').textContent = DOCN[a[0]] + ' · ' + ELN[a[1]];
      $('#sel-size').value = (m && m.s) || 1;
    }
    markSel();
  }
  function markSel() {
    $$('#docs .mv-sel').forEach(function (el) { el.classList.remove('mv-sel'); });
    if (!selKey) return;
    $$('#docs .sheet').forEach(function (sh) {
      $$('[data-mv]', sh).forEach(function (el) { if (sh.dataset.doc + '.' + el.dataset.mv === selKey) el.classList.add('mv-sel'); });
    });
  }
  function getMv(key) { var mv = S().studio.mv; return mv[key] || (mv[key] = { dx: 0, dy: 0, s: 1 }); }
  $('#sel-size').addEventListener('input', function (e) { if (!selKey) return; getMv(selKey).s = +e.target.value; K.applyMv($('#docs'), S()); save(); });
  $('#sel-reset').addEventListener('click', function () { if (!selKey) return; delete S().studio.mv[selKey]; K.applyMv($('#docs'), S()); setSel(selKey); save(); });
  $('#mv-reset').addEventListener('click', function () { S().studio.mv = {}; K.applyMv($('#docs'), S()); if (selKey) setSel(selKey); save(); });

  (function drag() {
    var d = $('#docs'), st = null;
    d.addEventListener('pointerdown', function (e) {
      var el = e.target.closest('[data-mv]'); if (!el) return;
      var sh = el.closest('.sheet'), key = sh.dataset.doc + '.' + el.dataset.mv, m = getMv(key);
      setSel(key); st = { x: e.clientX, y: e.clientY, dx: m.dx, dy: m.dy, key: key, moved: false };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      e.preventDefault();
    });
    d.addEventListener('pointermove', function (e) {
      if (!st) return;
      var z = parseFloat(getComputedStyle(d).getPropertyValue('--z')) || 1, k = z * 96 / 25.4;
      var m = getMv(st.key); m.dx = +(st.dx + (e.clientX - st.x) / k).toFixed(2); m.dy = +(st.dy + (e.clientY - st.y) / k).toFixed(2);
      st.moved = true; K.applyMv(d, S());
    });
    function up() { if (st) { if (st.moved) save(); st = null; } }
    d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
  })();

  // ---------- documentos ----------
  function fit(forPrint) {
    var d = $('#docs'), P = K.PAPER[S().print.paper] || K.PAPER.letter, px = P.w * 96 / 25.4, avail = d.clientWidth - 16;
    d.style.setProperty('--z', forPrint ? 1 : Math.min(1, avail / px).toFixed(4));
  }
  function renderDocs() {
    var s = S(), d = $('#docs');
    K.applyStyle(d, s, true);
    $('#page-style').textContent = '@page { size: ' + (s.print.paper === 'a4' ? 'A4' : 'letter') + '; margin: 0; }';
    var b = K.build(s); d.innerHTML = b.html; K.applyMv(d, s); markSel();
    var w = b.warnings.slice();
    if (location.protocol === 'file:' && !(CFG.publicBaseUrl || '').trim()) w.unshift('Test mode: the QR points to this computer, so a phone cannot open it yet. After publishing, set publicBaseUrl in config.js.');
    $('#warn').innerHTML = w.map(function (m) { return '<p class="warn">' + esc(m) + '</p>'; }).join('');
    $('#o-tag-wrap').hidden = document.body.dataset.tab !== 'tag';
    fit();
  }
  function setTab(t) {
    document.body.dataset.tab = t;
    $$('[data-tab-btn]').forEach(function (b) { b.classList.toggle('on', b.dataset.tabBtn === t); });
    $('#o-tag-wrap').hidden = t !== 'tag'; fit();
  }
  $$('[data-tab-btn]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tabBtn); }); });
  function printDocs(all) { document.body.dataset.print = all ? 'all' : 'tab'; fit(true); setTimeout(function () { window.print(); }, 60); }
  window.addEventListener('afterprint', function () { delete document.body.dataset.print; fit(); });
  $('#btn-print').addEventListener('click', function () { printDocs(false); });
  $('#btn-print-all').addEventListener('click', function () { printDocs(true); });
  window.addEventListener('resize', function () { fit(); });

  buildStatic(); syncControls(); renderDocs();
  setTab(['id', 'birth', 'vacc', 'tag'].indexOf(q.get('tab')) >= 0 ? q.get('tab') : 'id');
  if (q.get('printstyle')) document.body.dataset.print = q.get('printstyle');
})();

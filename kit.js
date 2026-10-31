// PawSafe Kit — núcleo compartido: datos, guardado y generadores de documentos.
// Lo usan el kit (index.html) y los extras (emergency, studio, family). Sin DOM propio.
(function (g) {
  'use strict';

  var CFG = g.PAWSAFE_CONFIG || {};
  var KEY = 'pawsafe.v1';
  var esc = PS.esc;

  var COLORS = {
    pink:  { c: '#e75a97', d: '#a82f66', l: '#fde7f1' },
    blue:  { c: '#3a96dc', d: '#1c68a8', l: '#e2f1fc' },
    green: { c: '#3bae7b', d: '#1e7c52', l: '#e1f5ec' }
  };
  var PAPER = { letter: { w: 215.9, h: 279.4 }, a4: { w: 210, h: 297 } };
  var TAGS = {
    r25:  { shape: 'round', w: 25, h: 25, label: 'round 25 mm' },
    r30:  { shape: 'round', w: 30, h: 30, label: 'round 30 mm' },
    r35:  { shape: 'round', w: 35, h: 35, label: 'round 35 mm' },
    rect: { shape: 'rect',  w: 45, h: 28, label: 'rectangular 45 × 28 mm' }
  };
  var ASPECT = {
    id:   { w: 3, h: 4, out: [600, 800],  label: '3 × 4 cm (1.2 × 1.6 in)' },
    cert: { w: 4, h: 5, out: [800, 1000], label: '4 × 5 cm (1.6 × 2.0 in)' }
  };
  var NOTICE = 'Personalized keepsake. Not a government-issued document. No legal value.';
  var VNOTICE = "Personal record. Does not replace your veterinarian's official records.";
  var MIN_MODULE_MM = 0.28;   // por debajo de esto el QR suele costar escanearlo
  var MAX_PETS = 6;           // mascota principal + hasta 5 extra (Family Pack)

  // ---------- estado ----------
  function newPet() {
    return {
      pet: { species: 'dog', name: '', sex: '', breed: '', coat: '', birthMode: 'date', birthDate: '', age: '', city: '', country: '', marks: '', microchip: '' },
      family: [{ name: '', role: '' }],
      photo: { src: null, crops: { id: { cx: 0.5, cy: 0.5, z: 1 }, cert: { cx: 0.5, cy: 0.5, z: 1 } }, id: null, cert: null, thumb: null },
      color: 'pink',
      tag: { owner: '', phone: '', address: '', note: '', show: { owner: true, phone: true, address: true, note: true }, nameOnFront: true, photoInQr: false },
      print: { paper: 'letter', tagSize: 'r30' },
      studio: { tpl: 'classic', main: '', accent: '', light: '', font: '', bgType: '', bgColor: '', mv: {} },
      emergency: { place: '', when: '', extra: '', reward: '', phoneOnPosts: true, qrOnPosts: true }
    };
  }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function merge(def, src) {
    if (!isObj(src)) return def;
    Object.keys(def).forEach(function (k) {
      if (src[k] === undefined || src[k] === null) return;
      def[k] = isObj(def[k]) ? merge(def[k], src[k]) : src[k];
    });
    if (def.mv !== undefined && isObj(src.mv)) def.mv = src.mv;   // studio.mv es de claves libres
    return def;
  }
  function freshStore() { return { v: 1, active: 0, pets: [newPet()], unlocks: {}, match: false }; }
  function normalizeStore(s) {
    if (!s || !Array.isArray(s.pets) || !s.pets.length) return freshStore();
    s.pets = s.pets.slice(0, MAX_PETS).map(function (p) { return merge(newPet(), p); });
    s.active = Math.min(Math.max(+s.active || 0, 0), s.pets.length - 1);
    s.unlocks = isObj(s.unlocks) ? s.unlocks : {};
    s.match = !!s.match;
    s.v = 1;
    return s;
  }

  var store;
  try { store = normalizeStore(JSON.parse(localStorage.getItem(KEY))); } catch (e) { store = freshStore(); }
  var noSave = false;
  function save() {
    if (noSave) return true;
    try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { return false; }
  }
  function S() { return store.pets[store.active]; }
  function setStore(s) { store = normalizeStore(s); return store; }

  // Extras: se encienden en config.js o al abrir su página (queda en store.unlocks).
  // Es un flag del navegador, no una protección: quien controla el acceso es la entrega post-compra.
  function featureOn(name) { return !!((CFG.features && CFG.features[name]) || (store.unlocks && store.unlocks[name])); }
  function unlock(name) { store.unlocks[name] = true; return save(); }

  // Diseño a juego: las mascotas 2..6 toman color y estilo de la mascota 1.
  function styled(i) {
    var p = store.pets[i === undefined ? store.active : i];
    if (!store.match || p === store.pets[0] || !featureOn('familyPack')) return p;
    var c = JSON.parse(JSON.stringify(p));
    var mv = c.studio.mv;
    c.color = store.pets[0].color;
    c.studio = JSON.parse(JSON.stringify(store.pets[0].studio)); c.studio.mv = mv;
    return c;
  }

  function download(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function exportBackup() {
    var d = { app: 'pawsafe', v: 1, exported: new Date().toISOString(), active: store.active, pets: store.pets, match: store.match };
    var nm = (S().pet.name || 'pet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pet';
    download('pawsafe-backup-' + nm + '-' + new Date().toISOString().slice(0, 10) + '.json', new Blob([JSON.stringify(d)], { type: 'application/json' }));
  }
  // Promesa: true si importó, false si no es un backup de PawSafe, null si canceló.
  function importBackup(file) {
    return new Promise(function (res) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var d = JSON.parse(r.result);
          if (!d || d.app !== 'pawsafe' || !Array.isArray(d.pets) || !d.pets.length) throw new Error('bad');
          if (!confirm('Replace what is on this device with the backup?')) { res(null); return; }
          setStore({ v: 1, active: d.active, pets: d.pets, unlocks: store.unlocks, match: d.match });
          save(); res(true);
        } catch (e) { res(false); }
      };
      r.onerror = function () { res(false); };
      r.readAsText(file);
    });
  }

  // Datos de ejemplo para pruebas (?demo=1). No se guardan.
  function demoPet(s, kind) {
    var set = kind === 'cat' ? { sp: 'cat', e: '🐱', n: 'Luna', br: 'Tabby', co: 'Grey stripes', c: 'pink', sx: 'Female' }
                             : { sp: 'dog', e: '🐶', n: 'Max', br: 'Golden mix', co: 'Golden, white chest', c: 'blue', sx: 'Male' };
    function draw(w, h) {
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var x = cv.getContext('2d'), gr = x.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#bfe3f7'); gr.addColorStop(1, '#f9e2c5'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.font = Math.round(w * 0.58) + 'px "Segoe UI Emoji","Apple Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(set.e, w / 2, h * 0.52);
      return cv;
    }
    s.photo.src = draw(900, 1100).toDataURL('image/jpeg', 0.9);
    s.photo.id = draw(600, 800).toDataURL('image/jpeg', 0.88);
    s.photo.cert = draw(800, 1000).toDataURL('image/jpeg', 0.88);
    s.photo.thumb = draw(30, 40).toDataURL('image/jpeg', 0.35).split(',')[1];
    s.pet = { species: set.sp, name: set.n, sex: set.sx, breed: set.br, coat: set.co, birthMode: 'date', birthDate: '2021-03-14', age: '', city: 'Miami', country: 'USA', marks: 'White left paw', microchip: '' };
    s.family = [{ name: 'Laura', role: 'Mom' }, { name: 'Tom', role: 'Brother' }];
    s.tag.owner = 'Laura Smith'; s.tag.phone = '+1 555 123 4567'; s.tag.address = ''; s.tag.note = 'Allergic to chicken';
    s.color = set.c;
  }

  // ---------- documentos ----------
  var PAW = function (mm) {
    return '<svg class="paw" viewBox="0 0 24 24" style="width:' + mm + 'mm;height:' + mm + 'mm" aria-hidden="true"><ellipse cx="6" cy="10" rx="2.2" ry="3"/><ellipse cx="10.5" cy="6" rx="2.2" ry="3"/><ellipse cx="16" cy="6" rx="2.2" ry="3"/><ellipse cx="19.5" cy="10.5" rx="2.2" ry="3"/><path d="M12 12c-3 0-6 3.5-6 6 0 2 2 3 4 2.5 1.2-.3 2.8-.3 4 0 2 .5 4-.5 4-2.5 0-2.5-3-6-6-6z"/></svg>';
  };
  var BLANK = '<i class="blank"></i>';
  function v(x) { x = (x == null ? '' : String(x)).trim(); return x ? esc(x) : BLANK; }
  function row(l, x) { return '<div class="r"><b>' + l + '</b><span>' + v(x) + '</span></div>'; }
  function abs(x, y, w, h, cls, html) {
    return '<div class="' + cls + '" style="left:' + x + 'mm;top:' + y + 'mm;' + (w ? 'width:' + w + 'mm;' : '') + (h ? 'height:' + h + 'mm;' : '') + '">' + (html || '') + '</div>';
  }
  function photoBox(src, w, h, label) {
    return '<div class="phbox" data-mv="photo" style="width:' + w + 'mm;height:' + h + 'mm">' +
      (src ? '<img alt="" src="' + src + '">' : '<span>PHOTO<br>' + label + '</span>') + '</div>';
  }
  function speciesLabel(sp) { return sp === 'dog' ? 'Dog' : sp === 'cat' ? 'Cat' : 'Pet'; }
  function dobText(p) {
    if (p.birthMode === 'age') return p.age ? 'Approx. ' + p.age : '';
    if (!p.birthDate) return '';
    var a = p.birthDate.split('-').map(Number);
    return new Date(a[0], a[1] - 1, a[2]).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function place(p) { return [p.city, p.country].map(function (x) { return x.trim(); }).filter(Boolean).join(', '); }
  function famList(s) { return s.family.filter(function (f) { return f.name.trim() || f.role.trim(); }); }
  function famText(f) { return esc(f.name.trim()) + (f.name.trim() && f.role.trim() ? ' – ' : '') + esc(f.role.trim()); }

  function marks(rects, pw, ph) {
    var o = 1.5, l = 3.5, out = '';
    rects.forEach(function (r) {
      [[r[0], r[1], -1, -1], [r[0] + r[2], r[1], 1, -1], [r[0], r[1] + r[3], -1, 1], [r[0] + r[2], r[1] + r[3], 1, 1]].forEach(function (c) {
        out += '<line x1="' + (c[0] + c[2] * o) + '" y1="' + c[1] + '" x2="' + (c[0] + c[2] * (o + l)) + '" y2="' + c[1] + '"/>';
        out += '<line x1="' + c[0] + '" y1="' + (c[1] + c[3] * o) + '" x2="' + c[0] + '" y2="' + (c[1] + c[3] * (o + l)) + '"/>';
      });
    });
    return '<svg class="marks" viewBox="0 0 ' + pw + ' ' + ph + '" aria-hidden="true">' + out + '</svg>';
  }
  function sheet(doc, page, inner, extraCls) {
    return '<section class="sheet ' + (extraCls || '') + '" data-doc="' + doc + '" data-page="' + page + '">' + inner + '</section>';
  }
  function sheetHead(pw, title) { return abs(0, 11, pw, 0, 'sh-title', title); }
  function sheetNote(pw, ph, text) { return abs(0, ph - 17, pw, 0, 'sh-note', text); }

  // --- Pet ID ---
  function docId(s, P) {
    var p = s.pet, pw = P.w, ph = P.h, x0 = (pw - 85.6) / 2, yF = 30, yB = 112;
    var photo = s.photo.id, owner = s.tag.owner.trim(), phone = PS.normalizePhone(s.tag.phone);
    var front = '<div class="card">' +
      '<div class="c-head">' + PAW(5) + '<span>PET ID CARD</span><em>PawSafe</em></div>' +
      abs(3, 11.5, 30, 40, 'c-photo', photoBox(photo, 30, 40, '3 × 4 cm')) +
      abs(36, 11, 47.5, 0, 'c-body',
        '<div class="c-name"><span data-mv="name" class="mvb">' + v(p.name) + '</span></div>' +
        row('Species', speciesLabel(p.species) + (p.sex ? ' · ' + p.sex : '')) +
        row('Breed', p.breed) + row('Coat', p.coat) + row('Born', dobText(p)) + row('Microchip', p.microchip)) +
      abs(36, 48.2, 47.5, 0, 'c-foot', NOTICE) + '</div>';
    var fam = famList(s), shown = fam.slice(0, 4);
    var back = '<div class="card">' +
      '<div class="c-head">' + PAW(5) + '<span>HUMAN FAMILY</span><em>PawSafe</em></div>' +
      abs(4, 11.5, 37, 0, 'c-body',
        (shown.length ? shown.map(function (f) { return '<div class="fam">' + famText(f) + '</div>'; }).join('') : '<div class="fam">' + BLANK + '</div><div class="fam">' + BLANK + '</div>') +
        (fam.length > 4 ? '<div class="fam more">+ ' + (fam.length - 4) + ' more</div>' : '')) +
      abs(44, 11.5, 39.5, 0, 'c-body',
        row('Born in', place(p)) + '<div class="r clamp2"><b>Marks</b><span>' + v(p.marks) + '</span></div>' +
        (owner || phone ? row('Contact', [owner, phone].filter(Boolean).join(' · ')) : '')) +
      abs(4, 48.2, 79.5, 0, 'c-foot', NOTICE) + '</div>';
    return sheet('id', 1,
      sheetHead(pw, 'PET ID CARD · print, then cut along the corner marks') +
      abs(x0, yF - 9, 85.6, 0, 'lbl-mini', 'FRONT') + abs(x0, yF, 85.6, 54, 'cardpos', front) +
      abs(x0, yB - 9, 85.6, 0, 'lbl-mini', 'BACK') + abs(x0, yB, 85.6, 54, 'cardpos', back) +
      marks([[x0, yF, 85.6, 54], [x0, yB, 85.6, 54]], pw, ph) +
      sheetNote(pw, ph, 'Card size: 85.6 × 54 mm (credit-card size). Photo size: 3 × 4 cm (1.2 × 1.6 in).<br>Glue front and back together, or laminate.'));
  }

  // --- Birth Certificate ---
  function docBirth(s, P) {
    var p = s.pet, pw = P.w, ph = P.h, fam = famList(s);
    var when = p.birthMode === 'age' ? (p.age ? 'is approximately <b>' + esc(p.age) + '</b> old' : 'was born on ' + BLANK)
      : 'was born on <b>' + v(dobText(p)) + '</b>';
    var where = place(p) ? ' in <b>' + esc(place(p)) + '</b>' : ' in ' + BLANK;
    var lines = ''; for (var i = 0; i < 5; i++) lines += '<div class="ln"></div>';
    var inner =
      '<div class="cert-frame"><div class="cert-in">' +
        '<div class="cert-top">' + PAW(14) + '<h1>Certificate of Birth</h1><div class="sub">PawSafe keepsake</div></div>' +
        '<div class="cert-mid">' +
          '<div class="cert-photo">' + photoBox(s.photo.cert, 40, 50, '4 × 5 cm') + '</div>' +
          '<div class="cert-text"><p>This certifies that</p><div class="cert-name"><span data-mv="name" class="mvb">' + v(p.name) + '</span></div>' +
          '<p>a ' + (p.species === 'other' ? 'pet' : esc(p.species)) + ', ' + when + where + '.</p></div>' +
        '</div>' +
        '<div class="cert-grid">' + row('Species', speciesLabel(p.species)) + row('Sex', p.sex) + row('Breed', p.breed) +
          row('Coat color', p.coat) + row('Microchip', p.microchip) + row('Distinguishing marks', p.marks) + '</div>' +
        '<div class="cert-fam"><b>Human family</b>' + (fam.length ? fam.map(function (f) { return '<span>' + famText(f) + '</span>'; }).join('') : '<span>' + BLANK + '</span>') + '</div>' +
        '<div class="cert-obs"><b>Observations</b>' + lines + '</div>' +
        '<div class="cert-sign"><div><i></i>Owner signature</div><div><i></i>Date</div></div>' +
        '<div class="cert-foot">' + NOTICE + '<br>Photo size: 4 × 5 cm (1.6 × 2.0 in)</div>' +
      '</div></div>';
    return sheet('birth', 1, inner, 'cert');
  }

  // --- Vaccination ---
  function vtable(cols, n) {
    var th = cols.map(function (c) { return '<th style="width:' + c[1] + '%">' + c[0] + '</th>'; }).join('');
    var rows = ''; for (var i = 0; i < n; i++) rows += '<tr>' + cols.map(function () { return '<td></td>'; }).join('') + '</tr>';
    return '<table class="vt"><thead><tr>' + th + '</tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function docVacc(s, P) {
    var p = s.pet, pw = P.w, ph = P.h, x0 = (pw - 190) / 2, y0 = 28, PW = 95, PH = 135;
    var owner = s.tag.owner.trim(), phone = PS.normalizePhone(s.tag.phone);
    var foot = function (vac) { return abs(4, PH - 11, PW - 8, 0, 'p-foot', (vac ? VNOTICE + '<br>' : '') + NOTICE); };
    var head = function (t) { return '<div class="p-head">' + PAW(5.5) + '<span>' + t + '</span></div>'; };
    var cover = '<div class="panel">' + head('VACCINATION CARD') +
      abs((PW - 30) / 2, 22, 30, 40, 'c-photo', photoBox(s.photo.id, 30, 40, '3 × 4 cm')) +
      abs(4, 68, PW - 8, 0, 'p-name', '<span data-mv="name" class="mvb">' + v(p.name) + '</span>') +
      abs(4, 82, PW - 8, 0, 'p-sub', [speciesLabel(p.species), p.sex, p.breed].map(function (x) { return (x || '').trim(); }).filter(Boolean).map(esc).join(' · ') || '&nbsp;') +
      abs(4, 92, PW - 8, 0, 'p-sub', dobText(p) ? 'Born: ' + esc(dobText(p)) : '&nbsp;') +
      foot(false) + '</div>';
    var back = '<div class="panel">' + head('MY DETAILS') +
      abs(5, 16, PW - 10, 0, 'c-body',
        row('Name', p.name) + row('Species', speciesLabel(p.species)) + row('Breed', p.breed) + row('Coat', p.coat) +
        row('Born', dobText(p)) + row('Microchip', p.microchip) + row('Owner', owner) + row('Phone', phone || '')) +
      foot(true) + '</div>';
    var vac = '<div class="panel">' + head('VACCINATIONS') +
      abs(4, 15, PW - 8, 0, 'p-table', vtable([['Date', 19], ['Vaccine', 33], ['Next dose', 20], ['Vet signature', 28]], 9)) + foot(true) + '</div>';
    var dew = '<div class="panel">' + head('DEWORMING &amp; PARASITE CONTROL') +
      abs(4, 15, PW - 8, 0, 'p-table', vtable([['Date', 19], ['Product', 33], ['Next dose', 20], ['Signature', 28]], 6)) +
      abs(4, 15 + 6 + 6 * 10.5 + 3, PW - 8, 0, 'p-notes', '<b>Notes &amp; allergies</b><div class="ln"></div><div class="ln"></div>') + foot(true) + '</div>';
    var fold = '<div class="fold" style="left:' + (x0 + PW) + 'mm;top:' + (y0 - 4) + 'mm;height:' + (PH + 8) + 'mm"></div>';
    var rects = [[x0, y0, 190, PH]];
    var note = sheetNote(pw, ph, 'Folded size: 95 × 135 mm. Photo size: 3 × 4 cm (1.2 × 1.6 in). Cut on the corner marks, fold on the dashed line.');
    return sheet('vacc', 1, sheetHead(pw, 'VACCINATION CARD · page 1 of 2 · outside') +
        abs(x0, y0, PW, PH, 'panelpos', back) + abs(x0 + PW, y0, PW, PH, 'panelpos', cover) + fold + marks(rects, pw, ph) + note) +
      sheet('vacc', 2, sheetHead(pw, 'VACCINATION CARD · page 2 of 2 · inside (print on the back of page 1, flip on the long edge)') +
        abs(x0, y0, PW, PH, 'panelpos', vac) + abs(x0 + PW, y0, PW, PH, 'panelpos', dew) + fold + marks(rects, pw, ph) + note);
  }

  // --- QR tags ---
  var warnings = [];
  var lastFound = '';
  function tagPieces(s) {
    var t = TAGS[s.print.tagSize] || TAGS.r30;
    var payload = PS.foundPayload(s.pet, s.tag, s.photo, s.color);
    var url = PS.foundUrl(payload), droppedPhoto = false;
    if (payload.i) {                       // la foto solo viaja si el QR sigue siendo escaneable
      var tmp = PS.qrSvg(url), qs0 = t.shape === 'round' ? t.w * 0.58 : t.h - 6;
      if (qs0 / tmp.total < MIN_MODULE_MM) { delete payload.i; url = PS.foundUrl(payload); droppedPhoto = true; }
    }
    var qr = PS.qrSvg(url);
    var qs = t.shape === 'round' ? t.w * 0.58 : t.h - 6;
    var mod = qs / qr.total;
    lastFound = url;
    if (mod < MIN_MODULE_MM) warnings.push('This QR is dense for a ' + t.label + ' tag (' + qr.modules + ' × ' + qr.modules + ' modules, ' + mod.toFixed(2) + ' mm each). It may be hard to scan. Pick a bigger tag, or hide some data with the switches.');
    if (droppedPhoto) warnings.push('The tiny photo did not fit in the QR without making it too dense, so it was left out. The page will show the pet name and species instead.');
    return { t: t, qr: qr, qs: qs, url: url };
  }
  function tagFront(s, t) {
    var name = s.pet.name.trim(), showName = s.tag.nameOnFront && name, w = t.w, h = t.h, inner;
    if (t.shape === 'rect') {
      var fs = Math.min(h * 0.32, (w - 17) / (Math.max(name.length, 3) * 0.58));
      inner = '<div class="tg-row">' + PAW(h * 0.42) + '<div class="tg-name" data-mv="name" style="font-size:' + fs.toFixed(2) + 'mm">' + (showName ? esc(name) : 'PawSafe') + '</div></div>';
    } else {
      var f2 = Math.max(2.2, Math.min(w * 0.2, (w * 0.7) / (Math.max(name.length, 3) * 0.58)));
      inner = '<div class="tg-col">' + PAW(w * (showName ? 0.28 : 0.42)) + '<div class="tg-name" data-mv="name" style="font-size:' + (showName ? f2.toFixed(2) : (w * 0.1).toFixed(2)) + 'mm">' + (showName ? esc(name) : 'PawSafe') + '</div></div>';
    }
    return '<div class="tag ' + t.shape + ' front" style="width:' + w + 'mm;height:' + h + 'mm"><div class="tag-in">' + inner + '</div></div>';
  }
  function tagBack(t, qs, qr) {
    var q = '<div class="tg-qr" style="width:' + qs + 'mm;height:' + qs + 'mm">' + qr.svg + '</div>';
    var cap = '<div class="tg-cap" style="font-size:' + (t.shape === 'rect' ? 2.6 : Math.max(1.7, t.w * 0.058)).toFixed(2) + 'mm">Scan if found</div>';
    var inner = t.shape === 'rect' ? '<div class="tg-row">' + q + cap + '</div>' : '<div class="tg-col">' + q + (t.w >= 30 ? cap : '') + '</div>';
    return '<div class="tag ' + t.shape + ' back" style="width:' + t.w + 'mm;height:' + t.h + 'mm"><div class="tag-in">' + inner + '</div></div>';
  }
  function docTag(s, P) {
    var pw = P.w, ph = P.h, d = tagPieces(s), t = d.t;
    var pairW = t.w * 2 + 4, gx = 8, gy = 6, mx = 14, top = 26, bottom = 24;
    var cols = Math.max(1, Math.floor((pw - 2 * mx + gx) / (pairW + gx)));
    var rows = Math.max(1, Math.floor((ph - top - bottom + gy) / (t.h + gy)));
    var gridW = cols * pairW + (cols - 1) * gx, x0 = (pw - gridW) / 2, html = '';
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var x = x0 + c * (pairW + gx), y = top + r * (t.h + gy);
      html += abs(x, y, t.w, t.h, 'tagpos', tagFront(s, t)) + abs(x + t.w + 4, y, t.w, t.h, 'tagpos', tagBack(t, d.qs, d.qr));
    }
    return sheet('tag', 1, sheetHead(pw, 'QR ID TAGS · ' + t.label + ' · ' + (rows * cols) + ' per sheet · cut along the dashed line (front left, back right)') + html +
      sheetNote(pw, ph, 'Glue front and back together, or print on adhesive paper, then laminate and attach to a collar tag.<br>' + NOTICE));
  }

  // ---------- estilos (Studio) ----------
  var FONTS = {
    sans:    { name: 'Clean sans',    css: '"Segoe UI",system-ui,Arial,sans-serif' },
    serif:   { name: 'Classic serif', css: 'Georgia,"Times New Roman",serif' },
    rounded: { name: 'Rounded',       css: '"Trebuchet MS","Arial Rounded MT Bold",Verdana,sans-serif' },
    hand:    { name: 'Handwritten',   css: '"Segoe Print","Bradley Hand","Comic Sans MS",cursive' },
    elegant: { name: 'Elegant',       css: '"Palatino Linotype",Palatino,"Book Antiqua",serif' },
    type:    { name: 'Typewriter',    css: '"Courier New",Courier,monospace' }
  };
  var TPL = {
    classic: { name: 'Classic',        note: 'Solid header bars',          font: 'sans',    hd: 'fill',    bd: 'solid',  rad: 3,   bg: ['none', ''] },
    outline: { name: 'Clean outline',  note: 'Light, ink-friendly',        font: 'sans',    hd: 'outline', bd: 'thick',  rad: 2,   bg: ['none', ''] },
    pill:    { name: 'Soft pill',      note: 'Rounded and friendly',       font: 'rounded', hd: 'pill',    bd: 'solid',  rad: 6,   bg: ['dots', ''] },
    paws:    { name: 'Paw prints',     note: 'Paw pattern background',     font: 'rounded', hd: 'fill',    bd: 'solid',  rad: 4,   bg: ['paws', ''] },
    modern:  { name: 'Modern',         note: 'Side accent, soft tint',     font: 'sans',    hd: 'side',    bd: 'none',   rad: 1.5, bg: ['gradient', ''] },
    vintage: { name: 'Vintage',        note: 'Serif, cream, double line',  font: 'elegant', hd: 'outline', bd: 'double', rad: 1,   bg: ['solid', '#fbf4e4'] }
  };
  var BGS = { none: 'Plain white', solid: 'Solid color', gradient: 'Soft gradient', dots: 'Dots', stripes: 'Stripes', paws: 'Paw prints' };

  function hex2rgb(h) { h = (h || '#000000').replace('#', ''); if (h.length === 3) h = h.replace(/(.)/g, '$1$1'); return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0]; }
  function rgb2hex(a) { return '#' + a.map(function (v) { return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); }).join(''); }
  function mix(a, b, t) { var x = hex2rgb(a), y = hex2rgb(b); return rgb2hex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function lum(h) { var c = hex2rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }

  // Estilo efectivo = plantilla + lo que el usuario cambió + color del kit.
  function effStyle(s) {
    var st = s.studio, t = TPL[st.tpl] || TPL.classic, base = COLORS[s.color] || COLORS.pink;
    var c = st.main || base.c;
    var d = st.accent || (st.main ? mix(st.main, '#000000', 0.38) : base.d);
    var l = st.light || (st.main ? mix(st.main, '#ffffff', 0.86) : base.l);
    var bgType = st.bgType || t.bg[0], bgColor = st.bgColor || t.bg[1] || l;
    var tint = mix(c, '#ffffff', 0.8), svg, full = '#ffffff', base0 = '#ffffff';
    if (bgType === 'solid') { full = bgColor; base0 = bgColor; }
    else if (bgType === 'gradient') { base0 = st.bgColor || l; full = 'linear-gradient(180deg,' + base0 + ',#ffffff)'; }
    else if (bgType === 'dots') { base0 = st.bgColor || '#ffffff'; full = 'radial-gradient(circle,' + tint + ' 0.55mm,transparent 0.65mm) 0 0/5mm 5mm,' + base0; }
    else if (bgType === 'stripes') { base0 = st.bgColor || '#ffffff'; full = 'repeating-linear-gradient(45deg,' + tint + ' 0 2.5mm,' + base0 + ' 2.5mm 5mm)'; }
    else if (bgType === 'paws') {
      base0 = st.bgColor || '#ffffff';
      svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><g fill='" + tint + "'><ellipse cx='6' cy='10' rx='2.2' ry='3'/><ellipse cx='10.5' cy='6' rx='2.2' ry='3'/><ellipse cx='16' cy='6' rx='2.2' ry='3'/><ellipse cx='19.5' cy='10.5' rx='2.2' ry='3'/><path d='M12 12c-3 0-6 3.5-6 6 0 2 2 3 4 2.5 1.2-.3 2.8-.3 4 0 2 .5 4-.5 4-2.5 0-2.5-3-6-6-6z'/></g></svg>";
      full = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 0 0/14mm 14mm,' + base0;
    }
    return { c: c, d: d, l: l, font: FONTS[st.font || t.font].css, fontKey: st.font || t.font, hd: t.hd, bd: t.bd, rad: t.rad,
      bgType: bgType, bgColor: bgColor, bgFull: full, dark: lum(base0) < 0.3 };
  }
  // withStudio=false → look del kit (colores base, sin plantilla).
  function applyStyle(el, s, withStudio) {
    var P = PAPER[s.print.paper] || PAPER.letter;
    el.style.setProperty('--pw', P.w + 'mm'); el.style.setProperty('--ph', P.h + 'mm');
    if (!withStudio) {
      var c = COLORS[s.color] || COLORS.pink;
      el.style.setProperty('--c', c.c); el.style.setProperty('--cd', c.d); el.style.setProperty('--cl', c.l);
      ['--font', '--bgfull', '--rad'].forEach(function (k) { el.style.removeProperty(k); });
      ['data-hd', 'data-bd', 'data-dark'].forEach(function (k) { el.removeAttribute(k); });
      return;
    }
    var e = effStyle(s);
    el.style.setProperty('--c', e.c); el.style.setProperty('--cd', e.d); el.style.setProperty('--cl', e.l);
    el.style.setProperty('--font', e.font); el.style.setProperty('--bgfull', e.bgFull); el.style.setProperty('--rad', e.rad + 'mm');
    el.setAttribute('data-hd', e.hd); el.setAttribute('data-bd', e.bd);
    if (e.dark) el.setAttribute('data-dark', ''); else el.removeAttribute('data-dark');
  }
  // Mover/agrandar foto y nombre: offsets en mm guardados en studio.mv["doc.elemento"].
  function applyMv(root, s) {
    var mv = s.studio.mv || {};
    Array.prototype.forEach.call(root.querySelectorAll('.sheet'), function (sh) {
      Array.prototype.forEach.call(sh.querySelectorAll('[data-mv]'), function (el) {
        var m = mv[sh.dataset.doc + '.' + el.dataset.mv];
        el.style.transform = m ? 'translate(' + (m.dx || 0) + 'mm,' + (m.dy || 0) + 'mm) scale(' + (m.s || 1) + ')' : '';
      });
    });
  }

  // ---------- armado ----------
  // Devuelve { html, warnings, lastFound } con los 4 documentos (5 hojas).
  function build(s) {
    var P = PAPER[s.print.paper] || PAPER.letter;
    warnings = [];
    var html = docId(s, P) + docBirth(s, P) + docVacc(s, P) + docTag(s, P);
    return { html: html, warnings: warnings.slice(), lastFound: lastFound };
  }
  // Hoja de chapitas de toda la familia (2 pares de cada mascota).
  function buildFamilyTags(pets, paperKey, tagSize) {
    var P = PAPER[paperKey] || PAPER.letter, t = TAGS[tagSize] || TAGS.r30, cells = [], warn = [];
    pets.forEach(function (p) {
      var s = JSON.parse(JSON.stringify(p)); s.print.tagSize = tagSize;
      warnings = [];
      var d = tagPieces(s);
      warn = warn.concat(warnings.map(function (w) { return (p.pet.name || 'Pet') + ': ' + w; }));
      var ef = effStyle(s), vars = 'display:contents;--c:' + ef.c + ';--cd:' + ef.d + ';--cl:' + ef.l;
      for (var i = 0; i < 2; i++) cells.push({ f: tagFront(s, d.t), b: tagBack(d.t, d.qs, d.qr), vars: vars });
    });
    var pw = P.w, ph = P.h, pairW = t.w * 2 + 4, gx = 8, gy = 6, mx = 14, top = 26, bottom = 24;
    var cols = Math.max(1, Math.floor((pw - 2 * mx + gx) / (pairW + gx)));
    var rows = Math.max(1, Math.floor((ph - top - bottom + gy) / (t.h + gy)));
    var gridW = cols * pairW + (cols - 1) * gx, x0 = (pw - gridW) / 2, html = '';
    cells.slice(0, cols * rows).forEach(function (c, i) {
      var x = x0 + (i % cols) * (pairW + gx), y = top + Math.floor(i / cols) * (t.h + gy);
      html += '<div style="' + c.vars + '">' + abs(x, y, t.w, t.h, 'tagpos', c.f) + abs(x + t.w + 4, y, t.w, t.h, 'tagpos', c.b) + '</div>';
    });
    var over = cells.length > cols * rows ? ' · showing the first ' + (cols * rows) + ' pairs' : '';
    return { html: sheet('ftag', 1, sheetHead(pw, 'FAMILY QR ID TAGS · ' + t.label + ' · ' + pets.length + ' pets, 2 pairs each' + over + ' · cut along the dashed line') + html +
      sheetNote(pw, ph, 'Glue front and back together, or print on adhesive paper, then laminate and attach to a collar tag.<br>' + NOTICE)), warnings: warn };
  }

  g.PSKit = {
    KEY: KEY, COLORS: COLORS, PAPER: PAPER, TAGS: TAGS, ASPECT: ASPECT, NOTICE: NOTICE, VNOTICE: VNOTICE, MIN_MODULE_MM: MIN_MODULE_MM, MAX_PETS: MAX_PETS,
    FONTS: FONTS, TPL: TPL, BGS: BGS,
    newPet: newPet, normalizeStore: normalizeStore, freshStore: freshStore, setStore: setStore,
    store: function () { return store; }, S: S, save: save, setNoSave: function (v) { noSave = !!v; },
    featureOn: featureOn, unlock: unlock, styled: styled,
    exportBackup: exportBackup, importBackup: importBackup, demoPet: demoPet, download: download,
    effStyle: effStyle, applyStyle: applyStyle, applyMv: applyMv, mix: mix, lum: lum,
    build: build, buildFamilyTags: buildFamilyTags, tagPieces: tagPieces, speciesLabel: speciesLabel, dobText: dobText, place: place, famList: famList, famText: famText,
    sheet: sheet, abs: abs, marks: marks, PAW: PAW, sheetHead: sheetHead, sheetNote: sheetNote, photoBox: photoBox, row: row, v: v
  };
})(window);

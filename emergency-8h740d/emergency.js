// Lost Pet Emergency Pack — cartel, imágenes para redes y checklist. Todo local, sin servidor.
(function () {
  'use strict';
  var K = window.PSKit, esc = PS.esc, CFG = window.PAWSAFE_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var BLANK = '<i class="blank"></i>';
  var RED = '#c8102e';

  var q = new URLSearchParams(location.search);
  if (q.get('demo')) {
    K.setNoSave(true);
    K.demoPet(K.S(), 'dog');
    K.S().emergency.place = 'Oak Street park, near the fountain'; K.S().emergency.when = 'Oct 28, around 6 pm';
    K.S().emergency.extra = 'Blue collar, a little shy with strangers';
    if (q.get('demo') === 'family') { var c2 = K.newPet(); K.demoPet(c2, 'cat'); K.store().pets.push(c2); }
  } else { K.unlock('emergency'); }
  var store = K.store();
  if (q.get('pet') && store.pets[+q.get('pet')]) store.active = +q.get('pet');
  function S() { return K.S(); }

  // ---------- datos ----------
  function renderPet() {
    var s = S(), p = s.pet, pick = $('#pet-pick');
    $('#pick-wrap').hidden = store.pets.length < 2;
    pick.innerHTML = store.pets.map(function (x, i) { return '<option value="' + i + '"' + (i === store.active ? ' selected' : '') + '>' + esc(x.pet.name || ('Pet ' + (i + 1))) + '</option>'; }).join('');
    $('#pet-card').innerHTML = (s.photo.id ? '<img alt="" src="' + s.photo.id + '">' : '<div class="ph0">no photo</div>') +
      '<div><b>' + (p.name.trim() ? esc(p.name.trim()) : 'No name yet') + '</b>' +
      '<span class="xnote">' + K.speciesLabel(p.species) + (p.breed ? ' · ' + esc(p.breed) : '') + '</span><br>' +
      '<a href="../index.html?pet=' + store.active + '">Edit details in my kit</a></div>';
    var miss = [];
    if (!PS.normalizePhone(s.tag.phone)) miss.push('a WhatsApp phone number (QR ID Tag section of your kit)');
    if (!s.photo.cert) miss.push('a photo');
    if (!p.name.trim()) miss.push('the pet name');
    $('#kit-warn').textContent = miss.length ? 'Still missing in your kit: ' + miss.join(', ') + '.' : '';
    $('#kit-warn').classList.toggle('bad', miss.length > 0);
    $('#o-paper').value = s.print.paper;
    $$('[data-e]').forEach(function (el) {
      var v = s.emergency[el.dataset.e];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v || '';
    });
  }
  function onInput(e) {
    var el = e.target.closest && e.target.closest('[data-e]'); if (!el) return;
    S().emergency[el.dataset.e] = el.type === 'checkbox' ? el.checked : el.value;
    K.save(); schedule();
  }
  document.addEventListener('input', onInput); document.addEventListener('change', onInput);
  $('#pet-pick').addEventListener('change', function (e) { store.active = +e.target.value; K.save(); renderPet(); renderAll(); });
  $('#o-paper').addEventListener('change', function (e) { S().print.paper = e.target.value; K.save(); renderAll(); });

  // ---------- hojas imprimibles ----------
  function phoneText(s) { return s.tag.phone.trim() || ''; }
  function poster(s, P) {
    var pw = P.w, ph = P.h, e = s.emergency, p = s.pet, extra = ph - 279.4;
    var kind = p.species === 'dog' ? 'DOG' : p.species === 'cat' ? 'CAT' : 'PET', name = p.name.trim();
    var url = PS.foundUrl(PS.foundPayload(p, s.tag, null, s.color, { lost: true })), qr = PS.qrSvg(url);
    var rows = '';
    [['Breed', p.breed], ['Color', p.coat], ['Sex', p.sex], ['Marks', p.marks]].forEach(function (r) {
      if (r[1] && r[1].trim()) rows += '<div class="pr"><b>' + r[0] + '</b><span>' + esc(r[1].trim()) + '</span></div>';
    });
    if (p.microchip.trim()) rows += '<div class="pr"><b>Microchip</b><span>Yes</span></div>';
    var seen = (e.place.trim() || e.when.trim())
      ? '<div class="ps-seen"><small>Last seen</small>' + esc([e.place.trim(), e.when.trim()].filter(Boolean).join(' · ')) + '</div>'
      : '<div class="ps-seen"><small>Last seen</small>' + BLANK + '</div>';
    var right = '<div class="ps-name">' + (name ? esc(name) : BLANK) + '</div>' + rows + seen +
      (e.extra.trim() ? '<div class="pr"><b>Note</b><span>' + esc(e.extra.trim()) + '</span></div>' : '') +
      (e.reward.trim() ? '<div class="ps-reward">' + esc(e.reward.trim()) + '</div>' : '');
    var phone = phoneText(s), yB = 156 + extra * 0.5, top = ph - 10 - 48, N = 8, sw = (pw - 16) / N, strips = '';
    for (var i = 0; i < N; i++) {
      strips += K.abs(8 + i * sw, top, sw, 48, 'strip', '<span>' + (name ? esc(name) + ' · ' : '') + (phone ? esc(phone) : BLANK) + '<small>FOUND ME? CALL</small></span>');
    }
    var band = '<div><div class="cta">Call or text</div><div class="num">' + (phone ? esc(phone) : BLANK) + '</div></div>' +
      '<div class="qr">' + qr.svg + 'Scan to tell the owner where you are, on WhatsApp</div>';
    return K.sheet('poster', 1,
      K.abs(0, 9, pw, 0, 'ps-title', 'LOST ' + kind) +
      K.abs(0, 36, pw, 0, 'ps-sub', name ? 'Please help bring ' + esc(name) + ' home' : 'Please help bring my pet home') +
      K.abs(14, 46, 84, 105, 'ps-photo', K.photoBox(s.photo.cert, 84, 105, '4 × 5 cm')) +
      K.abs(106, 46, pw - 120, 0, 'ps-right', right) +
      K.abs(14, yB, pw - 28, 0, 'ps-band', band) +
      K.abs(14, yB + 51, pw - 28, 0, 'ps-honest', 'This QR is not a GPS tracker. Nothing is sent automatically: if you scan it, you choose whether to message the owner on WhatsApp.<br>' + K.NOTICE) +
      K.abs(0, top - 4, pw, 0, 'strips-hint', 'CUT ALONG THE DASHED LINES · KEEP THE TOP EDGE ATTACHED SO THE STRIPS HANG TOGETHER') +
      strips, 'poster');
  }

  function checklist(s, P) {
    var name = s.pet.name.trim(), e = s.emergency, seen = [e.place.trim(), e.when.trim()].filter(Boolean).join(' · ');
    var li = function (t) { return '<li><span>' + t + '</span></li>'; };
    var fill = function (t) { return '<span class="fill">' + (t ? esc(t) : '&nbsp;') + '</span>'; };
    var inner = '<div class="ck-in">' +
      '<h1>First 24 hours' + (name ? ' · ' + esc(name) + ' is missing' : '') + '</h1>' +
      '<p class="lead">Stay as calm as you can and work down this list. Tick each box as you go. This is general guidance, not veterinary or legal advice.</p>' +
      '<h2>Right now · first hour</h2><ul>' +
        li('Search the area where your pet was last seen, on foot, calling their name calmly. Bring a leash or carrier, and treats or a favorite toy.') +
        li('Check every hiding spot at home first: under beds, closets, garage, basement, behind appliances, inside cars.') +
        li('Ask neighbors to look in garages, sheds, porches and under decks.') +
        li('Write down the exact place and time your pet was last seen: ' + fill(seen)) +
        li('Keep your phone on and charged. Ask someone to stay at home in case your pet comes back on their own.') +
      '</ul>' +
      '<h2>Next few hours</h2><ul>' +
        li('Print the LOST poster from this pack and put it where many people pass: shops, vet clinics, community boards, near where your pet was last seen.') +
        li('Share the social images from this pack on your own accounts and in local lost-pet and neighborhood groups.') +
        li('Call local animal shelters, animal control and nearby vets, and give them a description. If you can, visit shelters in person: a description over the phone may not match.') +
        li('If your pet is microchipped, contact the microchip company to report them missing and check your contact details are up to date. Company: ' + fill('')) +
        li('Leave familiar-smelling items (bedding, worn clothing) near your door. It can help some pets find their way back.') +
      '</ul>' +
      '<h2>By the end of day one</h2><ul>' +
        li('Search again at dusk and after dark with a flashlight, when streets are quieter. Scared pets often will not come when called, so look quietly and listen.') +
        li('Talk to delivery drivers, mail carriers, dog walkers and nearby businesses. Show them a photo.') +
        li('Keep checking WhatsApp and your phone for messages from anyone who scans your pet\'s QR. Remember: the tag is not a GPS tracker, you only hear from someone if they choose to message you.') +
        li('Be careful with anyone who asks for money before returning your pet. Meet in a public place and bring someone with you.') +
      '</ul>' +
      '<div class="tip"><b>Where to look.</b> Cats often hide silently close to where they got out. Dogs may move farther. Frightened pets can hide in very small spaces and may stay still for hours.</div>' +
      '<h2>Who I have told</h2><div class="who"><div>Animal shelter / control</div><div>Vet clinic</div><div>Microchip company</div><div>Neighbors / friends</div></div>' +
      '<div class="ck-foot">' + K.NOTICE + '<br>PawSafe tags are not GPS trackers.</div></div>';
    return K.sheet('check', 1, inner, 'ckpage');
  }

  // ---------- redes (canvas) ----------
  function wrap(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawQR(ctx, url, x, y, size) {
    var m = PS.qrMatrix(url), t = m.n + 2, cell = size / t;
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, size, size); ctx.fillStyle = '#000';
    for (var r = 0; r < m.n; r++) for (var c = 0; c < m.n; c++) if (m.dark(r, c)) ctx.fillRect(Math.floor(x + (c + 1) * cell), Math.floor(y + (r + 1) * cell), Math.ceil(cell), Math.ceil(cell));
  }
  function drawCover(ctx, img, x, y, w, h) {
    var s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }
  function lines(ctx, txt, x, y, font, color, maxW, lh, limit) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    wrap(ctx, txt, maxW).forEach(function (l) { if (y <= limit) { ctx.fillText(l, x, y); y += lh; } });
    return y;
  }
  var FF = '"Segoe UI","Helvetica Neue",Arial,sans-serif';

  function info(ctx, d, x, y, w, story, ink, soft, limit) {
    var nameSize = story ? 112 : 84, fs = story ? 42 : 34, lh = fs * 1.3;
    ctx.font = '800 ' + nameSize + 'px ' + FF;
    while (ctx.measureText(d.name).width > w && nameSize > 40) { nameSize -= 4; ctx.font = '800 ' + nameSize + 'px ' + FF; }
    ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    y += nameSize * 0.9; ctx.fillText(d.name, x, y); y += lh * 0.95;
    d.details.forEach(function (r) { y = lines(ctx, r, x, y, '600 ' + fs + 'px ' + FF, soft, w, lh, limit); });
    if (d.seen && y + lh * 1.3 <= limit) {
      y += lh * 0.25; ctx.font = '700 ' + (fs * 0.62) + 'px ' + FF; ctx.fillStyle = '#d98f00'; ctx.textAlign = 'left'; ctx.fillText('LAST SEEN', x, y); y += lh * 0.95;
      y = lines(ctx, d.seen, x, y, '800 ' + (fs * 1.0) + 'px ' + FF, ink, w, lh, limit);
    }
    if (d.extra) { y += lh * 0.1; y = lines(ctx, d.extra, x, y, '600 ' + fs * 0.9 + 'px ' + FF, soft, w, lh * 0.95, limit); }
    if (d.reward) { y += lh * 0.15; y = lines(ctx, d.reward, x, y, '800 ' + fs + 'px ' + FF, '#ff6a6a', w, lh, limit); }
    return y;
  }
  function contact(ctx, W, H, d, story, ink, soft, panel) {
    var qs = story ? 250 : 200, pad = 50, qy = H - 96 - qs, top = qy;
    if (d.url) {
      ctx.fillStyle = '#fff'; rr(ctx, W - pad - qs - 12, qy - 12, qs + 24, qs + 24, 18); ctx.fill();
      drawQR(ctx, d.url, W - pad - qs, qy, qs);
      ctx.font = '600 20px ' + FF; ctx.fillStyle = soft; ctx.textAlign = 'center';
      ctx.fillText('Scan to message the owner', W - pad - qs / 2, qy + qs + 38);
    }
    if (d.phone) {
      var maxW = (d.url ? W - 2 * pad - qs - 40 : W - 2 * pad);
      ctx.textAlign = 'left'; ctx.font = '700 26px ' + FF; ctx.fillStyle = soft; ctx.fillText('CALL OR TEXT', pad, qy + qs * 0.42);
      var fs = story ? 66 : 58; ctx.font = '900 ' + fs + 'px ' + FF;
      while (ctx.measureText(d.phone).width > maxW && fs > 30) { fs -= 2; ctx.font = '900 ' + fs + 'px ' + FF; }
      ctx.fillStyle = ink; ctx.fillText(d.phone, pad, qy + qs * 0.42 + fs + 6);
    }
    ctx.textAlign = 'center'; ctx.font = '500 21px ' + FF; ctx.fillStyle = soft;
    ctx.fillText('This QR is not a GPS tracker: the owner is notified only if you send a message.', W / 2, H - 30);
    return top - 20;
  }

  function drawPost(cv, tpl, W, H, d) {
    var ctx = cv.getContext('2d'), story = H > W, pad = 50;
    cv.width = W; cv.height = H;
    var ink = '#111', soft = '#444';
    if (tpl === 'A') {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      var bh = story ? 250 : 180; ctx.fillStyle = RED; ctx.fillRect(0, 0, W, bh);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 ' + (story ? 150 : 118) + 'px ' + FF; ctx.fillText('LOST ' + d.kind, W / 2, bh / 2 + 6);
      var y0 = bh + 36, lim = contact(ctx, W, H, d, story, ink, soft);
      ctx.fillStyle = '#fff';
      if (!story) {
        var pw = 380, ph = 475; ctx.save(); rr(ctx, pad, y0, pw, ph, 22); ctx.clip(); if (d.img) drawCover(ctx, d.img, pad, y0, pw, ph); else { ctx.fillStyle = '#eee'; ctx.fillRect(pad, y0, pw, ph); } ctx.restore();
        ctx.lineWidth = 8; ctx.strokeStyle = '#111'; rr(ctx, pad, y0, pw, ph, 22); ctx.stroke();
        info(ctx, d, pad + pw + 40, y0, W - pad * 2 - pw - 40, false, ink, soft, lim);
      } else {
        var sw = 520, sh = 650, sx = (W - sw) / 2; ctx.save(); rr(ctx, sx, y0, sw, sh, 26); ctx.clip(); if (d.img) drawCover(ctx, d.img, sx, y0, sw, sh); else { ctx.fillStyle = '#eee'; ctx.fillRect(sx, y0, sw, sh); } ctx.restore();
        ctx.lineWidth = 9; ctx.strokeStyle = '#111'; rr(ctx, sx, y0, sw, sh, 26); ctx.stroke();
        info(ctx, d, pad, y0 + sh + 20, W - pad * 2, true, ink, soft, lim);
      }
    } else if (tpl === 'B') {
      var c = d.color; ctx.fillStyle = c.l; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; rr(ctx, 28, 28, W - 56, H - 56, 40); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = RED; rr(ctx, W / 2 - 190, 64, 380, 64, 32); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '800 36px ' + FF; ctx.fillText('LOST ' + d.kind, W / 2, 108);
      var hy = story ? 220 : 190; ctx.fillStyle = c.d; ctx.font = '800 ' + (story ? 76 : 60) + 'px ' + FF; ctx.fillText('Have you seen ' + (d.rawName || 'this pet') + '?', W / 2, hy, W - 140);
      var lim2 = contact(ctx, W, H, d, story, ink, soft), y1 = hy + 40;
      if (!story) {
        var bw = 340, bh2 = 425; ctx.save(); rr(ctx, pad + 10, y1, bw, bh2, 30); ctx.clip(); if (d.img) drawCover(ctx, d.img, pad + 10, y1, bw, bh2); else { ctx.fillStyle = '#eee'; ctx.fillRect(pad + 10, y1, bw, bh2); } ctx.restore();
        ctx.lineWidth = 10; ctx.strokeStyle = c.c; rr(ctx, pad + 10, y1, bw, bh2, 30); ctx.stroke();
        info(ctx, d, pad + bw + 50, y1, W - pad * 2 - bw - 50, false, ink, soft, lim2);
      } else {
        var bw2 = 480, bh3 = 600, bx = (W - bw2) / 2; ctx.save(); rr(ctx, bx, y1, bw2, bh3, 34); ctx.clip(); if (d.img) drawCover(ctx, d.img, bx, y1, bw2, bh3); else { ctx.fillStyle = '#eee'; ctx.fillRect(bx, y1, bw2, bh3); } ctx.restore();
        ctx.lineWidth = 12; ctx.strokeStyle = c.c; rr(ctx, bx, y1, bw2, bh3, 34); ctx.stroke();
        info(ctx, d, pad + 10, y1 + bh3 + 20, W - pad * 2 - 20, true, ink, soft, lim2);
      }
    } else {   // C: foto a pantalla completa
      ctx.fillStyle = '#222'; ctx.fillRect(0, 0, W, H); if (d.img) drawCover(ctx, d.img, 0, 0, W, H);
      var g = ctx.createLinearGradient(0, H * (story ? 0.30 : 0.28), 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(0,0,0,.78)'); g.addColorStop(1, 'rgba(0,0,0,.92)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = RED; rr(ctx, pad, pad, 330, 84, 18); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 52px ' + FF; ctx.fillText('LOST ' + d.kind, pad + 165, pad + 44);
      var lim3 = contact(ctx, W, H, d, story, '#fff', '#ddd');
      var iy = H * 0.40; info(ctx, d, pad, iy, W - pad * 2, story, '#fff', '#e6e6e6', lim3);
    }
  }

  var TPLS = [['A', 'Bold alert', 'High contrast, readable at a glance'], ['B', 'Soft card', 'Uses your kit color'], ['C', 'Photo first', 'Full-bleed photo']];
  var photoImg = null, photoSrc = '';
  function socialData(s) {
    var p = s.pet, e = s.emergency, c = K.COLORS[s.color] || K.COLORS.pink, name = p.name.trim();
    var det = []; [p.breed, p.coat].forEach(function (x) { if (x && x.trim()) det.push(x.trim()); });
    if (p.sex && p.sex !== 'Unknown') det.unshift(p.sex);
    if (p.marks.trim()) det.push(p.marks.trim());
    var ph = PS.normalizePhone(s.tag.phone) ? s.tag.phone.trim() : '';
    return { kind: p.species === 'dog' ? 'DOG' : p.species === 'cat' ? 'CAT' : 'PET', name: name || 'My pet', rawName: name,
      details: det, seen: [e.place.trim(), e.when.trim()].filter(Boolean).join(' · '), extra: e.extra.trim(), reward: e.reward.trim(),
      phone: e.phoneOnPosts ? ph : '', url: e.qrOnPosts ? PS.foundUrl(PS.foundPayload(p, s.tag, null, s.color, { lost: true })) : '', color: c, img: photoImg };
  }
  function renderSocial() {
    var s = S(), list = $('#social-list');
    if (!list.firstChild || list.dataset.pet !== String(store.active)) {
      list.dataset.pet = String(store.active);
      list.innerHTML = TPLS.map(function (t) {
        return '<div class="tplcard"><h3>' + t[1] + '</h3><span class="xnote">' + t[2] + '</span><div class="tplrow">' +
          '<div class="cv"><canvas data-t="' + t[0] + '" data-f="post"></canvas><button type="button" class="btn ghost small" data-dl="' + t[0] + ':post">Download post 1:1 (PNG)</button></div>' +
          '<div class="cv story"><canvas data-t="' + t[0] + '" data-f="story"></canvas><button type="button" class="btn ghost small" data-dl="' + t[0] + ':story">Download story 9:16 (PNG)</button></div>' +
          '</div></div>';
      }).join('');
    }
    var go = function () {
      var d = socialData(s);
      $$('canvas', list).forEach(function (cv) { drawPost(cv, cv.dataset.t, 1080, cv.dataset.f === 'story' ? 1920 : 1080, d); });
    };
    if (s.photo.cert && s.photo.cert !== photoSrc) {
      photoSrc = s.photo.cert; var im = new Image(); im.onload = function () { photoImg = im; go(); }; im.src = photoSrc;
    } else { if (!s.photo.cert) { photoImg = null; photoSrc = ''; } go(); }
  }
  $('#social-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-dl]'); if (!b) return;
    var a = b.dataset.dl.split(':'), cv = $('canvas[data-t="' + a[0] + '"][data-f="' + a[1] + '"]');
    var nm = (S().pet.name || 'pet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pet';
    cv.toBlob(function (bl) { K.download('pawsafe-lost-' + nm + '-' + a[0].toLowerCase() + '-' + a[1] + '.png', bl); }, 'image/png');
  });

  // ---------- pestañas / pantalla ----------
  function fit(forPrint) {
    var d = $('#docs'), P = K.PAPER[S().print.paper] || K.PAPER.letter, px = P.w * 96 / 25.4, avail = d.clientWidth - 16;
    d.style.setProperty('--z', forPrint ? 1 : Math.min(1, avail / px).toFixed(4));
  }
  function setTab(t) {
    document.body.dataset.tab = t;
    $$('[data-tab-btn]').forEach(function (b) { b.classList.toggle('on', b.dataset.tabBtn === t); });
    var soc = t === 'social';
    $('#social').hidden = !soc; $('#docs').hidden = soc; $('#print-ctl').hidden = soc;
    if (soc) renderSocial(); else fit();
  }
  $$('[data-tab-btn]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tabBtn); }); });
  $('#btn-print').addEventListener('click', function () { fit(true); setTimeout(function () { window.print(); }, 60); });
  window.addEventListener('afterprint', function () { fit(); });
  window.addEventListener('resize', function () { fit(); });

  function renderAll() {
    var s = S(), P = K.PAPER[s.print.paper] || K.PAPER.letter, d = $('#docs');
    K.applyStyle(d, s, false);
    $('#page-style').textContent = '@page { size: ' + (s.print.paper === 'a4' ? 'A4' : 'letter') + '; margin: 0; }';
    d.innerHTML = poster(s, P) + checklist(s, P);
    var w = [];
    if (!PS.normalizePhone(s.tag.phone)) w.push('The poster needs a phone with WhatsApp in international format. Add it in your kit (QR ID Tag section).');
    if (location.protocol === 'file:' && !(CFG.publicBaseUrl || '').trim()) w.push('Test mode: the QR points to this computer, so a phone cannot open it yet. After publishing, set publicBaseUrl in config.js.');
    $('#warn').innerHTML = w.map(function (m) { return '<p class="warn">' + esc(m) + '</p>'; }).join('');
    fit();
    if (document.body.dataset.tab === 'social') renderSocial();
  }
  var tm; function schedule() { clearTimeout(tm); tm = setTimeout(renderAll, 140); }

  renderPet(); renderAll();
  setTab(['poster', 'social', 'check'].indexOf(q.get('tab')) >= 0 ? q.get('tab') : 'poster');
  if (q.get('paper') === 'a4') { S().print.paper = 'a4'; $('#o-paper').value = 'a4'; renderAll(); }
})();

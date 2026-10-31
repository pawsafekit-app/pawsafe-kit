// Utilidades compartidas por index.html y found.html
(function (g) {
  'use strict';

  var ROOT = (document.currentScript && document.currentScript.src) ? new URL('.', document.currentScript.src).href : null;

  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    return new TextDecoder().decode(Uint8Array.from(bin, function (c) { return c.charCodeAt(0); }));
  }

  // Devuelve "+15551234567" o null si no es un número internacional válido.
  function normalizePhone(raw) {
    if (!raw) return null;
    var s = String(raw).trim().replace(/[\s().\-]/g, '');
    if (s.indexOf('00') === 0) s = '+' + s.slice(2);
    return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // QR → { svg, modules }. Un módulo de zona blanca a cada lado.
  function qrSvg(text) {
    var q = qrcode(0, 'L');
    q.addData(text);
    q.make();
    var n = q.getModuleCount(), d = '';
    for (var y = 0; y < n; y++) {
      var x = 0;
      while (x < n) {
        if (q.isDark(y, x)) {
          var s = x;
          while (x < n && q.isDark(y, x)) x++;
          d += 'M' + (s + 1) + ' ' + (y + 1) + 'h' + (x - s) + 'v1h-' + (x - s) + 'z';
        } else x++;
      }
    }
    var t = n + 2;
    return {
      modules: n,
      total: t,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + ' ' + t +
        '" shape-rendering="crispEdges"><rect width="' + t + '" height="' + t +
        '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>'
    };
  }

  // Matriz del QR para dibujarlo en un canvas (imágenes para redes).
  function qrMatrix(text) {
    var q = qrcode(0, 'L'); q.addData(text); q.make();
    return { n: q.getModuleCount(), dark: function (y, x) { return q.isDark(y, x); } };
  }

  function foundBase() {
    var cfg = g.PAWSAFE_CONFIG || {}, b = (cfg.publicBaseUrl || '').trim();
    if (b) return /\.html?$/i.test(b) ? b : b.replace(/\/?$/, '/') + 'found.html';
    // found.html vive en la raíz del sitio, junto a common.js (también cuando se llama desde las carpetas de los extras)
    return new URL('found.html', ROOT || location.href).href;
  }

  // Solo viaja en la URL lo que el dueño dejó visible.
  // opts.lost = true: el cartel de mascota perdida; el teléfono impreso también viaja en el QR.
  function foundPayload(pet, tag, photo, color, opts) {
    opts = opts || {};
    var show = tag.show || {}, p = { v: 1, n: (pet.name || '').trim(), sp: (pet.species || 'other').charAt(0), c: (color || 'pink').charAt(0) };
    var phone = normalizePhone(tag.phone);
    if (opts.lost) p.l = 1;
    if (show.owner && tag.owner && tag.owner.trim()) p.o = tag.owner.trim();
    if ((show.phone || opts.lost) && phone) p.p = phone;
    if (show.address && tag.address && tag.address.trim()) p.a = tag.address.trim();
    if (show.note && tag.note && tag.note.trim()) p.t = tag.note.trim();
    if (tag.photoInQr && photo && photo.thumb) p.i = photo.thumb;
    return p;
  }

  function foundUrl(payload) {
    return foundBase() + '#' + b64urlEncode(JSON.stringify(payload));
  }

  g.PS = { b64urlEncode: b64urlEncode, b64urlDecode: b64urlDecode, normalizePhone: normalizePhone, esc: esc,
    qrSvg: qrSvg, qrMatrix: qrMatrix, foundBase: foundBase, foundPayload: foundPayload, foundUrl: foundUrl };
})(window);

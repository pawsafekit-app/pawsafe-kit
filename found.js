// found.html — lo que ve quien encuentra la mascota. Sin servidor: todo viene en el hash de la URL.
(function () {
  'use strict';
  var esc = PS.esc;
  var app = document.getElementById('app');
  var honest = document.getElementById('honest');
  var ICON = { d: '🐶', c: '🐱', o: '🐾' };
  var KIND = { d: 'dog', c: 'cat', o: 'pet' };

  honest.textContent = 'Heads up: this tag is not a GPS tracker. Nothing is sent automatically. ' +
    'If you tap the WhatsApp button, you choose to send your location, and the message goes from your own phone.';

  var p = null;
  try {
    var h = location.hash.replace(/^#/, '');
    if (h) p = JSON.parse(PS.b64urlDecode(h));
  } catch (e) { p = null; }

  if (!p || typeof p !== 'object') {
    app.innerHTML = '<div class="icon">🐾</div><h1>PawSafe tag</h1>' +
      '<p class="lead">This link has no pet information. If you found a pet with this tag, please try scanning the QR code again.</p>';
    return;
  }

  document.body.setAttribute('data-c', /^[bg]$/.test(p.c || '') ? p.c : 'p');
  var kind = KIND[p.sp] || 'pet';
  var name = (p.n || '').trim();
  var phone = PS.normalizePhone(p.p);

  var html = '';
  if (p.i && /^[A-Za-z0-9+\/=_-]+$/.test(p.i)) {
    html += '<img class="photo" alt="" src="data:image/jpeg;base64,' + p.i.replace(/-/g, '+').replace(/_/g, '/') + '">';
  } else {
    html += '<div class="icon">' + (ICON[p.sp] || '🐾') + '</div>';
  }
  if (p.l) html += '<p class="lostbar">This ' + kind + ' is missing. The owner is looking for them.</p>';
  html += '<p class="lead">You found a ' + kind + '! Thank you 💛</p>';
  html += '<h1>' + (name ? esc(name) : 'Lost ' + kind) + '</h1>';
  if (p.t) html += '<div class="note"><b>Important note</b>' + esc(p.t) + '</div>';
  var info = '';
  if (p.o) info += '<div><span>Owner</span>' + esc(p.o) + '</div>';
  if (p.a) info += '<div><span>Address</span>' + esc(p.a) + '</div>';
  if (phone) info += '<div><span>Phone</span>' + esc(phone) + '</div>';
  if (info) html += '<div class="info">' + info + '</div>';

  if (phone) {
    html += '<div class="btns">' +
      '<a class="btn call" href="tel:' + phone + '">Call owner</a>' +
      '<button class="btn wa" id="wa" type="button">Send my location on WhatsApp</button></div>' +
      '<p class="status" id="status"></p>';
  } else {
    html += '<p class="none">The owner did not add a phone number to this tag.</p>';
  }
  app.innerHTML = html;

  var wa = document.getElementById('wa');
  if (!wa) return;
  var status = document.getElementById('status');
  var who = name ? name : 'your ' + kind;

  function open(loc) {
    var msg = 'Hi! I found ' + who + '.' +
      (loc ? ' I am here: https://www.google.com/maps?q=' + loc.lat + ',' + loc.lng
           : ' I could not share my location, please reply and I will tell you where I am.');
    location.href = 'https://wa.me/' + phone.slice(1) + '?text=' + encodeURIComponent(msg);
  }

  wa.addEventListener('click', function () {
    if (!navigator.geolocation) { open(null); return; }
    status.textContent = 'Asking for your location…';
    wa.disabled = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      status.textContent = 'Opening WhatsApp…';
      wa.disabled = false;
      open({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
    }, function () {
      status.textContent = 'No location shared. Opening WhatsApp without it…';
      wa.disabled = false;
      open(null);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
})();

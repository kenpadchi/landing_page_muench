(function () {
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  var form = document.getElementById('contactForm');
  var statusEl = document.getElementById('formStatus');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      statusEl.className = 'form-status';
      statusEl.textContent = 'Wird gesendet …';
      fetch('https://formsubmit.co/ajax/die.alltagsengel@web.de', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      }).then(function (data) {
        if (data.success === false || data.success === 'false') throw new Error('rejected');
        form.reset();
        statusEl.className = 'form-status ok';
        statusEl.textContent = 'Vielen Dank! Ihre Nachricht wurde gesendet.';
      }).catch(function () {
        statusEl.className = 'form-status err';
        statusEl.textContent = 'Das Senden hat leider nicht geklappt. Bitte rufen Sie uns an: 02684 – 9767397.';
      }).finally(function () { btn.disabled = false; });
    });
  }

  var items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach(function (el) { io.observe(el); });
})();

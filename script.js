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
    var emailEl = form.querySelector('input[name="email"]');
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var emailFehler = 'Die E-Mail-Adresse ist nicht korrekt. Bitte prüfen Sie Ihre Eingabe (z. B. name@beispiel.de).';

    function zeigeFehler(text) {
      statusEl.className = 'form-status err';
      statusEl.textContent = text;
    }
    // Fehlermeldung ausblenden, sobald die E-Mail-Adresse korrigiert wird
    emailEl.addEventListener('input', function () {
      emailEl.setCustomValidity('');
      if (statusEl.textContent === emailFehler) {
        statusEl.className = 'form-status';
        statusEl.textContent = '';
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (!emailRe.test(emailEl.value.trim())) {
        zeigeFehler(emailFehler);
        emailEl.setCustomValidity(emailFehler);
        emailEl.reportValidity();
        emailEl.focus();
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      statusEl.className = 'form-status';
      statusEl.textContent = 'Wird gesendet …';
      fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      }).then(function (r) {
        // Auch bei 4xx die Meldung des Servers lesen (z. B. ungültige E-Mail)
        return r.json().then(function (data) { return { status: r.status, data: data }; },
                             function () { return { status: r.status, data: null }; });
      }).then(function (res) {
        if (res.data && res.data.success) {
          form.reset();
          statusEl.className = 'form-status ok';
          statusEl.textContent = 'Vielen Dank! Ihre Nachricht wurde gesendet.';
          return;
        }
        if (res.status >= 400 && res.status < 500 && res.data && res.data.message) {
          zeigeFehler(res.data.message);   // Eingabefehler: konkrete Meldung, kein Anruf-Hinweis
          return;
        }
        zeigeFehler('Das Senden hat leider nicht geklappt. Bitte rufen Sie uns an: 02684 – 9767397.');
      }).catch(function () {
        zeigeFehler('Das Senden hat leider nicht geklappt. Bitte rufen Sie uns an: 02684 – 9767397.');
      }).finally(function () { btn.disabled = false; });
    });
  }

  // Team-Karussell: natives Scroll-Snap (Wischen), Pfeile + Punkte per JS
  var carousel = document.getElementById('teamCarousel');
  if (carousel) {
    var track = carousel.querySelector('.carousel-track');
    var cards = Array.prototype.slice.call(track.children);
    var prev = carousel.querySelector('.carousel-prev');
    var next = carousel.querySelector('.carousel-next');
    var dotsWrap = carousel.querySelector('.carousel-dots');
    var dots = [];

    function cardStep() {
      return cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
    }
    // Anzahl erreichbarer Scroll-Positionen: Karten minus gleichzeitig sichtbare + 1
    function positionCount() {
      var maxScroll = track.scrollWidth - track.clientWidth;
      return maxScroll > 2 ? Math.round(maxScroll / cardStep()) + 1 : 1;
    }
    function currentIndex() {
      return Math.min(positionCount() - 1, Math.round(track.scrollLeft / cardStep()));
    }
    function scrollToCard(i) {
      i = Math.max(0, Math.min(positionCount() - 1, i));
      track.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: 'smooth' });
    }
    function buildDots() {
      var n = positionCount();
      if (dots.length === n) return;
      dotsWrap.innerHTML = '';
      dots = [];
      for (var i = 0; i < n; i++) {
        (function (k) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('role', 'tab');
          b.setAttribute('aria-label', 'Zu ' + cards[k].querySelector('h3').textContent);
          b.addEventListener('click', function () { scrollToCard(k); });
          dotsWrap.appendChild(b);
          dots.push(b);
        })(i);
      }
      dotsWrap.hidden = n < 2;
    }
    function update() {
      buildDots();
      var i = currentIndex();
      var maxScroll = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= maxScroll - 2;
      dots.forEach(function (d, k) { d.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    }

    prev.addEventListener('click', function () { scrollToCard(currentIndex() - 1); });
    next.addEventListener('click', function () { scrollToCard(currentIndex() + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); scrollToCard(currentIndex() - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); scrollToCard(currentIndex() + 1); }
    });
    track.tabIndex = 0;

    var raf;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
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

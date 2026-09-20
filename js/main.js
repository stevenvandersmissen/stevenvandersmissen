/* ==========================================================================
   Steven Vandersmissen — interactions & animation
   Vanilla JS, no dependencies. Everything degrades gracefully.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionPref = 'auto';
  try { motionPref = localStorage.getItem('sv-motion') || 'auto'; } catch (e) {}
  function motionReduced() {
    if (motionPref === 'on') return false;    /* visitor overrides the OS */
    if (motionPref === 'off') return true;
    return reduceMedia.matches;               /* auto = follow the OS */
  }
  var reduceMotion = motionReduced();
  window.__reduced = motionReduced;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ------------------------------------------------- 1. word splitting */
  function splitWords(el) {
    if (el.dataset.split === 'done') return;
    el.dataset.split = 'done';
    el.classList.add('split');

    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      var parts = node.nodeValue.split(/(\s+)/);
      parts.forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        var w = document.createElement('span');
        w.className = 'w';
        var i = document.createElement('i');
        i.textContent = part;
        w.appendChild(i);
        frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });

    var words = el.querySelectorAll('.w > i');
    Array.prototype.forEach.call(words, function (w, idx) {
      w.style.setProperty('--wd', (idx * 0.035).toFixed(3) + 's');
    });
  }

  document.querySelectorAll('[data-split]').forEach(splitWords);

  /* ---------------------------------------------------------- 2. reveal */
  var revealTargets = document.querySelectorAll('[data-reveal], .stagger, [data-split]');
  var pending = [];
  Array.prototype.forEach.call(revealTargets, function (el) { pending.push(el); });

  function markIn(el) {
    el.classList.add('is-in');
    var i = pending.indexOf(el);
    if (i > -1) pending.splice(i, 1);
  }

  /* auto stagger index for children without an inline --i */
  document.querySelectorAll('.stagger').forEach(function (list) {
    Array.prototype.forEach.call(list.children, function (child, i) {
      if (!child.style.getPropertyValue('--i')) child.style.setProperty('--i', i);
    });
  });

  /* fallback: plain rect check — guarantees reveals even if IO misbehaves
     (e.g. elements hidden by clip-path report a zero intersection rect) */
  function sweep() {
    if (!pending.length) return;
    var limit = window.innerHeight - 40;
    for (var i = pending.length - 1; i >= 0; i--) {
      var r = pending[i].getBoundingClientRect();
      if (r.top < limit && r.bottom > 0) markIn(pending[i]);
    }
  }

  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        markIn(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    revealTargets.forEach(function (el) { io.observe(el); });

    window.addEventListener('scroll', function () {
      requestAnimationFrame(sweep);
    }, { passive: true });
    window.addEventListener('resize', function () { requestAnimationFrame(sweep); });
    window.setTimeout(sweep, 400);
  } else {
    revealTargets.forEach(markIn);
  }

  /* ------------------------------------------------------ 3. scrollspy */
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('.nav__list a, .topbar__nav a'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* --------------------------------------------------- 3b. mechelen clock */
  var clockEl = document.getElementById('clock');
  if (clockEl) {
    var fmt = null;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Brussels',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
    } catch (e) { fmt = null; }
    var tickClock = function () {
      var t = fmt ? fmt.format(new Date()) : new Date().toTimeString().slice(0, 8);
      clockEl.textContent = '[ MECHELEN ' + t + ' ]';
    };
    tickClock();
    window.setInterval(tickClock, 1000);
  }

  /* ------------------------------------------------- 4. scroll progress */
  var bar = document.querySelector('.progress');
  var topbar = document.getElementById('topbar');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      if (bar) bar.style.transform = 'scaleX(' + p + ')';
      if (topbar) topbar.classList.toggle('is-on', window.scrollY > window.innerHeight * 0.65);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------- 5. theming */
  var THEMES = [
    { id: 'green',  label: 'green'  },
    { id: 'dark',   label: 'dark'   },
    { id: 'blue',   label: 'blue'   },
    { id: 'pink',   label: 'pink'   },
    { id: 'purple', label: 'purple' }
  ];

  var themeBtns = document.querySelectorAll('[data-theme-toggle]');
  var themeLabels = document.querySelectorAll('[data-theme-label]');
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(id, silent) {
    var theme = THEMES.filter(function (t) { return t.id === id; })[0] || THEMES[0];
    root.setAttribute('data-theme', theme.id);
    themeLabels.forEach(function (l) { l.textContent = theme.label; });
    if (themeMeta) {
      themeMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
    }
    if (!silent) {
      try { localStorage.setItem('sv-theme', theme.id); } catch (e) {}
    }
    window.dispatchEvent(new CustomEvent('themechange', { detail: { id: theme.id } }));
  }

  function nextTheme() {
    var cur = root.getAttribute('data-theme');
    var idx = THEMES.map(function (t) { return t.id; }).indexOf(cur);
    return THEMES[(idx + 1) % THEMES.length].id;
  }

  var stored = null;
  try { stored = localStorage.getItem('sv-theme'); } catch (e) {}
  applyTheme(stored || root.getAttribute('data-theme') || 'green', true);

  themeBtns.forEach(function (themeBtn) {
    themeBtn.addEventListener('click', function (ev) {
      var id = nextTheme();

      var canVT = typeof document.startViewTransition === 'function' && !reduceMotion;
      if (!canVT) { applyTheme(id); return; }

      var rect = themeBtn.getBoundingClientRect();
      root.style.setProperty('--vt-x', (rect.left + rect.width / 2) + 'px');
      root.style.setProperty('--vt-y', (rect.top + rect.height / 2) + 'px');
      root.classList.add('vt-circle');

      var vt = document.startViewTransition(function () { applyTheme(id); });
      vt.finished.then(function () { root.classList.remove('vt-circle'); })
        .catch(function () { root.classList.remove('vt-circle'); });
    });
  });

  /* -------------------------------------------------- 6. cursor chip */
  var tip = document.querySelector('.cursor-tip');
  var tipLabel = tip ? tip.querySelector('span') : null;

  if (tip && finePointer && !reduceMotion) {
    var tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    var cx = tx, cy = ty, raf = null, visible = false;

    function loop() {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      tip.style.transform =
        'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' +
        (visible ? 1 : 0.6) + ')';
      /* keep animating while visible or still easing towards the pointer */
      if (visible || Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }

    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!raf) loop();
    }, { passive: true });

    document.querySelectorAll('[data-tip]').forEach(function (el) {
      el.addEventListener('pointerenter', function () {
        if (tipLabel) tipLabel.textContent = el.getAttribute('data-tip') || 'view';
        tip.classList.add('is-on');
        visible = true;
        if (!raf) loop();
      });
      el.addEventListener('pointerleave', function () {
        tip.classList.remove('is-on');
        visible = false;
        if (!raf) loop();
      });
    });
  }

  /* ----------------------------------------------------- 7. lightbox */
  var lb = document.querySelector('.lightbox');
  var lbImg = lb ? lb.querySelector('img') : null;
  var lbTitle = lb ? lb.querySelector('[data-lb-title]') : null;
  var lastFocus = null;

  function openLightbox(src, title, trigger) {
    if (!lb || !lbImg) return;
    lastFocus = trigger || document.activeElement;
    lbImg.src = src;
    lbImg.alt = title || '';
    if (lbTitle) lbTitle.textContent = title || '';
    lb.classList.add('is-open');
    lb.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    var close = lb.querySelector('.lightbox__close');
    if (close) close.focus();
  }

  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    window.setTimeout(function () { if (lbImg) lbImg.src = ''; }, 400);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.querySelectorAll('[data-lightbox]').forEach(function (el) {
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      openLightbox(el.getAttribute('data-lightbox'), el.getAttribute('data-title'), el);
    });
  });

  if (lb) {
    lb.addEventListener('click', function (ev) {
      if (ev.target === lb || ev.target.closest('[data-lb-close]')) closeLightbox();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && lb.classList.contains('is-open')) closeLightbox();
    });
  }

  /* ------------------------------------------------------ 8. filtering */
  var filterBtns = document.querySelectorAll('[data-filter]');
  var cards = document.querySelectorAll('[data-cat]');
  var countEl = document.querySelector('[data-count]');

  function setCount(n) {
    if (countEl) countEl.textContent = n;
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = btn.getAttribute('data-filter');

      filterBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });

      var shown = 0;
      cards.forEach(function (card, i) {
        var match = f === 'all' || card.getAttribute('data-cat') === f;
        card.classList.toggle('is-hidden', !match);
        card.classList.remove('is-filtering');
        if (match) {
          shown++;
          if (!reduceMotion) {
            card.style.animationDelay = (shown * 0.045).toFixed(3) + 's';
            card.addEventListener('animationend', function h(ev) {
              if (ev.animationName !== 'cardIn') return;
              /* drop the class so the finished animation (fill: both)
                 stops overriding hover/opacity styles */
              card.classList.remove('is-filtering');
              card.style.animationDelay = '';
              card.removeEventListener('animationend', h);
            });
            /* force reflow so the animation replays */
            void card.offsetWidth;
            card.classList.add('is-filtering');
          }
        }
      });
      setCount(shown);
    });
  });

  /* ------------------------------------------------------- 9. copy e-mail */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var value = btn.getAttribute('data-copy');
      var done = function () {
        var old = btn.textContent;
        btn.textContent = '[ copied ]';
        btn.classList.add('is-done');
        window.setTimeout(function () {
          btn.textContent = old;
          btn.classList.remove('is-done');
        }, 1800);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done).catch(fallback);
      } else {
        fallback();
      }

      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });

  /* --------------------------------------------------- 10. magnetic btns */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-magnetic')) || 0.25;

      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * strength;
        var dy = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      });

      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
        el.style.transform = '';
        window.setTimeout(function () { el.style.transition = ''; }, 500);
      });
    });
  }

  /* --------------------------------------------------- 11. hero parallax */
  var heroArt = document.querySelector('[data-parallax]');
  if (heroArt && finePointer && !reduceMotion) {
    var hx = 0, hy = 0, hraf = null;
    window.addEventListener('pointermove', function (e) {
      hx = (e.clientX / window.innerWidth - 0.5) * 18;
      hy = (e.clientY / window.innerHeight - 0.5) * 12;
      if (!hraf) {
        hraf = requestAnimationFrame(function step() {
          heroArt.style.transform = 'translate3d(' + hx.toFixed(1) + 'px,' + hy.toFixed(1) + 'px,0)';
          hraf = null;
        });
      }
    }, { passive: true });
  }

  /* ------------------------------------------------------- 12. year stamp */
  var y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();

  /* ============================ wave 2 — extra eye-catchers ============ */

  /* release intro-filled animations so inline transforms work afterwards.
     NOTE: pin opacity/transform inline first — removing the animation alone
     would drop the element back to the opacity:0 base rule. */
  document.querySelectorAll('[data-intro]').forEach(function (el) {
    el.addEventListener('animationend', function () {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.animation = 'none';
    }, { once: true });
  });

  /* ----------------------------------------- 13. scramble-decode labels */
  var GLYPHS = '!<>-_\\/[]{}=+*^?#01';

  function scrambleEl(el) {
    if (el.dataset.scrambled || reduceMotion) return;
    el.dataset.scrambled = '1';

    var final = el.textContent;
    var queue = final.split('').map(function (ch, i) {
      return {
        ch: ch,
        start: Math.floor(i * 1.4 + Math.random() * 5),
        end: Math.floor(i * 1.4 + 9 + Math.random() * 12)
      };
    });
    var frame = 0;

    (function tick() {
      var out = '';
      var done = 0;
      queue.forEach(function (q) {
        if (q.ch === ' ') { out += ' '; done++; return; }
        if (frame >= q.end) { out += q.ch; done++; }
        else if (frame >= q.start) { out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]; }
        else { out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]; }
      });
      el.textContent = out;
      frame++;
      if (done < queue.length) requestAnimationFrame(tick);
      else el.textContent = final;
    })();
  }

  var scrambleEls = document.querySelectorAll('[data-scramble]');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        scrambleEl(e.target);
        sio.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    scrambleEls.forEach(function (el) { sio.observe(el); });
  }

  /* ------------------------------------------------------- 14. 3d tilt */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      var MAX = 5;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', (px * MAX * 2).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-py * MAX * 2).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* --------------------------------------------------- 15. count-up nums */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-countup')) || 0;
    if (reduceMotion) { el.textContent = String(target); return; }
    var dur = 1500, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var countEls = document.querySelectorAll('[data-countup]');
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countUp(e.target);
        cio.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    countEls.forEach(function (el) { cio.observe(el); });
  } else {
    countEls.forEach(countUp);
  }

  /* --------------------------------------- 16. hero scroll-away parallax */
  var heroBottom = document.querySelector('.hero__bottom');
  var hpTick = false;

  function heroParallax() {
    if (!heroBottom) return;
    var vh = window.innerHeight;
    var sy = window.scrollY;
    if (sy > vh) return;
    var p = sy / vh;
    heroBottom.style.opacity = String(Math.max(1 - p * 1.25, 0));
    heroBottom.style.transform = 'translate3d(0,' + (sy * 0.22).toFixed(1) + 'px,0)';
  }

  window.addEventListener('scroll', function () {
    if (hpTick) return;
    hpTick = true;
    requestAnimationFrame(function () { heroParallax(); hpTick = false; });
  }, { passive: true });

  /* ------------------------------------------- 12. motion preference toggle */
  var motionLabels = document.querySelectorAll('[data-motion-label]');
  var MOTION_CYCLE = ['auto', 'on', 'off'];

  var motionBanner = document.getElementById('motion-banner');

  function maybeBanner() {
    if (!motionBanner) return;
    var show = motionPref === 'auto' && reduceMedia.matches &&
      !sessionStorage.getItem('sv-motion-banner');
    motionBanner.hidden = !show;
  }

  function applyMotion(dispatch) {
    reduceMotion = motionReduced();
    for (var i = 0; i < motionLabels.length; i++) motionLabels[i].textContent = motionPref;
    maybeBanner();
    if (dispatch) {
      window.dispatchEvent(new CustomEvent('motionchange',
        { detail: { pref: motionPref, reduced: reduceMotion } }));
    }
  }

  document.querySelectorAll('[data-motion-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      motionPref = MOTION_CYCLE[(MOTION_CYCLE.indexOf(motionPref) + 1) % MOTION_CYCLE.length];
      try { localStorage.setItem('sv-motion', motionPref); } catch (e) {}
      applyMotion(true);
    });
  });

  var motionAccept = document.querySelector('[data-motion-accept]');
  if (motionAccept) motionAccept.addEventListener('click', function () {
    motionPref = 'on';
    try { localStorage.setItem('sv-motion', motionPref); } catch (e) {}
    applyMotion(true);
  });

  var motionDismiss = document.querySelector('[data-motion-dismiss]');
  if (motionDismiss) motionDismiss.addEventListener('click', function () {
    try { sessionStorage.setItem('sv-motion-banner', '1'); } catch (e) {}
    maybeBanner();
  });

  if (reduceMedia.addEventListener) reduceMedia.addEventListener('change', function () { applyMotion(true); });
  applyMotion(false);
})();

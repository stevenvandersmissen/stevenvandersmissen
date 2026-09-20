/* ==========================================================================
   SMOOTH SCROLL — Lenis (local build, js/lenis.min.js)
   Silky inertial wheel scrolling like the reference site. Anchor links ride
   along via lenis.scrollTo with an offset for the sticky topbar.
   Follows the site motion preference: "auto" = OS prefers-reduced-motion,
   "on" = visitor override (Lenis boots even when the OS asks for less),
   "off" = always instant. Switchable live via [data-motion-toggle].
   ========================================================================== */
(function () {
  'use strict';

  if (typeof Lenis === 'undefined') return;

  function reduced() {
    return window.__reduced ? window.__reduced()
      : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var lenis = null;

  function boot() {
    if (lenis || reduced()) return;

    /* native smooth would animate every per-frame scrollTop set — disable it
       while Lenis drives (inline beats the stylesheet) */
    document.documentElement.style.scrollBehavior = 'auto';

    try {
      lenis = new Lenis({
        duration: 1.15,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        smoothWheel: true,
        touchMultiplier: 1.6
      });
    } catch (err) {
      /* very old browser? fall back to native scrolling, no broken state */
      document.documentElement.style.scrollBehavior = '';
      window.__site = window.__site || {};
      window.__site.smooth = 'fallback: ' + err.message;
      lenis = null;
      return;
    }

    (function raf(time) {
      if (lenis) lenis.raf(time);
      requestAnimationFrame(raf);
    })(performance.now());

    window.__site = window.__site || {};
    window.__site.smooth = true;
    window.__smooth = { on: true, scroll: function () { return lenis ? lenis.scroll : 0; } };
  }

  function kill() {
    if (!lenis) return;
    lenis.destroy();
    lenis = null;
    document.documentElement.style.scrollBehavior = '';
    window.__smooth = { on: false };
  }

  /* anchor links (nav, back-to-top, …) glide with an offset for the topbar */
  document.addEventListener('click', function (e) {
    if (!lenis) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (!id || id === '#') return;
    var target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -72, duration: 1.3 });
  });

  window.addEventListener('motionchange', function () {
    if (reduced()) kill(); else boot();
  });

  boot();
})();

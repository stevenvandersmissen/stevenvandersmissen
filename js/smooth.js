/* ==========================================================================
   SMOOTH SCROLL — Lenis (local build, js/lenis.min.js)
   Silky inertial wheel scrolling like the reference site. Anchor links ride
   along via lenis.scrollTo with an offset for the sticky topbar. Skipped
   entirely for prefers-reduced-motion (native instant scroll stays).
   ========================================================================== */
(function () {
  'use strict';

  if (typeof Lenis === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* native smooth would animate every per-frame scrollTop set — disable it
     while Lenis drives (inline beats the stylesheet, reduce never gets here) */
  document.documentElement.style.scrollBehavior = 'auto';

  var lenis;
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
    return;
  }

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  /* anchor links (nav, back-to-top, …) glide with an offset for the topbar */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (!id || id === '#') return;
    var target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -72, duration: 1.3 });
  });

  /* keep lightbox / game from fighting the scroller */
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' && document.body.style.overflow === 'hidden') e.preventDefault();
  });

  window.__site = window.__site || {};
  window.__site.smooth = true;
  window.__smooth = {
    on: true,
    scroll: function () { return lenis.scroll; },
    stop: function () { lenis.stop(); },
    start: function () { lenis.start(); }
  };
})();

/* ==========================================================================
   MOTION PREFERENCE — standalone, loads before everything else.
   Keeps the [ motion: … ] pills and the reduced-motion banner working even
   if another script on the page fails. Values: auto (follow OS) / on / off.
   Persisted in localStorage; broadcasts window 'motionchange' events that
   ascii.js, smooth.js and main.js listen to.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionPref = 'auto';
  try { motionPref = localStorage.getItem('sv-motion') || 'auto'; } catch (e) {}

  function motionReduced() {
    if (motionPref === 'on') return false;    /* visitor overrides the OS */
    if (motionPref === 'off') return true;
    return reduceMedia.matches;               /* auto = follow the OS */
  }
  window.__reduced = motionReduced;
  window.__site = window.__site || {};
  window.__site.v = 13;
  window.__site.motion = motionPref;

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
    for (var i = 0; i < motionLabels.length; i++) motionLabels[i].textContent = motionPref;
    window.__site.motion = motionPref;
    maybeBanner();
    if (dispatch) {
      window.dispatchEvent(new CustomEvent('motionchange',
        { detail: { pref: motionPref, reduced: motionReduced() } }));
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

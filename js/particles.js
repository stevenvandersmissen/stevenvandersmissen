/* ==========================================================================
   Hero particle field — GSAP-driven interactive layer
   Flat squares / diamonds / rings in the theme's foreground colour drift
   through the empty hero space. The cursor repels them (springy return),
   clicking fires a shockwave ring + radial impulse. GSAP handles the intro
   pop-in, the shockwave tweens and the render ticker.
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('fx-canvas');
  var hero = document.querySelector('.hero');
  var hint = document.getElementById('fx-hint');

  if (!canvas || !hero || typeof gsap === 'undefined') return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var ctx = canvas.getContext('2d');
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var particles = [];
  var rings = [];
  var pointer = { x: -99999, y: -99999, active: false };
  var inView = true;
  var fg = '#000000';
  var t = 0;

  function readColor() {
    fg = (getComputedStyle(document.documentElement).getPropertyValue('--fg') || '#000').trim() || '#000';
  }
  readColor();

  /* ------------------------------------------------------------ seeding */
  function seed() {
    particles.length = 0;
    var count = Math.max(28, Math.min(90, Math.round((W * H) / (DPR * DPR * 15000))));
    for (var i = 0; i < count; i++) {
      var x = Math.random() * W;
      var y = Math.random() * H;
      var p = {
        hx: x, hy: y,              /* home position (drifts slowly) */
        x: x, y: y,                /* actual position */
        vx: 0, vy: 0,
        s: (2.5 + Math.random() * 5) * DPR,
        a: 0.26 + Math.random() * 0.48,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        shape: Math.random() < 0.68 ? 0 : (Math.random() < 0.65 ? 1 : 2),
        ph: Math.random() * Math.PI * 2,
        sp: 0.15 + Math.random() * 0.4
      };
      particles.push(p);
    }

    /* GSAP intro: everything pops out of the centre */
    if (!reduce) {
      particles.forEach(function (p, i) {
        var fx = p.x, fy = p.y, fs = p.s;
        p.x = W / 2; p.y = H / 2; p.s = 0;
        gsap.to(p, {
          x: fx, y: fy, s: fs,
          duration: 1.2,
          delay: 0.45 + i * 0.012,
          ease: 'power3.out',
          overwrite: true
        });
      });
    }
  }

  function resize() {
    var r = hero.getBoundingClientRect();
    W = canvas.width = Math.max(1, Math.round(r.width * DPR));
    H = canvas.height = Math.max(1, Math.round(r.height * DPR));
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    seed();
    if (reduce) drawStatic();
  }

  /* ----------------------------------------------------------- drawing */
  function drawParticle(p) {
    if (p.s <= 0.2) return;
    ctx.globalAlpha = p.a;
    if (p.shape === 2) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s * 0.7, 0, Math.PI * 2);
      ctx.lineWidth = 1.4 * DPR;
      ctx.strokeStyle = fg;
      ctx.stroke();
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot + (p.shape === 1 ? Math.PI / 4 : 0));
    ctx.fillStyle = fg;
    ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
    ctx.restore();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(drawParticle);
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------- render loop */
  function render(time, deltaMS) {
    if (!inView) return;
    var dt = Math.min(deltaMS / 1000, 0.05);
    t += dt;

    ctx.clearRect(0, 0, W, H);

    var R = 150 * DPR;
    var damp = Math.exp(-4.2 * dt);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      /* lazy drift of the home position */
      p.hx += Math.cos(t * p.sp + p.ph) * 7 * dt * DPR;
      p.hy += Math.sin(t * p.sp * 0.8 + p.ph) * 7 * dt * DPR;
      if (p.hx < -24) p.hx = W + 24; else if (p.hx > W + 24) p.hx = -24;
      if (p.hy < -24) p.hy = H + 24; else if (p.hy > H + 24) p.hy = -24;

      /* spring back home */
      var ax = (p.hx - p.x) * 7;
      var ay = (p.hy - p.y) * 7;

      /* cursor repulsion */
      if (pointer.active) {
        var dx = p.x - pointer.x * DPR;
        var dy = p.y - pointer.y * DPR;
        var d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          var d = Math.sqrt(d2) || 1;
          var f = (1 - d / R) * 2400 * DPR;
          ax += (dx / d) * f;
          ay += (dy / d) * f;
          p.rot += dt * 3;
        }
      }

      p.vx = (p.vx + ax * dt) * damp;
      p.vy = (p.vy + ay * dt) * damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      drawParticle(p);
    }

    /* shockwave rings */
    for (var r = rings.length - 1; r >= 0; r--) {
      var ring = rings[r];
      ctx.globalAlpha = ring.alpha;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.lineWidth = 2.5 * DPR;
      ctx.strokeStyle = fg;
      ctx.stroke();
      if (ring.alpha <= 0.01) rings.splice(r, 1);
    }

    ctx.globalAlpha = 1;
  }

  if (!reduce) gsap.ticker.add(render);

  /* ------------------------------------------------------ interaction */
  function hideHint() {
    if (hint && !hint.classList.contains('is-off')) hint.classList.add('is-off');
  }

  hero.addEventListener('pointermove', function (e) {
    var rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = true;
    hideHint();
  }, { passive: true });

  hero.addEventListener('pointerleave', function () {
    pointer.active = false;
    pointer.x = -99999; pointer.y = -99999;
  });

  hero.addEventListener('pointerdown', function (e) {
    var rect = canvas.getBoundingClientRect();
    var cx = (e.clientX - rect.left) * DPR;
    var cy = (e.clientY - rect.top) * DPR;

    hideHint();
    if (reduce) return;

    /* shockwave ring, tweened by gsap */
    var ring = { x: cx, y: cy, r: 6 * DPR, alpha: 0.55 };
    rings.push(ring);
    gsap.to(ring, { r: 240 * DPR, duration: 0.8, ease: 'power2.out' });
    gsap.to(ring, { alpha: 0, duration: 0.8, ease: 'power1.in', onComplete: function () {
      var i = rings.indexOf(ring);
      if (i > -1) rings.splice(i, 1);
    } });

    /* radial impulse + spin */
    var R2 = 230 * DPR;
    particles.forEach(function (p) {
      var dx = p.x - cx, dy = p.y - cy;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > R2) return;
      var fall = 1 - d / R2;
      var imp = fall * 620 * DPR;
      p.vx += (dx / (d || 1)) * imp;
      p.vy += (dy / (d || 1)) * imp;
      p.vr += (Math.random() - 0.5) * 6 * fall;
      /* elastic size pop */
      gsap.fromTo(p, { s: p.s * 1.9 }, { s: p.s, duration: 0.9, ease: 'elastic.out(1, 0.4)', overwrite: false });
    });
  });

  /* pause when the hero scrolls out of view */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { inView = e.isIntersecting; });
    }, { threshold: 0.02 });
    io.observe(hero);
  }

  /* theme + resize */
  window.addEventListener('themechange', function () {
    readColor();
    if (reduce) drawStatic();
  });

  var resizeCall = null;
  window.addEventListener('resize', function () {
    if (resizeCall) resizeCall.kill();
    resizeCall = gsap.delayedCall(0.2, resize);
  });

  resize();
})();

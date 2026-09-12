/* ==========================================================================
   HERO BALL PIT — Matter.js + GSAP
   A pool of flat balls (filled / outlined, with a little shine dot) rests on a
   ledge right above the giant headline. The cursor is a force field: move
   through the pit and the balls part around you. Drag one to grab & throw it,
   click for a radial blast, double-click to flip gravity for a moment so the
   whole pit rains back down. GSAP adds spawn pops and impact rings; rendering
   is a custom flat 2D pass in the theme colours.
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('fx-canvas');
  var hero = document.querySelector('.hero');
  var hint = document.getElementById('fx-hint');

  if (!canvas || !hero || typeof Matter === 'undefined' || typeof gsap === 'undefined') return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ctx = canvas.getContext('2d');
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var fg = '#000000';
  var bgColor = '#00ff11';

  var WALL = 0.03;             /* side wall inset as fraction of width */
  var MAX_BODIES = 64;
  var FIELD_R = 150;           /* cursor force-field radius, css px */
  var BLAST_R = 280;           /* click blast radius, css px */

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    fg = (cs.getPropertyValue('--fg') || '#000').trim() || '#000';
    bgColor = (cs.getPropertyValue('--bg') || '#00ff11').trim() || '#00ff11';
  }
  readColors();

  /* ------------------------------------------------------- matter world */
  var engine = Matter.Engine.create({ enableSleeping: true });
  var world = engine.world;

  var bodies = [];             /* dynamic balls, in spawn order */
  var statics = [];
  var sparks = [];             /* {x,y,r,alpha} impact rings */
  var shelfY = 0, wallL = 0, wallR = 0;

  function buildStatic() {
    statics.forEach(function (b) { Matter.World.remove(world, b); });

    /* the ledge sits in the real empty gap: just above the hero title block */
    var hb = hero.querySelector('.hero__bottom');
    var h1 = hero.querySelector('.hero__title');
    var hd = hero.querySelector('.hero__head');
    var gapTop = hd ? (hd.offsetTop + hd.offsetHeight) * DPR : H * 0.3;
    var titleTop = (h1 ? h1.offsetTop : (hb ? hb.offsetTop : H * 0.6)) * DPR;
    shelfY = Math.max(titleTop - 12 * DPR, gapTop + 120 * DPR);

    /* park the hint + shelf tag in the gap */
    if (hint) hint.style.top = Math.max(shelfY / DPR - 175, 60) + 'px';
    var tag = hero.querySelector('.fx-shelf-tag');
    if (tag) tag.style.top = (shelfY / DPR + 8) + 'px';

    wallL = W * WALL;
    wallR = W * (1 - WALL);
    var t = 60 * DPR;
    statics = [
      Matter.Bodies.rectangle(W / 2, shelfY + t / 2, W, t, { isStatic: true }),
      Matter.Bodies.rectangle(wallL - t / 2, H / 2, t, H * 4, { isStatic: true }),
      Matter.Bodies.rectangle(wallR + t / 2, H / 2, t, H * 4, { isStatic: true })
    ];
    Matter.World.add(world, statics);
  }

  /* ----------------------------------------------------------- spawning */
  function makeBall(x, y, r) {
    var radius = r || (11 + Math.random() * 17) * DPR * ((W / DPR) < 640 ? 0.8 : 1);
    var body = Matter.Bodies.circle(x, y, radius, {
      restitution: 0.62,
      friction: 0.06,
      frictionAir: 0.009
    });
    body.plugin.meta = {
      scale: 0,
      style: Math.random() < 0.68 ? 'fill' : 'ring'
    };
    Matter.World.add(world, body);
    bodies.push(body);

    if (!reduce) {
      gsap.to(body.plugin.meta, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.55)' });
    } else {
      body.plugin.meta.scale = 1;
    }
    trimBodies();
    return body;
  }

  function popRemove(body) {
    var i = bodies.indexOf(body);
    if (i > -1) bodies.splice(i, 1);
    if (grabbed === body) grabbed = null;
    if (reduce) { Matter.World.remove(world, body); return; }
    gsap.to(body.plugin.meta, {
      scale: 0, duration: 0.3, ease: 'back.in(2)',
      onComplete: function () { Matter.World.remove(world, body); }
    });
  }

  function trimBodies() {
    while (bodies.length > MAX_BODIES) popRemove(bodies[0]);
  }

  function seedPit() {
    var n = (W / DPR) < 640 ? 28 : 56;
    for (var i = 0; i < n; i++) {
      gsap.delayedCall(0.3 + i * 0.05, function () {
        makeBall(wallL + 20 * DPR + Math.random() * (wallR - wallL - 40 * DPR),
          -30 * DPR - Math.random() * 140 * DPR);
      });
    }
  }

  /* ------------------------------------------- cursor force field / grab */
  var grabbed = null;
  var pointer = { x: -9999, y: -9999, active: false };
  var trail = [];
  var downAt = 0, downX = 0, downY = 0, moved = 0;
  var flipping = false;

  function canvasPoint(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * DPR, y: (e.clientY - r.top) * DPR };
  }

  function bodyAt(x, y) {
    var hit = Matter.Query.point(bodies, { x: x, y: y });
    return hit.length ? hit[hit.length - 1] : null;
  }

  function wake(b) { if (b.isSleeping) Matter.Sleeping.set(b, false); }

  /* listeners live on the HERO (the canvas sits behind the content boxes);
     clicks on links/buttons are left untouched */
  function isInteractive(e) {
    return e.target.closest && e.target.closest('a, button, input, textarea, select');
  }

  hero.addEventListener('pointerdown', function (e) {
    if (isInteractive(e)) return;
    var p = canvasPoint(e);
    downAt = Date.now(); downX = e.clientX; downY = e.clientY; moved = 0;
    pointer.x = p.x; pointer.y = p.y; pointer.active = true;

    var b = bodyAt(p.x, p.y);
    if (b && b.plugin.meta.scale > 0.6) {
      grabbed = b;
      wake(b);
      trail.length = 0;
      hero.classList.add('is-grabbing');
      hero.setPointerCapture(e.pointerId);
      e.preventDefault();               /* no text selection while dragging */
    }
    hideHint();
  });

  hero.addEventListener('pointermove', function (e) {
    var p = canvasPoint(e);
    pointer.x = p.x; pointer.y = p.y; pointer.active = true;
    if (downAt) moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
    if (grabbed) {
      trail.push({ x: p.x, y: p.y, t: performance.now() });
      if (trail.length > 8) trail.shift();
    }
  });

  function release(e) {
    if (!grabbed) return;
    /* throw velocity from the pointer trail */
    if (trail.length >= 2) {
      var a = trail[0], b = trail[trail.length - 1];
      var dt = Math.max(b.t - a.t, 16);
      var vx = (b.x - a.x) / dt * 16.67;
      var vy = (b.y - a.y) / dt * 16.67;
      var cap = 34 * DPR;
      var m = Math.hypot(vx, vy);
      if (m > cap) { vx = vx / m * cap; vy = vy / m * cap; }
      Matter.Body.setVelocity(grabbed, { x: vx, y: vy });
    }
    grabbed = null;
    hero.classList.remove('is-grabbing');
    if (e && e.pointerId !== undefined && hero.hasPointerCapture(e.pointerId)) {
      hero.releasePointerCapture(e.pointerId);
    }
  }

  hero.addEventListener('pointerup', function (e) {
    var wasGrab = !!grabbed;
    release(e);

    var quick = Date.now() - downAt < 350;
    var still = moved < 8;
    downAt = 0;
    if (wasGrab || !quick || !still) return;

    blast(canvasPoint(e));
  });

  hero.addEventListener('pointercancel', release);
  hero.addEventListener('pointerleave', function () {
    pointer.active = false;
    pointer.x = pointer.y = -9999;
  });

  hero.addEventListener('dblclick', function (e) {
    if (isInteractive(e)) return;
    e.preventDefault();
    flipGravity();
  });

  function hideHint() {
    if (hint && !hint.classList.contains('is-off')) hint.classList.add('is-off');
  }

  /* radial blast: kick every ball away from the click */
  function blast(p) {
    var R = BLAST_R * DPR;
    bodies.forEach(function (b) {
      var dx = b.position.x - p.x;
      var dy = b.position.y - p.y;
      var d = Math.hypot(dx, dy);
      if (d > R || d < 0.001) return;
      wake(b);
      var f = (1 - d / R) * 22 * DPR;
      Matter.Body.setVelocity(b, {
        x: b.velocity.x + (dx / d) * f,
        y: b.velocity.y + (dy / d) * f - 3 * DPR
      });
    });
    var s = { x: p.x, y: p.y, r: 6 * DPR, alpha: 0.65 };
    sparks.push(s);
    gsap.to(s, { r: R * 0.8, duration: 0.55, ease: 'power2.out' });
    gsap.to(s, {
      alpha: 0, duration: 0.55, ease: 'power1.in',
      onComplete: function () { var i = sparks.indexOf(s); if (i > -1) sparks.splice(i, 1); }
    });
  }

  /* double-click: gravity flips for a beat, then the pit rains back down */
  function flipGravity() {
    if (flipping) return;
    flipping = true;
    hideHint();
    bodies.forEach(wake);
    engine.gravity.y = -1;
    gsap.delayedCall(1.9, function () {
      engine.gravity.y = 1;
      gsap.delayedCall(1.2, function () { flipping = false; });
    });
  }

  /* per-tick: spring the grabbed ball + cursor force field */
  Matter.Events.on(engine, 'beforeUpdate', function () {
    if (grabbed) {
      wake(grabbed);
      Matter.Body.setVelocity(grabbed, {
        x: (pointer.x - grabbed.position.x) * 0.22,
        y: (pointer.y - grabbed.position.y) * 0.22
      });
    } else if (pointer.active) {
      var R = FIELD_R * DPR;
      for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        var dx = b.position.x - pointer.x;
        var dy = b.position.y - pointer.y;
        var d2 = dx * dx + dy * dy;
        if (d2 > R * R || d2 < 0.0001) continue;
        var d = Math.sqrt(d2);
        var f = 1 - d / R;
        wake(b);
        var n = f * f * 2.4 * DPR;
        Matter.Body.setVelocity(b, {
          x: b.velocity.x + (dx / d) * n,
          y: b.velocity.y + (dy / d) * n - n * 0.35
        });
      }
    }
  });

  /* --------------------------------------------------------- impact fx */
  Matter.Events.on(engine, 'collisionStart', function (ev) {
    if (reduce) return;
    ev.pairs.forEach(function (pair) {
      var a = pair.bodyA, b = pair.bodyB;
      var impact = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (impact < 9 || sparks.length > 6) return;
      var s = {
        x: (a.position.x + b.position.x) / 2,
        y: (a.position.y + b.position.y) / 2,
        r: 4 * DPR, alpha: 0.35
      };
      sparks.push(s);
      gsap.to(s, { r: (16 + impact * 1.6) * DPR, duration: 0.45, ease: 'power2.out' });
      gsap.to(s, {
        alpha: 0, duration: 0.45, ease: 'power1.in',
        onComplete: function () { var i = sparks.indexOf(s); if (i > -1) sparks.splice(i, 1); }
      });
    });
  });

  /* ------------------------------------------------------------- draw */
  function drawBall(b) {
    var meta = b.plugin.meta;
    if (!meta || meta.scale <= 0.01) return;
    var r = b.circleRadius * meta.scale;

    ctx.globalAlpha = 0.94;
    ctx.beginPath();
    ctx.arc(b.position.x, b.position.y, r, 0, Math.PI * 2);
    if (meta.style === 'fill') {
      ctx.fillStyle = fg;
      ctx.fill();
      /* little shine dot so the pit reads as balls, not dots */
      ctx.beginPath();
      ctx.arc(b.position.x - r * 0.34, b.position.y - r * 0.34, r * 0.24, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.fill();
    } else {
      ctx.lineWidth = 2.5 * DPR;
      ctx.strokeStyle = fg;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.position.x, b.position.y, r * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = fg;
      ctx.fill();
    }
  }

  function drawScene() {
    ctx.clearRect(0, 0, W, H);

    /* ledge line + ticks */
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = fg;
    ctx.lineWidth = 2 * DPR;
    ctx.beginPath();
    ctx.moveTo(wallL, shelfY);
    ctx.lineTo(wallR, shelfY);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1.5 * DPR;
    for (var x = wallL; x < wallR; x += 64 * DPR) {
      ctx.beginPath();
      ctx.moveTo(x, shelfY + 6 * DPR);
      ctx.lineTo(x + 18 * DPR, shelfY + 6 * DPR);
      ctx.stroke();
    }

    /* impact / blast rings */
    sparks.forEach(function (sp) {
      ctx.globalAlpha = sp.alpha;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.lineWidth = 2 * DPR;
      ctx.strokeStyle = fg;
      ctx.stroke();
    });

    /* grab tether */
    if (grabbed) {
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([4 * DPR, 5 * DPR]);
      ctx.beginPath();
      ctx.moveTo(pointer.x, pointer.y);
      ctx.lineTo(grabbed.position.x, grabbed.position.y);
      ctx.lineWidth = 1.5 * DPR;
      ctx.strokeStyle = fg;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    bodies.forEach(drawBall);
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------- loop */
  var runner = Matter.Runner.create();
  var inView = true;

  function frame() { if (inView) drawScene(); }

  function setRunning(on) {
    if (on && !runner.enabled) Matter.Runner.run(runner, engine);
    if (!on && runner.enabled) Matter.Runner.stop(runner);
  }

  resize();   /* must run first: builds walls/floor the pre-settle needs */

  if (reduce) {
    /* pre-settled pit, no autonomous motion — but grab/blast/flip stay
       available because they are user-initiated */
    for (var i = 0; i < 30; i++) {
      makeBall(wallL + 20 * DPR + Math.random() * (wallR - wallL - 40 * DPR),
        shelfY - 10 * DPR - Math.random() * 160 * DPR);
    }
    for (var k = 0; k < 300; k++) Matter.Engine.update(engine, 1000 / 60);
  }
  Matter.Runner.run(runner, engine);
  gsap.ticker.add(frame);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        inView = e.isIntersecting;
        setRunning(e.isIntersecting);
      });
    }, { threshold: 0.02 }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () { setRunning(!document.hidden); });

  window.addEventListener('themechange', function () {
    readColors();
    if (reduce) drawScene();
  });

  var pendingResize = null;
  window.addEventListener('resize', function () {
    if (pendingResize) pendingResize.kill();
    pendingResize = gsap.delayedCall(0.25, function () {
      resize();
      if (reduce) drawScene();
    });
  });

  function resize() {
    var r = hero.getBoundingClientRect();
    W = canvas.width = Math.max(1, Math.round(r.width * DPR));
    H = canvas.height = Math.round(r.height * DPR);
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    buildStatic();
  }

  /* ambient rain: every so often a stray ball drops in */
  function ambient() {
    gsap.delayedCall(6 + Math.random() * 7, function () {
      if (inView && !grabbed && bodies.length < 58) {
        makeBall(wallL + 30 * DPR + Math.random() * (wallR - wallL - 60 * DPR), -30 * DPR);
      }
      ambient();
    });
  }

  /* --------------------------------------------------------------- go */
  if (!reduce) { seedPit(); ambient(); }

  /* tiny debug hook */
  window.__phys = {
    count: function () { return bodies.length; },
    positions: function () {
      return bodies.map(function (b) { return { x: b.position.x / DPR, y: b.position.y / DPR }; });
    },
    gravity: function () { return engine.gravity.y; }
  };
})();

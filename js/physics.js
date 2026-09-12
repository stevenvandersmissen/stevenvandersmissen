/* ==========================================================================
   HERO PHYSICS PLAYGROUND — Matter.js + GSAP
   Flat shapes (squares, rects, hexagons, triangles, balls — filled or outlined)
   drop into the empty hero zone and pile up on an invisible shelf.
   Grab & throw them with mouse or touch, click empty space to spawn a new
   one, double-click to pop-reset the pile. GSAP adds spawn pops, reset pops
   and impact sparks; rendering is a custom flat 2D pass in the theme colours.
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

  var SHELF = 0.56;            /* shelf height as fraction of hero height */
  var WALL = 0.03;             /* side wall inset as fraction of width */
  var MAX_BODIES = 34;

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    fg = (cs.getPropertyValue('--fg') || '#000').trim() || '#000';
    bgColor = (cs.getPropertyValue('--bg') || '#00ff11').trim() || '#00ff11';
  }
  readColors();

  /* ------------------------------------------------------- matter world */
  var engine = Matter.Engine.create({ enableSleeping: true });
  var world = engine.world;

  var bodies = [];             /* dynamic bodies, in spawn order */
  var statics = [];
  var sparks = [];             /* {x,y,r,alpha} impact rings */
  var shelfY = 0, wallL = 0, wallR = 0;

  function buildStatic() {
    statics.forEach(function (b) { Matter.World.remove(world, b); });

    /* the shelf is a ledge right above the giant headline: shapes balance
       on top of the title block, never through it */
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
      Matter.Bodies.rectangle(wallL - t / 2, H / 2, t, H * 3, { isStatic: true }),
      Matter.Bodies.rectangle(wallR + t / 2, H / 2, t, H * 3, { isStatic: true })
    ];
    Matter.World.add(world, statics);
  }

  /* ----------------------------------------------------------- spawning */
  var KINDS = ['square', 'rect', 'hex', 'tri', 'ball'];

  function makeBody(x, y) {
    var kind = KINDS[Math.floor(Math.random() * KINDS.length)];
    var narrow = (W / DPR) < 640 ? 0.75 : 1;
    var size = (20 + Math.random() * 30) * DPR * narrow;
    var body;

    if (kind === 'ball') {
      body = Matter.Bodies.circle(x, y, size * 0.55, { restitution: 0.75 });
    } else if (kind === 'square') {
      body = Matter.Bodies.rectangle(x, y, size, size, { restitution: 0.35 });
    } else if (kind === 'rect') {
      body = Matter.Bodies.rectangle(x, y, size * 1.7, size * 0.7, { restitution: 0.3 });
    } else if (kind === 'hex') {
      body = Matter.Bodies.polygon(x, y, 6, size * 0.62, { restitution: 0.4 });
    } else {
      body = Matter.Bodies.polygon(x, y, 3, size * 0.7, { restitution: 0.35 });
    }

    body.friction = 0.4;
    body.frictionAir = 0.012;
    body.angle = Math.random() * Math.PI;
    body.angularVelocity = (Math.random() - 0.5) * 0.2;

    body.plugin.meta = {
      kind: kind,
      scale: 0,
      style: Math.random() < 0.72 ? 'fill' : 'stroke'
    };

    Matter.World.add(world, body);
    bodies.push(body);

    if (!reduce) {
      gsap.to(body.plugin.meta, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
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
      scale: 0, duration: 0.35, ease: 'back.in(2)',
      onComplete: function () { Matter.World.remove(world, body); }
    });
  }

  function trimBodies() {
    while (bodies.length > MAX_BODIES) popRemove(bodies[0]);
  }

  function seedPile() {
    var n = (W / DPR) < 640 ? 8 : 15;
    /* drop in a few clusters so real little piles form */
    var clusters = [0.28, 0.5, 0.74].map(function (f) {
      return wallL + (wallR - wallL) * f;
    });
    for (var i = 0; i < n; i++) {
      gsap.delayedCall(0.35 + i * 0.1, function () {
        var cx = clusters[Math.floor(Math.random() * clusters.length)];
        var x = cx + (Math.random() - 0.5) * 70 * DPR;
        makeBody(x, -40 * DPR - Math.random() * 60 * DPR);
      });
    }
  }

  function resetPile() {
    hideHint();
    bodies.slice().forEach(function (b, i) {
      gsap.delayedCall(i * 0.02, function () { popRemove(b); });
    });
    gsap.delayedCall(0.55, seedPile);
  }

  /* --------------------------------------------- grab / throw / spawn */
  var grabbed = null;
  var pointer = { x: 0, y: 0 };
  var trail = [];              /* recent pointer samples for throw velocity */
  var downAt = 0, downX = 0, downY = 0, moved = 0;

  function canvasPoint(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * DPR, y: (e.clientY - r.top) * DPR };
  }

  function bodyAt(x, y) {
    var hit = Matter.Query.point(bodies, { x: x, y: y });
    return hit.length ? hit[hit.length - 1] : null;
  }

  /* listeners live on the HERO (the canvas sits behind the content boxes);
     clicks on links/buttons are left untouched */
  function isInteractive(e) {
    return e.target.closest && e.target.closest('a, button, input, textarea, select');
  }

  hero.addEventListener('pointerdown', function (e) {
    if (isInteractive(e)) return;
    var p = canvasPoint(e);
    downAt = Date.now(); downX = e.clientX; downY = e.clientY; moved = 0;
    pointer.x = p.x; pointer.y = p.y;

    var b = bodyAt(p.x, p.y);
    if (b && b.plugin.meta.scale > 0.6) {
      grabbed = b;
      Matter.Sleeping.set(b, false);
      trail.length = 0;
      hero.classList.add('is-grabbing');
      hero.setPointerCapture(e.pointerId);
      e.preventDefault();               /* no text selection while dragging */
      hideHint();
    }
  });

  hero.addEventListener('pointermove', function (e) {
    var p = canvasPoint(e);
    pointer.x = p.x; pointer.y = p.y;
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
      Matter.Body.setAngularVelocity(grabbed, vx * 0.004);
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

    var p = canvasPoint(e);
    var y = Math.min(p.y, shelfY - 70 * DPR);
    hideHint();
    var b = makeBody(p.x, y);
    b.velocity.x = (Math.random() - 0.5) * 6;
    b.angularVelocity = (Math.random() - 0.5) * 0.35;
  });

  hero.addEventListener('pointercancel', release);

  hero.addEventListener('dblclick', function (e) {
    if (isInteractive(e)) return;
    e.preventDefault();
    resetPile();
  });

  function hideHint() {
    if (hint && !hint.classList.contains('is-off')) hint.classList.add('is-off');
  }

  /* spring the grabbed body towards the pointer every tick */
  Matter.Events.on(engine, 'beforeUpdate', function () {
    if (!grabbed) return;
    Matter.Sleeping.set(grabbed, false);
    var k = 0.22;
    Matter.Body.setVelocity(grabbed, {
      x: (pointer.x - grabbed.position.x) * k,
      y: (pointer.y - grabbed.position.y) * k
    });
  });

  /* --------------------------------------------------------- impact fx */
  Matter.Events.on(engine, 'collisionStart', function (ev) {
    if (reduce) return;
    ev.pairs.forEach(function (pair) {
      var a = pair.bodyA, b = pair.bodyB;
      var impact = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (impact < 7 || sparks.length > 6) return;
      var s = {
        x: (a.position.x + b.position.x) / 2,
        y: (a.position.y + b.position.y) / 2,
        r: 4 * DPR, alpha: 0.4
      };
      sparks.push(s);
      gsap.to(s, { r: (18 + impact * 2) * DPR, duration: 0.5, ease: 'power2.out' });
      gsap.to(s, {
        alpha: 0, duration: 0.5, ease: 'power1.in',
        onComplete: function () { var i = sparks.indexOf(s); if (i > -1) sparks.splice(i, 1); }
      });
    });
  });

  /* ------------------------------------------------------------- draw */
  function drawBody(b) {
    var meta = b.plugin.meta;
    if (!meta || meta.scale <= 0.01) return;

    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    ctx.scale(meta.scale, meta.scale);
    ctx.globalAlpha = 0.92;

    if (meta.kind === 'ball') {
      var r = b.circleRadius;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      if (meta.style === 'fill') { ctx.fillStyle = fg; ctx.fill(); }
      else { ctx.lineWidth = 2 * DPR; ctx.strokeStyle = fg; ctx.stroke(); }
      /* notch so spin reads */
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineWidth = 1.5 * DPR;
      ctx.strokeStyle = meta.style === 'fill' ? bgColor : fg;
      ctx.stroke();
    } else {
      var c = Math.cos(-b.angle), s = Math.sin(-b.angle);
      var verts = b.vertices;
      ctx.beginPath();
      for (var i = 0; i < verts.length; i++) {
        var dx = verts[i].x - b.position.x;
        var dy = verts[i].y - b.position.y;
        var lx = dx * c - dy * s;
        var ly = dx * s + dy * c;
        if (i === 0) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
      }
      ctx.closePath();
      if (meta.style === 'fill') { ctx.fillStyle = fg; ctx.fill(); }
      else { ctx.lineWidth = 2 * DPR; ctx.strokeStyle = fg; ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawScene() {
    ctx.clearRect(0, 0, W, H);

    /* shelf line + ticks */
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = fg;
    ctx.lineWidth = 2 * DPR;
    ctx.beginPath();
    ctx.moveTo(wallL, shelfY);
    ctx.lineTo(wallR, shelfY);
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.5 * DPR;
    for (var x = wallL; x < wallR; x += 64 * DPR) {
      ctx.beginPath();
      ctx.moveTo(x, shelfY + 6 * DPR);
      ctx.lineTo(x + 18 * DPR, shelfY + 6 * DPR);
      ctx.stroke();
    }

    /* impact sparks */
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

    bodies.forEach(drawBody);
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------- loop */
  var runner = Matter.Runner.create();
  var inView = true;

  function frame() { if (inView) drawScene(); }

  function setRunning(on) {
    if (reduce) return;
    if (on && !runner.enabled) Matter.Runner.run(runner, engine);
    if (!on && runner.enabled) Matter.Runner.stop(runner);
  }

  if (!reduce) {
    Matter.Runner.run(runner, engine);
    gsap.ticker.add(frame);
  } else {
    for (var i = 0; i < 12; i++) {
      makeBody(wallL + 40 * DPR + Math.random() * (wallR - wallL - 80 * DPR),
        shelfY - 30 * DPR - Math.random() * 220 * DPR);
    }
    for (var k = 0; k < 240; k++) Matter.Engine.update(engine, 1000 / 60);
    drawScene();
  }

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
    H = canvas.height = Math.max(1, Math.round(r.height * DPR));
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    buildStatic();
  }

  /* ambient rain: every so often a new shape drops in by itself */
  function ambient() {
    gsap.delayedCall(6 + Math.random() * 6, function () {
      if (inView && !grabbed && bodies.length < 22) {
        makeBody(wallL + 30 * DPR + Math.random() * (wallR - wallL - 60 * DPR),
          -40 * DPR);
      }
      ambient();
    });
  }

  /* --------------------------------------------------------------- go */
  resize();
  if (!reduce) { seedPile(); ambient(); }

  /* tiny debug hook */
  window.__phys = {
    count: function () { return bodies.length; },
    positions: function () {
      return bodies.map(function (b) { return { x: b.position.x / DPR, y: b.position.y / DPR }; });
    }
  };
})();

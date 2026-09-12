/* ==========================================================================
   HERO ASCII FIELD — pixel/glyph texture like foundation-labs.xyz
   A full-hero grid of monospace glyphs (· ∙ ◦ △ ○ □ + ▲ ● ■ ✦ ◼ ) driven by
   layered sine noise, warped around the cursor column/row, drifting with
   scroll, and shocked by click ripples. Glyphs are pre-rendered to sprite
   canvases per theme so ~12k cells/frame stay cheap.
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('fx-canvas');
  var hero = document.querySelector('.hero');
  var hint = document.getElementById('fx-hint');
  if (!canvas || !hero) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = canvas.getContext('2d');

  var CHARS = [' ', '·', '∙', '◦', '△', '○', '□', '+', '▲', '●', '■', '✦', '▲', '◼', ''];
  var FONT = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  /* quality tiers: [cellW, cellH, minFrameMs] — auto-escalates on slow
     devices (CPU-rasterised canvas, phones) so the field never "freezes" */
  var TIERS = [[8.4, 14.3, 33], [10.5, 18, 50], [13, 22, 83]];
  var tier = (navigator.maxTouchPoints > 0 || (navigator.hardwareConcurrency || 8) <= 4) ? 1 : 0;
  var CELL_W = TIERS[tier][0], CELL_H = TIERS[tier][1], FRAME_MS = TIERS[tier][2];
  var staticMode = false;

  var dpr = 1, W = 0, H = 0, cols = 0, rows = 0;
  var fg = '#000', bg = '#00ff11';
  var sprites = [];            /* per-glyph offscreen canvases */
  var ripples = [];            /* {x, y, t0} in css px, canvas space */
  var mouse = { fx: 0.5, pageY: 0 };
  var frames = 0, drawnCells = 0, curAlpha = 1;

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    fg = (cs.getPropertyValue('--fg') || '#000').trim() || '#000';
    bg = (cs.getPropertyValue('--bg') || '#00ff11').trim() || '#00ff11';
    buildSprites();
  }

  function buildSprites() {
    sprites = CHARS.map(function (ch) {
      var c = document.createElement('canvas');
      c.width = Math.ceil(CELL_W * dpr);
      c.height = Math.ceil(CELL_H * dpr);
      var g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.font = FONT;
      g.textBaseline = 'top';
      g.fillStyle = fg;
      g.fillText(ch, 0, 0);
      return c;
    });
  }

  /* layered sine noise, ported concept from the reference site */
  function noise(t, n, o) {
    var c = Math.sin(t * 10 + o);
    c += Math.sin((n * 10 + o) / 2);
    c += Math.sin((t * 10 + n * 10 + o) / 2);
    var l = t + 0.5 * Math.sin(o / 3);
    var r = n + 0.5 * Math.cos(o / 2);
    c += Math.sin(Math.sqrt(100 * (l * l + r * r) + 1) + o);
    return c / 4;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = hero.getBoundingClientRect();
    W = canvas.width = Math.max(1, Math.round(r.width * dpr));
    H = canvas.height = Math.max(1, Math.round(r.height * dpr));
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(r.width / CELL_W);
    rows = Math.floor(r.height / CELL_H);
    buildMasks();
  }

  /* keep the glyph field out of the text zones so type stays readable:
     a hard core (skip) plus a feathered band (dimmed) */
  var maskGrid = null;   /* per-cell fade factor, precomputed on resize */
  var masks = [];
  function buildMasks() {
    masks = [];
    var cr = canvas.getBoundingClientRect();
    ['.hero__title', '.nav', '.logo', '.hero__meta', '.hero__bottom .label'].forEach(function (sel) {
      var el = hero.querySelector(sel);
      if (!el) return;
      var r = el.getBoundingClientRect();
      masks.push({
        x: r.left - cr.left - 10, y: r.top - cr.top - 10,
        w: r.width + 20, h: r.height + 20
      });
    });
    /* bake the per-cell factors once instead of per frame */
    maskGrid = new Float32Array(cols * rows);
    for (var f = 0; f < rows; f++) {
      for (var h = 0; h < cols; h++) {
        maskGrid[f * cols + h] = maskFactor(h * CELL_W + CELL_W / 2, f * CELL_H + CELL_H / 2);
      }
    }
  }

  function maskFactor(cx, cy) {
    var f = 1;
    for (var i = 0; i < masks.length; i++) {
      var m = masks[i];
      var feather = 34;
      if (cx > m.x && cx < m.x + m.w && cy > m.y && cy < m.y + m.h) return 0;
      var dx = Math.max(m.x - cx, cx - (m.x + m.w), 0);
      var dy = Math.max(m.y - cy, cy - (m.y + m.h), 0);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < feather) f = Math.min(f, 0.25 + 0.75 * (d / feather));
    }
    return f;
  }

  /* ------------------------------------------------------- interaction */
  document.addEventListener('mousemove', function (e) {
    mouse.fx = e.clientX / window.innerWidth;
    mouse.pageY = e.pageY;
  });

  function isInteractive(e) {
    return e.target.closest && e.target.closest('a, button, input, textarea, select');
  }

  hero.addEventListener('pointerdown', function (e) {
    if (isInteractive(e)) return;
    var rect = canvas.getBoundingClientRect();
    ripples.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t0: performance.now() });
    if (ripples.length > 5) ripples.shift();
    if (hint && !hint.classList.contains('is-off')) hint.classList.add('is-off');
    if (reduce || staticMode) draw(performance.now());
  });

  /* ------------------------------------------------------------ render */
  function draw(timeMs) {
    var a = timeMs * 0.001;
    var rect = canvas.getBoundingClientRect();
    var canvasTopPage = rect.top + window.pageYOffset;
    var F = Math.max(0, Math.min(1, (mouse.pageY - canvasTopPage) / Math.max(rect.height, 1)));
    var now = performance.now();

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    /* age out ripples */
    ripples = ripples.filter(function (r) { return now - r.t0 < 1400; });

    drawnCells = 0;
    curAlpha = 1; ctx.globalAlpha = 1;
    for (var f = 0; f < rows; f++) {
      var M = f / rows;
      for (var h = 0; h < cols; h++) {
        var w = h / cols;

        /* cursor warp (columns/rows bend around the pointer) */
        var vw = w - mouse.fx;
        var vM = M - F;
        var b = Math.sqrt(vw * vw + vM * vM);
        var E = Math.max(0, 1 - b * 3) * 0.15;
        var y = w + Math.sin(a * 2 + M * 8) * E;
        var L = M + Math.cos(a * 2 + w * 8) * E;

        var N = (noise(y, L, a) + 1) * 0.5;
        var idx = Math.floor(N * (CHARS.length - 1));

        /* cursor glow: heavier pixels close to the pointer */
        var p = Math.max(0, 1 - b * 4);
        if (p > 0) idx += Math.floor(p * 3);

        /* click ripples: expanding ring of heavy pixels + outward push */
        var ox = 0, oy = 0;
        var cx = h * CELL_W, cy = f * CELL_H;
        for (var ri = 0; ri < ripples.length; ri++) {
          var rp = ripples[ri];
          var age = (now - rp.t0) / 1000;
          var dx = cx - rp.x, dy = cy - rp.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          var ring = Math.exp(-Math.pow(d - age * 460, 2) / 7200) * (1 - age / 1.4);
          if (ring > 0.02) {
            idx += Math.round(ring * 5);
            if (d > 0.001) { ox += (dx / d) * ring * 7; oy += (dy / d) * ring * 7; }
          }
        }

        if (idx < 1) continue;
        if (idx > CHARS.length - 1) idx = CHARS.length - 1;
        var factor = maskGrid[f * cols + h];
        if (factor === 0) continue;
        if (factor !== curAlpha) { ctx.globalAlpha = factor; curAlpha = factor; }
        ctx.drawImage(sprites[idx], Math.round(cx + ox), Math.round(cy + oy));
        drawnCells++;
      }
    }
    frames++;
  }

  /* -------------------------------------------------------------- loop */
  var inView = true, running = false, raf = 0;

  var lastDraw = 0, slow = 0;
  function tick(t) {
    if (inView && !staticMode && t - lastDraw >= FRAME_MS) {
      var t0 = performance.now();
      draw(t);
      var dt = performance.now() - t0;
      lastDraw = t;
      /* struggling? step down a quality tier; last resort = static texture
         that still reacts to clicks, so the hero is never blank/frozen */
      if (dt > FRAME_MS * 1.4) {
        if (++slow > 45) {
          slow = 0;
          if (tier < TIERS.length - 1) {
            tier++; CELL_W = TIERS[tier][0]; CELL_H = TIERS[tier][1]; FRAME_MS = TIERS[tier][2];
            resize();
          } else {
            staticMode = true;
            setInterval(function () { if (inView) draw(performance.now()); }, 250);
            cancelAnimationFrame(raf);
            return;
          }
        }
      } else slow = 0;
    }
    raf = requestAnimationFrame(tick);
  }

  function setRunning(on) {
    if (reduce) return;
    if (on && !running) { running = true; raf = requestAnimationFrame(tick); }
    if (!on && running) { running = false; cancelAnimationFrame(raf); }
  }

  readColors();
  resize();

  if (reduce) {
    draw(1200);                       /* one static frame, no loop */
  } else {
    setRunning(true);
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

  var rz = null;
  window.addEventListener('resize', function () {
    if (rz) clearTimeout(rz);
    rz = setTimeout(function () {
      resize();
      if (reduce) draw(1200);
    }, 200);
  });

  window.addEventListener('themechange', function () {
    readColors();
    if (reduce) draw(1200);
  });

  window.__ascii = {
    frames: function () { return frames; },
    cells: function () { return drawnCells; },
    ripples: function () { return ripples.length; }
  };
})();

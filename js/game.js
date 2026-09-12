/* ==========================================================================
   DAEDALUS DASH — mini Phaser 3 game
   No image assets: player, obstacles, gems and the parallax labyrinth glyphs
   are all drawn with Phaser graphics at runtime, in the page's theme colours.
   ========================================================================== */
(function () {
  'use strict';

  var mount = document.getElementById('game-mount');
  var overlay = document.getElementById('game-overlay');
  var startBtn = document.getElementById('game-start');
  var bestEl = document.getElementById('game-best');
  var hud = document.getElementById('game-hud');
  var scoreEl = document.getElementById('game-score');
  var speedEl = document.getElementById('game-speed');
  var titleEl = overlay ? overlay.querySelector('.game__title') : null;
  var hintEl = overlay ? overlay.querySelector('.game__hint') : null;

  if (!mount || !overlay) return;

  function readBest() {
    try { return parseInt(localStorage.getItem('sv-dash-best'), 10) || 0; } catch (e) { return 0; }
  }
  function writeBest(v) {
    try { localStorage.setItem('sv-dash-best', String(v)); } catch (e) {}
  }
  function showBest() {
    if (bestEl) bestEl.textContent = '[ best: ' + readBest() + ' ]';
  }
  showBest();

  if (typeof Phaser === 'undefined') {
    if (hintEl) hintEl.textContent = '[ game unavailable — phaser.js could not load ]';
    if (startBtn) startBtn.style.display = 'none';
    return;
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function themeColors() {
    var cs = getComputedStyle(document.documentElement);
    return {
      fg: (cs.getPropertyValue('--fg') || '#000').trim(),
      bg: (cs.getPropertyValue('--bg') || '#00ff11').trim()
    };
  }

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? (parseInt(m[1], 16) << 16) + (parseInt(m[2], 16) << 8) + parseInt(m[3], 16) : 0x000000;
  }

  var scene = null;

  class Dash extends Phaser.Scene {
    constructor() { super('dash'); }

    create() {
      scene = this;
      this.c = themeColors();
      this.playing = false;
      this.dead = false;
      this.score = 0;
      this.mult = 1;
      this.jumps = 0;
      this.hudTick = 0;

      this.texGen = 0;
      this.makeTextures();

      this.groundG = this.add.graphics();
      this.dashes = this.add.group();
      this.glyphs = this.add.group();
      this.buildScenery();
      this.drawGround();

      /* player */
      this.player = this.physics.add.image(120, this.groundY() - 22, this.tk.player);
      this.player.body.setSize(40, 40);
      this.player.body.allowGravity = false;          /* idle until run starts */

      /* groups + collisions */
      this.blocks = this.physics.add.group();
      this.gems = this.physics.add.group();
      this.physics.add.overlap(this.player, this.blocks, this.crash, null, this);
      this.physics.add.overlap(this.player, this.gems, this.collect, null, this);

      /* particles */
      this.emitter = this.add.particles(0, 0, this.tk.part, {
        speed: { min: 60, max: 260 },
        lifespan: 550,
        scale: { start: 1, end: 0 },
        gravityY: 900,
        emitting: false
      });

      /* crash flash */
      this.flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, hexToRgb(this.c.fg), 1)
        .setOrigin(0, 0).setDepth(50).setAlpha(0);

      this.scale.on('resize', function () {
        scene.drawGround();
        scene.buildScenery();
        scene.flash.setSize(scene.scale.width, scene.scale.height);
        if (!scene.playing) scene.player.setPosition(120, scene.groundY() - 22);
      });

      /* idle bob on the start screen */
      this.tweens.add({
        targets: this.player,
        y: this.groundY() - 34,
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut'
      });
    }

    groundY() { return Math.round(this.scale.height * 0.8); }

    /* ------------------------------------------------------- textures */
    /* Textures are generated under versioned keys. Old keys are removed
       after a delay so in-flight particles never lose their GPU texture. */
    makeTextures() {
      var self = this;
      var fg = hexToRgb(this.c.fg);
      var bg = hexToRgb(this.c.bg);
      var sfx = 'v' + (++this.texGen);
      this.tk = {
        player: 'player-' + sfx, block: 'block-' + sfx, gem: 'gem-' + sfx,
        part: 'part-' + sfx, glyph: 'glyph-' + sfx
      };

      var g = this.make.graphics({ x: 0, y: 0, add: false });

      /* player: rounded square, eyes knocked out in bg colour */
      g.fillStyle(fg, 1);
      g.fillRoundedRect(0, 0, 44, 44, 8);
      g.fillStyle(bg, 1);
      g.fillRect(24, 12, 6, 10);
      g.fillRect(34, 12, 6, 10);
      g.generateTexture(this.tk.player, 44, 44);
      g.clear();

      /* obstacle block */
      g.fillStyle(fg, 1);
      g.fillRoundedRect(0, 0, 30, 60, 4);
      g.generateTexture(this.tk.block, 30, 60);
      g.clear();

      /* gem: diamond */
      g.fillStyle(fg, 1);
      g.beginPath();
      g.moveTo(13, 0); g.lineTo(26, 13); g.lineTo(13, 26); g.lineTo(0, 13); g.closePath();
      g.fillPath();
      g.generateTexture(this.tk.gem, 26, 26);
      g.clear();

      /* particle */
      g.fillStyle(fg, 1);
      g.fillRect(0, 0, 7, 7);
      g.generateTexture(this.tk.part, 7, 7);
      g.clear();

      /* labyrinth glyph for the parallax background */
      g.lineStyle(8, fg, 1);
      g.beginPath();
      g.moveTo(4, 4); g.lineTo(96, 4); g.lineTo(96, 96); g.lineTo(20, 96);
      g.lineTo(20, 20); g.lineTo(80, 20); g.lineTo(80, 80); g.lineTo(36, 80);
      g.lineTo(36, 36); g.lineTo(64, 36); g.lineTo(64, 64); g.lineTo(50, 64);
      g.strokePath();
      g.generateTexture(this.tk.glyph, 100, 100);
      g.destroy();
    }

    /* ------------------------------------------------------- scenery */
    buildScenery() {
      var w = this.scale.width;
      var gy = this.groundY();

      this.dashes.clear(true, true);
      for (var x = 0; x < w + 80; x += 80) {
        var d = this.add.rectangle(x, gy + 14, 26, 3, hexToRgb(this.c.fg), 0.35).setOrigin(0, 0);
        this.dashes.add(d);
      }

      this.glyphs.clear(true, true);
      var specs = [[0.12, 0.25, 0.07], [0.45, 0.12, 0.05], [0.78, 0.3, 0.09]];
      for (var i = 0; i < specs.length; i++) {
        var s = specs[i];
        var gl = this.add.image(w * s[0], gy * s[1] + 40, this.tk.glyph)
          .setAlpha(s[2]).setScale(1.6 + i * 0.7);
        gl.setData('speed', 0.12 + i * 0.08);
        this.glyphs.add(gl);
      }
    }

    drawGround() {
      this.groundG.clear();
      this.groundG.lineStyle(3, hexToRgb(this.c.fg), 1);
      this.groundG.beginPath();
      this.groundG.moveTo(0, this.groundY());
      this.groundG.lineTo(this.scale.width, this.groundY());
      this.groundG.strokePath();
    }

    onGround() {
      return Math.abs(this.player.y - (this.groundY() - 22)) < 2;
    }

    /* ----------------------------------------------------------- run */
    startRun() {
      this.playing = true;
      this.dead = false;
      this.score = 0;
      this.mult = 1;
      this.jumps = 0;

      this.blocks.clear(true, true);
      this.gems.clear(true, true);

      this.tweens.killTweensOf(this.player);
      this.player.setActive(true).setVisible(true);
      this.player.setAlpha(1).setAngle(0).setScale(1);
      this.player.setPosition(120, this.groundY() - 22);
      this.player.body.enable = true;
      this.player.body.allowGravity = true;
      this.player.body.velocity.set(0);

      if (this.spawnEv) this.spawnEv.remove();
      if (this.gemEv) this.gemEv.remove();
      if (this.rampEv) this.rampEv.remove();

      this.spawnEv = this.time.addEvent({ delay: 900, loop: false, callback: this.spawnBlock, callbackScope: this });
      this.gemEv = this.time.addEvent({ delay: 2200, loop: true, callback: this.spawnGem, callbackScope: this });
      this.rampEv = this.time.addEvent({
        delay: 6000, loop: true,
        callback: function () { scene.mult = Math.min(scene.mult + 0.12, 2.4); }
      });
    }

    spawnBlock() {
      if (!scene.playing || scene.dead) return;
      var v = -(300 + 120 * scene.mult);
      var h = 0.6 + Math.random() * 0.9;
      var b = scene.blocks.create(scene.scale.width + 60, scene.groundY() - 30 * h, scene.tk.block);
      b.setScale(1, h);
      b.body.allowGravity = false;
      b.body.velocity.x = v;

      if (Math.random() < 0.22) {
        var b2 = scene.blocks.create(scene.scale.width + 104, scene.groundY() - 21 * h, scene.tk.block);
        b2.setScale(1, h * 0.7);
        b2.body.allowGravity = false;
        b2.body.velocity.x = v;
      }
      scene.scheduleNext();
    }

    scheduleNext() {
      if (this.spawnEv) this.spawnEv.remove();
      this.spawnEv = this.time.addEvent({
        delay: Phaser.Math.Between(750, 1500) / this.mult,
        loop: false, callback: this.spawnBlock, callbackScope: this
      });
    }

    spawnGem() {
      if (!scene.playing || scene.dead) return;
      var gem = scene.gems.create(scene.scale.width + 40, scene.groundY() - Phaser.Math.Between(95, 175), scene.tk.gem);
      gem.body.allowGravity = false;
      gem.body.velocity.x = -(300 + 120 * scene.mult);
      scene.tweens.add({ targets: gem, angle: 360, duration: 1400, repeat: -1 });
    }

    jump() {
      if (!this.playing || this.dead || this.jumps >= 2) return;
      this.jumps++;
      this.player.body.velocity.y = this.jumps === 1 ? -640 : -560;
      this.tweens.add({ targets: this.player, scaleX: 0.82, scaleY: 1.22, duration: 90, yoyo: true });
      if (!reduceMotion) this.emitter.emitParticleAt(this.player.x, this.player.y + 20, 6);
    }

    collect(player, gem) {
      var gx = gem.x, gy = gem.y;
      gem.destroy();
      this.score += 25;
      if (!reduceMotion) this.emitter.emitParticleAt(gx, gy, 14);
      var t = this.add.text(gx, gy - 10, '+25', {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '18px',
        color: this.c.fg
      }).setOrigin(0.5);
      this.tweens.add({
        targets: t, y: t.y - 46, alpha: 0, duration: 700,
        onComplete: function () { t.destroy(); }
      });
    }

    crash() {
      if (this.dead) return;
      this.dead = true;
      this.playing = false;

      var px = this.player.x, py = this.player.y;

      if (!reduceMotion) {
        this.cameras.main.shake(260, 0.02);
        this.emitter.emitParticleAt(px, py, 26);
        this.tweens.add({ targets: this.flash, alpha: { from: 0.35, to: 0 }, duration: 420 });
      }

      this.tweens.add({
        targets: this.player, angle: 90, y: py - 60, duration: 180, yoyo: true, ease: 'Quad.out',
        onComplete: function () {
          scene.tweens.add({
            targets: scene.player, y: scene.groundY() - 10, alpha: 0.25,
            duration: 420, ease: 'Bounce.out'
          });
        }
      });

      this.blocks.children.entries.forEach(function (b) { if (b.body) b.body.velocity.x = 0; });
      this.gems.children.entries.forEach(function (g) { if (g.body) g.body.velocity.x = 0; });

      var final = Math.floor(this.score);
      var best = readBest();
      if (final > best) { best = final; writeBest(best); }

      this.time.delayedCall(750, function () {
        showBest();
        if (titleEl) titleEl.textContent = 'game over.';
        if (hintEl) hintEl.textContent = '[ score: ' + final + ' ] · [ best: ' + best + ' ] · [ space / tap ] = retry';
        if (startBtn) startBtn.querySelector('span').textContent = 'run again';
        overlay.classList.remove('is-off');
        if (hud) hud.hidden = true;
      });
    }

    /* -------------------------------------------------------- update */
    update(time, delta) {
      var dt = delta / 1000;
      var self = this;

      var drift = this.playing ? (300 + 120 * this.mult) : 40;
      this.dashes.children.entries.forEach(function (d) {
        d.x -= drift * dt * 0.5;
        if (d.x < -40) d.x = self.scale.width + 40;
      });
      this.glyphs.children.entries.forEach(function (g) {
        g.x -= drift * dt * g.getData('speed');
        if (g.x < -140) g.x = self.scale.width + 140;
      });

      if (!this.playing) return;

      /* ground clamp (the ground is drawn, not a physics body) */
      var gy = this.groundY() - 22;
      if (this.player.y >= gy) {
        this.player.y = gy;
        if (this.player.body.velocity.y > 0) this.player.body.velocity.y = 0;
      }

      /* score + hud */
      this.score += dt * 12 * this.mult;
      this.hudTick -= delta;
      if (this.hudTick <= 0) {
        this.hudTick = 100;
        if (scoreEl) scoreEl.textContent = '[ score: ' + Math.floor(this.score) + ' ]';
        if (speedEl) speedEl.textContent = '[ speed: ' + this.mult.toFixed(1) + '× ]';
      }

      /* landing: squash + reset jumps */
      if (this.jumps > 0 && this.onGround() && this.player.body.velocity.y === 0) {
        this.tweens.add({ targets: this.player, scaleX: 1.22, scaleY: 0.8, duration: 90, yoyo: true });
        if (!reduceMotion) this.emitter.emitParticleAt(this.player.x, this.player.y + 20, 5);
        this.jumps = 0;
      }

      /* recycle off-screen */
      this.blocks.children.entries.slice().forEach(function (b) { if (b.x < -80) b.destroy(); });
      this.gems.children.entries.slice().forEach(function (g) { if (g.x < -60) g.destroy(); });
    }

    /* ------------------------------------------------------- recolor */
    recolor() {
      var old = this.tk;
      this.c = themeColors();
      this.makeTextures();
      this.drawGround();
      if (this.player) this.player.setTexture(this.tk.player);
      this.blocks.children.entries.forEach(function (b) { b.setTexture(scene.tk.block); });
      this.gems.children.entries.forEach(function (g) { g.setTexture(scene.tk.gem); });
      this.glyphs.children.entries.forEach(function (g) { g.setTexture(scene.tk.glyph); });
      this.dashes.children.entries.forEach(function (d) { d.setFillStyle(hexToRgb(scene.c.fg), 0.35); });
      if (this.emitter) this.emitter.setTexture(this.tk.part);
      if (this.flash) this.flash.setFillStyle(hexToRgb(this.c.fg), 1);

      /* drop old textures once no particle can reference them anymore */
      this.time.delayedCall(900, function () {
        Object.keys(old).forEach(function (k) {
          if (scene.textures.exists(old[k])) scene.textures.remove(old[k]);
        });
      });
    }
  }

  /* ---------------------------------------------------------- boot */
  var game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-mount',
    transparent: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    physics: { default: 'arcade', arcade: { gravity: { y: 1600 }, debug: false } },
    scene: Dash,
    banner: false
  });

  /* ---------------------------------------------------- dom wiring */
  function startGame() {
    if (!scene) return;
    overlay.classList.add('is-off');
    if (hud) hud.hidden = false;
    scene.startRun();
  }

  overlay.addEventListener('pointerdown', function (e) {
    e.stopPropagation();
    startGame();
  });

  /* jump / restart — page level, space only captured while game is on screen */
  function gameInView() {
    var r = mount.getBoundingClientRect();
    return r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15;
  }

  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
    if (!gameInView()) return;
    e.preventDefault();
    if (!overlay.classList.contains('is-off')) { startGame(); return; }
    if (scene) scene.jump();
  });

  mount.addEventListener('pointerdown', function () {
    if (!overlay.classList.contains('is-off')) return;
    if (scene) scene.jump();
  });

  /* pause when scrolled away or tab hidden */
  function setPaused(pause) {
    if (!scene || !scene.playing) return;
    if (pause) game.scene.pause('dash');
    else game.scene.resume('dash');
  }

  if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { setPaused(!e.isIntersecting); });
    }, { threshold: 0.15 });
    vio.observe(mount);
  }
  document.addEventListener('visibilitychange', function () { setPaused(document.hidden); });

  /* theme sync */
  window.addEventListener('themechange', function () { if (scene) scene.recolor(); });
})();

'use strict';
// Mission world simulation, objectives, checkpoints, rewards, camera, rendering and HUD.

function computeStats(diffKey) {
  const u = id => Store.up(id), D = DIFFS[diffKey];
  const st = {
    maxHp: 100 + u('hp') * 15 + D.php,
    resist: 1 - u('resist') * 0.06,
    heal: 1 + u('heal') * 0.2,
    speed: 1 + u('speed') * 0.05,
    dodgeCd: 0.95 * (1 - 0.12 * u('dodge')),
    jumpVel: 480 * (1 + 0.04 * u('jump')),
    airControl: 1 + 0.15 * u('jump'),
    critChance: 0.05 + 0.03 * u('crit'),
    critMult: 1.6 + 0.15 * u('crit'),
    deCap: 100 * (1 + 0.2 * u('decap')),
    deSlow: 0.32 - 0.035 * u('deslow'),
    deRegen: 1 + 0.2 * u('deregen'),
    weapons: {},
  };
  const cap = u('capacity');
  for (const id of WEAPON_ORDER) {
    const W = WEAPONS[id], lv = Store.save.weaponLv[id] || 0;
    const w = Object.assign({}, W, {
      dmg: W.dmg * (1 + 0.08 * u('dmg')) * (1 + 0.1 * lv),
      mag: W.mag + Math.round(W.mag * cap / 6),
      reload: W.reload * (1 - 0.08 * u('reload')) * (1 - 0.07 * lv),
      fire: W.fire * (1 - 0.04 * u('handling')),
      swap: W.swap * (1 - 0.15 * u('handling')),
    });
    w.reserveMax = W.reserve === Infinity ? Infinity : Math.round(W.reserve * (1 + 0.2 * cap) * Math.min(1.3, D.ammo));
    w.startReserve = W.reserve === Infinity ? Infinity : Math.round(w.reserveMax * Math.min(1, 0.55 + 0.3 * D.ammo));
    st.weapons[id] = w;
  }
  return st;
}

const KEY_NAMES = { Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'RSHIFT', ControlLeft: 'CTRL', ControlRight: 'RCTRL', AltLeft: 'ALT', AltRight: 'RALT',
  ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN', Enter: 'ENTER', Tab: 'TAB', Backquote: '`', CapsLock: 'CAPS', Backspace: 'BKSP' };
function keyLabel(code) {
  if (!code) return '-';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM' + code.slice(6);
  return code.toUpperCase().slice(0, 8);
}
function bindLabel(action) {
  if (Input.usingPad) { const b = Store.settings.pad[action]; return b != null ? PAD_NAMES[b] : keyLabel(Store.settings.keys[action][0]); }
  return keyLabel((Store.settings.keys[action] || [''])[0]);
}
function fillTokens(s) { return s.replace(/\{(\w+)\}/g, (_, a) => bindLabel(a)); }

function wrapText(s, n) {
  const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

// ======================================================================
class World {
  constructor(mission, diffKey, snap, run) {
    G = this;
    this.mission = mission; this.diffKey = diffKey; this.diff = DIFFS[diffKey]; this.run = run;
    const L = this.level = LEVELS[mission.level]();
    this.width = L.width; this.th = THEMES[L.theme]; this.bg = Game.bgFor(L.theme);
    this.solids = L.solids; this.plats = L.plats; this.deco = L.deco; this.fg = L.fg;
    this.hazards = L.hazards.map(h => Object.assign({}, h));
    this.picks = L.picks.map(p => Object.assign({ t: 0, vx: 0, vy: 0, dyn: false }, p));
    this.waves = L.waves.map(w => Object.assign({}, w, { fired: false, done: false, queue: [] }));
    this.waveById = Object.fromEntries(this.waves.map(w => [w.id, w]));
    this.cps = L.cps.map(x => ({ x, active: false }));
    this.stages = L.stages.map(s => Object.assign({}, s));
    this.si = 0; this.enemies = []; this.dyns = []; this.rocks = []; this.flashes = []; this.timers = []; this.pendingBlasts = [];
    this.bullets = makePool(); this.parts = makePool(); this.nums = makePool();
    this.counters = {}; this.collected = 0; this.targetsKilled = 0; this.levers = {}; this.removed = new Set(); this.taken = new Set();
    this.minX = 0; this.maxX = this.width; this.arena = null; this.bossActive = false; this.boss = null; this.showdown = null; this.survive = null;
    this.cam = { x: 0, y: 0, kx: 0, ky: 0 }; this.trauma = 0; this.hitmarker = 0; this.hurtFlash = 0; this.darkBoost = 0; this.slowmo = 0;
    this.time = 0; this.timeLeft = null; this.state = 'play'; this.endT = 0; this.ts = 1;
    this.stats = run.stats; this.hitShots = run.hitShots; this.shotId = run.shotId;
    this.bannerQ = []; this.overlay = []; this.prompt = null; this.aimRel = { x: 120, y: 0 };
    this.pstats = computeStats(diffKey);
    this.tumbles = [];
    if (L.tumble) for (let i = 0; i < 3; i++) this.tumbles.push({ x: rand(0, VW * 2), vx: rand(35, 70), a: 0, ph: rand(0, 5), y: GY - 6 });
    const sx = L.spawnX;
    this.player = new Player(sx, this.surfaceY(sx));
    this.wagon = L.wagonStart != null ? new Wagon(L.wagonStart, L.wagonEnd) : null;
    if (snap) this.applySnapshot(snap);
    this.cam.x = clamp(this.player.cx - VW / 2, 0, this.width - VW);
    this.lastCp = snap ? snap.cp : -1;
    for (const st of this.stages) if (st.type === 'boss') st.spawned = false;
  }

  // ---- geometry helpers ----
  surfaceY(x) {
    let best = null;
    for (const s of this.solids) if ((s.kind === 'ground' || s.kind === 'car' || s.kind === 'hull' || s.kind === 'pier') && x >= s.x && x < s.x + s.w && s.y > 120 && (best == null || s.y < best)) best = s.y;
    return best == null ? GY : best;
  }
  removeSolid(s) { const i = this.solids.indexOf(s); if (i >= 0) this.solids.splice(i, 1); this.removed.add(s.id); }

  // ---- checkpoints ----
  makeSnapshot(i) {
    const P = this.player, ammo = {};
    for (const k in P.ammo) ammo[k] = { mag: P.ammo[k].mag, reserve: P.ammo[k].reserve };
    return {
      cp: i, x: this.cps[i].x, si: this.si, wavesDone: this.waves.filter(w => w.done).map(w => w.id),
      removed: [...this.removed], taken: [...this.taken], wagon: this.wagon ? { x: this.wagon.x, hp: this.wagon.hp } : null,
      ammo, de: P.de, collected: this.collected, counters: Object.assign({}, this.counters), targetsKilled: this.targetsKilled,
      levers: Object.assign({}, this.levers), timeLeft: this.timeLeft, cur: P.cur,
    };
  }
  applySnapshot(s) {
    const rm = new Set(s.removed);
    this.solids = this.solids.filter(o => !rm.has(o.id)); this.removed = rm;
    this.taken = new Set(s.taken); this.picks = this.picks.filter(p => !this.taken.has(p.id));
    for (const id of s.wavesDone) { const w = this.waveById[id]; if (w) { w.fired = true; w.done = true; } }
    if (this.wagon && s.wagon) { this.wagon.x = s.wagon.x; this.wagon.hp = Math.max(s.wagon.hp, this.wagon.maxHp * 0.5); }
    const P = this.player;
    for (const k in s.ammo) if (P.ammo[k]) { P.ammo[k].mag = s.ammo[k].mag; P.ammo[k].reserve = s.ammo[k].reserve == null ? Infinity : s.ammo[k].reserve; }
    if (P.slots[s.cur]) P.cur = s.cur;
    P.de = Math.max(s.de, this.pstats.deCap * 0.3);
    this.collected = s.collected; this.counters = Object.assign({}, s.counters); this.targetsKilled = s.targetsKilled; this.levers = Object.assign({}, s.levers);
    this.si = s.si;
    for (let i = 0; i < s.si && i < this.stages.length; i++) this.stages[i].started = true;
    if (s.timeLeft != null) { this.timeLeft = Math.max(s.timeLeft, 45); const st = this.stages[this.si]; if (st) st.started = true; }
    for (let i = 0; i <= s.cp; i++) this.cps[i].active = true;
    P.x = s.x - P.w / 2; P.y = this.surfaceY(s.x) - P.h; P.lastSafe = { x: P.x, y: P.y };
    for (const w of this.waves) if (!w.fired && w.at < s.x - 400) { w.fired = true; w.done = true; } // long-gone waves stay cleared
  }

  // ---- spawning ----
  spawnEnemy(def, waveId) {
    const P = this.player;
    let x = def.x;
    if (def.y == null && Math.abs(x - P.cx) < 140) x = clamp(P.cx + (Math.sign(x - P.cx) || 1) * 170, this.minX + 12, this.maxX - 12);
    const y = def.y != null ? def.y : this.surfaceY(x);
    const e = new Enemy(def.t, x, y, { guard: def.guard, name: def.name, elite: def.elite, hpMult: def.hpMult, look: def.look, wagon: def.wagon, wave: waveId });
    if (def.elite) e.T = Object.assign({}, e.T, { cool: e.T.cool.map(v => v * 0.7), burst: e.T.burst ? [e.T.burst[0] + 1, e.T.burst[1] + 1] : e.T.burst, aim: e.T.aim * 0.85 });
    e.isTarget = !!def.target;
    e.perched = def.y != null && def.y < this.surfaceY(x) - 10 && (def.t === 'sharp' || def.t === 'dynamite');
    this.enemies.push(e);
    dust(e.cx, y, 6);
    return e;
  }
  spawnAt(type, x, y) { return this.spawnEnemy({ t: type, x, y }, null); }
  fireWave(w) {
    w.fired = true;
    for (const d of w.spawns) w.queue.push({ d, t: d.delay || 0 });
  }

  // ---- events ----
  banner(text, sub, dur) { this.bannerQ.push({ text, sub: sub || '', t: 0, dur: dur || 2.4 }); }
  toast(text) { UI.toast(text); }
  kick(x, y) { this.cam.kx += x; this.cam.ky += y; }
  noise(x, r) { for (const e of this.enemies) if (!e.dead && e.hearNoise) e.hearNoise(x, r); }
  dropPickup(type, x, y, amount) {
    this.picks.push({ id: 0, type, x, y: y - 4, vx: rand(-50, 50), vy: rand(-180, -110), dyn: true, t: 0, life: type === 'cash' ? 22 : 30, amount });
  }
  onEnemyKilled(e, info) {
    if (e.decoy) return;
    this.stats.kills++;
    this.player.addDE(10);
    if (e.isTarget) { this.targetsKilled++; this.banner('BOUNTY COLLECTED', e.name || 'Target down'); }
    if (e.boss) { this.onBossDead(e); return; }
    const T = e.T, n = randi(2, 3);
    const total = (T.cash ? randi(T.cash[0], T.cash[1]) : 10) * (e.elite ? 5 : 1);
    for (let i = 0; i < n; i++) this.dropPickup('cash', e.cx, e.y + 10, Math.ceil(total / n));
    const r = Math.random(), am = this.diff.ammo;
    if (r < 0.22 * am) this.dropPickup('ammo', e.cx, e.y + 10);
    else if (r < 0.22 * am + 0.12) this.dropPickup('health', e.cx, e.y + 10);
    else if (r < 0.22 * am + 0.17) this.dropPickup('tonic', e.cx, e.y + 10);
  }
  onBossDead(b) {
    this.bossActive = false; this.slowmo = 1.6;
    this.solids = this.solids.filter(s => !s.arenaWall);
    this.minX = 0; this.maxX = this.width;
    this.banner(b.name + ' IS DEAD', 'Bounty claimed', 3);
    Sound.play('bell'); shake(0.6);
    for (let i = 0; i < 6; i++) this.dropPickup('cash', b.cx, b.y + 10, 25);
    if (this.showdown) { this.showdown = null; this.player.forcedDE = false; this.player.setDE(false); }
    for (const e of this.enemies) if (!e.dead && !e.boss) { e.fleeing = true; e.fleeDir = e.cx < b.cx ? -1 : 1; }
  }
  startShowdown(boss) {
    const P = this.player, ar = this.arena;
    for (const e of this.enemies) if (!e.dead && !e.boss) e.remove = true;
    clearPool(this.bullets); this.dyns.length = 0;
    this.showdown = { t: 0, boss };
    boss.invuln = true; boss.state = 'showIntro';
    P.x = ar.x0 + 140; P.y = this.surfaceY(ar.x0 + 140) - P.h; P.vx = 0;
    boss.x = ar.x1 - 160; boss.y = this.surfaceY(ar.x1 - 160) - boss.h; boss.vx = 0;
    this.banner('THE SHOWDOWN', 'One last draw. Make it count.', 2.2);
    Sound.play('bell');
  }
  onPlayerDeath() {
    this.stats.deaths++; Store.save.stats.deaths++;
    this.state = 'dead'; this.endT = 0;
    if (this.showdown) this.showdown = null;
  }
  fail(reason) {
    if (this.state !== 'play') return;
    this.state = 'failed'; this.failReason = reason; this.endT = 0;
    this.player.setDE(false);
  }
  complete() {
    if (this.state !== 'play') return;
    this.state = 'complete'; this.endT = 0;
    this.player.forcedDE = false; this.player.setDE(false);
    Sound.play('complete');
  }
  pitFall() {
    const P = this.player;
    if (!P.alive) return;
    if (this.th.water) { Sound.play('splash', { x: P.cx }); for (let i = 0; i < 14; i++) part('dust', P.cx + rand(-6, 6), 318, rand(-60, 60), rand(-220, -80), rand(0.4, 0.8), 2, '#b8d8e8', 700); }
    P.hp -= 20 * this.diff.edmg; Sound.play('hurt'); this.hurtFlash = 0.4; shake(0.3);
    if (P.hp <= 0) { P.die(); return; }
    P.x = P.lastSafe.x; P.y = P.lastSafe.y; P.vx = 0; P.vy = 0; P.iframes = 1.0; P.rollT = 0;
    if (P.h !== P.H) { P.y -= P.H - P.h; P.h = P.H; P.crouch = false; P.rolling = false; }
    dust(P.cx, P.y + P.h, 8);
  }
  interact() {
    const P = this.player, cx = P.cx, cy = P.y + P.h / 2;
    const near = this.findInteract();
    if (!near) return;
    if (near.kind === 'gold') {
      if (near.o.box) { smoke(near.o.x, near.o.y - 6, 4, '#c8c0b0'); Sound.play('crate', { x: near.o.x }); }
      this.picks.splice(this.picks.indexOf(near.o), 1); this.taken.add(near.o.id);
      this.collected++; Sound.play('gold');
      const need = (this.stages.find(s => s.type === 'collect') || { n: this.collected }).n;
      this.banner('GOLD RECOVERED', this.collected + ' / ' + need, 1.6);
      this.run.cash += 25;
    } else if (near.kind === 'door') {
      this.removeSolid(near.o); Sound.play('gate', { x: cx }); dust(near.o.x + 4, near.o.y + near.o.h, 6);
    } else if (near.kind === 'lever') {
      near.o.on = true; this.levers[near.o.lever] = true; shake(0.4);
      if (near.o.t === 'bell') { Sound.play('bell'); setTimeoutGame(() => Sound.play('bell'), 0.6); } else { Sound.play('gate', { x: cx }); Sound.play('whistle'); }
    }
    void cy;
  }
  findInteract() {
    const P = this.player, cx = P.cx, cy = P.y + P.h / 2;
    for (const p of this.picks) if (p.type === 'gold' && Math.abs(p.x - cx) < 22 && Math.abs(p.y - 6 - cy) < 30) return { kind: 'gold', o: p, x: p.x, y: p.y - 16, text: p.box ? 'CRACK STRONGBOX' : 'GRAB GOLD' };
    for (const s of this.solids) if (s.kind === 'door' && Math.abs(s.x + s.w / 2 - cx) < 22 && cy > s.y && cy < s.y + s.h + 10) return { kind: 'door', o: s, x: s.x + 4, y: s.y - 6, text: 'OPEN' };
    for (const d of this.deco) if (d.lever && !d.on && Math.abs(d.x - cx) < 24 && Math.abs((d.y || GY) - (P.y + P.h)) < 34) {
      const st = this.stages[this.si];
      if (st && st.type === 'interact' && st.id === d.lever) return { kind: 'lever', o: d, x: d.x, y: (d.y || GY) - 34, text: d.prompt || 'PULL BRAKE' };
    }
    return null;
  }

  // ---- stages ----
  startStage(s) {
    if (s.time != null && s.type !== 'survive' && this.timeLeft == null) this.timeLeft = s.time * this.diff.time; // survive uses `time` as its duration, not a limit
    if (s.fire) for (const id of s.fire) { const w = this.waveById[id]; if (w && !w.fired) this.fireWave(w); }
    if (s.type === 'survive') {
      this.arena = this.level.arena; this.minX = this.arena.x0; this.maxX = this.arena.x1;
      s.left = s.time * (this.diffKey === 'easy' ? 0.75 : this.diffKey === 'hard' ? 1.25 : 1); s.spawnT = 1;
      this.banner('AMBUSH!', 'Hold out until they break', 2.2);
      if (this.wagon) this.wagon.hp = Math.max(this.wagon.hp, this.wagon.maxHp * 0.7); // teamster patches the wagon
      Music.setMode('combat');
    }
  }
  startBoss(s) {
    s.spawned = true;
    const ar = this.arena = this.level.arena;
    this.minX = ar.x0; this.maxX = ar.x1;
    const P = this.player;
    if (P.x < ar.x0) P.x = ar.x0 + 4;
    this.solids.push({ id: -1, x: ar.x0 - 12, y: -200, w: 12, h: 600, kind: 'gate', move: true, arenaWall: true }, { id: -2, x: ar.x1, y: -200, w: 12, h: 600, kind: 'gate', move: true, arenaWall: true });
    const y = s.spawnY != null ? s.spawnY : this.surfaceY(s.spawnX);
    const b = this.boss = new BOSS_CLASSES[s.boss](s.spawnX, y);
    this.enemies.push(b);
    this.bossActive = true;
    smoke(b.cx, b.y + 15, 10);
    Sound.play('bossIntro'); Music.setMode('boss');
    this.banner(b.B.name, b.B.title, 2.6);
  }
  stageText() {
    const s = this.stages[this.si];
    if (!s) return 'Mission complete';
    let extra = '';
    if (s.type === 'clear') {
      let left = 0;
      for (const id of s.waves) { const w = this.waveById[id]; if (!w.fired) left += w.spawns.length; else left += w.queue.length + this.enemies.filter(e => e.wave === id && !e.dead).length; }
      extra = left + ' left';
    } else if (s.type === 'break') extra = (this.counters[s.kind] || 0) + '/' + s.n;
    else if (s.type === 'collect') extra = this.collected + '/' + s.n;
    else if (s.type === 'eliminate') extra = this.targetsKilled + '/' + s.n;
    else if (s.type === 'survive' && s.left != null) extra = fmtTime(s.left);
    else if (s.type === 'wagon' && this.wagon) extra = this.wagon.blocker ? 'Shoot the barricade!' : (this.wagon.moving ? Math.round(100 * (this.wagon.x - this.level.wagonStart) / (this.wagon.endX - this.level.wagonStart)) + '%' : 'Stay close');
    else if (s.type === 'boss' && !s.spawned) extra = 'Head onward';
    return s.text + (extra ? '  —  ' + extra : '');
  }
  updateStage(dt) {
    const s = this.stages[this.si], P = this.player;
    if (!s) return;
    if (!s.started) { s.started = true; this.startStage(s); }
    let done = false;
    switch (s.type) {
      case 'break': done = (this.counters[s.kind] || 0) >= s.n; break;
      case 'clear': done = s.waves.every(id => this.waveById[id].done); break;
      case 'reach': done = P.cx >= s.x; break;
      case 'collect': done = this.collected >= s.n; break;
      case 'eliminate': done = this.targetsKilled >= s.n; break;
      case 'interact': done = !!this.levers[s.id]; break;
      case 'wagon': done = this.wagon.x >= this.wagon.endX; break;
      case 'boss':
        if (!s.spawned) { if (P.cx >= s.at) this.startBoss(s); }
        else done = this.boss.dead && this.boss.deadT > 1.6;
        break;
      case 'survive': {
        s.left -= dt; s.spawnT -= dt;
        const alive = this.enemies.filter(e => !e.dead && !e.fleeing).length;
        if (s.spawnT <= 0 && s.left > 3) {
          s.spawnT = rand(2.8, 4) * this.diff.react;
          if (alive < (this.diffKey === 'hard' ? 6 : 5)) {
            const t = choose(s.mix);
            if (t === 'sharp' && s.ledges) { const l = choose(s.ledges); this.spawnEnemy({ t, x: l.x, y: l.y, wagon: true }); }
            else { const ar = this.arena, left = Math.abs(P.cx - ar.x0) > Math.abs(P.cx - ar.x1); this.spawnEnemy({ t, x: left ? ar.x0 + 14 : ar.x1 - 14, wagon: t !== 'dynamite' }); }
          }
        }
        if (s.left <= 0) {
          done = true;
          for (const e of this.enemies) if (!e.dead) { e.fleeing = true; e.fleeDir = e.cx < (this.arena.x0 + this.arena.x1) / 2 ? -1 : 1; }
          this.banner('THEY\'RE RUNNING!', 'The ambush is broken');
          this.minX = 0; this.maxX = this.width; this.arena = null;
        }
        break;
      }
    }
    if (!done && this.timeLeft != null) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.fail('Time ran out.'); return; }
    }
    if (done) {
      if (s.time != null) this.timeLeft = null;
      this.si++;
      if (this.si >= this.stages.length) this.complete();
      else { Sound.play('checkpoint'); this.banner('OBJECTIVE COMPLETE', this.stages[this.si].text, 2); }
    }
  }

  // ---- main update ----
  computeAim() {
    const P = this.player, sh = P.shoulder();
    if (Input.usingPad) {
      const ax = Input.stick.ax, ay = Input.stick.ay;
      if (Math.hypot(ax, ay) > 0.25) {
        let a = Math.atan2(ay, ax);
        const mode = Store.settings.aimAssist;
        if (mode !== 'off') {
          const cone = mode === 'high' ? 0.24 : 0.13; let best = null, bd = cone;
          for (const e of this.enemies) {
            if (e.dead || e.invuln || e.hidden || Math.abs(e.cx - P.cx) > 520) continue;
            const ty = e.y + (mode === 'high' ? 4 : 14), ea = Math.atan2(ty - sh.y, e.cx - sh.x), d = Math.abs(angDiff(a, ea));
            if (d < bd && losClear(sh.x, sh.y, e.cx, ty)) { bd = d; best = ea; }
          }
          if (best != null) a += angDiff(a, best) * (mode === 'high' ? 0.85 : 0.5);
        }
        const r = 110 + Math.hypot(ax, ay) * 60 * Store.settings.sensitivity;
        this.aimRel = { x: Math.cos(a) * r, y: Math.sin(a) * r };
      } else if (Math.abs(Input.stick.mx) > 0.3 && Math.sign(Input.stick.mx) !== Math.sign(this.aimRel.x)) this.aimRel.x = -this.aimRel.x;
      P.aimX = sh.x + this.aimRel.x; P.aimY = sh.y + this.aimRel.y;
    } else {
      P.aimX = Input.mouse.x + this.cam.x; P.aimY = Input.mouse.y + this.cam.y;
    }
  }

  update(dt) {
    const P = this.player;
    if (this.slowmo > 0) this.slowmo -= dt;
    let ts = this.showdown && this.showdown.t > 1.8 ? 0.25 : P.deActive ? this.pstats.deSlow : 1;
    if (this.slowmo > 0) ts = Math.min(ts, 0.35);
    if (this.state === 'complete') ts = 0.6;
    this.ts = ts;
    const wdt = dt * ts;
    this.time += wdt; this.run.time += dt;
    this.computeAim();
    if (this.state === 'play' || this.state === 'dead') P.update(dt);
    if (this.state !== 'play') { this.endT += dt; }
    // showdown choreography
    if (this.showdown) {
      const sd = this.showdown; sd.t += dt;
      if (sd.t > 1.8 && sd.boss.state === 'showIntro') {
        sd.boss.state = 'duel'; sd.boss.invuln = false; sd.boss.st = 1.0;
        P.de = this.pstats.deCap; P.forcedDE = true; P.setDE(true);
        this.banner('DRAW!', 'Three hits, or one to the head', 1.6);
        Sound.play('bell');
      }
    }
    // world-time scheduler
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm.t -= wdt; if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); } }
    // waves
    for (const w of this.waves) {
      if (!w.fired && P.cx >= w.at) this.fireWave(w);
      if (w.queue.length) for (let i = w.queue.length - 1; i >= 0; i--) { const q = w.queue[i]; q.t -= wdt; if (q.t <= 0) { w.queue.splice(i, 1); this.spawnEnemy(q.d, w.id); } }
    }
    // enemies
    for (const e of this.enemies) e.update(wdt);
    for (const w of this.waves) if (w.fired && !w.done && !w.queue.length && !this.enemies.some(e => e.wave === w.id && !e.dead && !e.remove)) w.done = true;
    this.enemies = this.enemies.filter(e => !e.remove && !(e.dead && e.deadT > 4 && !e.boss));
    // bullets: player rounds stay fast, enemy rounds obey world time
    for (const b of this.bullets.list) updateBullet(b, b.team === 'p' ? dt * (P.deActive ? 0.6 : 1) : wdt);
    sweepPool(this.bullets);
    for (const d of this.dyns) updateDynamite(d, wdt);
    this.dyns = this.dyns.filter(d => !d.dead);
    for (const r of this.rocks) updateRock(r, wdt);
    this.rocks = this.rocks.filter(r => !r.dead);
    for (const h of this.hazards) updateHazard(h, wdt);
    for (let i = this.pendingBlasts.length - 1; i >= 0; i--) { const b = this.pendingBlasts[i]; b.t -= wdt; if (b.t <= 0) { this.pendingBlasts.splice(i, 1); explode(b.x, b.y, 56, 40 * this.diff.edmg, 160, b.byPlayer); } }
    if (this.wagon) this.wagon.update(wdt);
    // gates open when their waves are done
    for (const s of this.solids.slice()) if (s.kind === 'gate' && s.waves && s.waves.every(id => this.waveById[id] && this.waveById[id].done)) {
      this.removeSolid(s); Sound.play('gate', { x: s.x }); dust(s.x + 5, s.y + s.h, 10); smoke(s.x + 5, s.y + s.h - 20, 6, '#c8a878');
      this.banner('THE WAY IS OPEN', '', 1.4);
    }
    this.updatePickups(wdt);
    // particles
    for (const p of this.parts.list) {
      p.life -= wdt; if (p.life <= 0) { p.dead = true; continue; }
      if (p.type === 'stuck') continue;
      p.vy += p.grav * wdt; p.x += p.vx * wdt; p.y += p.vy * wdt;
      if (p.type === 'smoke') { p.vx *= 0.98; p.size += wdt * 4; }
      if (p.bounce && p.vy > 0 && pointSolid(p.x, p.y)) { p.y -= p.vy * wdt; p.vy *= -0.35; p.vx *= 0.6; if (p.type === 'shell' && Math.abs(p.vy) > 30) Sound.play('shell', { x: p.x }); }
    }
    sweepPool(this.parts);
    for (const n of this.nums.list) { n.life -= dt; n.y += n.vy * dt; n.vy *= 0.94; if (n.life <= 0) n.dead = true; }
    sweepPool(this.nums);
    for (const f of this.flashes) f.life -= wdt;
    this.flashes = this.flashes.filter(f => f.life > 0);
    // checkpoints
    if (P.alive && this.state === 'play') for (let i = this.cps.length - 1; i >= 0; i--) {
      const cp = this.cps[i];
      if (cp.active) break;
      if (P.cx >= cp.x) {
        for (let j = 0; j <= i; j++) this.cps[j].active = true;
        this.lastCp = i; this.run.snap = this.makeSnapshot(i);
        Sound.play('checkpoint'); UI.toast('Checkpoint reached');
        break;
      }
    }
    if (this.state === 'play') this.updateStage(wdt);
    this.prompt = P.alive ? this.findInteract() : null;
    // ambience: tumbleweeds, wind dust, train smoke
    for (const tw of this.tumbles) {
      tw.x += tw.vx * wdt; tw.a += tw.vx * wdt / 6; tw.ph += wdt * 5;
      tw.y = GY - 6 - Math.abs(Math.sin(tw.ph)) * 12;
      if (tw.x > this.cam.x + VW + 200) { tw.x = this.cam.x - rand(100, 400); tw.vx = rand(35, 70); }
    }
    const th = this.th;
    if (Math.random() < (th.wind || 0) * wdt * 30) {
      if (th.scroll) part('dust', this.cam.x + VW + 5, rand(60, 320), -rand(400, 600), rand(-10, 10), 1.6, 1, '#8a8ab0', 0);
      else if (th.cave) part('dust', this.cam.x + rand(0, VW), rand(60, 120), rand(-5, 5), rand(10, 25), 4, 1, '#6a5a4a', 0);
      else part('dust', this.cam.x + VW + 5, rand(150, 310), -rand(60, 130), rand(-8, 8), 6, 1, th.crust, 0);
    }
    for (const d of this.deco) if (d.t === 'smokestack' && Math.abs(d.x - this.cam.x - VW / 2) < 420 && Math.random() < wdt * 8) part('smoke', d.x + rand(-3, 3), d.y - d.h - 8, rand(-30, -10), -rand(20, 45), rand(1.2, 2), rand(3, 5), '#4a4a52', -4);
    if (th.scroll) {
      const eng = this.solids.find(s => s.variant === 'engine');
      if (eng && Math.random() < wdt * 25) part('smoke', eng.x + 36 + rand(-3, 3), eng.y - 34, -rand(200, 320), -rand(20, 50), rand(1, 1.6), rand(3, 5), '#5a5a6a', -5);
    }
    // camera & feedback
    this.updateCamera(dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    if (this.hitmarker > 0) this.hitmarker -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    for (const b of this.bannerQ) b.t += dt;
    if (this.bannerQ.length && this.bannerQ[0].t > this.bannerQ[0].dur) this.bannerQ.shift();
    if (this.bannerQ.length > 3) this.bannerQ.splice(1, 1);
    Sound.listenerX = this.cam.x + VW / 2;
    // music intensity
    if (!this.bossActive && !this.survive && this.state === 'play') {
      const fighting = this.enemies.some(e => !e.dead && e.alert && Math.abs(e.cx - P.cx) < 500);
      Music.setMode(fighting || (this.stages[this.si] && this.stages[this.si].type === 'survive') ? 'combat' : 'explore');
    }
  }

  updatePickups(dt) {
    const P = this.player;
    for (let i = this.picks.length - 1; i >= 0; i--) {
      const p = this.picks[i];
      p.t += dt;
      if (p.dyn) {
        p.vy += GRAV * 0.8 * dt;
        const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
        if (p.vy > 0 && pointSolid(nx, ny)) { p.vy = 0; p.vx *= 0.5; } else { p.x = nx; p.y = ny; }
        if (pointSolid(p.x, p.y - 1)) p.vx = 0;
        p.life -= dt; p.blink = p.life < 3;
        if (p.life <= 0 || p.y > VH + 20) { this.picks.splice(i, 1); continue; }
      }
      if (!P.alive) continue;
      const dx = P.cx - p.x, dy = (P.y + P.h / 2) - (p.y - 4), d = Math.hypot(dx, dy);
      if (p.type === 'cash' && d < 70 && p.t > 0.3) { p.x += dx / d * 240 * dt; p.y += dy / d * 240 * dt; p.vy = Math.min(p.vy, 0); }
      if (p.type === 'gold' || d > 14) continue;
      if (this.collect(p)) { this.picks.splice(i, 1); if (p.id) this.taken.add(p.id); }
    }
  }
  collect(p) {
    const P = this.player;
    switch (p.type) {
      case 'cash': this.run.cash += p.amount; Sound.play('pickup'); floatText(p.x, p.y - 8, '+$' + p.amount, '#ffe070'); return true;
      case 'stash': this.run.cash += p.amount; this.stats.secrets++; Sound.play('gold'); this.banner('HIDDEN STASH', '+$' + p.amount, 1.6); return true;
      case 'health': if (!P.heal(30)) return false; Sound.play('heal'); floatText(p.x, p.y - 8, '+HEALTH', '#ff8a8a', true); return true;
      case 'tonic': if (P.de >= this.pstats.deCap - 1) return false; P.de = Math.min(this.pstats.deCap, P.de + this.pstats.deCap * 0.45); Sound.play('heal'); floatText(p.x, p.y - 8, '+DEAD EYE', '#ffd070', true); return true;
      case 'ammo': {
        let got = false;
        for (const id of P.slots) {
          if (!id) continue;
          const a = P.ammo[id], ws = this.pstats.weapons[id];
          if (a.reserve === Infinity || a.reserve >= ws.reserveMax) continue;
          const add = Math.max(1, Math.round(ws.mag * (id === P.wid ? 1.5 : 0.7) * this.diff.ammo));
          a.reserve = Math.min(ws.reserveMax, a.reserve + add); got = true;
        }
        if (!got) return false;
        Sound.play('ammo'); floatText(p.x, p.y - 8, '+AMMO', '#c8e0a0', true); return true;
      }
    }
    return false;
  }

  updateCamera(dt) {
    const P = this.player, cam = this.cam;
    const look = clamp((P.aimX - P.cx) * (P.ads ? 0.45 : 0.22), P.ads ? -170 : -80, P.ads ? 170 : 80);
    let tx = P.cx + look - VW / 2;
    const B = this.boss;
    if (this.bossActive && B && !B.dead && !B.hidden) { // frame both duelists, never losing the player
      const mid = (P.cx + B.cx) / 2 - VW / 2;
      tx = clamp(B.introT > 0 ? mid : lerp(tx, mid, 0.6), P.cx - VW + 70, P.cx - 70);
    }
    const lo = this.arena && (this.bossActive || this.minX > 0) ? this.arena.x0 : 0;
    const hi = (this.arena && (this.bossActive || this.minX > 0) ? this.arena.x1 : this.width) - VW;
    tx = hi < lo ? (lo + hi) / 2 : clamp(tx, lo, hi);
    cam.x += (tx - cam.x) * (1 - Math.exp(-7 * dt));
    cam.kx *= Math.exp(-18 * dt); cam.ky *= Math.exp(-18 * dt);
  }

  // ---- rendering ----
  render(c, t) {
    const cam = this.cam, sk = Store.settings.shake;
    const tr = Game.state === 'play' ? this.trauma * this.trauma * sk : 0;
    const shx = (Math.random() * 2 - 1) * 10 * tr + cam.kx * sk, shy = (Math.random() * 2 - 1) * 7 * tr + cam.ky * sk;
    const sx = Math.round(cam.x + shx), sy = Math.round(cam.y + shy);
    const th = this.th;
    drawBackground(c, this.bg, cam.x, t, th.scroll);
    const x0 = sx - 120, x1 = sx + VW + 120;
    c.save(); c.translate(-sx, -sy);
    this.overlay.length = 0;
    if (th.scroll) this.drawTrainGround(c, t, sx);
    for (const d of this.deco) if (d.x > x0 - 100 && d.x < x1 + 60) drawDeco(c, d, t, this.bg);
    for (let i = 0; i < this.cps.length; i++) { const cp = this.cps[i]; if (cp.x > x0 && cp.x < x1) this.drawCheckpoint(c, cp, t); }
    for (const p of this.plats) if (p.x + p.w > x0 && p.x < x1) drawPlatform(c, p, th);
    for (const s of this.solids) if (s.x + s.w > x0 && s.x < x1) this.drawSolid(c, s, t);
    for (const h of this.hazards) if (h.x > x0 && h.x < x1) this.drawHazard(c, h, t);
    for (const p of this.picks) if (p.x > x0 && p.x < x1) drawPickup(c, p, t);
    if (this.wagon) this.wagon.draw(c, t);
    for (const e of this.enemies) if (e.dead && e.cx > x0 && e.cx < x1) e.draw(c, t);
    for (const e of this.enemies) if (!e.dead && e.cx > x0 - 60 && e.cx < x1 + 60) { e.draw(c, t); this.enemyOverlay(e, t); }
    this.drawPlayer(c, t);
    for (const d of this.dyns) this.drawDynamite(c, d, t);
    for (const r of this.rocks) { px(c, Math.round(r.x) - 3, Math.round(r.y) - 3, 7, 6, '#6a5a4a'); px(c, Math.round(r.x) - 2, Math.round(r.y) - 3, 4, 2, '#8a7a6a'); }
    this.drawBullets(c);
    this.drawParticles(c, t);
    for (const tw of this.tumbles) drawTumbleweed(c, tw.x, tw.y, tw.a);
    if (th.water) this.drawWater(c, t, sx);
    if (th.fog) for (let i = 0; i < 3; i++) {
      c.globalAlpha = 0.07 + i * 0.02; c.fillStyle = '#b8c0d0';
      for (let x = sx - 40; x < sx + VW + 40; x += 8) c.fillRect(x, Math.round(250 + i * 16 + Math.sin(x / 70 + t * (0.4 + i * 0.2)) * 8), 8, 26 - i * 6);
      c.globalAlpha = 1;
    }
    for (const d of this.fg) if (d.x > x0 - 60 && d.x < x1 + 60) drawDeco(c, d, t, this.bg);
    c.restore();
    if (th.dark) this.drawLighting(c, sx, sy, t);
    c.save(); c.translate(-sx, -sy);
    for (const f of this.overlay) f(c);
    this.drawSignTips(c);
    if (this.prompt) { const p = this.prompt, txt = '[' + bindLabel('interact') + '] ' + p.text; px(c, Math.round(p.x - textW(txt) / 2 - 3), Math.round(p.y - 2), textW(txt) + 6, 9, 'rgba(20,12,8,0.8)'); pixText(c, txt, p.x, p.y, '#ffe8a0', 1, 'center'); }
    c.restore();
    this.sx = sx; this.sy = sy;
  }

  drawTrainGround(c, t, sx) {
    const sp = this.th.scroll, off = (t * sp) % 64;
    c.save(); c.translate(-off, 0);
    c.fillStyle = this.bg.pattern; c.fillRect(sx - 64, 312, VW + 192, 60);
    c.restore();
    px(c, sx, 310, VW, 3, '#2a2030');
    for (let x = Math.floor((sx - ((t * sp) % 14)) / 1); x < sx + VW + 14; x += 14) px(c, Math.round(x - ((t * sp) % 14)), 316, 8, 3, '#3a2a24');
    px(c, sx, 314, VW, 1, '#8a8a9a'); px(c, sx, 320, VW, 1, '#6a6a7a');
    for (let i = 0; i < 4; i++) { const x = sx + ((((i * 400 - t * sp * 1.4) % 1600) + 1600) % 1600) - 200; px(c, Math.round(x), 230, 3, 84, '#1a1424'); px(c, Math.round(x) - 7, 234, 17, 2, '#1a1424'); }
  }

  drawWater(c, t, sx) {
    const top = 316;
    c.globalAlpha = 0.88;
    px(c, sx, top, VW, VH - top, '#2e5466');
    c.globalAlpha = 1;
    for (let y = top + 2; y < VH; y += 6) for (let x = sx - ((t * 30 + y * 7) % 24); x < sx + VW; x += 24) px(c, Math.round(x), y, 10, 1, y < top + 8 ? '#9ac8d8' : '#4a7a8c');
    px(c, sx, top, VW, 1, '#c8e4ec');
  }

  drawCheckpoint(c, cp, t) {
    const y = this.surfaceY(cp.x);
    px(c, cp.x, y - 36, 2, 36, '#4a3a2a');
    for (let i = 0; i < 12; i++) px(c, cp.x + 2 + i, y - 35 + Math.round(Math.sin(t * 6 + i * 0.6) * (cp.active ? 1.2 : 0.3)), 1, 8, cp.active ? (i % 4 < 2 ? '#c83030' : '#a82424') : '#8a8a80');
    if (cp.active) pixText(c, '*', cp.x + 7, y - 33, '#ffe070');
  }

  drawSolid(c, s, t) {
    const dmg = s.hp != null && s.maxHp ? 1 - s.hp / s.maxHp : s.hp != null ? 1 - s.hp / (s.kind === 'crate' ? 140 : 60) : 0;
    switch (s.kind) {
      case 'ground': c.fillStyle = this.bg.pattern; c.fillRect(s.x, s.y, s.w, s.h);
        px(c, s.x, s.y, s.w, 3, this.th.crust); px(c, s.x, s.y + 3, s.w, 1, this.th.crust2);
        for (let x = s.x - (s.x % 7); x < s.x + s.w; x += 7) if (x >= s.x) px(c, x, s.y + 4, 3, 1 + ((x * 13) % 3), this.th.crust2);
        if (s.x > 0) px(c, s.x, s.y, 2, s.h, shade(this.th.rock[3], -0.3));
        if (s.x + s.w < this.width) px(c, s.x + s.w - 2, s.y, 2, s.h, shade(this.th.rock[3], -0.3));
        break;
      case 'rock': drawRockWall(c, s.x, s.y, s.w, s.h, this.bg); break;
      case 'crate': drawCrate(c, s.x, s.y, s.w, s.h, dmg); break;
      case 'barrel': drawBarrel(c, s.x, s.y, s.w, s.h, t, s.hurtT > 0); if (s.hurtT > 0) s.hurtT -= 1 / 60; break;
      case 'boards': drawBoards(c, s.x, s.y, s.w, s.h, dmg); break;
      case 'gate': if (!s.arenaWall) drawGate(c, s.x, s.y, s.w, s.h); else if (this.bossActive) { c.globalAlpha = 0.5; for (let y = 0; y < VH; y += 6) px(c, s.x + 4, y, 3, 3, '#a02020'); c.globalAlpha = 1; } break;
      case 'door': drawDoor(c, s.x, s.y, s.w, s.h); break;
      case 'wood': drawWoodWall(c, s.x, s.y, s.w, s.h); break;
      case 'cart': drawCart(c, s.x, s.y, s.w, s.h); break;
      case 'car': drawTrainCar(c, s, t); break;
      case 'hull':
        px(c, s.x, s.y, s.w, 5, '#8a6038'); px(c, s.x, s.y, s.w, 1, '#b8844a');
        px(c, s.x, s.y + 5, s.w, s.h - 5, '#e4dccc'); px(c, s.x, s.y + 9, s.w, 3, '#8a2a20'); px(c, s.x, s.y + 22, s.w, 2, '#3a2a24');
        for (let x = s.x + 20; x < s.x + s.w - 10; x += 46) { pcircle(c, x, s.y + 16, 2, '#3a4a5a'); px(c, x - 1, s.y + 15, 1, 1, '#9ac8d8'); }
        break;
      case 'pier':
        px(c, s.x, s.y, s.w, 4, '#8a6038'); px(c, s.x, s.y, s.w, 1, '#b8844a'); for (let x = s.x + 6; x < s.x + s.w; x += 9) px(c, x, s.y + 1, 1, 3, '#5a3a20');
        for (let x = s.x + 4; x < s.x + s.w - 4; x += 40) px(c, x, s.y + 4, 4, VH - s.y, '#4a2e1a');
        break;
      case 'stone':
        px(c, s.x, s.y, s.w, s.h, '#5a5660'); for (let y = s.y; y < s.y + s.h; y += 6) { px(c, s.x, y, s.w, 1, '#3a3640'); for (let x = s.x + ((y / 6) % 2) * 6; x < s.x + s.w; x += 12) px(c, x, y, 1, 6, '#3a3640'); }
        px(c, s.x, s.y, s.w, 1, '#8a8690');
        break;
      case 'bottle': px(c, s.x + 1, s.y + 3, 3, 4, '#5a9a4a'); px(c, s.x + 2, s.y, 1, 3, '#5a9a4a'); px(c, s.x + 1, s.y + 3, 1, 2, '#cfeac0'); px(c, s.x + 2, s.y, 1, 1, '#8a5a2a'); break;
    }
  }

  drawHazard(c, h, t) {
    if (h.type === 'steam') {
      px(c, h.x - 6, h.y - 2, 12, 2, '#3a3a40'); for (let i = 0; i < 12; i += 3) px(c, h.x - 6 + i, h.y - 2, 1, 2, '#1a1a1e');
      if (h.boss && this.bossActive && h.state === 'hiss') this.overlay.push(c2 => { c2.globalAlpha = 0.5 + Math.sin(t * 30) * 0.3; px(c2, h.x - 8, h.y - 90, 1, 90, '#ffffff'); px(c2, h.x + 7, h.y - 90, 1, 90, '#ffffff'); c2.globalAlpha = 1; });
    } else if (h.type === 'fire') {
      px(c, h.x, h.y - 3, h.w, 3, '#3a1a10');
      for (let i = 0; i < h.w; i += 3) { const fh = 4 + Math.abs(Math.sin(t * 9 + i)) * 8 | 0; px(c, h.x + i, h.y - 3 - fh, 2, fh, i % 2 ? '#ff8a30' : '#ffd060'); }
    } else if (h.type === 'rockfall' && h.warned) {
      this.overlay.push(c2 => { c2.globalAlpha = 0.35 + Math.sin(t * 20) * 0.2; px(c2, h.x, GY - 2, h.w, 2, '#ff4030'); c2.globalAlpha = 1; });
    }
  }

  enemyOverlay(e, t) {
    if (e.spawnT > 0 || e.decoy) return;
    const x = Math.round(e.cx), y = Math.round(e.y) - 6;
    const T = e.T;
    this.overlay.push(c => {
      if (e.alertT > 0) pixText(c, '!', x, y - 10, (t * 10 | 0) % 2 ? '#ffe040' : '#ff6030', 1, 'center');
      if (!e.boss && e.hp < e.maxHp) { px(c, x - 8, y - 2, 16, 3, '#1a0c08'); px(c, x - 7, y - 1, Math.max(0, Math.round(14 * e.hp / e.maxHp)), 1, e.armorT ? '#a8b0c0' : '#e04030'); }
      if (e.name && !e.boss) pixText(c, e.name, x, y - 9, '#ffd060', 1, 'center', '#2a1a10');
      if (e.atk === 'aim' && !e.boss) {
        if (T.laser) drawLaser(c, e.shoulder(), e.aimAng, e.atkT < 0.2, t);
        else if (T.telegraph || T.gun === 'shotgun' || T.gun === 'dynamite') { if ((t * 12 | 0) % 2) pixText(c, T.telegraph ? '!!' : '!', x, y - 10, '#ff3020', 1, 'center'); }
      }
      if (e.boss && e.tell > 0 && (t * 12 | 0) % 2) pixText(c, '!!', x, y - 12, '#ff3020', 1, 'center');
    });
  }

  drawPlayer(c, t) {
    const P = this.player;
    if (!P.alive && P.deadT > 3) return;
    const fx = P.cx, fy = P.y + P.h;
    if (P.alive) { c.fillStyle = 'rgba(40,20,10,0.3)'; c.fillRect(Math.round(fx - 7), Math.round(fy), 14, 1); }
    const state = !P.alive ? 'dead' : P.rollT > 0 ? 'roll' : P.crouch ? 'crouch' : !P.onGround ? 'jump' : Math.abs(P.vx) > 20 ? 'run' : 'idle';
    let aim = P.aim;
    if (P.reloadT > 0) aim = P.f > 0 ? 0.95 : Math.PI - 0.95;
    else if (P.swapT > 0) aim = P.f > 0 ? 1.2 : Math.PI - 1.2;
    if (P.iframes > 0 && P.rollT <= 0 && (t * 20 | 0) % 2) c.globalAlpha = 0.6;
    const ws = P.ws;
    const skin = P.wid === 'devil' ? DEVIL_SKIN : SKINS[Store.save.skin];
    drawCharacter(c, LOOKS.player, fx, fy, {
      f: P.f, state, phase: state === 'roll' ? 1 - P.rollT / 0.32 : P.phase, aim, gun: P.wid === 'gatling' ? 'gatlingP' : P.wid, skin, flash: P.flashT > 0, t, deadT: P.deadT,
      pull: ws.charge ? P.drawT / ws.charge : 0, nocked: P.ammo[P.wid].mag > 0 && P.reloadT <= 0, spin: P.spin,
      lever: P.leverT > 0.1 && P.leverT < 0.3, recoil: P.recoil > 0 ? 1 : 0, recoil2: P.recoil2 > 0 ? 1 : 0, dual: !!ws.dual, aim2: aim + 0.04,
    });
    c.globalAlpha = 1;
    if (skin.glint && P.alive && Math.random() < 0.05) { const sh = P.shoulder(); part('spark', sh.x + Math.cos(P.aim) * 10, sh.y + Math.sin(P.aim) * 10, 0, -10, 0.3, 1, '#fff6c0', 0); }
    // ADS aim line
    if (ws.grav && P.alive && P.rollT <= 0 && P.reloadT <= 0) { // arc preview for bow and launcher
      const sh = P.shoulder(), draw = ws.charge ? P.drawT / ws.charge : 1, sp = ws.charge ? lerp(ws.speed, ws.speedMax, draw) : ws.speed;
      let x = sh.x, y = sh.y, vx = Math.cos(P.aim) * sp, vy = Math.sin(P.aim) * sp;
      c.globalAlpha = ws.charge && P.drawT <= 0 ? 0.15 : 0.45;
      for (let i = 0; i < 26; i++) {
        for (let k = 0; k < 3; k++) { vy += ws.grav / 60; x += vx / 60; y += vy / 60; }
        if (i > 1) px(c, Math.round(x), Math.round(y), 1, 1, ws.explosive ? '#ff9a50' : '#fff0c0');
        if (pointSolid(x, y)) break;
      }
      c.globalAlpha = 1;
    } else if (P.ads && P.alive && P.rollT <= 0) {
      const sh = P.shoulder();
      c.globalAlpha = 0.35;
      for (let i = 24; i < 160; i += 6) px(c, Math.round(sh.x + Math.cos(P.aim) * i), Math.round(sh.y + Math.sin(P.aim) * i), 1, 1, '#fff0c0');
      c.globalAlpha = 1;
    }
  }

  drawDynamite(c, d, t) {
    const x = Math.round(d.x), y = Math.round(d.y);
    px(c, x - 1, y - 3, 3, 5, '#c8302a'); px(c, x, y - 4, 1, 1, (t * 20 | 0) % 2 ? '#ffe060' : '#ff8030');
    const gx = d.landed ? d.x : d.tx, gy = d.landed ? d.y : d.ty;
    this.overlay.push(c2 => {
      const pulse = (t * (d.fuse < 0.6 ? 16 : 6) | 0) % 2;
      c2.strokeStyle = pulse ? '#ff3020' : '#ffb040'; c2.globalAlpha = 0.7; c2.lineWidth = 1;
      c2.beginPath(); c2.ellipse(Math.round(gx) + 0.5, Math.round(gy) + 0.5, 50, 10, 0, 0, TAU); c2.stroke(); c2.globalAlpha = 1;
    });
  }

  drawBullets(c) {
    for (const b of this.bullets.list) {
      const sp = Math.hypot(b.vx, b.vy), k = Math.min(b.team === 'p' ? 22 : 10, b.dist) / sp;
      const tx = b.x - b.vx * k, ty = b.y - b.vy * k;
      if (b.arrow || b.knife) {
        const a = Math.atan2(b.vy, b.vx), L2 = b.arrow ? 9 : 5, ca = Math.cos(a), sa = Math.sin(a);
        for (let i = 0; i < L2; i++) px(c, Math.round(b.x - ca * i), Math.round(b.y - sa * i), 1, 1, i < 2 ? '#d8d8e0' : b.arrow ? (i > L2 - 3 ? '#d83a2e' : '#a8784a') : '#5a3a20');
        continue;
      }
      if (b.explosive) {
        px(c, Math.round(b.x) - 2, Math.round(b.y) - 1, 4, 3, '#c8302a'); px(c, Math.round(b.x), Math.round(b.y) - 2, 1, 1, (b.age * 30 | 0) % 2 ? '#ffe060' : '#ff8030');
        if (Math.random() < 0.5) part('spark', b.x, b.y - 2, rand(-20, 20), rand(-40, 0), 0.15, 1, '#ffd060', 0);
        continue;
      }
      if (b.team === 'p') {
        c.strokeStyle = b.wpn === 'devil' ? 'rgba(255,90,40,0.8)' : 'rgba(255,190,90,0.55)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(tx, ty); c.lineTo(b.x, b.y); c.stroke();
        px(c, Math.round(b.x), Math.round(b.y), 1, 1, '#fffbe0');
      } else {
        c.strokeStyle = 'rgba(255,110,60,0.6)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(tx, ty); c.lineTo(b.x, b.y); c.stroke();
        const s = b.big ? 3 : 2;
        px(c, Math.round(b.x - s / 2), Math.round(b.y - s / 2), s, s, '#ff4a2a'); px(c, Math.round(b.x), Math.round(b.y), 1, 1, '#ffe0c0');
      }
    }
  }

  drawParticles(c) {
    for (const p of this.parts.list) {
      const a = p.life / p.max, x = Math.round(p.x), y = Math.round(p.y);
      switch (p.type) {
        case 'smoke': c.globalAlpha = a * 0.45; pcircle(c, x, y, Math.round(p.size), p.color); c.globalAlpha = 1; break;
        case 'fire': pcircle(c, x, y, Math.max(1, Math.round(p.size * a)), p.color); break;
        case 'flash': { const s = p.size; px(c, x - s, y, s * 2 + 1, 1, '#ffe090'); px(c, x, y - s + 1, 1, s * 2 - 1, '#ffe090'); px(c, x - 1, y - 1, 3, 3, p.color); break; }
        case 'spark': c.strokeStyle = p.color; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); c.stroke(); break;
        case 'stuck': { const an = Math.atan2(p.vy, p.vx), ca = Math.cos(an), sa = Math.sin(an); c.globalAlpha = Math.min(1, a * 3); for (let i = 1; i < 7; i++) px(c, Math.round(p.x - ca * i), Math.round(p.y - sa * i), 1, 1, i > 4 ? '#d83a2e' : '#a8784a'); c.globalAlpha = 1; break; }
        case 'ring': c.strokeStyle = p.color; c.globalAlpha = a; c.lineWidth = 2; c.beginPath(); c.arc(x, y, p.size * (1 - a) * 1.4 + 4, 0, TAU); c.stroke(); c.globalAlpha = 1; break;
        default: if (p.type === 'dust') c.globalAlpha = Math.min(1, a * 1.5); px(c, x, y, p.size, p.size, p.color); c.globalAlpha = 1;
      }
    }
  }

  drawLighting(c, sx, sy, t) {
    const [dc, dx] = Game.darkLayer();
    const dark = clamp(this.th.dark + this.darkBoost, 0, 0.95);
    dx.globalCompositeOperation = 'source-over';
    dx.clearRect(0, 0, VW, VH);
    dx.fillStyle = this.th.cave ? `rgba(8,4,2,${dark})` : `rgba(6,8,24,${dark})`;
    dx.fillRect(0, 0, VW, VH);
    dx.globalCompositeOperation = 'destination-out';
    const L = (x, y, r, i) => {
      x -= sx; y -= sy;
      if (x < -r || x > VW + r) return;
      const g = dx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${i})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      dx.fillStyle = g; dx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const P = this.player;
    L(P.cx, P.y + 12, 120, 0.85);
    const fl = 0.9 + Math.sin(t * 13) * 0.05;
    for (const d of this.deco) {
      if (d.t === 'lantern') L(d.x, (d.y || GY) - (d.post ? 32 : -2), 115 * fl, 0.9);
      else if (d.t === 'torch') L(d.x, (d.y || GY) - 28, 80 * fl, 0.9);
      else if (d.t === 'campfire') L(d.x, (d.y || GY) - 6, 100 * fl, 0.95);
      else if (d.t === 'crystal') L(d.x, (d.y || GY) - 4, 26, 0.5);
    }
    for (const s of this.solids) if (s.kind === 'car' && (s.variant === 'pass' || s.variant === 'engine')) L(s.x + s.w / 2, s.y + 14, s.w * 0.6, 0.6);
    for (const h of this.hazards) if (h.type === 'fire') L(h.x + h.w / 2, h.y - 8, 70 * fl, 0.9);
    for (const f of this.flashes) L(f.x, f.y, f.r, f.life / f.max);
    for (const b of this.bullets.list) if (b.team === 'e') L(b.x, b.y, 16, 0.8);
    for (const d of this.dyns) L(d.x, d.y, 24, 0.8);
    for (const e of this.enemies) if (!e.dead && !e.hidden) L(e.cx, e.y + 12, e.boss ? 60 : 38, e.boss ? 0.65 : 0.45); // keep threats readable
    if (this.wagon) L(this.wagon.cx, this.wagon.y + 10, 70, 0.6);
    for (const p of this.picks) if (p.type === 'gold') L(p.x, p.y - 6, 22, 0.7);
    c.drawImage(dc, 0, 0);
  }

  drawSignTips(c) {
    const P = this.player;
    for (const d of this.deco) {
      if (d.t !== 'sign' || !d.tip || Math.abs(d.x - P.cx) > 60) continue;
      const lines = wrapText(fillTokens(d.tip), 30);
      const w = Math.max(...lines.map(l => textW(l))) + 10, h = lines.length * 7 + 7;
      const bx = Math.round(clamp(d.x - w / 2, this.cam.x + 4, this.cam.x + VW - w - 4)), by = GY - 40 - h;
      px(c, bx, by, w, h, '#ecdcb4'); px(c, bx, by, w, 1, '#fff2d0'); px(c, bx, by + h - 1, w, 1, '#8a6a42'); px(c, bx - 1, by + 1, 1, h - 2, '#8a6a42'); px(c, bx + w, by + 1, 1, h - 2, '#8a6a42');
      lines.forEach((l, i) => pixText(c, l, bx + w / 2, by + 4 + i * 7, '#3a2414', 1, 'center'));
    }
  }
}

// ======================================================================
const Game = {
  state: 'menu', w: null, run: null, mission: null, t: 0, bgs: {}, diffKey: 'normal', resultShown: false,

  init() {
    this.canvas = document.getElementById('screen');
    this.ctx = this.canvas.getContext('2d');
    [this.buf, this.bx] = makeCanvas(VW, VH);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('fullscreenchange', () => { Store.settings.fullscreen = !!document.fullscreenElement; this.resize(); });
    this.menuScene = { tw: { x: 140, a: 0 }, t: 0 };
  },
  bgFor(theme) { return this.bgs[theme] || (this.bgs[theme] = buildBackground(theme)); },
  darkLayer() { if (!this._dark) this._dark = makeCanvas(VW, VH); return this._dark; },
  resize() {
    const dpr = window.devicePixelRatio || 1, W = Math.floor(innerWidth * dpr), H = Math.floor(innerHeight * dpr);
    this.canvas.width = W; this.canvas.height = H;
    let s = Math.min(W / VW, H / VH);
    if (Store.settings.scaling === 'integer') s = Math.max(1, Math.floor(s));
    const ox = Math.round((W - VW * s) / 2), oy = Math.round((H - VH * s) / 2);
    this.view = { ox, oy, s, W, H };
    Input.view = { ox, oy, s };
    this.ctx.imageSmoothingEnabled = false;
  },

  startMission(id) {
    Sound.init();
    const m = MISSION_BY_ID[id];
    this.mission = m; this.diffKey = Store.save.difficulty;
    this.run = { stats: { kills: 0, headshots: 0, shots: 0, hits: 0, dmgTaken: 0, deaths: 0, secrets: 0 }, cash: 0, time: 0, snap: null, hitShots: new Set(), shotId: 0, rewarded: false, result: null };
    this.build(null);
    this.enterPlay();
    const th = THEMES[this.w.level.theme];
    Sound.setAmbience(th.wind ? 0.12 + th.wind * 0.5 : 0.08, th.windF || 500);
    Music.clack = !!th.scroll;
    if (th.scroll) Sound.play('whistle');
    this.w.banner(m.name.toUpperCase(), m.goals[0], 3);
  },
  build(snap) {
    this.w = new World(this.mission, this.diffKey, snap, this.run);
    this.resultShown = false;
  },
  enterPlay() {
    this.state = 'play'; Input.clearAll(); UI.hideAll(); UI.setGameCursor(true); Sound.setPaused(false);
    Music.setMode('explore');
  },
  respawn() {
    if (!this.run) return;
    this.build(this.run.snap);
    this.enterPlay();
    this.w.banner('BACK IN THE SADDLE', this.w.stageText(), 1.8);
  },
  restartMission() { this.startMission(this.mission.id); },
  pause() {
    if (this.state !== 'play' || !this.w || this.w.state !== 'play') return;
    this.state = 'pause'; Sound.setPaused(true); Input.clearAll(); UI.setGameCursor(false);
    if (document.pointerLockElement) document.exitPointerLock();
    UI.show('pause');
  },
  resume() {
    if (this.state !== 'pause') return;
    this.state = 'play'; Sound.setPaused(false); Input.clearAll(); UI.hideAll(); UI.setGameCursor(true);
  },
  quitToMenu() {
    if (this.w) { this.w.player.setDE(false); }
    Sound.setDeadEye(false); Sound.setPaused(false); Sound.setAmbience(0); Music.clack = false;
    this.w = null; G = null; this.run = null; this.state = 'menu';
    UI.setGameCursor(false);
    if (document.pointerLockElement) document.exitPointerLock();
    Music.setMode('menu');
  },

  grantRewards() {
    const run = this.run;
    if (run.rewarded) return run.result;
    run.rewarded = true;
    const m = this.mission, sv = Store.save, D = DIFFS[this.diffKey];
    const first = !sv.completed[m.id], reps = sv.replays[m.id] || 0;
    const factor = first ? 1 : replayFactor(reps);
    const s = run.stats, acc = s.shots ? s.hits / s.shots : 0, time = run.time;
    const lines = [];
    const base = Math.round(m.reward * D.reward * factor);
    lines.push([first ? 'Bounty reward' : `Replay bounty (${Math.round(factor * 100)}%)`, base]);
    lines.push(['Cash collected', Math.round(run.cash * (first ? 1 : Math.max(0.5, factor)))]);
    if (s.deaths === 0) lines.push(['Untouchable (no deaths)', Math.round(base * 0.15 + 25 * factor)]);
    if (acc >= 0.6 && s.shots >= 10) lines.push(['Dead aim (60%+ accuracy)', Math.round(60 * factor)]);
    if (s.headshots) lines.push([`Headshots x${s.headshots}`, Math.round(Math.min(150, s.headshots * 4) * factor)]);
    if (time <= m.par) lines.push([`Fast work (under ${fmtTime(m.par)})`, Math.round(base * 0.2)]);
    const total = lines.reduce((a, l) => a + l[1], 0);
    sv.cash += total;
    sv.completed[m.id] = true;
    if (!first) sv.replays[m.id] = reps + 1;
    for (const u of (m.unlocks || [])) if (!sv.unlocked.includes(u)) sv.unlocked.push(u);
    if (!sv.bestTimes[m.id] || time < sv.bestTimes[m.id]) sv.bestTimes[m.id] = time;
    sv.stats.kills += s.kills; sv.stats.headshots += s.headshots;
    let legendary = false;
    if (m.id === 'm6' && !sv.finalBeat) {
      sv.finalBeat = true; legendary = true;
      if (!sv.owned.includes('devil')) sv.owned.push('devil');
      const free = sv.loadout.indexOf(null); if (free >= 0) sv.loadout[free] = 'devil';
    }
    Store.commit();
    run.result = { lines, total, first, acc, time, stats: Object.assign({}, s), legendary, unlocks: (first ? m.unlocks || [] : []), mission: m };
    return run.result;
  },

  update(dt) {
    const w = this.w;
    if (!w) return;
    if (Input.hit('pause') && this.state === 'play') { this.pause(); return; }
    w.update(dt);
    if (w.state === 'complete' && w.endT > 2.2 && !this.resultShown) {
      this.resultShown = true; this.state = 'complete'; UI.setGameCursor(false);
      if (document.pointerLockElement) document.exitPointerLock();
      UI.showResults(this.grantRewards());
      Music.setMode('menu');
    }
    if (w.state === 'dead' && w.endT > 2 && !this.resultShown) {
      this.resultShown = true; this.state = 'dead'; UI.setGameCursor(false); Sound.play('failed');
      if (document.pointerLockElement) document.exitPointerLock();
      UI.show('died');
    }
    if (w.state === 'failed' && w.endT > 1.2 && !this.resultShown) {
      this.resultShown = true; this.state = 'failed'; UI.setGameCursor(false); Sound.play('failed');
      if (document.pointerLockElement) document.exitPointerLock();
      UI.show('failed', w.failReason);
    }
  },

  renderMenu(c, t) {
    const bg = this.bgFor('desert');
    drawBackground(c, bg, t * 6, t, 0);
    c.save(); c.scale(2, 2);
    const gy = 150;
    c.fillStyle = bg.pattern; c.fillRect(0, gy, 320, 40);
    px(c, 0, gy, 320, 2, THEMES.desert.crust); px(c, 0, gy + 2, 320, 1, THEMES.desert.crust2);
    drawSaguaro(c, 222, gy, 26, 3); drawBarrelCactus(c, 22, gy, 4); drawBarrelCactus(c, 296, gy, 5);
    drawDeco(c, { t: "skull", x: 196, y: gy }, t); drawDeco(c, { t: 'bush', x: 60, y: gy }, t);
    c.fillStyle = 'rgba(60,30,20,0.25)'; c.fillRect(158, gy, 26, 1); c.fillRect(270, gy, 26, 1);
    drawCharacter(c, LOOKS.player, 170, gy, { f: 1, state: 'idle', t, gun: 'revolver', aim: 1.25, skin: SKINS[Store.save.skin] });
    drawCharacter(c, LOOKS.devil, 282, gy, { f: -1, state: 'idle', t: t + 0.4, gun: 'devil', aim: Math.PI - 1.25, skin: DEVIL_SKIN });
    const tw = this.menuScene.tw;
    tw.x += 0.35; tw.a += 0.06; if (tw.x > 340) tw.x = -20;
    drawTumbleweed(c, tw.x, gy - 5 - Math.abs(Math.sin(t * 4)) * 8, tw.a);
    drawBarrelCactus(c, 30, 180, 9); drawSaguaro(c, 300, 182, 30, 1);
    c.restore();
    for (let i = 0; i < 30; i++) { const x = ((i * 97 - t * (40 + i % 5 * 15)) % (VW + 40) + VW + 40) % (VW + 40) - 20, y = 200 + (i * 37) % 150; px(c, Math.round(x), Math.round(y + Math.sin(t + i) * 3), 1, 1, i % 3 ? '#f6dca8' : '#e8b880'); }
  },

  render(dt) {
    this.t += dt;
    const c = this.bx, w = this.w;
    if (w) w.render(c, this.t); else this.renderMenu(c, this.t);
    const ctx = this.ctx, v = this.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c0806'; ctx.fillRect(0, 0, v.W, v.H);
    ctx.imageSmoothingEnabled = false;
    const de = w && (w.player.deActive || (w.showdown && w.showdown.t > 1.8));
    if (de) ctx.filter = 'sepia(0.8) saturate(1.5) contrast(1.1) brightness(1.02)';
    ctx.drawImage(this.buf, 0, 0, VW, VH, v.ox, v.oy, VW * v.s, VH * v.s);
    ctx.filter = 'none';
    if (Store.settings.crt) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = v.oy; y < v.oy + VH * v.s; y += Math.max(2, Math.round(v.s))) ctx.fillRect(v.ox, y, VW * v.s, 1); }
    if (w) this.drawHUD(ctx, w, de);
  },

  // ---------------- HUD (drawn at display resolution for crisp text) ----------------
  drawHUD(ctx, w, de) {
    const v = this.view, S = v.s, ox = v.ox, oy = v.oy, P = w.player, t = this.t;
    const X = gx => ox + gx * S, Y = gy => oy + gy * S;
    const font = (sz, fam) => `${Math.round(sz * S)}px ${fam === 'title' ? "Rye, Georgia, serif" : "VT323, 'Courier New', monospace"}`;
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, VW * S, VH * S); ctx.clip();
    // vignettes
    if (de) {
      const g = ctx.createRadialGradient(X(VW / 2), Y(VH / 2), VH * S * 0.25, X(VW / 2), Y(VH / 2), VW * S * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,16,0,0.65)');
      ctx.fillStyle = g; ctx.fillRect(ox, oy, VW * S, VH * S);
    }
    const low = P.alive && P.hp < P.maxHp * 0.3;
    const hf = Math.max(w.hurtFlash, low ? 0.15 + Math.sin(t * 6) * 0.1 : 0);
    if (hf > 0) {
      const g = ctx.createRadialGradient(X(VW / 2), Y(VH / 2), VH * S * 0.3, X(VW / 2), Y(VH / 2), VW * S * 0.6);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(160,10,0,${Math.min(0.6, hf)})`);
      ctx.fillStyle = g; ctx.fillRect(ox, oy, VW * S, VH * S);
    }
    ctx.textBaseline = 'top';
    const panel = (x, y, wd, h) => { ctx.fillStyle = 'rgba(28,16,10,0.72)'; ctx.fillRect(X(x), Y(y), wd * S, h * S); ctx.strokeStyle = 'rgba(232,190,120,0.35)'; ctx.lineWidth = Math.max(1, S * 0.5); ctx.strokeRect(X(x) + 0.5, Y(y) + 0.5, wd * S - 1, h * S - 1); };
    const bar = (x, y, wd, h, f, col, back) => { ctx.fillStyle = back || '#2a140c'; ctx.fillRect(X(x), Y(y), wd * S, h * S); ctx.fillStyle = col; ctx.fillRect(X(x), Y(y), wd * S * clamp(f, 0, 1), h * S); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(X(x), Y(y), wd * S * clamp(f, 0, 1), Math.max(1, S * h * 0.3)); };
    const text = (s, x, y, sz, col, align, fam) => { ctx.font = font(sz, fam); ctx.textAlign = align || 'left'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(s, X(x) + S * 0.6, Y(y) + S * 0.6); ctx.fillStyle = col; ctx.fillText(s, X(x), Y(y)); };

    // health + dead eye
    panel(6, 6, 118, 30);
    text('HEALTH', 10, 7, 7, '#e8d0a0');
    text(Math.ceil(Math.max(0, P.hp)) + '/' + P.maxHp, 120, 7, 7, '#e8d0a0', 'right');
    bar(10, 14, 110, 6, P.hp / P.maxHp, low && (t * 4 | 0) % 2 ? '#ff5a3a' : '#c8302a');
    const deF = P.de / w.pstats.deCap;
    text('DEAD EYE [' + bindLabel('deadeye') + ']', 10, 21, 6, P.deActive ? '#ffe070' : '#d8b878');
    bar(10, 28, 110, 4, deF, P.deActive ? ((t * 8 | 0) % 2 ? '#ffe070' : '#ffb030') : deF >= 0.2 ? '#e0a830' : '#7a5a2a');
    ctx.fillStyle = '#ffffff55'; ctx.fillRect(X(10 + 110 * 0.2), Y(28), Math.max(1, S * 0.5), 4 * S);

    // cash
    panel(VW - 96, 6, 90, 20);
    text(fmtMoney(Store.save.cash), VW - 10, 6, 9, '#ffe070', 'right');
    text('+' + fmtMoney(this.run.cash) + ' this job', VW - 10, 16, 6, '#c8b088', 'right');

    // objective
    const obj = w.stageText();
    ctx.font = font(7.5);
    const ow = Math.min(360, ctx.measureText(obj).width / S + 20);
    panel(VW / 2 - ow / 2, 6, ow, w.timeLeft != null ? 22 : 13);
    text(obj, VW / 2, 7, 7.5, '#f4e4c0', 'center');
    if (w.timeLeft != null) text('TIME ' + fmtTime(w.timeLeft), VW / 2, 15, 7, w.timeLeft < 20 && (t * 4 | 0) % 2 ? '#ff6040' : '#ffd070', 'center');
    if (w.wagon && !w.wagon.dead) {
      const y0 = w.timeLeft != null ? 30 : 21;
      text('WAGON', VW / 2 - 50, y0, 6, '#e8d0a0'); bar(VW / 2 - 28, y0 + 1.5, 80, 4, w.wagon.hp / w.wagon.maxHp, w.wagon.flash > 0 ? '#ffffff' : '#d89040');
    }

    // weapon panel
    const ws = P.ws, a = P.ammo[P.wid];
    panel(VW - 140, VH - 46, 134, 40);
    text(ws.short, VW - 136, VH - 45, 8, P.wid === 'devil' ? '#ff7a50' : '#f4e4c0');
    const mag = ws.mag;
    const bw = Math.min(5, 92 / mag);
    if (mag > 20) bar(VW - 136, VH - 33, 92, 5, a.mag / mag, '#e8c050');
    else for (let i = 0; i < mag; i++) {
      const filled = i < a.mag;
      ctx.fillStyle = filled ? '#e8c050' : 'rgba(120,90,60,0.5)';
      ctx.fillRect(X(VW - 136 + i * bw), Y(VH - 34), Math.max(1, (bw - 1.5) * S), 7 * S);
      if (filled) { ctx.fillStyle = '#a87030'; ctx.fillRect(X(VW - 136 + i * bw), Y(VH - 29), Math.max(1, (bw - 1.5) * S), 2 * S); }
    }
    text(a.reserve === Infinity ? '∞' : String(a.reserve), VW - 10, VH - 37, 9, a.reserve === 0 && a.mag === 0 ? '#ff6040' : '#e8d0a0', 'right');
    if (P.reloadT > 0) { bar(VW - 136, VH - 25, 126, 2, 1 - P.reloadT / P.reloadMax, '#e8d0a0'); text(ws.charge ? 'NOCKING' : 'RELOADING', VW - 136, VH - 23, 6, '#e8d0a0'); }
    else if (ws.charge && P.drawT > 0) { const f = P.drawT / ws.charge; bar(VW - 136, VH - 25, 126, 2, f, f >= 1 ? '#ffe070' : '#c8a060'); text(f >= 1 ? 'FULL DRAW' : 'DRAWING', VW - 136, VH - 23, 6, f >= 1 ? '#ffe070' : '#e8d0a0'); }
    else if (ws.spin && P.spin > 0) { bar(VW - 136, VH - 25, 126, 2, P.spin, P.spin >= 1 ? '#ff9a50' : '#c8a060'); text(P.spin >= 1 ? 'FIRING' : 'CRANKING', VW - 136, VH - 23, 6, '#e8d0a0'); }
    else if (a.mag === 0) text(a.reserve > 0 ? 'RELOAD [' + bindLabel('reload') + ']' : 'NO AMMO', VW - 136, VH - 23, 6, (t * 4 | 0) % 2 ? '#ff8060' : '#e8d0a0');
    for (let i = 0; i < 4; i++) {
      const id = P.slots[i], cur = i === P.cur;
      const x = VW - 136 + i * 32;
      ctx.fillStyle = cur ? 'rgba(232,192,80,0.35)' : 'rgba(0,0,0,0.25)'; ctx.fillRect(X(x), Y(VH - 15), 30 * S, 8 * S);
      text((i + 1) + ' ' + (id ? WEAPONS[id].short.slice(0, 5) : '--'), x + 1.5, VH - 15, 6, cur ? '#ffe070' : id ? '#c8b088' : '#6a5a4a');
    }

    // boss bar
    const b = w.boss;
    if (b && w.bossActive && !b.dead) {
      const bwid = 300;
      panel(VW / 2 - bwid / 2 - 6, VH - 30, bwid + 12, 24);
      text(b.B.name, VW / 2, VH - 30, 8, '#f4d4a0', 'center', 'title');
      bar(VW / 2 - bwid / 2, VH - 18, bwid, 6, b.hp / b.maxHp, b.introT > 0 ? '#8a7a6a' : '#b81818');
      const marks = b.id === 'devil' ? [0.7, 0.4, 0.15] : [0.5];
      for (const m of marks) { ctx.fillStyle = '#f4e4c0'; ctx.fillRect(X(VW / 2 - bwid / 2 + bwid * m), Y(VH - 19), Math.max(1, S * 0.6), 8 * S); }
    }

    // damage numbers
    for (const n of w.nums.list) {
      const a2 = Math.min(1, n.life / n.max * 2);
      ctx.globalAlpha = a2;
      text(n.text, (n.x - w.sx), (n.y - w.sy), n.big ? 8 : 7, n.color, 'center');
      ctx.globalAlpha = 1;
    }

    // banners
    const bn = w.bannerQ[0];
    if (bn) {
      const fa = Math.min(1, bn.t * 4, (bn.dur - bn.t) * 3);
      ctx.globalAlpha = clamp(fa, 0, 1);
      ctx.fillStyle = 'rgba(20,10,6,0.55)'; ctx.fillRect(ox, Y(VH * 0.3), VW * S, 40 * S);
      text(bn.text, VW / 2, VH * 0.3 + 5, 17, '#f8dca0', 'center', 'title');
      if (bn.sub) text(bn.sub, VW / 2, VH * 0.3 + 26, 8, '#e8c890', 'center');
      ctx.globalAlpha = 1;
    }
    if (w.showdown && w.showdown.t < 1.8) {
      const n = Math.max(1, 3 - Math.floor(w.showdown.t / 0.6));
      text(String(n), VW / 2, VH * 0.55, 26, '#ffe070', 'center', 'title');
    }

    // crosshair
    if (this.state === 'play' && P.alive) {
      let cx, cy;
      if (Input.usingPad) { cx = P.aimX - w.cam.x; cy = P.aimY - w.cam.y; } else { cx = Input.mouse.x; cy = Input.mouse.y; }
      const spread = (ws.spread + (P.heat || 0)) * (P.ads ? 0.45 : 1) * (P.deActive ? 0.3 : 1);
      const dist = Math.hypot(P.aimX - P.cx, P.aimY - P.y);
      const gap = 2.5 + Math.min(24, spread * dist);
      const col = w.hitmarker > 0 ? (w.hitHead ? '#ff4030' : '#ffffff') : P.deActive ? '#ffd040' : '#f8f0d8';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = S * 1.4;
      const tick = (dx, dy, l) => { ctx.beginPath(); ctx.moveTo(X(cx + dx * gap), Y(cy + dy * gap)); ctx.lineTo(X(cx + dx * (gap + l)), Y(cy + dy * (gap + l))); ctx.stroke(); };
      for (const pass of [0, 1]) {
        if (pass) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, S * 0.6); }
        tick(1, 0, 4); tick(-1, 0, 4); tick(0, 1, 4); tick(0, -1, 4);
      }
      ctx.fillStyle = col; ctx.fillRect(X(cx) - S * 0.5, Y(cy) - S * 0.5, S, S);
      if (w.hitmarker > 0) {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, S * 0.7); const r1 = 3, r2 = 7;
        for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.beginPath(); ctx.moveTo(X(cx + dx * r1), Y(cy + dy * r1)); ctx.lineTo(X(cx + dx * r2), Y(cy + dy * r2)); ctx.stroke(); }
      }
      if (P.reloadT > 0) { ctx.strokeStyle = '#e8d0a0'; ctx.lineWidth = Math.max(1, S * 0.8); ctx.beginPath(); ctx.arc(X(cx), Y(cy), 10 * S, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - P.reloadT / P.reloadMax)); ctx.stroke(); }
    }
    ctx.restore();
  },
};

'use strict';
// World entities: physics, bullets, particles, player, enemies, bosses, explosives, wagon, hazards.
let G = null; // active mission world (built by Game)

const COVER_KINDS = new Set(['crate', 'cart', 'barrel']);

// ---------------- physics ----------------
function moveX(e, dx) {
  if (!dx) return;
  e.x += dx;
  for (const s of G.solids) {
    if (!s.move || !overlap(e, s)) continue;
    if (dx > 0) { e.x = s.x - e.w; e.hitWall = 1; } else { e.x = s.x + s.w; e.hitWall = -1; }
    e.hitSolid = s;
  }
}
function moveY(e, dy) {
  const prevBottom = e.y + e.h;
  e.y += dy; e.onGround = false;
  for (const s of G.solids) {
    if (!s.move || !overlap(e, s)) continue;
    if (dy > 0) { e.y = s.y - e.h; e.onGround = true; e.ground = s; } else e.y = s.y + s.h;
    e.vy = 0;
  }
  if (dy >= 0 && !e.onGround && !(e.dropT > 0)) {
    for (const p of G.plats) {
      if (e.x + e.w > p.x && e.x < p.x + p.w && prevBottom <= p.y + 0.5 && e.y + e.h >= p.y) {
        e.y = p.y - e.h; e.vy = 0; e.onGround = true; e.ground = p;
      }
    }
  }
}
function physics(e, dt, grav) {
  e.vy = Math.min(e.vy + (grav == null ? GRAV : grav) * dt, 900);
  e.hitWall = 0; e.hitSolid = null;
  const was = e.onGround;
  moveX(e, e.vx * dt);
  moveY(e, e.vy * dt);
  e.landed = !was && e.onGround;
  if (e.dropT > 0) e.dropT -= dt;
  if (e.x < G.minX) { e.x = G.minX; e.vx = 0; e.hitWall = -1; e.hitEdge = true; }
  else if (e.x + e.w > G.maxX) { e.x = G.maxX - e.w; e.vx = 0; e.hitWall = 1; e.hitEdge = true; }
  else e.hitEdge = false;
}
function setHeight(e, h) {
  if (e.h === h) return true;
  if (h > e.h) { // standing up: need headroom
    const test = { x: e.x, y: e.y - (h - e.h), w: e.w, h: h - e.h };
    for (const s of G.solids) if (s.move && overlap(test, s)) return false;
  }
  e.y += e.h - h; e.h = h;
  return true;
}
function pointSolid(x, y) {
  for (const s of G.solids) if (s.move && x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return s;
  for (const p of G.plats) if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + 4) return p;
  return null;
}
function groundAhead(e, dir, depth) {
  const fx = dir > 0 ? e.x + e.w + 3 : e.x - 3, fy = e.y + e.h;
  for (let d = 2; d < (depth || 40); d += 6) if (pointSolid(fx, fy + d)) return true;
  return false;
}
// Line of sight; cover-type solids right next to the shooter are ignored (shooting over own cover).
function losClear(x0, y0, x1, y1) {
  for (const s of G.solids) {
    if (s.bullet === false) continue;
    if (COVER_KINDS.has(s.kind) && x0 > s.x - 28 && x0 < s.x + s.w + 28 && y0 < s.y + 6) continue;
    if (segRect(x0, y0, x1, y1, s) >= 0) return false;
  }
  return true;
}
const cxOf = e => e.x + e.w / 2;

// ---------------- particles ----------------
function part(type, x, y, vx, vy, life, size, color, grav) {
  const p = spawnFrom(G.parts);
  p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.color = color; p.grav = grav || 0; p.bounce = 0;
  return p;
}
function dust(x, y, n, col) { for (let i = 0; i < n; i++) part('dust', x + rand(-4, 4), y, rand(-40, 40), rand(-40, -5), rand(0.3, 0.6), randi(1, 2), col || '#d8b88a', 80); }
function smoke(x, y, n, col) { for (let i = 0; i < n; i++) part('smoke', x + rand(-3, 3), y + rand(-3, 3), rand(-15, 15), rand(-30, -8), rand(0.5, 1.1), rand(2, 4), col || '#c8c0b0', -10); }
function sparks(x, y, n, ang, col) {
  for (let i = 0; i < n; i++) { const a = ang + rand(-0.9, 0.9), s = rand(60, 220); part('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.1, 0.3), 1, col || '#ffd070', 400); }
}
function puffs(x, y, n, col, ang) {
  for (let i = 0; i < n; i++) { const a = (ang == null ? rand(0, TAU) : ang + rand(-0.8, 0.8)), s = rand(30, 120); part('dust', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.2, 0.5), randi(1, 2), col, 300); }
}
function shell(x, y, f, col) { const p = part('shell', x, y, -f * rand(40, 90), rand(-160, -90), 2.2, 1, col || '#e0b040', 900); p.bounce = 1; }
function floatText(x, y, text, color, big) {
  if (!Store.settings.dmgNumbers && !big) return;
  const n = spawnFrom(G.nums);
  n.x = x + rand(-4, 4); n.y = y; n.vy = -40; n.life = big ? 1.1 : 0.7; n.max = n.life; n.text = text; n.color = color; n.big = !!big;
}
function shake(a) { G.trauma = Math.min(1, G.trauma + a); }
function light(x, y, r, life) { G.flashes.push({ x, y, r, life, max: life }); }

// ---------------- bullets ----------------
function fireBullet(team, x, y, ang, speed, dmg, opt) {
  const b = spawnFrom(G.bullets);
  b.team = team; b.x = x; b.y = y; b.px = x; b.py = y; b.sx = x; b.sy = y;
  b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed;
  b.dmg = dmg; b.dist = 0; b.range = opt.range || 600; b.pierce = opt.pierce || 0; b.wpn = opt.wpn || null;
  b.shot = opt.shot || 0; b.headMult = opt.headMult || 2; b.knock = opt.knock || 40; b.falloff = !!opt.falloff;
  b.crit = !!opt.crit; b.big = !!opt.big; b.weak = opt.weak || 0; b.age = 0; b.wagonDmg = opt.wagonDmg || 0.3;
  b.grav = opt.grav || 0; b.explosive = opt.explosive || 0; b.arrow = !!opt.arrow; b.knife = !!opt.knife; b.silent = !!opt.silent;
  b.hit = b.hit || []; b.hit.length = 0;
  b.ign = b.ign || []; b.ign.length = 0;
  for (const s of G.solids) if (COVER_KINDS.has(s.kind) && x > s.x - 28 && x < s.x + s.w + 28 && y < s.y + 6 && y > s.y - 40) b.ign.push(s);
  return b;
}

function hitTest(e, x0, y0, x1, y1) {
  const hh = e.headH || 10;
  const head = { x: e.x + 1, y: e.y, w: e.w - 2, h: hh };
  const body = { x: e.x, y: e.y + hh, w: e.w, h: e.h - hh };
  const th = segRect(x0, y0, x1, y1, head), tb = segRect(x0, y0, x1, y1, body);
  if (th < 0 && tb < 0) return null;
  if (th >= 0 && (tb < 0 || th <= tb + 0.0001)) return { t: th, head: true };
  return { t: tb, head: false };
}

// Lobbed charges burst wherever they stop.
function detonate(b, x, y) {
  b.dead = true; b.x = x; b.y = y;
  explode(x, y, b.explosive, 25, b.dmg, b.team === 'p');
}

function updateBullet(b, dt) {
  if (b.grav) b.vy += b.grav * dt;
  let x0 = b.x, y0 = b.y;
  const x1 = x0 + b.vx * dt, y1 = y0 + b.vy * dt;
  b.px = x0; b.py = y0; b.age += dt;
  for (let guard = 0; guard < 6; guard++) {
    let best = 2, bt = null, kind = null, head = false;
    for (const s of G.solids) {
      if (s.bullet === false || b.ign.includes(s)) continue;
      const t = segRect(x0, y0, x1, y1, s);
      if (t >= 0 && t < best) { best = t; bt = s; kind = 's'; }
    }
    if (b.team === 'p') {
      for (const e of G.enemies) {
        if (e.dead || e.invuln || b.hit.includes(e)) continue;
        if (Math.abs(cxOf(e) - x0) > Math.abs(x1 - x0) + 60) continue;
        const r = hitTest(e, x0, y0, x1, y1);
        if (r && r.t < best) { best = r.t; bt = e; kind = 'e'; head = r.head; }
      }
      for (const d of G.dyns) {
        if (d.dead) continue;
        const t = segRect(x0, y0, x1, y1, { x: d.x - 3, y: d.y - 3, w: 6, h: 6 });
        if (t >= 0 && t < best) { best = t; bt = d; kind = 'd'; }
      }
    } else {
      const P = G.player;
      if (P.alive && !b.hit.includes(P)) { const r = hitTest(P, x0, y0, x1, y1); if (r && r.t < best) { best = r.t; bt = P; kind = 'p'; } }
      const W = G.wagon;
      if (W && !W.dead) { const t = segRect(x0, y0, x1, y1, W); if (t >= 0 && t < best) { best = t; bt = W; kind = 'w'; } }
    }
    if (!bt) break;
    const hx = x0 + (x1 - x0) * best, hy = y0 + (y1 - y0) * best;
    b.dist += Math.hypot(hx - x0, hy - y0);
    if (b.explosive && (kind === 's' || kind === 'e' || kind === 'd')) { if (kind === 'd') bt.fuse = 0; detonate(b, hx - b.vx * 0.004, hy - b.vy * 0.004); return; }
    if (kind === 's') {
      bulletHitSolid(b, bt, hx, hy); b.x = hx; b.y = hy; b.dead = true;
      if (b.arrow && bt.kind !== 'bottle') { const p = part('stuck', hx, hy, b.vx, b.vy, 4, 1, '#a8784a', 0); p.vx = b.vx; p.vy = b.vy; }
      return;
    }
    if (kind === 'd') { bt.fuse = 0; bt.byPlayer = true; b.x = hx; b.y = hy; b.dead = true; return; }
    if (kind === 'p') {
      b.hit.push(bt);
      if (bt.hurt(b.dmg, b.sx)) { puffs(hx, hy, 4, '#8a2a20', Math.atan2(b.vy, b.vx)); b.x = hx; b.y = hy; b.dead = true; return; }
      x0 = hx; y0 = hy; continue; // dodged: bullet passes through
    }
    if (kind === 'w') { bt.hurt(b.dmg * b.wagonDmg); sparks(hx, hy, 3, Math.atan2(-b.vy, -b.vx), '#d8a060'); Sound.play('wood', { x: hx }); b.x = hx; b.y = hy; b.dead = true; return; }
    // enemy hit
    b.hit.push(bt);
    damageEnemy(bt, b, head, hx, hy);
    if (b.pierce > 0 && !bt.boss && !bt.armorT) { b.pierce--; b.dmg *= 0.8; x0 = hx; y0 = hy; continue; }
    b.x = hx; b.y = hy; b.dead = true; return;
  }
  b.dist += Math.hypot(x1 - x0, y1 - y0);
  b.x = x1; b.y = y1;
  if (b.dist > b.range || b.x < -50 || b.x > G.width + 50 || b.y > VH + 50 || b.y < -200) {
    if (b.explosive && b.y < VH) detonate(b, b.x, b.y); else b.dead = true;
  }
}

function bulletHitSolid(b, s, x, y) {
  const back = Math.atan2(-b.vy, -b.vx);
  const k = s.kind;
  if (k === 'crate' || k === 'boards' || k === 'door' || k === 'gate' || k === 'car' || k === 'wood' || k === 'cart' || k === 'hull' || k === 'pier' || k === 'coffin') { puffs(x, y, 4, '#b8844a', back); Sound.play('wood', { x }); }
  else if (k === 'bottle') { /* handled by damage */ }
  else if (k === 'rock' || k === 'ground') { puffs(x, y, 5, '#c8a07a', back); Sound.play('dirt', { x }); }
  else { sparks(x, y, 5, back); Sound.play('ric', { x }); }
  if (s.hp != null && !(s.kind === 'coffin' && b.team === 'e')) damageSolid(s, b.team === 'p' ? b.dmg : b.dmg * 0.5, b.team === 'p');
}

function damageSolid(s, dmg, byPlayer) {
  if (s.hp == null || s.broken) return;
  s.hp -= dmg; s.hurtT = 0.1;
  if (s.hp > 0) return;
  s.broken = true;
  G.removeSolid(s);
  if (s.onBreak) s.onBreak();
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  if (s.kind === 'barrel') { s.pending = 0.12; G.pendingBlasts.push({ x: cx, y: cy, t: 0.12, byPlayer }); return; }
  if (s.kind === 'bottle') {
    Sound.play('glass', { x: cx });
    for (let i = 0; i < 8; i++) part('debris', cx, cy, rand(-80, 80), rand(-160, -40), rand(0.4, 0.8), 1, i % 2 ? '#7ab86a' : '#cfeac0', 600);
    if (byPlayer) G.counters.bottle = (G.counters.bottle || 0) + 1;
    return;
  }
  Sound.play('crate', { x: cx });
  for (let i = 0; i < 14; i++) part('debris', cx + rand(-s.w / 2, s.w / 2), cy + rand(-s.h / 2, s.h / 2), rand(-120, 120), rand(-220, -60), rand(0.5, 1), randi(1, 2), i % 3 ? '#a8743a' : '#6a4220', 700).bounce = 1;
  smoke(cx, cy, 4, '#c8a878');
  if (s.kind === 'crate' && Math.random() < 0.3) G.dropPickup(Math.random() < 0.6 ? 'cash' : 'ammo', cx, cy, 6);
  if (s.secret && byPlayer) { G.toast('Secret found!'); Sound.play('gold'); }
}

function damageEnemy(e, b, head, hx, hy) {
  const P = G.player, st = G.pstats;
  let dmg = b.dmg;
  if (b.falloff) dmg *= clamp(1 - (b.dist - 50) / 260, 0.3, 1);
  let crit = b.crit;
  if (head) {
    dmg *= e.boss ? Math.min(b.headMult, 1.6) : b.headMult;
    if (P.deActive) crit = true;
  }
  if (!crit && Math.random() < st.critChance) crit = true;
  if (crit) dmg *= st.critMult;
  let weak = false;
  if (e.armorT && !head) {
    // Iron Jack's back tank: shots travelling the same way he faces hit his back.
    if (e.tankWeak && Math.sign(b.vx) === e.f) { dmg *= 2.2; weak = true; }
    else dmg *= e.armorFactor();
  }
  const kx = Math.sign(b.vx) * b.knock;
  e.hurt(dmg, { head, crit, kx, byPlayer: true, x: hx, y: hy, weak, silent: b.silent });
  if (!G.hitShots.has(b.shot)) { G.hitShots.add(b.shot); G.stats.hits++; }
  P.addDE(head ? 8 : 3);
  const back = Math.atan2(-b.vy, -b.vx);
  if (e.armorT && !head && !weak) { sparks(hx, hy, 5, back, '#ffe0a0'); Sound.play('ric', { x: hx }); }
  else puffs(hx, hy, head ? 7 : 4, e.decoy ? '#e8e8e0' : '#8a2a20', back + Math.PI);
  G.hitmarker = head ? 0.25 : 0.15; G.hitHead = head;
  Sound.play(head ? 'headshot' : 'hitmarker');
  if (crit && P.deActive) { Sound.play('crit'); light(hx, hy, 30, 0.15); }
  if (head) G.stats.headshots++;
  const txt = Math.round(dmg) + '';
  floatText(hx, hy - 6, weak ? 'WEAK ' + txt : head ? (crit ? 'CRIT ' : '') + txt : txt, weak ? '#ffa040' : head ? (crit ? '#ffe040' : '#ff6a4a') : crit ? '#ffe040' : '#ffffff');
}

// ---------------- explosions ----------------
function explode(x, y, r, dmgP, dmgE, byPlayer) {
  Sound.play('explosion', { x });
  shake(0.55);
  light(x, y, r * 2.2, 0.35);
  part('ring', x, y, 0, 0, 0.3, r, '#fff0c0');
  for (let i = 0; i < 18; i++) { const a = rand(0, TAU), s = rand(20, 160); part('fire', x, y, Math.cos(a) * s, Math.sin(a) * s - 30, rand(0.25, 0.55), rand(3, 6), choose(['#ffd060', '#ff9a30', '#ff6a20']), -40); }
  smoke(x, y - 4, 10, '#5a4a40');
  for (let i = 0; i < 10; i++) part('debris', x, y, rand(-160, 160), rand(-260, -80), rand(0.5, 1), 1, '#4a3020', 700).bounce = 1;
  for (const e of G.enemies) {
    if (e.dead || e.invuln) continue;
    const d = Math.hypot(cxOf(e) - x, e.y + e.h / 2 - y);
    if (d < r + e.w / 2) {
      let dmg = dmgE * clamp(1 - d / (r * 1.5), 0.35, 1);
      if (e.boss) dmg *= 0.5;
      e.hurt(dmg, { kx: Math.sign(cxOf(e) - x) * 220, byPlayer, explosion: true });
      e.vy -= 160;
      if (byPlayer) floatText(cxOf(e), e.y, Math.round(dmg) + '', '#ffb040');
    }
  }
  const P = G.player;
  if (P.alive) {
    const d = Math.hypot(cxOf(P) - x, P.y + P.h / 2 - y);
    if (d < r + 4 && P.hurt(dmgP * clamp(1 - d / (r * 1.6), 0.4, 1), x)) { P.vx += Math.sign(cxOf(P) - x) * 220; P.vy = -220; }
  }
  if (G.wagon && !G.wagon.dead && Math.hypot(cxOf(G.wagon) - x, G.wagon.y + 20 - y) < r + 30) G.wagon.hurt(dmgP * 1.2);
  for (const s of G.solids.slice()) {
    if (s.hp == null || s.broken) continue;
    if (Math.hypot(s.x + s.w / 2 - x, s.y + s.h / 2 - y) < r + Math.max(s.w, s.h) / 2) damageSolid(s, s.kind === 'barrel' ? 999 : 120, byPlayer);
  }
}

// Thrown dynamite (enemies & bosses). Shoot it to detonate early.
function throwDynamite(x, y, tx, ty, flight, fuse) {
  const T = flight;
  const d = { x, y, vx: (tx - x) / T, vy: (ty - y - 0.5 * GRAV * T * T) / T, fuse, landed: false, dead: false, t: 0, byPlayer: false, w: 4, h: 4, tx, ty };
  G.dyns.push(d);
  Sound.play('throw', { x });
  return d;
}
function updateDynamite(d, dt) {
  d.t += dt; d.fuse -= dt;
  if ((d.t * 10 | 0) % 2) part('spark', d.x, d.y - 3, rand(-30, 30), rand(-60, -20), 0.15, 1, '#ffe060', 0);
  if (!d.landed) {
    d.vy += GRAV * dt;
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    const s = pointSolid(nx, ny);
    if (s && d.vy > 0) { d.landed = true; d.y = s.y - 2; d.vx = 0; d.vy = 0; Sound.play('wood', { x: d.x }); }
    else if (pointSolid(nx, d.y)) { d.vx *= -0.3; }
    else { d.x = nx; d.y = ny; }
    if (d.y > VH + 30) d.dead = true;
  }
  if (d.fuse <= 0 && !d.dead) { d.dead = true; explode(d.x, d.y, 50, 34 * G.diff.edmg, 130, d.byPlayer); }
}

// ---------------- player ----------------
class Player {
  constructor(x, y) {
    const st = G.pstats;
    this.w = 12; this.h = 30; this.H = 30; this.HC = 19; this.headH = 10;
    this.x = x - 6; this.y = y - 30; this.vx = 0; this.vy = 0; this.f = 1;
    this.onGround = false; this.crouch = false; this.alive = true; this.deadT = 0;
    this.hp = this.maxHp = st.maxHp;
    this.rollT = 0; this.rollCd = 0; this.rollDir = 1; this.iframes = 0; this.airRoll = false; this.flashT = 0;
    this.coyote = 0; this.jumpBuf = 0; this.stepT = 0; this.phase = 0; this.t = 0;
    this.slots = Store.save.loadout.slice();
    this.ammo = {};
    for (const id of this.slots) if (id) { const ws = st.weapons[id]; this.ammo[id] = { mag: ws.mag, reserve: ws.startReserve }; }
    this.cur = this.slots.findIndex(Boolean);
    this.fireT = 0; this.reloadT = 0; this.swapT = 0; this.heat = 0; this.drawT = 0; this.spin = 0; this.spinT = 0; this.burstLeft = 0; this.burstT = 0; this.dualSide = 0; this.recoil = 0; this.recoil2 = 0; this.leverT = 0; this.queued = 0;
    this.de = st.deCap * 0.5; this.deActive = false; this.forcedDE = false; this.beatT = 0;
    this.aim = 0; this.aimX = x + 100; this.aimY = y - 20; this.ads = false;
    this.lastSafe = { x: this.x, y: this.y }; this.safeT = 0;
    this.dropT = 0; this.muzzle = null;
  }
  get wid() { return this.slots[this.cur]; }
  get ws() { return G.pstats.weapons[this.wid]; }
  get cx() { return this.x + this.w / 2; }
  shoulder() {
    const fe = this.y + this.h;
    return { x: this.cx + this.f * 3, y: fe - (this.crouch ? 10 : 19) };
  }
  addDE(v) { if (!this.forcedDE) this.de = Math.min(G.pstats.deCap, this.de + v * G.pstats.deRegen); }
  setDE(on) {
    if (on === this.deActive) return;
    this.deActive = on;
    Sound.play(on ? 'deOn' : 'deOff'); Sound.setDeadEye(on);
    if (on) this.beatT = 0;
  }
  switchTo(i) {
    if (i === this.cur || !this.slots[i] || this.rollT > 0) return;
    this.cur = i; this.reloadT = 0; this.swapT = this.ws.swap; this.heat = 0; this.fireT = 0; this.drawT = 0; this.spin = 0; this.burstLeft = 0;
    Sound.play('swap');
  }
  cycle(d) {
    for (let k = 1; k <= 4; k++) { const i = (this.cur + d * k + 8) % 4; if (this.slots[i]) { this.switchTo(i); return; } }
  }
  startReload() {
    const a = this.ammo[this.wid], ws = this.ws;
    if (this.reloadT > 0 || a.mag >= ws.mag || a.reserve <= 0) return;
    this.reloadT = ws.reload; this.reloadMax = ws.reload;
    Sound.play('reload');
    if (this.wid === 'revolver' || this.wid === 'devil' || this.wid === 'dual') { const sh = this.shoulder(); for (let i = 0; i < Math.min(6, ws.mag - a.mag); i++) shell(sh.x, sh.y + 2, -this.f); }
  }
  finishReload() {
    const a = this.ammo[this.wid], n = Math.min(this.ws.mag - a.mag, a.reserve);
    a.mag += n; if (a.reserve !== Infinity) a.reserve -= n;
    Sound.play('reloadEnd');
    if (this.wid === 'shotgun') Sound.play('pump');
  }
  hurt(dmg, srcX, opt) {
    if (!this.alive || G.state !== 'play') return false;
    if (this.rollT > 0) { // dodge roll: projectile passes through
      if (!(this._dodgeMsg > 0)) { floatText(this.cx, this.y - 4, 'DODGE', '#a0d8ff', true); this._dodgeMsg = 0.6; }
      return false;
    }
    if (this.iframes > 0) return true; // brief mercy window after a hit: absorbed, no damage
    dmg *= G.pstats.resist;
    this.hp -= dmg; this.iframes = 0.32; this.flashT = 0.1;
    G.stats.dmgTaken += dmg; G.hurtFlash = 0.35;
    shake(0.22 + dmg / 120);
    Sound.play('hurt');
    if (srcX != null) this.vx += Math.sign(this.cx - srcX || 1) * 70;
    if (this.hp <= 0) this.die();
    return true;
  }
  heal(v) { const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + v * G.pstats.heal); return this.hp > before; }
  die() {
    this.hp = 0; this.alive = false; this.deadT = 0; this.vy = -180; this.vx = -this.f * 60;
    this.setDE(false); this.forcedDE = false;
    Sound.play('enemyDie');
    G.onPlayerDeath();
  }

  update(dt) {
    const st = G.pstats;
    this.t += dt;
    if (this._dodgeMsg > 0) this._dodgeMsg -= dt;
    if (!this.alive) { this.deadT += dt; this.vx *= 0.92; physics(this, dt); return; }
    // Dead Eye meter (real time)
    if (Input.hit('deadeye') && !this.forcedDE) {
      if (this.deActive) this.setDE(false);
      else if (this.de >= 20) this.setDE(true);
      else { Sound.play('deny'); floatText(this.cx, this.y - 6, 'DEAD EYE LOW', '#ffd070', true); }
    }
    if (this.deActive && !this.forcedDE) { this.de -= 20 * dt; if (this.de <= 0) { this.de = 0; this.setDE(false); } }
    if (this.deActive) { this.beatT -= dt; if (this.beatT <= 0) { Sound.play('heartbeat'); this.beatT = 0.9; } }
    const mdt = dt * (this.deActive ? 0.55 : 1); // player body moves a bit slowed in Dead Eye
    const wdt = dt * (this.deActive ? 0.8 : 1);  // ...while the gun stays snappy

    // weapon select
    for (let i = 0; i < 4; i++) if (Input.hit('w' + (i + 1))) this.switchTo(i);
    if (Input.hit('next')) this.cycle(1);
    if (Input.hit('prev')) this.cycle(-1);
    const ws = this.ws, a = this.ammo[this.wid];

    // movement
    const mx = Input.moveX();
    this.ads = Input.held('aim');
    const wantCrouch = Input.held('crouch') && this.onGround && this.rollT <= 0;
    if (wantCrouch !== this.crouch) { if (setHeight(this, wantCrouch ? this.HC : this.H)) this.crouch = wantCrouch; }
    this.headH = this.crouch ? 8 : 10;
    if (this.onGround) { this.coyote = 0.1; this.airRoll = false; } else this.coyote -= mdt;
    if (Input.hit('jump')) this.jumpBuf = 0.12; else this.jumpBuf -= mdt;
    if (this.jumpBuf > 0 && this.coyote > 0 && this.rollT <= 0) {
      if (Input.held('crouch') && this.ground && this.ground.oneway) { this.dropT = 0.25; this.y += 1; }
      else {
        if (this.crouch) { setHeight(this, this.H); this.crouch = false; }
        this.vy = -st.jumpVel; Sound.play('jump'); dust(this.cx, this.y + this.h, 4);
      }
      this.jumpBuf = 0; this.coyote = 0;
    }
    if (this.vy < -310 && !Input.held('jump')) this.vy = -310; // short hop on tap still clears a crate
    if (Input.hit('dodge') && this.rollCd <= 0 && !(this.airRoll && !this.onGround)) {
      if (this.crouch) { setHeight(this, this.H); this.crouch = false; }
      this.rollDir = mx ? Math.sign(mx) : this.f;
      this.rollT = 0.32; this.iframes = Math.max(this.iframes, 0.3); this.rollCd = st.dodgeCd; this.airRoll = !this.onGround;
      Sound.play('dodge'); dust(this.cx, this.y + this.h, 6);
      if (this.h !== 20 && setHeight(this, 20)) this.rolling = true;
    }
    if (this.rollT > 0) {
      this.rollT -= mdt; this.vx = this.rollDir * 310 * st.speed;
      if (this.rollT <= 0 && this.rolling) { if (setHeight(this, this.H)) this.rolling = false; else this.rollT = 0.05; }
    } else {
      const heavy = (ws.heavy && this.spin > 0.05 ? ws.heavy : 1) * (this.drawT > 0 ? 0.6 : 1);
      const sp = 138 * st.speed * (this.crouch ? 0.35 : 1) * (this.ads ? 0.65 : 1) * heavy;
      const acc = this.onGround ? 2200 : 1200 * st.airControl;
      this.vx = approach(this.vx, mx * sp, acc * mdt);
    }
    if (this.rollCd > 0) this.rollCd -= dt;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    const vyBefore = this.vy;
    physics(this, mdt);
    if (this.landed && vyBefore > 250) { Sound.play('land'); dust(this.cx, this.y + this.h, 5); }
    // footsteps
    if (this.onGround && Math.abs(this.vx) > 40 && this.rollT <= 0) {
      this.phase = (this.phase + mdt * Math.abs(this.vx) / 70) % 1;
      this.stepT -= mdt;
      if (this.stepT <= 0) {
        this.stepT = 0.3;
        const wood = this.ground && (this.ground.oneway || ['crate', 'car', 'wood', 'cart', 'hull', 'pier'].includes(this.ground.kind));
        Sound.play(wood ? 'foot_wood' : 'foot_dirt', { x: this.cx });
        if (!wood && Math.random() < 0.5) dust(this.cx - this.f * 4, this.y + this.h, 1);
      }
    }
    // safety point for pits
    if (this.onGround && this.ground && !this.ground.hazard) {
      this.safeT += dt;
      if (this.safeT > 0.25 && groundAhead(this, 1) && groundAhead(this, -1)) this.lastSafe = { x: this.x, y: this.y };
    } else this.safeT = 0;
    if (this.y > VH + 30) G.pitFall();

    // aiming
    const sh = this.shoulder();
    if (this.rollT <= 0) this.f = this.aimX >= this.cx ? 1 : -1; else this.f = this.rollDir;
    this.aim = Math.atan2(this.aimY - sh.y, this.aimX - sh.x);

    // weapons
    if (this.swapT > 0) this.swapT -= wdt;
    if (this.fireT > 0) this.fireT -= wdt;
    if (this.leverT > 0) this.leverT -= wdt;
    this.recoil = Math.max(0, this.recoil - wdt * 20); this.recoil2 = Math.max(0, this.recoil2 - wdt * 20);
    if (this.reloadT > 0) { this.reloadT -= wdt; if (this.reloadT <= 0) { this.reloadT = 0; this.finishReload(); } }
    if (!Input.held('shoot')) this.heat = Math.max(0, this.heat - wdt * 0.5);
    if (Input.hit('reload')) this.startReload();
    if (Input.hit('shoot')) this.queued = 0.15; else this.queued -= wdt;
    const ready = this.fireT <= 0 && this.swapT <= 0 && this.rollT <= 0;
    const outOfAmmo = () => {
      if (this.reloadT > 0) return;
      if (a.reserve > 0) this.startReload(); else { Sound.play('empty'); this.fireT = 0.25; floatText(this.cx, this.y - 6, 'EMPTY', '#ff8a6a', true); }
    };
    if (ws.charge) { // bow: hold to draw, release to loose
      if (Input.held('shoot') && ready && this.reloadT <= 0 && a.mag > 0) {
        if (this.drawT === 0) Sound.play('draw');
        this.drawT = Math.min(ws.charge, this.drawT + wdt);
      } else if (this.drawT > 0) {
        if (!Input.held('shoot') && a.mag > 0 && this.rollT <= 0) this.fire(this.drawT / ws.charge);
        this.drawT = 0;
      } else if (this.queued > 0 && ready && a.mag === 0) { outOfAmmo(); this.queued = 0; }
    } else if (ws.burst) { // three-round burst per squeeze
      if (this.burstLeft > 0) {
        this.burstT -= wdt;
        if (this.burstT <= 0) {
          if (a.mag > 0 && this.rollT <= 0) { this.fire(); this.burstLeft--; this.burstT = ws.burstGap; } else this.burstLeft = 0;
          if (this.burstLeft <= 0) this.fireT = ws.fire;
        }
      } else if (this.queued > 0 && ready) {
        if (a.mag > 0) { if (this.reloadT > 0) this.reloadT = 0; this.burstLeft = ws.burst; this.burstT = 0; } else outOfAmmo();
        this.queued = 0;
      }
    } else {
      if (ws.spin) { // gatling: crank up before it fires
        const cranking = Input.held('shoot') && this.swapT <= 0 && this.rollT <= 0 && this.reloadT <= 0 && a.mag > 0;
        this.spin = cranking ? Math.min(1, this.spin + wdt / ws.spin) : Math.max(0, this.spin - wdt * 1.5);
        if (this.spin > 0.05) { this.spinT -= wdt; if (this.spinT <= 0) { Sound.play('spin', { pitch: 0.7 + this.spin * 0.5 }); this.spinT = 0.16 - this.spin * 0.08; } }
      }
      const want = ws.auto ? Input.held('shoot') : this.queued > 0;
      if (want && ready && (!ws.spin || this.spin >= 1 || a.mag === 0)) {
        if (a.mag > 0) { if (this.reloadT > 0) this.reloadT = 0; this.fire(); this.queued = 0; }
        else { outOfAmmo(); this.queued = 0; }
      }
    }
    if (a.mag === 0 && this.fireT <= 0 && this.reloadT <= 0 && a.reserve > 0 && this.rollT <= 0) this.startReload();
    if (Input.hit('interact')) G.interact();
  }

  fire(draw) {
    const ws = this.ws, id = this.wid, a = this.ammo[id];
    a.mag--;
    this.fireT = ws.fire;
    G.stats.shots++; const shot = ++G.run.shotId;
    let spread = ws.spread * (this.ads ? 0.45 : 1) * (Math.abs(this.vx) > 40 ? 1.35 : 1) * (this.onGround ? 1 : 1.4) * (this.deActive ? 0.3 : 1);
    if (ws.spreadGrow) { spread += this.heat; this.heat = Math.min(ws.spreadMax, this.heat + ws.spreadGrow); }
    else if (this.t - (this.lastShot || -9) > 0.45 && Math.abs(this.vx) < 40 && !ws.pellets && !ws.spin) spread *= 0.2; // deliberate first shot is true
    if (ws.charge) spread *= 1.6 - draw * 1.4; // a full draw flies true
    this.lastShot = this.t;
    const sh = this.shoulder();
    // muzzle comes from the gun drawing; fall back to computed point
    let side = 0;
    if (ws.dual) { side = this.dualSide; this.dualSide ^= 1; }
    const pellets = ws.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const ang = this.aim + (pellets > 1 ? (i / (pellets - 1) - 0.5) * spread * 2 + rand(-0.03, 0.03) : rand(-spread, spread));
      const speed = ws.charge ? lerp(ws.speed, ws.speedMax, draw) : ws.speed, dmg = ws.charge ? lerp(ws.dmg, ws.dmgMax, draw) : ws.dmg;
      fireBullet('p', sh.x, sh.y + (side ? 1 : 0), ang, speed, dmg, { range: ws.range, pierce: ws.pierce, wpn: id, shot, headMult: ws.headMult, knock: ws.knock || 50, falloff: ws.falloff,
        grav: ws.grav, explosive: ws.explosive, arrow: ws.arrow, silent: ws.silent });
    }
    const len = { revolver: 14, rifle: 21, shotgun: 17, dual: 14, sharp: 25, devil: 16, volcanic: 15, gatling: 19, boom: 15, bow: 12 }[id] || 14;
    const mx = sh.x + Math.cos(this.aim) * len, my = sh.y + Math.sin(this.aim) * len - (side ? 0 : 1);
    if (!ws.silent) {
      part('flash', mx, my, 0, 0, 0.06, id === 'shotgun' || id === 'boom' ? 6 : id === 'sharp' ? 5 : 4, '#fff4c0');
      smoke(mx, my, id === 'shotgun' || id === 'boom' ? 4 : 1, '#e8e0d0');
      light(mx, my, 70, 0.08);
    }
    if (side) this.recoil2 = 2; else this.recoil = ws.kick > 5 ? 3 : 2;
    if (ws.lever) { this.leverT = 0.35; setTimeoutGame(() => shell(sh.x, sh.y, this.f), 0.25); }
    else if (ws.shell) shell(sh.x, sh.y, this.f);
    if (ws.recoil && this.rollT <= 0) { this.vx -= Math.cos(this.aim) * ws.recoil; if (!this.onGround) this.vy -= Math.sin(this.aim) * ws.recoil * 0.5; }
    G.kick(-Math.cos(this.aim) * ws.kick, -Math.sin(this.aim) * ws.kick);
    shake(ws.shake);
    Sound.play(ws.sound, { pitch: rand(0.94, 1.06) });
    if (!ws.silent) G.noise(this.cx, 500);
  }
}

// Tiny scheduler running in world time (pauses with the game).
function setTimeoutGame(fn, t) { G.timers.push({ fn, t }); }

// ---------------- enemies ----------------
class Enemy {
  constructor(type, x, feetY, opt) {
    opt = opt || {};
    const T = ENEMY_TYPES[type] || {};
    this.type = type; this.T = T;
    this.L = LOOKS[opt.look || T.look || 'outlaw'];
    const L = this.L;
    this.w = (L.torsoW || 10) + 2; this.H = (L.legH || 8) + (L.torsoH || 9) + 13; this.h = this.H;
    this.HC = this.H - 11; this.headH = 10;
    this.x = x - this.w / 2; this.y = feetY - this.h; this.vx = 0; this.vy = 0; this.f = -1;
    this.maxHp = this.hp = (T.hp || 100) * G.diff.ehp * (opt.hpMult || 1);
    this.alert = !opt.guard; this.alertT = 0; this.atk = 'cool'; this.atkT = rand(0.5, 1.2) * G.diff.react + (opt.delayAtk || 0);
    this.fireT = 0; this.shots = 0; this.aimAng = Math.PI; this.goalX = x; this.decideT = 0; this.cover = null;
    this.dead = false; this.deadT = 0; this.flash = 0; this.t = rand(0, 5); this.phase = 0; this.hurtT = 0;
    this.spawnT = opt.spawnT != null ? opt.spawnT : 0.45; this.crouch = false; this.dropT = 0; this.jumpCd = 0;
    this.name = opt.name || null; this.elite = !!opt.elite; this.wave = opt.wave || null; this.wagonTarget = !!opt.wagon;
    this.target = null; this.home = x; this.patrolT = 0; this.armorT = T.armor ? 1 : 0; this.lever = 0;
    this.gun = T.gun; this.reward = opt.reward;
    if (this.elite) { this.maxHp = this.hp *= 1; }
  }
  get cx() { return this.x + this.w / 2; }
  armorFactor() { return Math.min(1, (this.T.armor || 1) + Store.up('ap') * 0.15); }
  shoulder() {
    const L = this.L, fe = this.y + this.h, tw = L.torsoW || 10;
    const lh = this.crouch ? 2 : (L.legH || 8), th = (L.torsoH || 9) - (this.crouch ? 3 : 0);
    return { x: this.cx + this.f * (tw / 2 - 2), y: fe - lh - 3 - 1 - th + 2 };
  }
  setAlert() {
    if (this.alert) return;
    this.alert = true; this.alertT = 0.8; Sound.play('alert', { x: this.cx });
    for (const o of G.enemies) if (!o.dead && !o.alert && Math.abs(o.cx - this.cx) < 220) { o.alert = true; o.alertT = 0.8; }
  }
  hearNoise(x, r) { if (!this.alert && Math.abs(x - this.cx) < r) this.setAlert(); }

  update(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.alertT > 0) this.alertT -= dt;
    if (this.dead) { this.deadT += dt; this.vx *= Math.pow(0.02, dt); physics(this, dt); return; }
    if (this.spawnT > 0) { this.spawnT -= dt; physics(this, dt); return; }
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.rollT > 0) { // evasive roll: untouchable for most of it
      this.rollT -= dt; this.vx = this.rollDir * 260; this.invuln = this.rollT > 0.06; this.phase = 1 - this.rollT / 0.35;
      physics(this, dt);
      if (this.rollT <= 0) { this.invuln = false; this.vx = 0; }
      return;
    }
    if (this.fleeing) {
      this.f = this.fleeDir; this.vx = this.fleeDir * this.T.speed * 1.6; this.crouch = false;
      physics(this, dt);
      if (this.x < G.cam.x - 60 || this.x > G.cam.x + VW + 60 || this.hitEdge) this.remove = true;
      return;
    }
    this.think(dt);
    physics(this, dt);
    if (Math.abs(this.vx) > 10 && this.onGround) this.phase = (this.phase + dt * Math.abs(this.vx) / 60) % 1;
    if (this.y > VH + 30) this.kill({ fell: true });
  }

  pickTarget() {
    const W = G.wagon;
    if (this.wagonTarget && W && !W.dead && Math.random() < 0.3) return W;
    return G.player;
  }

  decide(tcx) {
    const T = this.T, cx = this.cx;
    const side = Math.sign(cx - tcx) || (Math.random() < 0.5 ? -1 : 1);
    let goal = tcx + side * (T.prefer || 200) * rand(0.8, 1.15);
    if (T.aggressive) goal = tcx + side * rand(25, 55);
    this.cover = null;
    if (T.cover && Math.random() < 0.7) {
      let best = null, bd = 1e9;
      for (const s of G.solids) {
        if (s.kind !== 'crate' && s.kind !== 'cart') continue;
        if (G.enemies.some(o => o !== this && !o.dead && o.cover === s)) continue; // one shooter per crate
        const scx = s.x + s.w / 2;
        if (Math.sign(scx - tcx) !== side) continue;
        const dt2 = Math.abs(scx - tcx);
        if (dt2 < 70 || dt2 > T.range * 0.9 || Math.abs(scx - cx) > 260 || s.y < G.player.y - 60) continue;
        const coverX = side > 0 ? s.x + s.w + this.w / 2 + 1 : s.x - this.w / 2 - 1;
        const d = Math.abs(coverX - goal);
        if (d < bd) { bd = d; best = { s, x: coverX }; }
      }
      if (best) { goal = best.x; this.cover = best.s; }
    }
    if (this.perched) goal = this.home + rand(-12, 12); // snipers on roofs/ledges hold their perch
    // never path through tall walls or closed gates
    for (const s of G.solids) {
      if (!s.move || s.h < 50 || s.y > this.y + this.h - 45 || s.y + s.h < this.y) continue;
      if (s.x >= cx && s.x < goal) goal = s.x - this.w;
      else if (s.x + s.w <= cx && s.x + s.w > goal) goal = s.x + s.w + this.w;
    }
    if (!this.cover && !this.perched) { // spread out instead of stacking on one spot
      for (let k = 0; k < 4; k++) {
        if (!G.enemies.some(o => o !== this && !o.dead && !o.boss && Math.abs(o.goalX - goal) < 26 && Math.abs(o.y - this.y) < 30)) break;
        goal += side * 30;
      }
    }
    this.goalX = clamp(goal, G.minX + 10, G.maxX - 10);
    this.decideT = rand(1.4, 2.8);
    this.target = this.pickTarget();
  }

  think(dt) {
    const T = this.T, P = G.player;
    if (!this.alert) {
      // guard: idle sway / short patrol, spot the player with line of sight
      this.patrolT -= dt;
      if (this.patrolT <= 0) { this.patrolT = rand(1.5, 3); this.goalX = this.home + rand(-40, 40); }
      const d = this.goalX - this.cx; this.vx = Math.abs(d) > 4 ? Math.sign(d) * 30 : 0; if (this.vx) this.f = Math.sign(this.vx);
      const dx = P.cx - this.cx;
      if (P.alive && Math.abs(dx) < 330 && Math.abs(P.y - this.y) < 120 && (Math.sign(dx) === this.f || Math.abs(dx) < 120)) {
        const sh = this.shoulder();
        if (losClear(sh.x, sh.y, P.cx, P.y + 8)) this.setAlert();
      }
      return;
    }
    if (!P.alive && (!G.wagon || G.wagon.dead)) { this.vx = approach(this.vx, 0, 600 * dt); return; }
    if (!this.target || this.target.dead || (this.target === P && !P.alive)) this.target = this.pickTarget();
    const tg = this.target;
    const tcx = tg.x + tg.w / 2, tcy = tg.y + (tg === P ? (P.crouch ? 6 : 9) : tg.h * 0.4);
    this.decideT -= dt;
    if (this.decideT <= 0) this.decide(tcx);
    const cx = this.cx, dxT = tcx - cx;
    this.f = Math.sign(dxT) || this.f;
    let want = 0;
    const md = this.goalX - cx;
    if (Math.abs(md) > 5) want = Math.sign(md) * T.speed;
    if ((this.atk === 'aim' || this.atk === 'fire') && !T.aggressive) want = 0;
    if (want && this.onGround && !groundAhead(this, Math.sign(want), this.perched ? 40 : 90)) { want = 0; this.decideT = Math.min(this.decideT, 0.25); } // hop down short drops, never into pits
    this.vx = approach(this.vx, want, 900 * dt);
    this.jumpCd -= dt;
    if (this.onGround && this.jumpCd <= 0 && !this.perched) {
      const footY = this.y + this.h, pFoot = P.y + P.h;
      if (this.hitWall && want) { this.vy = -440; this.jumpCd = 0.8; }
      else if (tg === P && pFoot < footY - 40 && Math.abs(dxT) < 160 && Math.random() < dt * 1.2) { this.vy = -490; this.jumpCd = 1.5; }
      else if (tg === P && pFoot > footY + 30 && this.ground && this.ground.oneway && Math.random() < dt * 1.2) { this.dropT = 0.3; this.jumpCd = 1.5; }
    }
    const atCover = this.cover && !this.cover.broken && Math.abs(this.goalX - cx) < 8;
    const wantCrouch = atCover && this.atk === 'cool' && this.atkT > 0.25;
    if (wantCrouch !== this.crouch && this.onGround) { if (setHeight(this, wantCrouch ? this.HC : this.H)) this.crouch = wantCrouch; }
    this.headH = this.crouch ? 8 : 10;
    if (T.roller && this.onGround && (this.rollCd = (this.rollCd || 1) - dt) <= 0 && this.atk === 'cool' && P.alive) {
      const psh = P.shoulder(), toMe = Math.atan2(this.y + 12 - psh.y, this.cx - psh.x);
      if (Math.abs(angDiff(P.aim, toMe)) < 0.14 && Math.random() < dt * 4) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        if (groundAhead(this, dir, 40) && pointSolid(this.cx + dir * 90, this.y + this.h + 2)) {
          if (this.crouch) { setHeight(this, this.H); this.crouch = false; }
          this.rollT = 0.35; this.rollDir = dir; this.rollCd = rand(2.2, 3.5); Sound.play('dodge', { x: this.cx });
          return;
        }
      }
    }
    this.attack(dt, tg, tcx, tcy);
  }

  attack(dt, tg, tcx, tcy) {
    const T = this.T, sh = this.shoulder();
    const ang = Math.atan2(tcy - sh.y, tcx - sh.x), adx = Math.abs(tcx - sh.x);
    switch (this.atk) {
      case 'cool':
        this.aimAng += angDiff(this.aimAng, ang) * Math.min(1, dt * 6);
        this.atkT -= dt;
        if (this.atkT <= 0) {
          if (adx < T.range && Math.abs(tcy - sh.y) < 200 && (T.gun === 'dynamite' || losClear(sh.x, sh.y, tcx, tcy))) {
            if (this.crouch) { setHeight(this, this.H); this.crouch = false; }
            this.atk = 'aim'; this.atkT = T.aim * G.diff.react;
            if (T.laser) Sound.play('lock', { x: this.cx });
          } else { this.atkT = 0.3; this.decideT = Math.min(this.decideT, 0.4); }
        }
        break;
      case 'aim':
        if (!(T.laser && this.atkT < 0.2)) this.aimAng = ang;
        this.atkT -= dt;
        if (this.atkT <= 0) {
          if (T.gun === 'dynamite') {
            const P = G.player, fl = clamp(adx / 260, 0.7, 1.25);
            const tx = clamp(tcx + (tg === P ? P.vx * fl * 0.8 : 0), tcx - 110, tcx + 110);
            throwDynamite(sh.x, sh.y - 4, tx, tg.y + tg.h - 3, fl, 1.6 * G.diff.react);
            this.atk = 'cool'; this.atkT = rand(...T.cool) * G.diff.react;
          } else {
            this.atk = 'fire'; this.shots = randi(T.burst[0], T.burst[1]); this.fireT = 0;
            if (T.gun === 'gatling') this.sweep = -0.18;
          }
        }
        break;
      case 'fire':
        this.fireT -= dt;
        if (this.fireT <= 0) {
          let a = this.aimAng;
          if (T.gun === 'gatling') { a = ang + this.sweep * this.f; this.sweep += 0.04; this.aimAng = a; }
          this.shoot(a);
          this.shots--; this.fireT = T.gap;
          if (this.shots <= 0) { this.atk = 'cool'; this.atkT = rand(T.cool[0], T.cool[1]) * G.diff.react; }
        }
        break;
    }
  }

  shoot(ang) {
    const T = this.T, sh = this.shoulder(), sp = (T.spread || 0.05) * G.diff.spread;
    const n = T.pellets || 1;
    for (let i = 0; i < n; i++) {
      const a = ang + (n > 1 ? (i / (n - 1) - 0.5) * sp * 2 : rand(-sp, sp));
      fireBullet('e', sh.x, sh.y, a, T.bspeed, T.dmg * G.diff.edmg, { range: T.brange || T.range + 160, big: T.gun === 'rifle', knife: T.gun === 'knife' });
    }
    if (T.gun === 'knife') { Sound.play('throw', { x: this.cx }); this.recoil = 2; return; }
    const len = T.gun === 'rifle' ? 20 : T.gun === 'gatling' ? 18 : 14;
    part('flash', sh.x + Math.cos(ang) * len, sh.y + Math.sin(ang) * len, 0, 0, 0.06, n > 1 ? 5 : 4, '#ffd8a0');
    light(sh.x + Math.cos(ang) * len, sh.y + Math.sin(ang) * len, 60, 0.08);
    this.recoil = 2;
    Sound.play(T.gun === 'shotgun' ? 'eshotgun' : T.gun === 'rifle' ? 'erifle' : T.gun === 'gatling' ? 'gatling' : 'eshot', { x: this.cx, pitch: rand(0.9, 1.1) });
  }

  hurt(dmg, info) {
    if (this.dead || this.invuln) return;
    this.hp -= dmg; this.flash = 0.08;
    if (!this.alert && !(info.silent && this.hp <= 0)) this.setAlert(); // a silent one-shot keeps the others unaware
    this.vx += (info.kx || 0) * (this.boss ? 0.15 : 1);
    if (!this.boss) {
      this.hurtT = 0.12;
      if (this.atk === 'aim' && dmg >= 20 && !this.T.telegraph) { this.atk = 'cool'; this.atkT = 0.45; } // flinch
      if (this.hp > 0) Sound.play('enemyHurt', { x: this.cx });
    }
    if (this.hp <= 0) this.kill(info);
  }

  kill(info) {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.hp = 0;
    if (this.crouch) { setHeight(this, this.H); this.crouch = false; }
    this.vy = -140; this.vx = (info && info.kx) ? Math.sign(info.kx) * 90 : 0;
    this.f = this.vx ? -Math.sign(this.vx) : this.f;
    Sound.play('enemyDie', { x: this.cx });
    G.onEnemyKilled(this, info || {});
  }

  draw(c, t) {
    if (this.remove) return;
    const alpha = this.spawnT > 0 ? 1 - this.spawnT / 0.45 : this.dead && this.deadT > 2.5 ? Math.max(0, 1 - (this.deadT - 2.5)) : 1;
    if (alpha <= 0) return;
    c.globalAlpha = alpha;
    const fx = this.cx, fy = this.y + this.h;
    if (!this.dead) { c.fillStyle = 'rgba(40,20,10,0.25)'; c.fillRect(Math.round(fx - this.w / 2 - 1), Math.round(fy), this.w + 2, 1); }
    const state = this.dead ? 'dead' : this.rollT > 0 ? 'roll' : this.crouch ? 'crouch' : !this.onGround ? 'jump' : Math.abs(this.vx) > 10 ? 'run' : 'idle';
    let gun = this.gun === 'dynamite' ? (this.atk === 'aim' ? 'dynamite' : null) : this.gun === 'knife' ? (this.atk !== 'cool' ? 'knife' : null) : this.gun;
    let aim = this.aimAng;
    if (gun && (this.atk === 'cool' && this.crouch)) aim = this.f > 0 ? 0.7 : Math.PI - 0.7;
    drawCharacter(c, this.L, fx, fy, { f: this.f, state, phase: this.phase, aim, gun, flash: this.flash > 0, t, deadT: this.deadT, recoil: this.recoil > 0 ? 1 : 0 });
    if (this.recoil > 0) this.recoil -= 0.25;
    c.globalAlpha = 1;
  }
}

// ---------------- bosses ----------------
class Boss extends Enemy {
  constructor(id, x, feetY) {
    const B = BOSSES[id];
    super('boss', x, feetY, { look: B.look, spawnT: 0 });
    this.id = id; this.B = B; this.boss = true; this.name = B.name;
    this.maxHp = this.hp = B.hp * G.diff.bhp;
    this.headH = 12; this.introT = 2.4; this.state = 'intro'; this.st = 0; this.alert = true;
    this.gun = B.gun; this.aimAng = Math.PI; this.p2 = false;
    this.T = { speed: 60, gun: B.gun, cool: [1, 2], burst: [1, 1] };
  }
  hurt(dmg, info) {
    if (this.introT > 0 || this.state === 'intro') return;
    if (this.stunT > 0) dmg *= 1.5;
    const before = this.hp;
    super.hurt(dmg, info);
    if (this.hp > 0 && before - this.hp > 0) { if (Math.random() < 0.3) Sound.play('bossHurt', { x: this.cx }); }
  }
  update(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.dead) { this.deadT += dt; this.vx *= Math.pow(0.02, dt); physics(this, dt); return; }
    if (this.introT > 0) {
      this.introT -= dt; this.f = Math.sign(G.player.cx - this.cx) || -1;
      this.aimAng = this.f > 0 ? 0.4 : Math.PI - 0.4;
      physics(this, dt);
      if (this.introT <= 0) { this.state = 'idle'; this.st = 0.4; }
      return;
    }
    if (this.stunT > 0) this.stunT -= dt;
    if (G.player.alive) this.think(dt);
    else this.vx = approach(this.vx, 0, 600 * dt);
    physics(this, dt);
    if (Math.abs(this.vx) > 10 && this.onGround) this.phase = (this.phase + dt * Math.abs(this.vx) / 60) % 1;
    if (this.y > VH + 30) { this.y = 100; this.x = (G.arena.x0 + G.arena.x1) / 2; } // never lose a boss in a pit
  }
  aimAt(dt, rate) {
    const P = G.player, sh = this.shoulder();
    const ang = Math.atan2(P.y + 10 - sh.y, P.cx - sh.x);
    this.aimAng += angDiff(this.aimAng, ang) * Math.min(1, dt * (rate || 10));
    return ang;
  }
  blast(n, spread, dmg, speed, range, ang) {
    const sh = this.shoulder();
    for (let i = 0; i < n; i++) fireBullet('e', sh.x, sh.y, ang + (i / (n - 1) - 0.5) * spread * 2 + rand(-0.02, 0.02), speed, dmg * G.diff.edmg, { range });
    part('flash', sh.x + Math.cos(ang) * 16, sh.y + Math.sin(ang) * 16, 0, 0, 0.08, 6, '#ffd8a0');
    light(sh.x, sh.y, 80, 0.1); shake(0.15);
    Sound.play('eshotgun', { x: this.cx });
  }
  single(ang, dmg, speed, snd) {
    const sh = this.shoulder();
    fireBullet('e', sh.x, sh.y, ang, speed, dmg * G.diff.edmg, { range: 900, big: true });
    part('flash', sh.x + Math.cos(ang) * 16, sh.y + Math.sin(ang) * 16, 0, 0, 0.06, 5, '#ffd8a0');
    light(sh.x, sh.y, 70, 0.08);
    Sound.play(snd || 'erifle', { x: this.cx });
  }
  walkTo(x, sp, dt) { const d = x - this.cx; this.vx = approach(this.vx, Math.abs(d) > 6 ? Math.sign(d) * sp : 0, 900 * dt); return Math.abs(d) <= 6; }
  draw(c, t) {
    if (this.hidden) return;
    const fx = this.cx, fy = this.y + this.h;
    let alpha = this.alpha == null ? 1 : this.alpha;
    if (this.dead && this.deadT > 3) alpha = Math.max(0, 1 - (this.deadT - 3));
    c.globalAlpha = alpha;
    if (!this.dead && !this.decoy) { c.fillStyle = 'rgba(40,20,10,0.3)'; c.fillRect(Math.round(fx - this.w / 2 - 2), Math.round(fy), this.w + 4, 1); }
    const state = this.dead ? 'dead' : this.rolling ? 'roll' : this.crouch ? 'crouch' : !this.onGround ? 'jump' : Math.abs(this.vx) > 10 ? 'run' : 'idle';
    const tell = this.tell > 0 && (t * 16 | 0) % 2;
    drawCharacter(c, this.L, fx, fy, { f: this.f, state, phase: this.phase, aim: this.aimAng, gun: this.gun, flash: this.flash > 0 || tell, t, deadT: this.deadT, recoil: 0, skin: this.id === 'devil' ? DEVIL_SKIN : null, dual: this.dualGuns, phaseRoll: this.phase });
    c.globalAlpha = 1;
    if (this.stunT > 0 && !this.dead) for (let i = 0; i < 3; i++) { const a = t * 6 + i * TAU / 3; px(c, Math.round(fx + Math.cos(a) * 8), Math.round(this.y - 4 + Math.sin(a) * 2), 2, 2, '#ffe060'); }
  }
}

class Butcher extends Boss {
  constructor(x, y) { super('butcher', x, y); this.headH = 12; this.cd = 0; }
  next() {
    const P = G.player, adx = Math.abs(P.cx - this.cx), r = Math.random();
    const crates = G.solids.filter(s => s.kind === 'crate' && !s.broken);
    if (!this.p2 && r < 0.22 && crates.length && this.lastState !== 'cover') {
      const side = Math.sign(this.cx - P.cx) || 1;
      let best = null, bd = 1e9;
      for (const s of crates) { const sx = side > 0 ? s.x + s.w + this.w / 2 + 1 : s.x - this.w / 2 - 1; const d = Math.abs(sx - this.cx); if (Math.sign(s.x + s.w / 2 - P.cx) === side && d < bd && d < 260) { bd = d; best = sx; } }
      if (best != null) { this.state = 'cover'; this.goalX = best; this.st = 4; this.lastState = 'cover'; return; }
    }
    if (adx < 170 ? r < 0.6 : r < 0.3) { this.state = 'pump'; this.st = this.p2 ? 0.38 : 0.55; this.blasts = this.p2 ? 2 : 1; this.tell = this.st; Sound.play('pump', { x: this.cx }); }
    else if (r < 0.85) { this.state = 'chargeTell'; this.st = this.p2 ? 0.55 : 0.8; this.tell = this.st; Sound.play('stomp', { x: this.cx }); }
    else { this.state = 'walk'; this.st = 1.1; }
    this.lastState = this.state;
  }
  think(dt) {
    const P = G.player, dx = P.cx - this.cx;
    if (this.tell > 0) this.tell -= dt;
    if (!this.p2 && this.hp < this.maxHp * 0.5) {
      this.p2 = true; this.state = 'roar'; this.st = 1.1; this.crouch = false; setHeight(this, this.H);
      Sound.play('roar', { x: this.cx }); shake(0.6); G.banner('THE BUTCHER IS ENRAGED', 'He charges faster and blasts twice');
      this.L = Object.assign({}, this.L, { shirt: '#c86a5a' });
    }
    const sp = this.p2 ? 1.3 : 1;
    this.st -= dt;
    switch (this.state) {
      case 'idle': this.vx = approach(this.vx, 0, 800 * dt); this.aimAt(dt); if (this.st <= 0) this.next(); break;
      case 'roar': this.vx = 0; if ((this.t * 20 | 0) % 3 === 0) dust(this.cx + rand(-10, 10), this.y + this.h, 1); if (this.st <= 0) this.next(); break;
      case 'walk': this.f = Math.sign(dx) || 1; this.aimAt(dt); this.vx = approach(this.vx, Math.abs(dx) > 90 ? Math.sign(dx) * 70 * sp : 0, 800 * dt); if (this.st <= 0) this.next(); break;
      case 'pump': {
        this.vx = approach(this.vx, 0, 900 * dt); this.f = Math.sign(dx) || 1;
        const ang = this.aimAt(dt, 8);
        if (this.st <= 0) {
          this.blast(7, 0.32, 8, 470, 320, ang); this.blasts--;
          if (this.blasts > 0) { this.st = 0.4; this.tell = 0.3; Sound.play('pump', { x: this.cx }); } else { this.state = 'idle'; this.st = this.p2 ? 0.45 : 0.8; }
        }
        break;
      }
      case 'chargeTell':
        this.vx = 0; this.f = Math.sign(dx) || 1; this.aimAt(dt);
        if ((this.t * 30 | 0) % 4 === 0) dust(this.cx - this.f * 8, this.y + this.h, 1);
        if (this.st <= 0) { this.state = 'charge'; this.st = 1.7; this.chargeDir = this.f; this.chargeHit = false; Sound.play('roar', { x: this.cx }); }
        break;
      case 'charge':
        this.f = this.chargeDir; this.vx = this.chargeDir * 330 * sp;
        if ((this.t * 30 | 0) % 2 === 0) dust(this.cx - this.f * 8, this.y + this.h, 1);
        if (!this.chargeHit && P.alive && overlap(this, P)) {
          if (P.hurt(28 * G.diff.edmg, this.cx)) { P.vx = this.chargeDir * 380; P.vy = -260; this.chargeHit = true; }
        }
        if (this.hitWall) {
          const s = this.hitSolid;
          if (s && s.kind === 'crate') { damageSolid(s, 999, false); this.stunT = 1.2; }
          else this.stunT = 1.0;
          shake(0.5); Sound.play('stomp', { x: this.cx }); dust(this.cx + this.f * 10, this.y + this.h - 10, 8, '#b8844a');
          this.state = 'stun'; this.st = this.stunT; this.vx = -this.chargeDir * 60;
        } else if (this.st <= 0) { this.state = 'idle'; this.st = 0.6; }
        break;
      case 'stun': this.vx = approach(this.vx, 0, 600 * dt); if (this.st <= 0) { this.stunT = 0; this.state = 'idle'; this.st = 0.3; } break;
      case 'cover': {
        this.aimAt(dt);
        const there = this.walkTo(this.goalX, 90, dt);
        if (there && !this.crouch) { if (setHeight(this, this.HC)) { this.crouch = true; this.st = Math.min(this.st, 1.5); } }
        if (this.st <= 0 || (this.crouch && !G.solids.some(s => s.kind === 'crate' && Math.abs(s.x + s.w / 2 - this.cx) < 30))) {
          if (this.crouch) { setHeight(this, this.H); this.crouch = false; }
          this.state = 'pump'; this.st = 0.45; this.blasts = 1; this.tell = 0.45; Sound.play('pump', { x: this.cx });
        }
        break;
      }
    }
  }
}

class Ghost extends Boss {
  constructor(x, y) { super('ghost', x, y); this.cycle = 0; this.dmgSince = 0; this.alpha = 1; this.laser = 0; }
  hurt(dmg, info) {
    if (this.hidden || this.state === 'vanish') return;
    const before = this.hp; super.hurt(dmg, info);
    this.dmgSince += before - this.hp;
    if (!this.dead && this.dmgSince > this.maxHp * 0.13 && this.state !== 'vanish') this.vanish();
  }
  vanish() {
    this.state = 'vanish'; this.st = 0.35; this.laser = 0;
    smoke(this.cx, this.y + 15, 10, '#d8d8d0'); Sound.play('laugh', { x: this.cx });
  }
  think(dt) {
    const P = G.player;
    if (!this.p2 && this.hp < this.maxHp * 0.5) { this.p2 = true; G.darkBoost = 0.08; G.banner('THE LANTERNS GUTTER', 'The Ghost fires twice'); }
    this.st -= dt; this.vx = 0;
    switch (this.state) {
      case 'idle': this.hidden = false; this.alpha = 1; this.aimAt(dt); if (this.st <= 0) { this.state = 'aim'; this.st = this.p2 ? 0.95 : 1.25; this.shotsLeft = this.p2 ? 2 : 1; } break;
      case 'appear':
        this.alpha = 1 - this.st / 0.4; this.aimAt(dt);
        if (this.st <= 0) { this.alpha = 1; this.state = 'aim'; this.st = this.p2 ? 0.95 : 1.25; this.shotsLeft = this.p2 ? 2 : 1; this.dmgSince = 0; }
        break;
      case 'aim': {
        this.f = Math.sign(P.cx - this.cx) || 1;
        if (this.st > 0.25) { this.lockAng = this.aimAt(dt, 14); this.laser = 1; }
        else { if (this.laser === 1) Sound.play('lock', { x: this.cx }); this.laser = 2; }
        if (this.st <= 0) {
          this.single(this.lockAng, 26, 1350, 'erifle'); this.shotsLeft--; this.laser = 0;
          if (this.shotsLeft > 0) { this.st = 0.55; } else { this.state = 'linger'; this.st = 0.5; }
        }
        break;
      }
      case 'linger': this.aimAt(dt); if (this.st <= 0) this.vanish(); break;
      case 'vanish':
        this.alpha = Math.max(0, this.st / 0.35);
        if (this.st <= 0) { this.hidden = true; this.invuln = true; this.state = 'hidden'; this.st = this.p2 ? 0.45 : 0.7; }
        break;
      case 'hidden':
        if (this.st <= 0) {
          const onScreen = p => p.x > G.cam.x + 24 && p.x < G.cam.x + VW - 24; // always appear where the player can see
          const all = G.level.perches || [];
          const perches = all.filter(onScreen).length >= 3 ? all.filter(onScreen) : all;
          const opts = perches.filter(p => Math.abs(p.x - this.cx) > 30 && Math.abs(p.x - P.cx) > 110);
          const pick = choose(opts.length ? opts : perches);
          this.x = pick.x - this.w / 2; this.y = pick.y - this.h; this.vy = 0;
          this.hidden = false; this.invuln = false; this.state = 'appear'; this.st = 0.4; this.alpha = 0;
          smoke(this.cx, this.y + 15, 8, '#d8d8d0');
          this.cycle++;
          if (Math.random() < (this.p2 ? 0.75 : 0.45) && this.cycle > 1) {
            const others = perches.filter(p => p !== pick && Math.abs(p.x - P.cx) > 80);
            for (let i = 0; i < 2 && others.length; i++) {
              const o = others.splice(randi(0, others.length - 1), 1)[0];
              G.enemies.push(new GhostDecoy(o.x, o.y));
            }
          }
        }
        break;
    }
  }
  draw(c, t) {
    super.draw(c, t);
    if (!this.hidden && this.laser) drawLaser(c, this.shoulder(), this.lockAng, this.laser === 2, t);
  }
}

class GhostDecoy extends Enemy {
  constructor(x, y) {
    super('sharp', x, y, { look: 'ghost', spawnT: 0.4 });
    this.decoy = true; this.hp = this.maxHp = 1; this.st = rand(1.1, 1.5); this.alert = true; this.lockAng = 0; this.laser = 1;
  }
  update(dt) {
    this.t += dt;
    if (this.dead) { this.remove = true; return; }
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    const P = G.player, sh = this.shoulder();
    this.f = Math.sign(P.cx - this.cx) || 1;
    this.st -= dt;
    if (this.st > 0.25) { this.lockAng = Math.atan2(P.y + 10 - sh.y, P.cx - sh.x); this.aimAng = this.lockAng; } else this.laser = 2;
    if (this.st <= 0) {
      fireBullet('e', sh.x, sh.y, this.lockAng, 1100, 7 * G.diff.edmg, { range: 900, big: true });
      Sound.play('eshot', { x: this.cx });
      smoke(this.cx, this.y + 15, 8, '#d8d8d0'); this.remove = true;
    }
  }
  kill() { this.dead = true; smoke(this.cx, this.y + 15, 10, '#d8d8d0'); Sound.play('laugh', { x: this.cx }); floatText(this.cx, this.y, 'DECOY', '#d8d8ff', true); }
  draw(c, t) {
    if (this.remove) return;
    c.globalAlpha = (this.spawnT > 0 ? 0.4 : 0.55) + Math.sin(t * 23) * 0.15;
    drawCharacter(c, this.L, this.cx, this.y + this.h, { f: this.f, state: 'idle', aim: this.aimAng, gun: 'rifle', t });
    c.globalAlpha = 1;
    if (this.spawnT <= 0) drawLaser(c, this.shoulder(), this.lockAng, this.laser === 2, t);
  }
}

function drawLaser(c, sh, ang, locked, t) {
  const len = 700;
  c.globalAlpha = locked ? 0.95 : 0.45 + Math.sin(t * 20) * 0.1;
  c.strokeStyle = locked ? '#ffffff' : '#ff3030';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(sh.x + 0.5, sh.y + 0.5);
  // stop the laser at the first wall so it reads honestly
  let ex = sh.x + Math.cos(ang) * len, ey = sh.y + Math.sin(ang) * len, best = 1;
  for (const s of G.solids) { if (s.bullet === false) continue; const tt = segRect(sh.x, sh.y, ex, ey, s); if (tt > 0.02 && tt < best) best = tt; }
  c.lineTo(sh.x + (ex - sh.x) * best + 0.5, sh.y + (ey - sh.y) * best + 0.5);
  c.stroke();
  c.globalAlpha = 1;
}

class IronJack extends Boss {
  constructor(x, y) {
    super('ironjack', x, y);
    this.armorT = 1; this.tankWeak = true; this.headH = 11; this.turnT = 0;
  }
  armorFactor() { return Math.min(1, (this.p2 ? 0.5 : 0.25) + Store.up('ap') * 0.1); }
  next() {
    const P = G.player, adx = Math.abs(P.cx - this.cx), r = Math.random();
    if (r < 0.5) { this.state = 'suppressTell'; this.st = this.p2 ? 0.45 : 0.65; this.tell = this.st; Sound.play('lock', { x: this.cx }); }
    else if (r < 0.8 || adx > 260) { this.state = 'throwTell'; this.st = 0.45; this.tell = 0.45; }
    else { this.state = 'walk'; this.st = 1.3; }
  }
  think(dt) {
    const P = G.player, dx = P.cx - this.cx;
    if (this.tell > 0) this.tell -= dt;
    if (!this.p2 && this.hp < this.maxHp * 0.5) {
      this.p2 = true; G.banner('ARMOR CRACKED', 'Iron Jack is exposed — and furious');
      this.L = Object.assign({}, this.L, { armor: '#5a3e38', armorHi: '#c8603a' });
      this.state = 'vent'; this.st = 1.0; Sound.play('steam', { x: this.cx });
    }
    // slow turning: the tank on his back is exposed while he turns
    const want = Math.sign(dx) || this.f;
    if (want !== this.f) { this.turnT += dt; if (this.turnT > (this.p2 ? 0.45 : 0.75)) { this.f = want; this.turnT = 0; } } else this.turnT = 0;
    this.st -= dt;
    const ang = (() => { const sh = this.shoulder(); return Math.atan2(P.y + 10 - sh.y, P.cx - sh.x); })();
    const facingOk = Math.sign(dx) === this.f;
    if (facingOk) this.aimAng += angDiff(this.aimAng, ang) * Math.min(1, dt * 8);
    switch (this.state) {
      case 'idle': this.vx = approach(this.vx, 0, 600 * dt); if (this.st <= 0) this.next(); break;
      case 'walk': this.vx = approach(this.vx, Math.abs(dx) > 170 ? this.f * 45 : Math.abs(dx) < 100 ? -this.f * 30 : 0, 600 * dt); if (this.st <= 0) this.next(); break;
      case 'suppressTell': this.vx = 0; if (this.st <= 0) { this.state = 'suppress'; this.shots = this.p2 ? 16 : 12; this.fireT = 0; this.sweep = 0.28; } break;
      case 'suppress':
        this.fireT -= dt;
        if (this.fireT <= 0) {
          const a = (facingOk ? ang : this.aimAng) + this.sweep;
          this.aimAng = a; this.single(a, 7, 520, 'gatling'); this.sweep -= 0.56 / (this.p2 ? 16 : 12);
          this.shots--; this.fireT = this.p2 ? 0.075 : 0.1;
          if (this.shots <= 0) { this.state = 'idle'; this.st = this.p2 ? 0.6 : 0.9; }
        }
        break;
      case 'throwTell':
        this.vx = 0;
        if (this.st <= 0) {
          const sh = this.shoulder(), n = this.p2 ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const tx = clamp(P.cx + P.vx * 0.6 + (i - (n - 1) / 2) * 55, G.arena.x0 + 10, G.arena.x1 - 10);
            throwDynamite(sh.x, sh.y - 6, tx, P.y + P.h - 3, clamp(Math.abs(tx - sh.x) / 280, 0.7, 1.2), 1.5);
          }
          this.state = 'idle'; this.st = 0.8;
        }
        break;
      case 'vent':
        this.vx = 0; this.tell = 0.1;
        if ((this.t * 30 | 0) % 2 === 0) smoke(this.cx + rand(-14, 14), this.y + rand(0, this.h), 1, '#f0f0f0');
        if (this.st < 0.6 && !this.ventHit && P.alive && Math.abs(P.cx - this.cx) < 46 && Math.abs(P.y - this.y) < 40) { if (P.hurt(16 * G.diff.edmg, this.cx)) { P.vx = Math.sign(P.cx - this.cx) * 300; this.ventHit = true; } }
        if (this.st <= 0) { this.ventHit = false; this.state = 'idle'; this.st = 0.5; }
        break;
    }
    if (this.p2 && this.state === 'idle' && Math.abs(dx) < 45 && Math.random() < dt * 2) { this.state = 'vent'; this.st = 0.9; Sound.play('steam', { x: this.cx }); }
  }
}

class DevilsHand extends Boss {
  constructor(x, y) { super('devil', x, y); this.phaseN = 1; this.gun = 'devil'; this.dualGuns = true; this.showHits = 0; }
  setPhase(n) {
    this.phaseN = n;
    const ar = G.arena;
    if (n === 2) {
      this.gun = 'rifle'; this.dualGuns = false;
      G.banner('BOYS! KILL HIM!', "The Devil's Hand calls his gang");
      G.spawnAt('outlaw', ar.x0 + 30); G.spawnAt('outlaw', ar.x1 - 30); G.spawnAt('sharp', ar.x1 - 60, ar.highY);
    } else if (n === 3) {
      this.gun = 'shotgun';
      G.banner('NO MORE GAMES', 'He draws the scattergun');
      G.spawnAt('shotgun', ar.x0 + 30); G.spawnAt('dynamite', ar.x1 - 40);
    } else if (n === 4) {
      this.gun = 'devil'; this.dualGuns = false; this.rolling = false; this.laser = 0; this.tell = 0;
      G.startShowdown(this); // sets state 'showIntro'
      return;
    }
    this.state = 'idle'; this.st = 0.8;
  }
  hurt(dmg, info) {
    if (this.phaseN === 4) {
      if (this.state !== 'duel' || this.dead) return;
      this.showHits += info.head ? 3 : 1; this.flash = 0.1;
      Sound.play('bossHurt', { x: this.cx });
      this.hp = this.maxHp * 0.15 * Math.max(0, 1 - this.showHits / 3);
      if (this.showHits >= 3) { this.hp = 0; this.kill(info); }
      return;
    }
    super.hurt(dmg, info);
    if (this.dead) return;
    const frac = this.hp / this.maxHp;
    if (this.phaseN === 1 && frac < 0.7) this.setPhase(2);
    else if (this.phaseN === 2 && frac < 0.4) this.setPhase(3);
    else if (this.phaseN === 3 && frac < 0.15) { this.hp = this.maxHp * 0.15; this.setPhase(4); }
  }
  next() {
    const P = G.player, r = Math.random(), adx = Math.abs(P.cx - this.cx);
    if (this.phaseN === 1) {
      if (r < 0.55) { this.state = 'fanTell'; this.st = 0.5; this.tell = 0.5; }
      else if (r < 0.8) { this.state = 'roll'; this.st = 0.4; this.rollDir = Math.random() < 0.5 ? -1 : 1; this.rolling = true; }
      else { this.state = 'strafe'; this.st = 1.0; this.goalX = clamp(P.cx + rand(-220, 220), G.arena.x0 + 30, G.arena.x1 - 30); }
    } else if (this.phaseN === 2) {
      if (r < 0.55) { this.state = 'aim'; this.st = 0.85; this.shotsLeft = 2; }
      else if (r < 0.85) { this.state = 'throwTell'; this.st = 0.4; this.tell = 0.4; }
      else { this.state = 'strafe'; this.st = 1.0; this.goalX = clamp(P.cx + (Math.random() < 0.5 ? -260 : 260), G.arena.x0 + 30, G.arena.x1 - 30); }
    } else {
      if (adx > 70 && r < 0.6) { this.state = 'dashTell'; this.st = 0.5; this.tell = 0.5; Sound.play('pump', { x: this.cx }); }
      else if (r < 0.85) { this.state = 'pump'; this.st = 0.4; this.tell = 0.4; Sound.play('pump', { x: this.cx }); }
      else { this.state = 'roll'; this.st = 0.4; this.rollDir = -Math.sign(P.cx - this.cx) || 1; this.rolling = true; }
    }
  }
  think(dt) {
    const P = G.player, dx = P.cx - this.cx;
    if (this.tell > 0) this.tell -= dt;
    this.st -= dt;
    if (this.state !== 'roll') this.f = Math.sign(dx) || 1;
    switch (this.state) {
      case 'idle': this.vx = approach(this.vx, 0, 900 * dt); this.aimAt(dt); if (this.st <= 0) this.next(); break;
      case 'strafe': this.aimAt(dt); if (this.walkTo(this.goalX, 110, dt) || this.st <= 0) { this.state = 'idle'; this.st = 0.2; } break;
      case 'roll':
        this.vx = this.rollDir * 300; this.invuln = this.st > 0.08; this.f = this.rollDir;
        if (this.st <= 0) { this.rolling = false; this.invuln = false; this.state = 'idle'; this.st = 0.25; }
        break;
      case 'fanTell': this.vx = 0; this.fanAng = this.aimAt(dt); if (this.st <= 0) { this.state = 'fan'; this.shots = 6; this.fireT = 0; } break;
      case 'fan':
        this.fireT -= dt;
        if (this.fireT <= 0) {
          const k = 6 - this.shots, a = this.fanAng + (k / 5 - 0.5) * 0.6;
          this.aimAng = a; this.single(a, 9, 520, 'eshot'); this.shots--; this.fireT = 0.08;
          if (this.shots <= 0) { this.state = 'idle'; this.st = 0.7; }
        }
        break;
      case 'aim':
        if (this.st > 0.2) { this.lockAng = this.aimAt(dt, 14); this.laser = 1; } else { if (this.laser === 1) Sound.play('lock', { x: this.cx }); this.laser = 2; }
        this.vx = 0;
        if (this.st <= 0) {
          this.single(this.lockAng, 24, 1300); this.laser = 0; this.shotsLeft--;
          if (this.shotsLeft > 0) { this.st = 0.6; } else { this.state = 'idle'; this.st = 0.5; }
        }
        break;
      case 'throwTell':
        this.vx = 0;
        if (this.st <= 0) {
          const sh = this.shoulder();
          for (let i = 0; i < 2; i++) { const tx = clamp(P.cx + P.vx * 0.5 + (i ? 60 : -30), G.arena.x0 + 10, G.arena.x1 - 10); throwDynamite(sh.x, sh.y - 6, tx, P.y + P.h - 3, clamp(Math.abs(tx - sh.x) / 280, 0.7, 1.2), 1.5); }
          this.state = 'idle'; this.st = 0.7;
        }
        break;
      case 'dashTell': this.vx = 0; this.aimAt(dt); if (this.st <= 0) { this.state = 'dash'; this.st = 0.38; this.dashDir = Math.sign(dx) || 1; } break;
      case 'dash':
        this.vx = this.dashDir * 380; this.aimAt(dt);
        if (this.st <= 0 || Math.abs(dx) < 50 || this.hitWall) { this.vx = 0; this.state = 'pump'; this.st = 0.15; this.tell = 0.15; }
        break;
      case 'pump': this.vx = approach(this.vx, 0, 900 * dt); { const a = this.aimAt(dt, 10); if (this.st <= 0) { this.blast(7, 0.3, 8, 480, 300, a); this.state = 'idle'; this.st = 0.8; } } break;
      case 'showIntro': this.vx = 0; this.aimAng = this.f > 0 ? 0.9 : Math.PI - 0.9; break;
      case 'duel': {
        this.walkTo(P.cx - this.f * 90, 14, dt);
        this.aimAt(dt, 6);
        if (this.st <= 0) { this.single(this.aimAng, 18, 330, 'devil'); this.st = 1.1; }
        break;
      }
    }
  }
  draw(c, t) {
    super.draw(c, t);
    if (this.laser && !this.dead) drawLaser(c, this.shoulder(), this.lockAng, this.laser === 2, t);
  }
}
// The Undertaker hides behind a bullet-proof coffin. Shoot it apart, flank him, or fire from above;
// he lowers it to use his coach gun, which is your window.
class Undertaker extends Boss {
  constructor(x, y) {
    super('undertaker', x, y);
    this.headH = 11; this.guard = true; this.turnT = 0; this.raiseCd = 5;
    const hp = 450 * G.diff.bhp;
    const c = this.coffin = { id: -7, x: 0, y: 0, w: 12, h: 36, kind: 'coffin', move: false, hp, maxHp: hp };
    c.onBreak = () => { this.coffin = null; this.enrage('THE COFFIN SPLINTERS'); };
    G.solids.push(c); this.placeCoffin();
  }
  placeCoffin() {
    const c = this.coffin;
    if (!c) return;
    c.y = this.y + this.h - c.h;
    if (this.guard) { c.x = this.f > 0 ? this.x + this.w + 1 : this.x - c.w - 1; delete c.bullet; }
    else { c.x = this.f > 0 ? this.x - c.w + 3 : this.x + this.w - 3; c.bullet = false; }
  }
  dropCoffin() { const c = this.coffin; if (!c) return; this.coffin = null; c.onBreak = null; damageSolid(c, 1e6, false); }
  enrage(msg) {
    if (this.p2 || this.dead) return;
    this.p2 = true; this.dropCoffin();
    G.banner(msg, 'He grabs his shovel', 2); Sound.play('roar', { x: this.cx }); shake(0.5);
    this.L = Object.assign({}, this.L, { coatHi: '#7a1a1a' });
    this.state = 'idle'; this.st = 0.6; this.guard = false;
  }
  hurt(dmg, info) {
    super.hurt(dmg, info);
    if (!this.dead && !this.p2 && this.hp < this.maxHp * 0.5) this.enrage('HE TEARS OFF THE LID');
  }
  kill(info) { this.dropCoffin(); super.kill(info); }
  next() {
    const P = G.player, adx = Math.abs(P.cx - this.cx), r = Math.random();
    const adds = G.enemies.filter(e => !e.dead && !e.boss && !e.remove).length;
    if (this.raiseCd <= 0 && adds < 3 && r < 0.45) {
      this.state = 'raiseTell'; this.st = 0.9; this.tell = 0.9; this.raiseCd = this.p2 ? 8 : 10;
      Sound.play('rise'); floatText(this.cx, this.y - 8, 'RISE!', '#b0ffb0', true);
      return;
    }
    if (this.p2 && adx > 60 && r < 0.75) { this.state = 'shovelTell'; this.st = 0.5; this.tell = 0.5; return; }
    if (adx < 260 ? r < 0.7 : r < 0.35) { this.state = 'blastTell'; this.st = 0.55; this.tell = 0.55; Sound.play('pump', { x: this.cx }); return; }
    this.state = 'advance'; this.st = 1.4;
  }
  raise() {
    const graves = (G.level.graves || []).filter(x => Math.abs(x - G.player.cx) > 120);
    for (let i = 0; i < 2 && graves.length; i++) {
      const x = graves.splice(randi(0, graves.length - 1), 1)[0];
      const e = G.spawnAt(choose(['outlaw', 'outlaw', 'knife']), x);
      e.spawnT = 0.8; dust(x, G.surfaceY(x), 12, '#6a5a4a');
    }
    shake(0.3); Sound.play('rumble', { x: this.cx });
  }
  think(dt) {
    const P = G.player, dx = P.cx - this.cx;
    if (this.tell > 0) this.tell -= dt;
    const want = Math.sign(dx) || this.f;
    if (want !== this.f && this.state !== 'shovel') { this.turnT += dt; if (this.turnT > (this.p2 ? 0.3 : 0.6)) { this.f = want; this.turnT = 0; } } else this.turnT = 0;
    const facing = Math.sign(dx) === this.f;
    if (facing) this.aimAt(dt, 6);
    this.st -= dt; this.raiseCd -= dt;
    switch (this.state) {
      case 'idle': this.guard = !this.p2; this.vx = approach(this.vx, 0, 600 * dt); if (this.st <= 0) this.next(); break;
      case 'advance': this.guard = !this.p2; this.vx = approach(this.vx, Math.abs(dx) > 110 ? this.f * (this.p2 ? 70 : 38) : 0, 600 * dt); if (this.st <= 0) this.next(); break;
      case 'blastTell': this.guard = false; this.vx = 0; if (this.st <= 0) { this.state = 'blast'; this.shots = 2; this.st = 0; } break;
      case 'blast':
        this.vx = 0;
        if (this.st <= 0) {
          this.blast(6, 0.26, 8, 470, 300, facing ? this.aimAt(dt, 30) : this.aimAng);
          this.shots--; this.st = 0.28;
          if (this.shots <= 0) { this.state = 'exposed'; this.st = this.p2 ? 0.6 : 1.1; Sound.play('reload', { x: this.cx }); }
        }
        break;
      case 'exposed': this.guard = false; this.vx = 0; if (this.st <= 0) { this.state = 'idle'; this.st = 0.3; } break;
      case 'raiseTell': this.vx = 0; this.guard = !this.p2; this.aimAng = this.f > 0 ? -1.2 : Math.PI + 1.2; if (this.st <= 0) { this.raise(); this.state = 'idle'; this.st = 0.6; } break;
      case 'shovelTell': this.vx = 0; this.guard = false; if (this.st <= 0) { this.state = 'shovel'; this.st = 0.45; this.dashDir = this.f; this.swingHit = false; Sound.play('swing', { x: this.cx }); } break;
      case 'shovel':
        this.vx = this.dashDir * 360;
        if (!this.swingHit && P.alive && overlap(this, P) && P.hurt(24 * G.diff.edmg, this.cx)) { P.vx = this.dashDir * 320; P.vy = -240; this.swingHit = true; }
        if (this.st <= 0 || this.hitWall) { this.vx = 0; this.state = 'exposed'; this.st = 0.7; }
        break;
    }
    this.placeCoffin();
  }
  draw(c, t) {
    const k = this.coffin;
    if (k && !this.dead && !this.guard) drawCoffin(c, k, t);
    super.draw(c, t);
    if (k && !this.dead && this.guard) drawCoffin(c, k, t);
    if (k && k.hp < k.maxHp) G.overlay.push(c2 => { px(c2, Math.round(k.x) - 2, Math.round(k.y) - 5, 16, 3, '#1a0c08'); px(c2, Math.round(k.x) - 1, Math.round(k.y) - 4, Math.round(14 * k.hp / k.maxHp), 1, '#c89050'); });
  }
}
function drawCoffin(c, k, t) {
  const x = Math.round(k.x), y = Math.round(k.y), w = k.w, h = k.h, dmg = 1 - k.hp / k.maxHp;
  for (let i = 0; i < h; i++) { const ww = i < 9 ? w - 4 + Math.round(i / 2.5) : w - Math.round((i - 9) * 4 / (h - 9)); px(c, x + Math.round((w - ww) / 2), y + i, ww, 1, i === 0 ? '#7a5034' : '#4a2e1e'); }
  px(c, x + 2, y + 2, 1, h - 5, '#6a4430');
  px(c, x + 5, y + 7, 2, 12, '#c8b080'); px(c, x + 3, y + 10, 6, 2, '#c8b080');
  px(c, x + 1, y + 24, 2, 2, '#8a8a96'); px(c, x + w - 3, y + 24, 2, 2, '#8a8a96');
  if (k.hurtT > 0) { k.hurtT -= 1 / 60; c.globalAlpha = 0.5; px(c, x, y, w, h, '#ffffff'); c.globalAlpha = 1; }
  if (dmg > 0.35) { px(c, x + 3, y + 14, 1, 7, '#1a0c06'); px(c, x + 4, y + 20, 3, 1, '#1a0c06'); }
  if (dmg > 0.7) { px(c, x + 8, y + 4, 1, 8, '#1a0c06'); px(c, x + 6, y + 28, 4, 1, '#1a0c06'); }
  void t;
}
const BOSS_CLASSES = { butcher: Butcher, ghost: Ghost, ironjack: IronJack, devil: DevilsHand, undertaker: Undertaker };

// ---------------- wagon ----------------
class Wagon {
  constructor(x, endX) {
    this.w = 58; this.h = 34; this.x = x; this.y = GY - this.h; this.endX = endX;
    this.maxHp = this.hp = 420 / Math.max(0.7, G.diff.edmg); this.dead = false; this.t = 0; this.flash = 0; this.moving = false;
  }
  get cx() { return this.x + this.w / 2; }
  hurt(d) {
    if (this.dead) return;
    this.hp -= d; this.flash = 0.08;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; explode(this.cx, this.y + 20, 40, 0, 60, false); G.fail('The wagon was destroyed.'); }
  }
  update(dt) {
    this.t += dt; if (this.flash > 0) this.flash -= dt;
    const P = G.player;
    const near = Math.abs(P.cx - this.cx) < 260;
    const probe = { x: this.x + this.w, y: this.y + 4, w: 6, h: this.h - 8 };
    for (const s of G.solids) if (s.kind === 'crate' && overlap(probe, s)) damageSolid(s, 999, false); // the team smashes through loose crates
    this.blocker = G.solids.find(s => s.move && overlap(probe, s)) || null;
    this.moving = near && !this.blocker && this.x < this.endX;
    if (this.moving) { this.x += 30 * dt; if ((this.t * 4 | 0) % 2 === 0 && Math.random() < 0.2) dust(this.x + 4, GY, 1); }
  }
  draw(c, t) {
    const x = Math.round(this.x), y = Math.round(this.y), fl = this.flash > 0;
    const mv = this.moving ? t : 0;
    // horse
    const hx = x + this.w + 4, leg = Math.round(Math.sin(mv * 10) * 2);
    px(c, hx, y + 10, 20, 9, fl ? '#fff' : '#6a3e22'); px(c, hx + 16, y + 3, 6, 9, fl ? '#fff' : '#6a3e22'); px(c, hx + 19, y + 2, 5, 4, fl ? '#fff' : '#5a321a');
    px(c, hx + 15, y + 2, 2, 6, '#2a1a10'); px(c, hx - 2, y + 11, 3, 6, '#2a1a10');
    for (const [lx, o] of [[hx + 2, leg], [hx + 6, -leg], [hx + 14, leg], [hx + 18, -leg]]) px(c, lx + o, y + 19, 2, 15, '#4a2a16');
    px(c, x + this.w - 2, y + 16, 8, 1, '#3a2a1a');
    // wagon
    px(c, x, y + 14, this.w, 12, fl ? '#fff' : '#7a4a28'); px(c, x, y + 14, this.w, 2, '#9a6a3a');
    for (let i = 0; i < 14; i++) { const r = Math.floor(Math.sqrt(Math.max(0, 196 - (i - 7) * (i - 7) * 4)) / 1.2); px(c, x + 4 + i * 3.6 | 0, y + 14 - r, 4, r, fl ? '#fff' : (i % 3 ? '#ece0c0' : '#d8c8a0')); }
    for (const wx of [x + 10, x + this.w - 10]) {
      pcircle(c, wx, y + 28, 6, '#3a2414'); pcircle(c, wx, y + 28, 4, '#6a4a2a');
      const a = mv * 6; px(c, Math.round(wx + Math.cos(a) * 3), Math.round(y + 28 + Math.sin(a) * 3), 1, 1, '#2a1a10');
    }
  }
}

// ---------------- hazards ----------------
function updateHazard(h, dt) {
  if (h.boss && !G.bossActive) return;
  h.t -= dt;
  const P = G.player;
  if (h.type === 'rockfall') {
    if (h.t < 1.1 && !h.warned) { h.warned = true; if (Math.abs(P.cx - (h.x + h.w / 2)) < 400) Sound.play('rumble', { x: h.x + h.w / 2 }); }
    if (h.warned && h.t > 0 && Math.random() < dt * 30) part('dust', h.x + rand(0, h.w), h.top + 2, 0, rand(20, 60), 0.6, 1, '#8a7a6a', 120);
    if (h.t <= 0) {
      h.t = h.period + rand(-0.5, 0.5); h.warned = false;
      for (let i = 0; i < 3; i++) G.rocks.push({ x: h.x + rand(6, h.w - 6), y: h.top + 4 + i * -14, vy: 0, dead: false });
    }
  } else if (h.type === 'steam') {
    const cyc = h.period;
    if (h.t <= 0) h.t += cyc;
    const ph = cyc - h.t; // time since cycle start
    h.state = ph < cyc - 1.9 ? 'idle' : ph < cyc - 0.9 ? 'hiss' : 'blast';
    if (h.state === 'hiss' && Math.random() < dt * 20) part('smoke', h.x + rand(-3, 3), h.y, rand(-5, 5), rand(-40, -20), 0.4, 1, '#f0f0f0', 0);
    if (h.state === 'blast') {
      if (!h.sounded) { h.sounded = true; Sound.play('steam', { x: h.x }); }
      if (Math.random() < dt * 60) part('smoke', h.x + rand(-6, 6), h.y, rand(-10, 10), rand(-260, -160), 0.45, rand(2, 4), '#f4f4f4', 0);
      const col = { x: h.x - 8, y: h.y - 90, w: 16, h: 90 };
      if (P.alive && overlap(P, col) && !h.hitDone) { if (P.hurt(14 * G.diff.edmg, h.x)) { P.vy = -300; h.hitDone = true; } }
      for (const e of G.enemies) if (!e.dead && !e.boss && overlap(e, col)) e.hurt(40 * dt, { kx: 0 });
    } else { h.sounded = false; h.hitDone = false; }
  } else if (h.type === 'fire') {
    if (Math.random() < dt * 12) part('fire', h.x + rand(0, h.w), h.y, rand(-8, 8), rand(-60, -30), 0.45, rand(2, 3), choose(['#ffd060', '#ff8a30', '#ff5a20']), -20);
    const box = { x: h.x, y: h.y - 14, w: h.w, h: 14 };
    if (P.alive && overlap(P, box)) { if (P.hurt(10 * G.diff.edmg, h.x + h.w / 2)) P.vy = -260; }
  }
}
function updateRock(r, dt) {
  r.vy += GRAV * 0.8 * dt; r.y += r.vy * dt;
  const P = G.player, box = { x: r.x - 4, y: r.y - 4, w: 8, h: 8 };
  if (P.alive && overlap(P, box)) { P.hurt(18 * G.diff.edmg, r.x); r.dead = true; }
  for (const e of G.enemies) if (!e.dead && overlap(e, box)) { e.hurt(45, { kx: 0 }); r.dead = true; }
  const s = pointSolid(r.x, r.y + 4);
  if (s || r.y > VH) { r.dead = true; }
  if (r.dead) { Sound.play('rock', { x: r.x }); for (let i = 0; i < 6; i++) part('debris', r.x, r.y, rand(-90, 90), rand(-160, -40), rand(0.4, 0.7), 2, '#6a5a4a', 700).bounce = 1; dust(r.x, r.y, 4, '#8a7a6a'); }
}

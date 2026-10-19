'use strict';
// Developer helpers, loaded with index.html?dev. Use from the browser console.
//   dev.go('m3', 2000)   start a mission with every weapon, teleported to x=2000 (invulnerable)
//   dev.boss('ghost')    jump straight into a boss fight
//   dev.sim(2)           advance the simulation 2 seconds instantly
const dev = {
  step(n) { for (let i = 0; i < n; i++) { Input.beginTick(); Game.update(DT); } },
  sim(s) { dev.step(Math.round(s / DT)); },
  go(id, x, secs) {
    Store.newGame(); Store.save.owned = [...WEAPON_ORDER]; Store.save.loadout = ['revolver', 'rifle', 'shotgun', 'dual'];
    Game.startMission(id); dev.sim(0.1);
    const w = G, P = w.player;
    for (const v of w.waves) if (v.at < x - 50) v.fired = v.done = true;
    P.x = x - 6; P.y = w.surfaceY(x) - P.h - 1; P.vy = 0; P.iframes = 999;
    dev.sim(secs || 1.5); P.iframes = 999;
    return w.stageText();
  },
  boss(id, secs) {
    const m = MISSIONS.find(m => m.boss === id);
    dev.go(m.id, 100, 0.1);
    const w = G, si = w.stages.findIndex(s => s.type === 'boss'), st = w.stages[si], P = w.player;
    w.si = si; for (const v of w.waves) v.fired = v.done = true;
    P.x = st.at + 10; P.y = w.surfaceY(st.at + 10) - P.h - 1;
    dev.sim(secs || 3.5); P.iframes = 999;
    return w.boss.state;
  },
  // Simple autoplayer used for balance checks: dev.bot('m2', 600) -> {state, deaths, minHp, acc...}
  bot(id, maxT, opts = {}) {
    Store.newGame();
    if (opts.diff) Store.save.difficulty = opts.diff;
    if (opts.upg) Object.assign(Store.save.upgrades, opts.upg);
    if (opts.load) { Store.save.owned = [...new Set(['revolver', ...opts.load])]; Store.save.loadout = [...opts.load, null, null, null].slice(0, 4); }
    Game.startMission(id);
    let deaths = 0, t = 0, minHp = 999, jumpHold = 0, stuck = 0, lastX = 0;
    while (t < maxT) {
      if (Game.state === 'dead') { deaths++; Game.respawn(); continue; }
      if (Game.state !== 'play') break;
      const w = G, P = w.player, s = w.stages[w.si];
      Input.down.clear();
      const sh = P.shoulder();
      const vis = w.enemies.filter(e => !e.dead && !e.hidden && e.spawnT <= 0 && Math.abs(e.cx - P.cx) < 420 && !e.decoy && !e.fleeing && losClear(sh.x, sh.y, e.cx, e.y + 10))
        .sort((a, b) => Math.abs(a.cx - P.cx) - Math.abs(b.cx - P.cx));
      let move = 0, jump = false;
      if (vis.length) {
        const e = vis[0], err = opts.err || 5;
        Input.mouse.x = e.cx - w.cam.x + (Math.random() * 2 - 1) * err;
        Input.mouse.y = e.y + (opts.body ? 16 : 4) - w.cam.y + (Math.random() * 2 - 1) * err;
        if (P.fireT <= 0) Input.buf.add('shoot');
        if (P.de > 60 && !P.deActive && vis.length >= 3) Input.buf.add('deadeye');
        for (const b of w.bullets.list) if (b.team === 'e' && Math.abs(b.x - P.cx) < 70 && Math.sign(P.cx - b.x) === Math.sign(b.vx) && Math.random() < (opts.dodge || 0.12) && groundAhead(P, P.f, 30) && pointSolid(P.cx + P.f * 100, P.y + P.h + 2)) Input.buf.add('dodge');
        if (Math.abs(e.cx - P.cx) > 300) move = e.cx > P.cx ? 1 : -1;
        if (e.y + e.h < P.y - 20 && Math.abs(e.cx - P.cx) < 60) jump = true;
      } else {
        Input.mouse.x = VW * 0.8; Input.mouse.y = 250; move = 1;
        // walk to a point, climbing up or dropping through one-way floors as needed
        const goTo = (tx, ty) => {
          const feet = P.y + P.h, dx = tx - P.cx;
          move = Math.abs(dx) < 8 ? 0 : Math.sign(dx);
          if (ty < feet - 20 && Math.abs(dx) < 40) { jump = true; if (!move) move = 0; }
          if (ty > feet + 20 && Math.abs(dx) < 24 && P.onGround && P.ground && P.ground.oneway) { Input.down.add('KeyS'); Input.buf.add('jump'); }
          if (!move && Math.abs(ty - feet) < 30) Input.buf.add('interact');
        };
        if (s && s.type === 'collect') { const g = w.picks.find(p => p.type === 'gold'); if (g) goTo(g.x, g.y); }
        if (s && s.type === 'interact') { const lv = w.deco.find(d => d.lever === s.id); if (lv) goTo(lv.x, lv.y || GY); }
        if (s && s.type === 'wagon') {
          const W = w.wagon;
          if (W.blocker) { Input.mouse.x = W.blocker.x - w.cam.x + 4; Input.mouse.y = W.blocker.y + 10 - w.cam.y; if (P.fireT <= 0) Input.buf.add('shoot'); move = P.cx < W.x + 30 ? 1 : 0; }
          else move = P.cx > W.cx + 160 ? -1 : P.cx > W.cx + 100 ? 0 : 1;
        }
        if (s && s.type === 'break') { const b = w.solids.find(o => o.kind === 'bottle'); if (b) { Input.mouse.x = b.x - w.cam.x + 1; Input.mouse.y = b.y + 3 - w.cam.y; if (P.fireT <= 0) Input.buf.add('shoot'); move = b.x - P.cx > 150 ? 1 : 0; } }
        const door = w.solids.find(o => o.kind === 'door' && Math.abs(o.x - P.cx) < 30); if (door) Input.buf.add('interact');
      }
      if (P.hitWall && P.onGround && move) jump = true;
      if (move && P.onGround && !groundAhead(P, move, 30)) jump = true; // gaps
      if (Math.abs(P.x - lastX) < 0.01 && move) { if (++stuck > 90) { jump = true; stuck = 0; } } else stuck = 0;
      lastX = P.x;
      if (jump && P.onGround) { Input.buf.add('jump'); jumpHold = 24; }
      if (jumpHold > 0 && !move && !P.onGround) move = 1;
      if (jumpHold-- > 0) Input.down.add('Space');
      if (move > 0) Input.down.add('KeyD'); else if (move < 0) Input.down.add('KeyA');
      if (Input.down.has('KeyS') && !Input.buf.has('jump')) Input.down.delete('KeyS'); // only crouch while dropping
      if (P.alive && P.ammo[P.wid].mag === 0) Input.buf.add('reload');
      Input.beginTick(); Game.update(DT); t += DT;
      if (G && G.player.alive) minHp = Math.min(minHp, G.player.hp);
    }
    const w = G;
    const out = { id, state: Game.state, deaths, t: Math.round(t), minHp: Math.round(minHp), stage: w ? w.si + '/' + w.stages.length + ' ' + w.stageText() : '', acc: w ? Math.round(100 * w.stats.hits / Math.max(1, w.stats.shots)) : 0 };
    Input.down.clear();
    return out;
  },
  // Enlarge a region of the internal pixel buffer to inspect sprites.
  peek(gx, gy, gw, gh) {
    let c = document.getElementById('peek');
    if (!c) { c = document.createElement('canvas'); c.id = 'peek'; c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:99;image-rendering:pixelated;background:#000;object-fit:contain'; c.onclick = () => c.remove(); document.body.appendChild(c); }
    c.width = gw; c.height = gh; c.getContext('2d').drawImage(Game.buf, gx, gy, gw, gh, 0, 0, gw, gh);
  },
};
window.dev = dev;

'use strict';
// Automated self-test. Open index.html?selftest — results print to the console and an on-screen panel.
// It drives the real game code with simulated input and an autopilot that plays every mission.
(async function selftest() {
  const results = [];
  const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info || '' }); if (!cond) console.error('FAIL', name, info || ''); };
  const W = () => G;
  const step = n => { for (let i = 0; i < n; i++) { Input.beginTick(); Game.update(DT); } };
  const sim = s => step(Math.round(s / DT));
  const tp = x => { const P = W().player; P.x = x - P.w / 2; P.y = W().surfaceY(x) - P.h - 1; P.vx = 0; P.vy = 0; P.lastSafe = { x: P.x, y: P.y }; };
  const god = () => { const P = W().player; P.iframes = 99; P.hp = P.maxHp; };
  const aim = (x, y) => { Input.usingPad = false; Input.mouse.x = x - W().cam.x; Input.mouse.y = y - W().cam.y; };
  const press = a => Input.buf.add(a);
  const killAll = () => { for (const e of W().enemies) if (!e.dead && !e.boss) e.hurt(1e6, { byPlayer: true, kx: 0 }); };
  const realSave = localStorage.getItem(SAVE_KEY), realSettings = localStorage.getItem(SETTINGS_KEY);
  let errors = 0;
  window.addEventListener('error', () => errors++);

  try {
    // ---------- save system ----------
    localStorage.setItem(SAVE_KEY, '{not json');
    Store.load();
    ok('corrupt save recovers to defaults', Store.save.cash === 0 && Store.save.owned.includes('revolver') && Store.warning);
    const junk = validateSave({ cash: -50, owned: ['nope', 'rifle'], loadout: ['rifle', 'rifle', 'x'], upgrades: { dmg: 99, bad: 3 }, completed: { m1: true, zz: true }, skin: 'legend' });
    ok('validateSave sanitizes', junk.cash === 0 && junk.owned.join() === 'revolver,rifle' && junk.loadout.filter(Boolean).join() === 'rifle' && junk.upgrades.dmg === 5 && !junk.upgrades.bad && junk.unlocked.includes('m2') && junk.skin === 'walnut');
    Store.newGame(); Store.save.cash = 1234; Store.commit(); Store.load();
    ok('save round-trip', Store.save.cash === 1234 && Store.save.started);

    // ---------- core controls ----------
    Store.newGame();
    Game.startMission('m1'); sim(0.5);
    let P = W().player;
    ok('mission starts, player grounded', Game.state === 'play' && P.onGround && P.alive);
    const x0 = P.x; Input.down.add('KeyD'); sim(1); Input.down.delete('KeyD');
    ok('player moves right', P.x > x0 + 80, P.x - x0);
    press('jump'); step(1); ok('jump launches', P.vy < 0); sim(1.2); ok('lands again', P.onGround);
    // shoot bottles
    for (const b of W().solids.filter(s => s.kind === 'bottle')) { tp(b.x - 120); sim(0.1); aim(b.x + 1, b.y + 3); sim(0.05); press('shoot'); sim(0.4); }
    ok('bottles shot by aiming + clicking', (W().counters.bottle || 0) === 3, W().counters.bottle);
    ok('bottle stage completes', W().si >= 1);
    const a = P.ammo.revolver; const magBefore = a.mag;
    aim(P.cx + 200, P.y); press('shoot'); sim(0.3);
    ok('firing uses ammo', a.mag === magBefore - 1);
    press('reload'); sim(2); ok('reload refills', a.mag === P.ws.mag);
    press('dodge'); step(2); ok('dodge gives i-frames', P.rollT > 0 && P.iframes > 0); sim(1);
    Input.down.add('KeyS'); sim(0.2); ok('crouch shrinks hitbox', P.crouch && P.h === P.HC); Input.down.delete('KeyS'); sim(0.2); ok('stand up', !P.crouch && P.h === P.H);

    // ---------- weapons & headshots ----------
    Store.save.owned = [...WEAPON_ORDER]; Store.save.loadout = ['revolver', 'rifle', 'shotgun', 'dual'];
    Game.startMission('m1'); sim(0.3); P = W().player;
    for (const v of W().waves) v.fired = v.done = true;
    const dummyTest = (slot, head, dist) => {
      tp(1550); sim(0.2);
      const e = W().spawnAt('outlaw', P.cx + (dist || 150)); e.spawnT = 0; e.alert = false; e.hp = e.maxHp = 1e5; e.atkT = 99; e.guard = true; e.think = () => {};
      sim(0.1);
      P.switchTo(slot); sim(0.6);
      const sh = P.shoulder();
      aim(e.cx, head ? e.y + 3 : e.y + 20);
      const hp0 = e.hp, bullets0 = W().bullets.list.length;
      press('shoot'); step(1);
      const spawned = W().bullets.list.length - bullets0;
      sim(0.5);
      const dmg = hp0 - e.hp; e.remove = true; sim(0.05);
      void sh;
      return { dmg, spawned };
    };
    const rb = dummyTest(0, false), rh = dummyTest(0, true);
    ok('revolver body hit', rb.dmg > 20, rb.dmg);
    ok('headshot deals far more', rh.dmg > rb.dmg * 1.8, rh.dmg + ' vs ' + rb.dmg);
    const sg = dummyTest(2, false, 60), sgFar = dummyTest(2, false, 230);
    ok('shotgun fires 8 pellets', sg.spawned === 8, sg.spawned);
    ok('shotgun damage falls off with distance', sg.dmg > sgFar.dmg * 1.5, sg.dmg + ' vs ' + sgFar.dmg);
    const rf = dummyTest(1, false);
    ok('rifle hits harder than revolver', rf.dmg > rb.dmg * 1.6, rf.dmg);
    P.switchTo(3); sim(0.5); tp(1550); aim(P.cx + 300, P.y + 5);
    const m0 = P.ammo.dual.mag; Input.mouse.b[0] = true; sim(0.5); Input.mouse.b[0] = false;
    ok('duals are full-auto', m0 - P.ammo.dual.mag >= 4, m0 - P.ammo.dual.mag);
    ok('duals spread grows when held', P.heat > 0.03, P.heat);
    sim(2);
    // sharpshooter pierce
    P.slots[3] = 'sharp'; P.ammo.sharp = { mag: 4, reserve: 20 }; P.switchTo(3); sim(0.6); tp(1550);
    const e1 = W().spawnAt('outlaw', P.cx + 120), e2 = W().spawnAt('outlaw', P.cx + 160);
    for (const e of [e1, e2]) { e.spawnT = 0; e.think = () => {}; e.hp = e.maxHp = 1000; }
    sim(0.1); aim(e2.cx + 40, e1.y + 18); press('shoot'); sim(0.4);
    ok('sharpshooter penetrates enemies', e1.hp < 1000 && e2.hp < 1000);
    e1.remove = e2.remove = true;
    // walls block bullets
    tp(1550); sim(0.2);
    W().solids.push({ id: 999, x: P.cx + 60, y: 150, w: 10, h: 150, kind: 'wood', move: true });
    const hid = W().spawnAt('outlaw', P.cx + 120); hid.spawnT = 0; hid.think = () => {}; sim(0.2);
    P.switchTo(0); sim(0.4); aim(hid.cx, hid.y + 20); const hh = hid.hp; press('shoot'); sim(0.4);
    ok('walls stop bullets', hid.hp === hh);
    W().solids.pop(); hid.remove = true;

    // ---------- new weapons ----------
    const equip = id => { P.slots[3] = id; P.ammo[id] = { mag: W().pstats.weapons[id].mag, reserve: 99 }; P.cur = 0; P.switchTo(3); sim(0.8); tp(1550); sim(0.2); };
    const dummy = (dx, hp) => { const e = W().spawnAt('outlaw', P.cx + dx); e.spawnT = 0; e.think = () => {}; e.hp = e.maxHp = hp || 1e5; sim(0.1); return e; };
    equip('volcanic'); { const e = dummy(150); aim(e.cx, e.y + 20); const n0 = W().stats.shots; press('shoot'); sim(0.5); ok('volcanic fires 3-round bursts per click', W().stats.shots - n0 === 3, W().stats.shots - n0); e.remove = true; }
    equip('bow'); {
      const e = dummy(200); aim(e.cx, e.y + 4);
      Input.mouse.b[0] = true; step(3); Input.mouse.b[0] = false; step(1);
      const weak = W().bullets.list.find(b => b.arrow); const weakDmg = weak ? weak.dmg : 0; sim(1);
      ok('bow arrows are affected by gravity', weak && weak.grav > 0);
      sim(0.5); Input.mouse.b[0] = true; sim(0.9); ok('bow draws to full', P.drawT >= W().pstats.weapons.bow.charge - 0.01); Input.mouse.b[0] = false; step(1);
      const strong = W().bullets.list.find(b => b.arrow);
      ok('full draw hits much harder than a tap', strong && strong.dmg > weakDmg * 2, weakDmg + ' -> ' + (strong && strong.dmg));
      sim(1); e.remove = true;
    }
    { // silent kill: one guard dies, the other never notices
      for (const v of W().waves) v.fired = v.done = true;
      const g1 = W().spawnAt('outlaw', P.cx + 200), g2 = W().spawnAt('outlaw', P.cx + 300);
      for (const g of [g1, g2]) { g.alert = false; g.spawnT = 0; g.think = () => {}; }
      P.ammo.bow.mag = 1; sim(0.5); aim(g1.cx, g1.y + 3); Input.mouse.b[0] = true; sim(0.9); Input.mouse.b[0] = false; sim(1);
      ok('silent bow kill leaves the other guard unaware', g1.dead && !g2.alert, `dead=${g1.dead} alert2=${g2.alert}`);
      g1.remove = g2.remove = true;
    }
    equip('boom'); {
      const es = [dummy(140, 50), dummy(160, 50), dummy(180, 50)];
      aim(es[1].cx, es[1].y - 25); press('shoot'); sim(1.2); // lobbed: aim above, the arc drops onto them
      ok('boomstick blast kills a cluster', es.every(e => e.dead), es.map(e => Math.round(e.hp)).join(','));
    }
    equip('gatling'); {
      const e = dummy(200); aim(e.cx, e.y + 20); const n0 = W().stats.shots;
      Input.mouse.b[0] = true; sim(0.3); const early = W().stats.shots - n0; sim(1.2); Input.mouse.b[0] = false;
      ok('gatling must spin up before firing', early === 0 && W().stats.shots - n0 > 12, early + ' then ' + (W().stats.shots - n0));
      e.remove = true; sim(0.5);
    }
    P.switchTo(0); sim(0.3);

    // ---------- Dead Eye ----------
    P.de = W().pstats.deCap; press('deadeye'); step(2);
    ok('dead eye activates & slows world', P.deActive && W().ts < 0.5, W().ts);
    const de0 = P.de; sim(1); ok('meter drains', P.de < de0 - 10);
    press('deadeye'); step(2); ok('dead eye toggles off', !P.deActive && W().ts === 1);
    const deBefore = P.de; const k = W().spawnAt('outlaw', P.cx + 100); k.spawnT = 0; sim(0.1); k.hurt(1e5, { byPlayer: true, kx: 1 }); sim(0.1);
    ok('kills recharge dead eye', P.de > deBefore);
    ok('kills drop cash', W().picks.some(p => p.type === 'cash'));

    // ---------- enemy AI ----------
    Game.startMission('m1'); sim(0.3); P = W().player; tp(300);
    for (const t of ['outlaw', 'shotgun', 'sharp', 'dynamite', 'enforcer', 'knife']) {
      tp(300); P.hp = P.maxHp; P.iframes = 0;
      const e = W().spawnAt(t, t === 'shotgun' ? 420 : t === 'sharp' ? 650 : 520); sim(0.1);
      const hp0 = P.hp; let t0 = 0;
      while (t0 < 9 && P.hp === hp0) { sim(0.25); t0 += 0.25; P.iframes = 0; }
      ok(`${t} detects & damages player`, P.hp < hp0, `${t0}s`);
      while (e.rollT > 0) step(1); // rolls are untouchable by design
      e.hurt(1e6, { byPlayer: true, kx: 0 }); sim(0.2);
      ok(`${t} can die`, e.dead);
      P.hp = P.maxHp;
    }
    const enf = W().spawnAt('enforcer', 600); enf.spawnT = 0; enf.think = () => {}; sim(0.1);
    const fakeB = (head) => ({ dmg: 50, vx: 1, vy: 0, falloff: false, crit: false, headMult: 2, knock: 0, shot: 9e9, dist: 10 });
    const R = Math.random; Math.random = () => 0.99; // no random crits
    const hpA = enf.hp; damageEnemy(enf, fakeB(), false, 0, 0); const body = hpA - enf.hp;
    const hpB = enf.hp; damageEnemy(enf, fakeB(), true, 0, 0); const head = hpB - enf.hp;
    Math.random = R;
    ok('enforcer armor reduces body damage, head is weak point', body < 30 && head > 80, body + ' / ' + head);
    enf.remove = true;

    // knife thrower dodges an aimed gun
    { const k = W().spawnAt('knife', P.cx + 200); k.spawnT = 0; let rolled = false; for (let i = 0; i < 300 && !rolled; i++) { aim(k.cx, k.y + 12); step(1); rolled = k.rollT > 0; P.hp = P.maxHp; } ok('knife thrower rolls away from your aim', rolled); k.remove = true; }
    // Undertaker's coffin blocks frontal fire
    {
      Game.startMission('m7'); sim(0.2); P = W().player; const w = W();
      w.si = w.stages.findIndex(s => s.type === 'boss'); for (const v of w.waves) v.fired = v.done = true;
      tp(2600); sim(3.2); tp(3100); sim(0.3); const b = w.boss; b.think = function () { this.guard = true; this.f = -1; this.placeCoffin(); };
      sim(0.2); aim(b.cx, b.y + 18); const hp0 = b.hp, c0 = b.coffin.hp; press('shoot'); sim(0.6);
      ok('Undertaker coffin soaks frontal shots', b.hp === hp0 && b.coffin.hp < c0, `boss ${hp0}->${b.hp} coffin ${c0}->${b.coffin.hp}`);
    }

    // survival stages must never trip a hidden time limit (regression: Hard used to fail them)
    {
      Store.save.difficulty = 'hard'; Game.startMission('m5'); sim(0.2); const w = W();
      w.si = w.stages.findIndex(s => s.type === 'survive'); for (const v of w.waves) v.fired = v.done = true;
      tp((w.level.arena.x0 + w.level.arena.x1) / 2);
      for (let i = 0; i < 400 && w.state === 'play' && w.si < w.stages.length && w.stages[w.si].type === 'survive'; i++) { god(); killAll(); sim(0.25); }
      ok('survival on Hard ends by surviving, not by a timer', w.state !== 'failed' && w.timeLeft == null, w.failReason || '');
      Store.save.difficulty = 'normal';
    }

    // ---------- death & checkpoint respawn ----------
    Game.startMission('m1'); sim(0.2); P = W().player;
    tp(1400); sim(0.5);
    ok('checkpoint activates', W().cps[0].active && Game.run.snap);
    P.iframes = 0; P.hurt(1e4, 0); sim(2.5);
    ok('death shows died screen', Game.state === 'dead' && UI.cur === 'died');
    Game.respawn(); sim(0.3); P = W().player;
    ok('respawn at checkpoint', P.alive && Math.abs(P.cx - 1360) < 30 && W().waveById.w1.done, P.cx);

    // ---------- pause ----------
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
    ok('Escape opens pause menu', Game.state === 'pause' && UI.cur === 'pause');
    const tPause = W().time; await new Promise(r => setTimeout(r, 400));
    ok('pause freezes simulation', W().time === tPause);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
    ok('Escape resumes', Game.state === 'play' && !UI.cur);

    // ---------- every mission completes via autopilot ----------
    for (const m of MISSIONS) {
      Store.newGame(); Store.save.difficulty = 'normal';
      Game.startMission(m.id); sim(0.2);
      const w = W(); let guard = 0, err = null;
      try {
        while (w.state === 'play' && guard++ < 6000) {
          god();
          const s = w.stages[w.si];
          if (!s) break;
          killAll();
          switch (s.type) {
            case 'break': for (const b of w.solids.filter(o => o.kind === 'bottle')) damageSolid(b, 99, true); break;
            case 'clear': case 'eliminate': {
              const next = w.waves.find(v => !v.fired && (s.type === 'eliminate' || s.waves.includes(v.id)));
              if (next) tp(Math.min(next.at + 5, w.width - 20));
              break;
            }
            case 'reach': tp(Math.min(s.x + 5, w.width - 20)); break;
            case 'collect': {
              const g = w.picks.find(p => p.type === 'gold');
              if (g) { const wv = w.waves.find(v => !v.fired && v.at <= g.x + 50); if (wv) tp(wv.at + 2); else { tp(g.x); w.player.y = g.y - w.player.h; w.player.vy = 0; press('interact'); } }
              break;
            }
            case 'boss':
              if (!s.spawned) tp(s.at + 5);
              else { const b = w.boss; if (!b.dead && b.introT <= 0 && !b.hidden && !b.invuln && b.state !== 'showIntro') b.hurt(b.phaseN === 4 ? 1 : b.maxHp * 0.06, { byPlayer: true, kx: 0, head: true }); }
              break;
            case 'wagon': {
              const wg = w.wagon; tp(wg.x + 80); if (wg.blocker && wg.blocker.hp != null) damageSolid(wg.blocker, 999, true);
              for (const v of w.waves) if (!v.fired && v.at < wg.x + 200) v.fired = true, v.done = true;
              break;
            }
            case 'survive': tp((w.arena.x0 + w.arena.x1) / 2); break;
            case 'interact': { const lv = w.deco.find(d => d.lever === s.id); tp(lv.x); w.player.y = lv.y - w.player.h; w.player.vy = 0; press('interact'); break; }
          }
          sim(0.25);
        }
      } catch (e) { err = e; console.error(e); }
      sim(2.6);
      ok(`mission ${m.id} "${m.name}" completes`, !err && Game.state === 'complete' && UI.cur === 'results', err ? err.message : `state=${Game.state} stage=${w.si}/${w.stages.length} ${w.stageText()}`);
      if (m.boss) ok(`boss ${m.boss} defeated`, w.boss && w.boss.dead);
      const cash = Store.save.cash; Game.grantRewards();
      ok(`${m.id} rewards granted once`, Store.save.cash === cash && Store.save.completed[m.id]);
    }
    ok('final victory grants legendary weapon', Store.save.finalBeat === false || Store.save.owned.includes('devil'));
    Store.newGame(); Game.startMission('m6'); { const w = W(); w.si = 1; Game.run.time = 1; w.complete(); sim(2.6); }
    ok('beating the Devil unlocks Devil\'s Due + legendary skin', Store.save.finalBeat && Store.save.owned.includes('devil'));
    // replays pay less
    Store.newGame(); Game.startMission('m1'); W().complete(); sim(2.6); const first = Game.run.result.lines[0][1];
    Game.startMission('m1'); W().complete(); sim(2.6); const second = Game.run.result.lines[0][1];
    ok('replay bounty is reduced', second < first, first + ' -> ' + second);
    Game.quitToMenu();

    // ---------- shop & upgrades ----------
    Store.newGame(); Store.save.cash = 100; UI.show('shop');
    UI.buyWeapon('rifle'); ok('locked weapon cannot be bought', !Store.save.owned.includes('rifle'));
    Store.save.completed.m1 = true; UI.buyWeapon('rifle'); ok('insufficient cash blocks purchase', !Store.save.owned.includes('rifle') && Store.save.cash === 100);
    Store.save.cash = 5000; UI.buyWeapon('rifle'); ok('weapon purchase works & auto-equips', Store.save.owned.includes('rifle') && Store.save.cash === 4550 && Store.save.loadout.includes('rifle'));
    UI.upgradeWeapon('rifle'); ok('weapon upgrade', Store.save.weaponLv.rifle === 1);
    UI.buyUpgrade('dmg'); ok('character upgrade', Store.up('dmg') === 1);
    const c0 = Store.save.cash; UI.buySkin('gold'); ok('skin purchase equips', Store.save.skin === 'gold' && Store.save.cash === c0 - 900);
    UI.buySkin('legend'); ok('legendary skin locked until final boss', !Store.save.skins.includes('legend'));
    ok('upgrades raise stats', computeStats('normal').weapons.revolver.dmg > WEAPONS.revolver.dmg);
    Store.load(); ok('purchases persisted', Store.save.owned.includes('rifle') && Store.save.skin === 'gold');

    // ---------- settings & rebinding ----------
    Store.settings = defaultSettings();
    UI.rebind('reload:0'); Input.capture('KeyE');
    ok('rebind conflict swaps keys with warning', Store.settings.keys.reload[0] === 'KeyE' && Store.settings.keys.interact[0] === 'KeyR' && UI.notice.includes('⚠'));
    Store.settings = defaultSettings(); Store.commitSettings();
    ok('settings persisted', JSON.parse(localStorage.getItem(SETTINGS_KEY)).keys.reload[0] === 'KeyR');

    // ---------- stress: repeated transitions ----------
    for (let i = 0; i < 12; i++) { Game.startMission(choose(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'b4'])); sim(0.5); W().player.hurt(1e4, 0); sim(2.2); Game.respawn(); sim(0.3); Game.quitToMenu(); }
    ok('repeated deaths/restarts/transitions stable', Game.state === 'menu' && errors === 0, 'errors=' + errors);
  } catch (e) {
    ok('selftest crashed', false, e.stack);
  }

  // restore user's data
  if (realSave == null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, realSave);
  if (realSettings == null) localStorage.removeItem(SETTINGS_KEY); else localStorage.setItem(SETTINGS_KEY, realSettings);
  Store.load(); Game.quitToMenu(); UI.show('main');
  const failed = results.filter(r => !r.pass);
  window.SELFTEST = { passed: results.length - failed.length, failed: failed.length, results };
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;right:8px;top:8px;max-height:90vh;overflow:auto;z-index:100;background:#000d;color:#cfc;padding:8px;font:14px monospace';
  box.textContent = `SELFTEST ${results.length - failed.length}/${results.length} passed\n` + results.map(r => `${r.pass ? 'ok  ' : 'FAIL'} ${r.name} ${r.pass ? '' : r.info}`).join('\n');
  document.body.appendChild(box);
  console.log(box.textContent);
})();

'use strict';
// Level builders. Each returns fresh data so a level can be rebuilt for checkpoint respawns.

function LB(theme, width) {
  let nid = 1;
  const L = {
    theme, width, solids: [], plats: [], deco: [], fg: [], waves: [], cps: [], picks: [], hazards: [], stages: [],
    perches: [], arena: null, spawnX: 40, tumble: theme !== 'mine', levers: [],
  };
  const S = o => { o.id = nid++; o.move = o.move !== false; L.solids.push(o); return o; };
  Object.assign(L, {
    ground(x0, x1, y = GY, kind = 'ground') { return S({ x: x0, y, w: x1 - x0, h: VH + 40 - y, kind }); },
    crate(x, n = 1, base = GY, w = 20) { for (let i = 0; i < n; i++) S({ x, y: base - 20 * (i + 1), w, h: 20, kind: 'crate', hp: 140 }); },
    barrel(x, base = GY) { S({ x, y: base - 18, w: 12, h: 18, kind: 'barrel', hp: 15 }); },
    cart(x, base = GY) { S({ x, y: base - 16, w: 24, h: 16, kind: 'cart' }); },
    wall(x, y, w, h, kind = 'wood') { return S({ x, y, w, h, kind }); },
    boards(x, y, w, h, secret) { return S({ x, y, w, h, kind: 'boards', hp: 60, secret: !!secret }); },
    door(x, base = GY, h = 34) { return S({ x, y: base - h, w: 8, h, kind: 'door', interact: true }); },
    gate(x, waves, base = GY, h = 110) { return S({ x, y: base - h, w: 10, h, kind: 'gate', waves }); },
    bottle(x, y) { S({ x: x - 1, y: y - 7, w: 5, h: 7, kind: 'bottle', hp: 1, move: false }); },
    car(x, w, variant, top) { return S({ x, y: top, w, h: 300 - top, kind: 'car', variant }); },
    plat(x, y, w, o = {}) { const p = Object.assign({ id: nid++, x, y, w, h: 4, oneway: true }, o); L.plats.push(p); return p; },
    wave(id, at, spawns, o = {}) { L.waves.push(Object.assign({ id, at, spawns }, o)); },
    cp(x) { L.cps.push(x); },
    pick(type, x, y = GY, amount) { L.picks.push({ id: nid++, type, x, y, amount }); },
    box(x, y = GY) { L.picks.push({ id: nid++, type: 'gold', x, y, box: true }); },
    stone(x, y, w, h) { return S({ x, y, w, h, kind: 'stone' }); },
    pier(x0, x1, y = 290) { return S({ x: x0, y, w: x1 - x0, h: VH + 40 - y, kind: 'pier' }); },
    room(x, base = GY, top = 240) { // small locked cabin: door on the left, solid wall on the right
      S({ x, y: top, w: 8, h: base - 34 - top, kind: 'wood' }); L.door(x, base); S({ x: x + 56, y: top, w: 6, h: base - top, kind: 'wood' });
    },
    d(t, x, o = {}) { L.deco.push(Object.assign({ t, x }, o)); },
    f(t, x, o = {}) { L.fg.push(Object.assign({ t, x }, o)); },
    stage(s) { L.stages.push(s); },
    scatter(x0, x1, seed, kinds) {
      const r = mulberry32(seed);
      for (let x = x0; x < x1; x += 60 + r() * 120) L.d(kinds[(r() * kinds.length) | 0], x | 0, { h: 22 + (r() * 22 | 0), r: 4 + (r() * 3 | 0) });
    },
  });
  return L;
}

const SP = (t, x, o) => Object.assign({ t, x }, o || {});

const LEVELS = {
  arrival() {
    const L = LB('desert', 3000);
    L.ground(0, 760); L.ground(800, 3000);
    L.scatter(60, 2950, 1, ['cactus', 'bcactus', 'rock', 'bush', 'skull', 'bush']);
    L.d('sign', 80, { label: 'MOVE', tip: '{left}/{right} TO MOVE' });
    L.d('sign', 210, { label: 'JUMP', tip: '{jump} TO JUMP' });
    L.crate(250); L.crate(290, 2);
    L.d('sign', 380, { label: 'SHOOT', tip: 'AIM WITH THE MOUSE - CLICK TO SHOOT. {reload} RELOADS' });
    L.d('fence', 430, { w: 100 });
    L.bottle(445, GY - 14); L.bottle(480, GY - 14); L.bottle(515, GY - 14);
    L.d('sign', 590, { label: 'COVER', tip: 'HOLD {crouch} TO CROUCH BEHIND CRATES' });
    L.crate(660);
    L.d('sign', 720, { label: 'DODGE', tip: '{dodge} TO DODGE ROLL THROUGH BULLETS' });
    L.d('sign', 860, { label: 'AIM', tip: 'HOLD RIGHT MOUSE TO STEADY YOUR AIM. HEADSHOTS HIT HARDER' });
    L.crate(980); L.crate(1120);
    L.wave('w1', 900, [SP('outlaw', 1060, { guard: true }), SP('outlaw', 1170, { guard: true })]);
    L.d('sign', 1250, { label: 'DEAD EYE', tip: 'PRESS {deadeye} FOR DEAD EYE - TIME SLOWS, HEADSHOTS CRIT' });
    L.pick('tonic', 1290); L.pick('ammo', 1320); L.cp(1360);
    L.plat(1420, 250, 70, { posts: true }); L.plat(1520, 205, 50, { posts: true }); L.pick('stash', 1545, 205, 60);
    L.d('sign', 1660, { label: 'BOOM', tip: 'SHOOT RED BARRELS TO BLOW THEM UP' });
    L.d('tent', 1900); L.d('tent', 2140); L.d('campfire', 2020); L.d('wheel', 2080); L.d('hay', 2250);
    L.crate(1840); L.crate(1980); L.barrel(2070); L.crate(2210, 2); L.crate(2380);
    L.wave('w2', 1720, [SP('outlaw', 1990, { guard: true }), SP('outlaw', 2100, { guard: true }), SP('outlaw', 2260), SP('shotgun', 2420, { delay: 2 }), SP('outlaw', 2500, { delay: 2.5 })]);
    L.pick('health', 2300); L.cp(2550);
    L.d('sign', 2900, { label: 'RED CREEK 2 MI' });
    L.f('cactus', 120, { y: 352, h: 40 }); L.f('bcactus', 520, { y: 360, r: 9 }); L.f('cactus', 1500, { y: 356, h: 46 }); L.f('cactus', 2600, { y: 352, h: 38 });
    L.stage({ type: 'break', kind: 'bottle', n: 3, text: 'Shoot the bottles on the fence' });
    L.stage({ type: 'clear', waves: ['w1'], text: 'Deal with the bandits on the trail' });
    L.stage({ type: 'clear', waves: ['w2'], text: 'Clear the bandit camp' });
    L.stage({ type: 'reach', x: 2880, text: 'Ride on toward Red Creek' });
    return L;
  },

  redcreek() {
    const L = LB('town', 3600);
    L.ground(0, 3600);
    L.d('sign', 120, { label: 'RED CREEK' });
    const bld = (x, w, h, name, o = {}) => { L.d('building', x, Object.assign({ w, h, name }, o)); L.plat(x - 4, GY - 46, w + 8, { rail: true }); if (o.roof) L.plat(x + 2, GY - h + 1, w - 4); };
    bld(260, 110, 84, 'GENERAL STORE');
    bld(400, 90, 74, 'HOTEL', { lit: true });
    bld(560, 150, 92, 'SALOON', { saloon: true, lit: true, color: '#9a5a3a' });
    bld(900, 100, 96, 'BANK', { color: '#b8885a', roof: true });
    bld(1050, 90, 78, 'SHERIFF', { color: '#8a6a4a' });
    bld(1500, 80, 70, 'BARBER', { color: '#a87850' });
    bld(1620, 120, 86, 'STABLES', { color: '#7a5032' });
    bld(1960, 110, 90, 'ASSAYER', { color: '#b07a52', roof: true });
    L.d('waterTower', 2420); L.plat(2398, GY - 100, 44);
    L.d('poster', 380); L.d('poster', 1180); L.d('hay', 760); L.d('wheel', 1440); L.d('fence', 2150, { w: 120 });
    L.crate(500); L.crate(760); L.barrel(840); L.crate(1000); L.crate(1210); L.cart(1330);
    L.wave('w1', 230, [SP('outlaw', 620, { y: GY - 46 }), SP('outlaw', 700), SP('outlaw', 820), SP('outlaw', 880, { delay: 3 })]);
    L.wave('w2', 860, [SP('outlaw', 1100, { y: GY - 46 }), SP('sharp', 950, { y: GY - 95 }), SP('shotgun', 1260), SP('dynamite', 1300, { delay: 1.5 })]);
    L.gate(1380, ['w1', 'w2']); L.cp(1420);
    L.crate(1580); L.barrel(1760); L.crate(1880); L.crate(2100, 2); L.crate(2290);
    L.plat(1700, 200, 60); L.pick('stash', 1730, 200, 80);
    L.wall(2310, GY - 40, 50, 6, 'wood'); L.wall(2354, GY - 34, 6, 34, 'wood'); L.boards(2310, GY - 34, 8, 34, true); L.pick('stash', 2336, GY, 90);
    L.wave('w3', 1460, [SP('outlaw', 1680, { y: GY - 46 }), SP('shotgun', 1800), SP('dynamite', 1900), SP('outlaw', 1980, { y: GY - 46 })]);
    L.wave('w4', 2150, [SP('outlaw', 2380), SP('sharp', 2420, { y: GY - 100 }), SP('outlaw', 2500), SP('shotgun', 2560, { delay: 2 }), SP('outlaw', 2200, { delay: 4 })]);
    L.pick('ammo', 1450); L.pick('health', 2000); L.pick('ammo', 2460);
    L.gate(2600, ['w3', 'w4']); L.cp(2640);
    // town square boss arena
    L.d('building', 3330, { w: 120, h: 110, name: 'CHURCH', color: '#c8a888' }); L.d('gibbet', 2860); L.d('cross', 3270);
    L.crate(2880); L.crate(3040, 2); L.barrel(3150); L.crate(3260); L.pick('health', 2700); L.pick('ammo', 2720);
    L.arena = { x0: 2700, x1: 3500 };
    L.f('cactus', 300, { y: 354, h: 34 }); L.f('bcactus', 1300, { y: 360, r: 8 }); L.f('cactus', 2200, { y: 350, h: 40 });
    L.stage({ type: 'clear', waves: ['w1', 'w2', 'w3', 'w4'], text: 'Clear Main Street' });
    L.stage({ type: 'boss', boss: 'butcher', at: 2760, spawnX: 3300, text: 'Defeat The Butcher' });
    return L;
  },

  mine() {
    const L = LB('mine', 4100);
    L.ground(0, 4100);
    const r = mulberry32(3);
    for (let x = 0; x < 4100; x += 100) {
      const inArena = x >= 3100 && x < 3900;
      L.wall(x, 0, 100, inArena ? 24 : 62 + (r() * 30 | 0), 'rock');
    }
    for (let x = 80; x < 3100; x += 170) L.d('beam', x);
    for (let x = 150; x < 4000; x += 230) L.d('lantern', x, { post: true });
    L.d('rails', 0, { w: 3100 });
    L.cart(700); L.crate(820); L.crate(1180); L.cart(1500); L.crate(1640, 2);
    L.plat(860, 236, 70); L.plat(940, 196, 60); L.pick('gold', 970, 196);
    L.plat(560, 220, 50); L.plat(600, 170, 40); L.pick('stash', 620, 170, 70);
    L.wave('w1', 300, [SP('outlaw', 640, { guard: true }), SP('outlaw', 760, { guard: true }), SP('dynamite', 890, { y: 236, delay: 1 })]);
    L.wave('w2', 1050, [SP('enforcer', 1400), SP('outlaw', 1300), SP('outlaw', 1550, { delay: 2 })]);
    L.hazards.push({ type: 'rockfall', x: 1180, w: 140, top: 70, period: 4.5, t: 3 });
    L.cp(1060); L.pick('ammo', 1080); L.d('sign', 1100, { label: 'ENFORCERS', tip: 'ARMORED ENFORCERS SHRUG OFF BODY SHOTS. AIM FOR THE HEAD' });
    // side chamber behind a door
    L.wall(1800, 70, 14, GY - 34 - 70, 'rock'); L.door(1803);
    L.d('sign', 1770, { label: 'E', tip: 'PRESS {interact} TO OPEN DOORS AND GRAB GOLD' });
    L.cp(1830);
    L.wave('w3', 1820, [SP('outlaw', 2050), SP('sharp', 2140, { y: 210 }), SP('outlaw', 2150, { delay: 2 })]);
    L.plat(2100, 210, 80); L.pick('gold', 2160, 210);
    L.wall(2210, GY - 60, 46, 26, 'rock'); L.wall(2250, GY - 34, 6, 34, 'rock'); L.boards(2210, GY - 34, 8, 34, true); L.pick('stash', 2232, GY, 90);
    L.hazards.push({ type: 'rockfall', x: 2340, w: 120, top: 80, period: 4, t: 2 });
    L.cart(2500); L.crate(2620); L.barrel(2680);
    L.wave('w4', 2380, [SP('enforcer', 2740), SP('shotgun', 2600), SP('dynamite', 2820, { delay: 1 }), SP('outlaw', 2860, { delay: 3 })]);
    L.pick('gold', 2860); L.pick('health', 2450);
    L.gate(2950, ['w1', 'w2', 'w3', 'w4'], GY, 200);
    L.cp(2980); L.pick('ammo', 3000); L.pick('health', 3020);
    // Ghost's cavern
    L.plat(3260, 220, 70); L.plat(3440, 165, 70); L.plat(3600, 215, 70); L.plat(3750, 160, 60);
    L.crate(3350); L.crate(3540); L.crate(3700);
    L.perches.push({ x: 3200, y: GY }, { x: 3295, y: 220 }, { x: 3475, y: 165 }, { x: 3635, y: 215 }, { x: 3780, y: 160 }, { x: 3860, y: GY }, { x: 3600, y: GY });
    for (let x = 3150; x < 3900; x += 120) L.d('crystal', x + 30);
    L.arena = { x0: 3100, x1: 3900 };
    L.stage({ type: 'collect', n: 3, text: 'Recover the stolen gold' });
    L.stage({ type: 'boss', boss: 'ghost', at: 3160, spawnX: 3635, spawnY: 215, text: 'Defeat The Ghost' });
    return L;
  },

  train() {
    const L = LB('night', 4350);
    L.tumble = false;
    const cars = [['box', 0, 180, 240], ['flat', 214, 160, 280], ['box', 410, 200, 240], ['pass', 646, 220, 245], ['flat', 900, 160, 280], ['box', 1096, 200, 240],
      ['pass', 1330, 220, 245], ['flat', 1584, 160, 280], ['box', 1780, 200, 240], ['pass', 2014, 220, 245], ['flat', 2268, 200, 280], ['box', 2502, 200, 240],
      ['pass', 2736, 220, 245], ['flat', 2990, 160, 280], ['box', 3186, 200, 240], ['flat', 3420, 640, 280], ['engine', 4096, 254, 250]];
    for (const [v, x, w, top] of cars) L.car(x, w, v, top);
    L.d('rails', 0, { w: 4350, y: 322 });
    L.crate(250, 1, 280); L.crate(330, 1, 280); L.crate(960, 1, 280); L.barrel(1020, 280); L.crate(1640, 1, 280); L.crate(1700, 2, 280);
    L.wall(2300, 250, 40, 6, 'wood'); L.wall(2336, 256, 4, 24, 'wood'); L.boards(2300, 256, 6, 24, true); L.pick('stash', 2320, 280, 100);
    L.crate(2400, 1, 280); L.crate(3050, 1, 280); L.barrel(3100, 280);
    L.wave('w1', 160, [SP('outlaw', 300, { y: 280 }), SP('outlaw', 520, { y: 240 })]);
    L.wave('w2', 700, [SP('shotgun', 940, { y: 280 }), SP('outlaw', 1040, { y: 280 }), SP('dynamite', 1200, { y: 240 })]);
    L.wave('w3', 1400, [SP('outlaw', 1660, { y: 280 }), SP('sharp', 1900, { y: 240 }), SP('outlaw', 1730, { y: 240, delay: 1 })]);
    L.wave('w4', 2100, [SP('enforcer', 2420, { y: 280 }), SP('outlaw', 2620, { y: 240 })]);
    L.wave('w5', 2800, [SP('dynamite', 3030, { y: 280 }), SP('shotgun', 3120, { y: 280 }), SP('outlaw', 3300, { y: 240 })]);
    L.cp(930); L.cp(1820); L.cp(2770); L.cp(3440);
    L.pick('ammo', 700, 245); L.pick('health', 1400, 245); L.pick('ammo', 2100, 245); L.pick('health', 2800, 245); L.pick('ammo', 3450, 280);
    L.crate(3560, 1, 280); L.crate(3760, 1, 280); L.crate(3900, 2, 280);
    L.hazards.push({ type: 'steam', x: 3660, y: 280, period: 4, t: 1, boss: true }, { type: 'steam', x: 3850, y: 280, period: 4, t: 3, boss: true }, { type: 'steam', x: 4000, y: 280, period: 4.5, t: 2, boss: true });
    L.levers.push({ id: 'brake', x: 4180, y: 250, text: 'Pull the brake' });
    L.d('lever', 4180, { y: 250, lever: 'brake' });
    L.arena = { x0: 3420, x1: 4060 };
    L.stage({ type: 'reach', x: 3440, time: 150, text: 'Reach the engine before the bridge' });
    L.stage({ type: 'boss', boss: 'ironjack', at: 3460, spawnX: 3980, spawnY: 280, text: 'Defeat Iron Jack' });
    L.stage({ type: 'interact', id: 'brake', text: 'Pull the brake lever on the engine' });
    return L;
  },

  canyon() {
    const L = LB('canyon', 3900);
    L.ground(0, 3900);
    L.scatter(40, 3800, 9, ['bcactus', 'rock', 'skull', 'bush', 'rock']);
    const ledges = [[580, 200, 90], [1180, 190, 100], [1560, 220, 80], [1630, 150, 50], [2080, 180, 110], [2480, 210, 90], [3080, 190, 90], [3620, 200, 90]];
    for (const [x, y, w] of ledges) L.plat(x, y, w, { posts: true });
    L.pick('stash', 1655, 150, 110);
    L.boards(900, GY - 30, 10, 30); L.boards(1900, GY - 30, 10, 30); L.boards(2720, GY - 30, 10, 30);
    L.crate(760); L.crate(1340); L.crate(1530); L.crate(2240); L.crate(2560);
    L.wave('w1', 420, [SP('outlaw', 800, { wagon: true }), SP('outlaw', 860), SP('sharp', 620, { y: 200 })]);
    L.wave('w2', 1050, [SP('dynamite', 1230, { y: 190 }), SP('outlaw', 1400, { wagon: true }), SP('shotgun', 1350)]);
    L.wave('w3', 1650, [SP('outlaw', 1450, { wagon: true }), SP('outlaw', 2000), SP('dynamite', 2120, { y: 180 })]);
    L.wave('w4', 2300, [SP('enforcer', 2640), SP('sharp', 2520, { y: 210 }), SP('outlaw', 2680, { wagon: true, delay: 1.5 })]);
    L.cp(1000); L.cp(2000); L.cp(2900);
    L.pick('ammo', 1020); L.pick('health', 1700); L.pick('ammo', 2300); L.pick('health', 2950); L.pick('ammo', 3000);
    L.crate(3360); L.crate(3480, 2); L.barrel(3560); L.crate(3700);
    L.wagonStart = 110; L.wagonEnd = 3240;
    L.arena = { x0: 3020, x1: 3880 };
    L.stage({ type: 'wagon', text: 'Escort the wagon through the canyon' });
    L.stage({ type: 'survive', time: 50, text: 'Survive the ambush', mix: ['outlaw', 'outlaw', 'shotgun', 'dynamite', 'outlaw', 'sharp'], ledges: [{ x: 3125, y: 190 }, { x: 3665, y: 200 }] });
    return L;
  },

  hideout() {
    const L = LB('hideout', 4700);
    L.ground(0, 4700);
    L.scatter(30, 850, 13, ['bush', 'rock', 'skull', 'cross']);
    L.d('tent', 300); L.d('tent', 520); L.d('campfire', 410); L.d('torch', 860); L.d('torch', 940);
    L.plat(660, 200, 60, { posts: true }); L.crate(460); L.crate(600); L.barrel(700);
    L.wave('w1', 200, [SP('outlaw', 480), SP('sharp', 690, { y: 200 }), SP('outlaw', 760)]);
    L.wave('w2', 560, [SP('shotgun', 820), SP('dynamite', 850, { delay: 1 })]);
    L.gate(900, ['w1', 'w2'], GY, 140); L.cp(930);
    for (let x = 1000; x < 2500; x += 200) L.d('torch', x);
    L.d('building', 1100, { w: 120, h: 80, name: 'BUNKHOUSE', color: '#6a4030' }); L.plat(1096, GY - 46, 128, { rail: true });
    L.d('building', 1700, { w: 100, h: 90, name: 'ARMORY', color: '#5a3828', roof: true }); L.plat(1696, GY - 46, 108, { rail: true });
    L.hazards.push({ type: 'fire', x: 1380, w: 24, y: GY }, { type: 'fire', x: 2060, w: 24, y: GY });
    L.d('flag', 1300); L.d('flag', 2000);
    L.crate(1250); L.crate(1460); L.barrel(1520); L.crate(1620, 2); L.crate(1900); L.barrel(2150); L.crate(2300);
    L.wave('w3', 1000, [SP('outlaw', 1160, { y: GY - 46 }), SP('enforcer', 1500), SP('outlaw', 1300), SP('dynamite', 1600, { delay: 2 })]);
    L.wave('w4', 1650, [SP('sharp', 1750, { y: GY - 46 }), SP('shotgun', 1950), SP('outlaw', 2100), SP('enforcer', 2300, { delay: 2 }), SP('outlaw', 2350, { delay: 3 })]);
    L.pick('ammo', 1020); L.pick('health', 1700); L.pick('ammo', 2200);
    L.plat(2200, 210, 50, { posts: true }); L.plat(2260, 160, 40, { posts: true }); L.pick('stash', 2280, 160, 150);
    L.gate(2500, ['w3', 'w4'], GY, 140); L.cp(2540);
    L.crate(2700); L.cart(2880); L.crate(3050, 2); L.barrel(3120); L.crate(3300); L.plat(2950, 220, 80, { posts: true });
    L.wave('w5', 2580, [SP('outlaw', 2780), SP('shotgun', 2860), SP('dynamite', 2990, { y: 220 }), SP('outlaw', 3150)]);
    L.wave('w6', 3100, [SP('enforcer', 3450), SP('sharp', 3400), SP('outlaw', 3500, { delay: 1 }), SP('shotgun', 3550, { delay: 3 })]);
    L.pick('health', 3200); L.pick('ammo', 3250);
    L.gate(3620, ['w5', 'w6'], GY, 140); L.cp(3650); L.pick('health', 3680); L.pick('ammo', 3700);
    // final arena
    L.crate(3880); L.crate(4040, 2); L.crate(4280); L.crate(4450); L.plat(4130, 220, 100, { posts: true });
    for (let x = 3760; x < 4600; x += 150) L.d('torch', x);
    L.d('flag', 4160, { y: 220 });
    L.arena = { x0: 3720, x1: 4620, highY: 220 };
    L.stage({ type: 'clear', waves: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'], text: 'Breach the fort' });
    L.stage({ type: 'boss', boss: 'devil', at: 3780, spawnX: 4250, text: "Defeat The Devil's Hand" });
    return L;
  },

  ghosttown() {
    const L = LB('ghost', 3500);
    L.ground(0, 3500);
    L.d('sign', 100, { label: 'PERDITION  POP. 0' });
    const bld = (x, w, h, name) => { L.d('building', x, { w, h, name, color: '#5a4840' }); L.plat(x - 4, GY - 46, w + 8, { rail: true }); };
    bld(380, 110, 84, 'HOTEL'); bld(560, 130, 92, 'SALOON'); bld(1240, 100, 80, 'UNDERTAKER'); bld(1480, 120, 90, 'BANK'); bld(1880, 110, 84, 'JAIL');
    for (const x of [260, 820, 1120, 1760, 2120]) L.d('deadtree', x, { h: 50 + (x % 30) });
    for (const x of [420, 900, 1600, 2200, 2560, 3000, 3300]) L.d('lantern', x, { post: true });
    L.d('sign', 300, { label: 'QUIET', tip: 'THE GUARDS HAVE NOT SEEN YOU. GUNSHOTS WAKE THE WHOLE STREET - PICK YOUR FIRST SHOT WELL' });
    L.crate(700); L.barrel(780); L.crate(1000); L.crate(1420); L.barrel(1700); L.crate(2000);
    L.wave('w1', 160, [SP('outlaw', 520, { guard: true }), SP('outlaw', 620, { y: GY - 46, guard: true }), SP('knife', 760, { guard: true })]);
    L.d('sign', 900, { label: 'KNIVES', tip: 'KNIFE THROWERS ROLL AWAY WHEN YOU AIM AT THEM. FIRE FROM THE HIP OR WAIT THEM OUT' });
    L.wave('w2', 1000, [SP('knife', 1300), SP('outlaw', 1280, { y: GY - 46 }), SP('shotgun', 1420), SP('sharp', 1540, { y: GY - 46 }), SP('dynamite', 1600, { delay: 2 })]);
    L.wall(1150, GY - 40, 50, 6, 'wood'); L.wall(1194, GY - 34, 6, 34, 'wood'); L.boards(1150, GY - 34, 8, 34, true); L.pick('stash', 1176, GY, 110);
    L.gate(1680, ['w1', 'w2']); L.cp(1720); L.pick('ammo', 1730); L.pick('health', 1760);
    L.wave('w3', 1790, [SP('knife', 2000), SP('outlaw', 2050), SP('enforcer', 2150), SP('knife', 2100, { delay: 2 }), SP('outlaw', 1920, { y: GY - 46, delay: 1 })]);
    // church bell tower
    L.d('building', 2380, { w: 100, h: 96, name: 'CHURCH', color: '#6a5a54' });
    L.d('tower', 2300, { w: 60, top: 140 });
    L.plat(2306, 252, 48); L.plat(2306, 206, 48); L.plat(2306, 160, 48);
    L.d('bell', 2330, { y: 160, lever: 'bell', prompt: 'RING THE BELL' });
    L.cp(2260); L.pick('health', 2440); L.pick('ammo', 2470);
    // graveyard arena
    const graves = [2600, 2680, 2780, 2900, 3050, 3150, 3280, 3380];
    for (const x of graves) L.d('grave', x);
    L.graves = graves;
    L.stone(2720, GY - 40, 40, 40); L.stone(2990, GY - 30, 30, 30); L.stone(3020, GY - 60, 46, 60); L.stone(3300, GY - 40, 40, 40);
    L.d('deadtree', 2840, { h: 70 }); L.d('gibbet', 3200);
    L.arena = { x0: 2520, x1: 3440 };
    L.f('bcactus', 1000, { y: 360, r: 8 });
    L.stage({ type: 'clear', waves: ['w1', 'w2', 'w3'], text: 'Clear the ghost town' });
    L.stage({ type: 'interact', id: 'bell', text: 'Climb the tower and ring the church bell' });
    L.stage({ type: 'boss', boss: 'undertaker', at: 2560, spawnX: 3200, text: 'Defeat The Undertaker' });
    return L;
  },

  river() {
    const L = LB('river', 3400);
    L.tumble = false;
    L.pier(0, 340); L.wall(340, 286, 2620, VH + 40 - 286, 'hull').kind = 'hull'; L.pier(2990, 3400);
    L.d('cabin', 420, { y: 286, w: 880, h: 50 }); L.d('cabin', 1400, { y: 286, w: 1000, h: 50 }); L.d('cabin', 2480, { y: 286, w: 420, h: 50 });
    L.d('cabin', 600, { y: 236, w: 300, h: 46 }); L.d('cabin', 1700, { y: 236, w: 400, h: 46 });
    L.d('smokestack', 1150, { y: 236, h: 130 }); L.d('smokestack', 1250, { y: 236, h: 130 });
    L.d('paddlewheel', 2900, { y: 300, r: 40 });
    L.plat(420, 236, 880, { rail: true }); L.plat(1400, 236, 1000, { rail: true }); L.plat(2480, 236, 420, { rail: true });
    L.plat(600, 190, 300); L.plat(1700, 190, 400);
    L.room(700, 286); L.box(732, 286); L.room(1600, 286); L.box(1632, 286); L.room(2560, 286); L.box(2592, 286);
    L.crate(560, 1, 286); L.barrel(900, 286); L.crate(1060, 1, 286); L.crate(1470, 2, 286); L.crate(2000, 1, 286); L.barrel(2200, 286); L.crate(2450, 1, 286); L.crate(2760, 1, 286);
    L.crate(3120, 1, 290); L.crate(3180, 2, 290);
    L.d('sign', 220, { label: 'RIVER QUEEN', y: 290, tip: 'STRONGBOXES ARE LOCKED IN THE CABINS. {interact} OPENS DOORS - OR DROP IN FROM THE DECK ABOVE' });
    L.wave('w1', 150, [SP('outlaw', 500), SP('outlaw', 640, { y: 236 }), SP('sharp', 860, { y: 190 })]);
    L.wave('w2', 900, [SP('knife', 1150), SP('knife', 1250, { delay: 1 }), SP('enforcer', 1320)]);
    L.wave('w3', 1450, [SP('dynamite', 1820, { y: 190 }), SP('outlaw', 1560, { y: 236 }), SP('shotgun', 1720), SP('outlaw', 1900)]);
    L.wave('w4', 2150, [SP('enforcer', 2350), SP('knife', 2400), SP('sharp', 2640, { y: 236 })]);
    L.wave('w5', 2700, [SP('outlaw', 2820), SP('shotgun', 2900), SP('dynamite', 3150, { y: 290 })]);
    L.cp(1000); L.cp(1900); L.cp(2620);
    L.pick('ammo', 980, 286); L.pick('health', 1420, 286); L.pick('ammo', 1950, 236); L.pick('health', 2480, 286); L.pick('ammo', 2700, 286);
    L.pick('stash', 1880, 190, 120);
    L.d('sign', 3320, { label: 'SKIFF', y: 290 });
    L.stage({ type: 'collect', n: 3, time: 240, text: 'Crack the strongboxes before the boat docks' });
    L.stage({ type: 'reach', x: 3300, text: 'Jump ship to the skiff' });
    return L;
  },

  fortbliss() {
    const L = LB('fort', 3600);
    L.ground(0, 3600);
    L.scatter(30, 780, 51, ['bush', 'rock', 'bcactus']);
    L.d('tent', 260); L.d('tent', 480); L.d('campfire', 370); L.d('cannon', 640); L.d('cannon', 3060);
    L.plat(600, 210, 60, { posts: true });
    L.crate(420); L.crate(540); L.barrel(700); L.crate(760, 2);
    L.wave('w1', 150, [SP('outlaw', 450), SP('outlaw', 560), SP('sharp', 630, { y: 210 }), SP('dynamite', 720, { delay: 1 })]);
    L.wave('w1b', 450, [SP('shotgun', 760), SP('knife', 790, { delay: 1 })]);
    L.d('stockade', 790, { w: 70, h: 110 }); L.gate(850, ['w1', 'w1b'], GY, 140); L.cp(900);
    L.d('sign', 960, { label: 'FORT BLISS' });
    const bld = (x, w, h, name, roof) => { L.d('building', x, { w, h, name, color: '#b88a5a', roof }); L.plat(x - 4, GY - 46, w + 8, { rail: true }); if (roof) L.plat(x + 2, GY - h + 1, w - 4); };
    bld(1000, 150, 90, 'BARRACKS'); bld(1500, 110, 100, 'ARMORY', true); bld(1900, 120, 90, 'HQ', true);
    L.d('flagpole', 1320); L.d('hay', 1420); L.d('wheel', 1780);
    L.crate(1200); L.crate(1360); L.barrel(1450); L.crate(1700, 2); L.crate(2100); L.barrel(2250); L.crate(2400); L.crate(2520, 2);
    L.pick('stash', 1960, GY - 89, 140);
    L.pick('ammo', 1180); L.pick('health', 1250);
    L.d('stockade', 2660, { w: 70, h: 110 });
    L.cp(2720); L.pick('health', 2740); L.pick('ammo', 2760);
    L.plat(3300, 220, 60, { posts: true });
    L.crate(2950); L.crate(3150); L.barrel(3240); L.crate(3420, 2);
    L.wave('wB', 99999, [SP('enforcer', 3200, { look: 'graves', name: 'CAPTAIN GRAVES', elite: true, hpMult: 2.2, target: true }),
      SP('sharp', 3320, { y: 220, name: 'LT. COBB', elite: true, hpMult: 2.5, target: true }), SP('outlaw', 3000), SP('knife', 3100, { delay: 1 }), SP('enforcer', 3450, { delay: 3 })]);
    L.arena = { x0: 1150, x1: 2650 };
    L.stage({ type: 'clear', waves: ['w1', 'w1b'], text: 'Break through the siege lines' });
    L.stage({ type: 'reach', x: 1240, text: 'Get inside the fort' });
    L.stage({ type: 'survive', time: 55, text: 'Hold the fort', mix: ['outlaw', 'outlaw', 'knife', 'shotgun', 'dynamite', 'sharp'], ledges: [{ x: 1550, y: GY - 46 }, { x: 1960, y: GY - 46 }, { x: 1080, y: GY - 46 }] });
    L.stage({ type: 'eliminate', n: 2, fire: ['wB'], text: 'Kill Captain Graves and his lieutenant' });
    return L;
  },

  bounty_lou() {
    const L = LB('river', 2400);
    L.tumble = false;
    L.pier(0, 700); L.pier(740, 1500); L.wall(1540, 286, 460, VH + 40 - 286, 'hull').kind = 'hull'; L.pier(2030, 2400);
    L.d('cabin', 1600, { y: 286, w: 300, h: 50 }); L.plat(1600, 236, 300, { rail: true }); L.d('smokestack', 1760, { y: 236, h: 110 });
    L.d('sign', 120, { label: 'SHILOH LANDING', y: 290 });
    L.crate(400, 1, 290); L.barrel(560, 290); L.crate(900, 1, 290); L.crate(1100, 2, 290); L.barrel(1300, 290); L.crate(2200, 1, 290);
    L.wave('w1', 200, [SP('outlaw', 500), SP('knife', 650)]);
    L.wave('w2', 850, [SP('shotgun', 1200), SP('outlaw', 1300), SP('sharp', 1110, { y: 250 })]);
    L.wave('w3', 1450, [SP('knife', 1800, { look: 'lou', name: 'LUCKY LOU', elite: true, hpMult: 4, target: true }), SP('outlaw', 1700, { y: 236 }), SP('knife', 2150), SP('outlaw', 2250, { delay: 2 })]);
    L.cp(860); L.pick('ammo', 870, 290); L.pick('health', 1450, 290);
    L.stage({ type: 'eliminate', n: 1, time: 130, text: 'Get Lucky Lou before his boat sails' });
    return L;
  },

  bounty_ray() {
    const L = LB('town', 2600);
    L.ground(0, 2600);
    L.d('sign', 100, { label: 'DRY GULCH' });
    L.d('building', 300, { w: 100, h: 80, name: 'CANTINA', lit: true }); L.plat(296, GY - 46, 108, { rail: true });
    L.d('building', 1300, { w: 120, h: 90, name: 'HOTEL' }); L.plat(1296, GY - 46, 128, { rail: true });
    L.d('building', 2000, { w: 140, h: 100, name: 'SALOON', saloon: true, lit: true }); L.plat(1996, GY - 46, 148, { rail: true });
    L.crate(500); L.crate(700); L.barrel(780); L.crate(1100); L.crate(1500, 2); L.barrel(1700); L.crate(1850); L.crate(2250);
    L.wave('w1', 250, [SP('outlaw', 560), SP('outlaw', 340, { y: GY - 46 }), SP('outlaw', 760)]);
    L.wave('w2', 950, [SP('outlaw', 1340, { y: GY - 46 }), SP('shotgun', 1250), SP('dynamite', 1450)]);
    L.wave('w3', 1650, [SP('outlaw', 2300, { look: 'ray', name: 'RATTLESNAKE RAY', elite: true, hpMult: 4, target: true }), SP('outlaw', 2050, { y: GY - 46 }), SP('sharp', 2120, { y: GY - 46 }), SP('outlaw', 2400, { delay: 2 })]);
    L.cp(1000); L.pick('ammo', 1000); L.pick('health', 1620);
    L.stage({ type: 'eliminate', n: 1, text: 'Eliminate Rattlesnake Ray' });
    return L;
  },

  bounty_twins() {
    const L = LB('canyon', 2800);
    L.ground(0, 2800);
    L.scatter(40, 2700, 21, ['bcactus', 'rock', 'skull', 'bush']);
    L.plat(700, 200, 90, { posts: true }); L.plat(1500, 190, 90, { posts: true }); L.plat(2200, 200, 100, { posts: true });
    L.crate(500); L.crate(900); L.barrel(1100); L.crate(1300); L.crate(1800, 2); L.barrel(2000); L.crate(2400);
    L.d('tent', 2500); L.d('campfire', 2580);
    L.wave('w1', 300, [SP('outlaw', 620), SP('sharp', 740, { y: 200 }), SP('outlaw', 960)]);
    L.wave('w2', 1100, [SP('dynamite', 1540, { y: 190 }), SP('shotgun', 1400), SP('outlaw', 1700)]);
    L.wave('w3', 1900, [SP('shotgun', 2450, { look: 'coyote', name: 'JED COYOTE', elite: true, hpMult: 3, target: true }), SP('outlaw', 2560, { look: 'coyote', name: 'ZEKE COYOTE', elite: true, hpMult: 3, target: true }), SP('dynamite', 2240, { y: 200 }), SP('outlaw', 2650, { delay: 2 })]);
    L.cp(1150); L.pick('ammo', 1150); L.pick('health', 1950);
    L.stage({ type: 'eliminate', n: 2, time: 150, text: 'Catch the Coyote Twins before they skip town' });
    return L;
  },

  bounty_kettle() {
    const L = LB('desert', 3000);
    L.ground(0, 1400); L.ground(1440, 3000);
    L.scatter(40, 2900, 33, ['cactus', 'bcactus', 'rock', 'bush']);
    L.d('windmill', 600); L.d('tent', 1700); L.d('tent', 2500); L.d('campfire', 2600);
    L.plat(1000, 210, 80, { posts: true }); L.pick('gold', 1040, 210);
    L.crate(800); L.barrel(900); L.crate(1200); L.crate(1600); L.barrel(1750); L.crate(2000, 2); L.crate(2300); L.barrel(2450);
    L.wave('w1', 400, [SP('outlaw', 760), SP('dynamite', 1030, { y: 210 }), SP('outlaw', 1150)]);
    L.wave('w2', 1500, [SP('shotgun', 1800), SP('outlaw', 1900), SP('sharp', 2050, { delay: 1 })]);
    L.pick('gold', 2100);
    L.wave('w3', 2200, [SP('dynamite', 2650, { look: 'kettle', name: 'MA KETTLE', elite: true, hpMult: 5, target: true }), SP('enforcer', 2500), SP('outlaw', 2750, { delay: 2 })]);
    L.cp(1460); L.pick('ammo', 1480); L.pick('health', 2150);
    L.stage({ type: 'collect', n: 2, text: 'Recover the payroll bags' });
    L.stage({ type: 'eliminate', n: 1, text: 'Eliminate Ma Kettle' });
    return L;
  },
};

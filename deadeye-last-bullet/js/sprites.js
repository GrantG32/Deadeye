'use strict';
// Procedural pixel art: characters, guns, props, backgrounds and a tiny pixel font.

const _shadeCache = new Map();
function shade(hex, amt) {
  const k = hex + amt; let v = _shadeCache.get(k);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  const f = c => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
  v = '#' + [f(n >> 16), f(n >> 8 & 255), f(n & 255)].map(c => c.toString(16).padStart(2, '0')).join('');
  _shadeCache.set(k, v);
  return v;
}

function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function pcircle(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); c.fillRect(cx - w, cy + dy, w * 2 + 1, 1); }
}

// ---------- 3x5 pixel font ----------
const GLYPHS = {};
(() => {
  const src = 'A010101111101101B110101110101110C011100100100011D110101101101110E111100110100111F111100110100100G011100101101011H101101111101101I111010010010111J001001001101010K101101110101101L100100100100111M101111111101101N110101101101101O010101101101010P110101110100100Q010101101110011R110101110101101S011100010001110T111010010010010U101101101101111V101101101101010W101101111111101X101101010101101Y101101010010010Z1110010101001110111101101101111101011001001011121100010101001113110001010001110410110111100100151111001100011106011100111101111711100101001001081111011111011119111101111001110!010010010000010?110001010000010.000000000000010,000000000010100:000010000010000-000000111000000\'010010000000000$011110010011110/001001010100100+000010111010000&010101010101011(001010010010001)100010010010100#101111101111101 000000000000000';
  for (let i = 0; i < src.length; i += 16) GLYPHS[src[i]] = src.slice(i + 1, i + 16);
})();
function textW(s, sc = 1) { return (s.length * 4 - 1) * sc; }
function pixText(c, s, x, y, col, sc = 1, align = 'left', shadow) {
  s = String(s).toUpperCase();
  if (align === 'center') x -= Math.floor(textW(s, sc) / 2); else if (align === 'right') x -= textW(s, sc);
  x = Math.round(x); y = Math.round(y);
  if (shadow) pixText(c, s, x + sc, y + sc, shadow, sc);
  c.fillStyle = col;
  for (let i = 0; i < s.length; i++) {
    const g = GLYPHS[s[i]] || GLYPHS['?'];
    for (let j = 0; j < 15; j++) if (g[j] === '1') c.fillRect(x + i * 4 * sc + (j % 3) * sc, y + Math.floor(j / 3) * sc, sc, sc);
  }
}

// ---------- Guns ----------
// Each profile: [i0, i1, j0, j1, colorKey] cells along the aim direction (i) and toward the grip (j).
const GUN_PROFILES = {
  revolver: { cells: [[-1, 1, 1, 3, 'wood'], [0, 3, 0, 1, 'metal'], [2, 4, 0, 1.5, 'hi'], [4, 8, 0, 0, 'metal'], [8, 8, -1, -1, 'metal']], muzzle: 9 },
  rifle:    { cells: [[-7, -1, 0, 2, 'wood'], [-1, 3, 0, 1, 'metal'], [0, 2, 2, 2, 'lever'], [3, 14, 0, 0, 'metal'], [3, 9, 1, 1, 'wood'], [12, 13, -1, -1, 'hi']], muzzle: 15 },
  shotgun:  { cells: [[-4, 0, 1, 2.5, 'wood'], [0, 2, 0, 1, 'metal'], [2, 10, 0, 1, 'metal'], [2, 10, 0, 0, 'hi'], [2, 6, 2, 2, 'wood']], muzzle: 11 },
  sharp:    { cells: [[-8, -1, 0, 2, 'wood'], [-1, 4, 0, 1, 'metal'], [0, 5, -2, -2, 'metal'], [5, 5, -2, -2, 'hi'], [4, 18, 0, 0, 'metal'], [4, 10, 1, 1, 'wood']], muzzle: 19 },
  devil:    { cells: [[-1, 1, 1, 3, 'wood'], [0, 3, 0, 1, 'metal'], [2, 4, 0, 1.5, 'hi'], [4, 10, 0, 0, 'metal'], [4, 10, 1, 1, 'glow'], [10, 10, -1, -1, 'hi']], muzzle: 11 },
  gatling:  { cells: [[-3, 5, -1, 2.5, 'metal'], [5, 12, -1, -1, 'hi'], [5, 12, 0, 0, 'metal'], [5, 12, 1, 1, 'hi'], [0, 2, 3, 4, 'wood']], muzzle: 13 },
  repeater: { cells: [[-6, -1, 0, 2, 'wood'], [-1, 5, -1, 1.5, 'metal'], [1, 3, 2, 4, 'hi'], [5, 15, 0, 0, 'metal'], [5, 15, -1, -1, 'metal'], [5, 10, 1, 1, 'wood']], muzzle: 16 },
  dynamite: { cells: [[0, 1, -3, 0, 'red'], [1, 1, -4, -4, 'fuse']], muzzle: 1 },
  volcanic: { cells: [[-1, 1, 1, 3, 'wood'], [0, 3, 0, 1, 'metal'], [3, 9, 0, 0, 'metal'], [3, 8, 1, 1, 'hi'], [0, 1, 2.5, 3, 'metal']], muzzle: 10 },
  boom:     { cells: [[-4, 0, 1, 2.5, 'wood'], [0, 9, -1.5, 1.5, 'metal'], [8, 9, -1.5, 1.5, 'hi'], [2, 3, 2, 3.5, 'wood'], [3, 6, -2, -2, 'red']], muzzle: 10 },
  coach:    { cells: [[-5, 0, 1, 2.5, 'wood'], [0, 2, 0, 1, 'metal'], [2, 13, 0, 1, 'metal'], [2, 13, 0, 0, 'hi'], [2, 7, 2, 2, 'wood']], muzzle: 14 },
  knife:    { cells: [[-1, 0, 0, 0.5, 'wood'], [1, 4, 0, 0, 'hi']], muzzle: 4 },
  gatlingP: { cells: [[-3, 5, -1, 2.5, 'metal'], [5, 13, -1, -1, 'spin'], [5, 13, 0, 0, 'metal'], [5, 13, 1, 1, 'spin'], [0, 2, 3, 4, 'wood'], [-2, -2, -3, -1, 'wood']], muzzle: 14 },
};
const ENEMY_GUN_SKIN = { metal: '#4a4a52', hi: '#8a8a96', wood: '#6a4426', wood2: '#4a2c18' };
const DEVIL_SKIN = { metal: '#1e1a1e', hi: '#d8d8e0', wood: '#e8e0c8', wood2: '#b8ae94', glow: '#ff5a2a' };

function gunColor(key, sk, opt) {
  switch (key) {
    case 'wood': return sk.wood;
    case 'metal': return sk.metal;
    case 'hi': return (sk.glint && ((opt.t || 0) * 3 % 1) < 0.15) ? '#ffffff' : sk.hi;
    case 'lever': return sk.metal;
    case 'glow': return sk.glow || '#ff5a2a';
    case 'red': return '#c8302a';
    case 'fuse': return ((opt.t || 0) * 20 | 0) % 2 ? '#ffe060' : '#ff8030';
    case 'spin': return opt.spin > 0 && ((opt.t || 0) * 40 * opt.spin | 0) % 2 ? sk.hi : sk.metal;
  }
  return '#f0f';
}

// Draws arm + gun from shoulder; returns muzzle position.
function drawGun(c, kind, ox, oy, ang, f, sk, opt = {}) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const nx = f >= 0 ? -dy : dy, ny = f >= 0 ? dx : -dx;     // "down" relative to gun
  const plot = (i, j, col) => { c.fillStyle = col; c.fillRect(Math.round(ox + dx * i + nx * j), Math.round(oy + dy * i + ny * j), 1, 1); };
  const arm = opt.armLen || 4;
  const back = opt.recoil || 0;
  for (let i = 0; i <= arm - back; i += 0.5) for (let j = 0; j <= 1; j += 0.5) plot(i, j, opt.sleeve || '#555');
  const hx = arm - back;
  for (let i = hx; i <= hx + 1; i += 0.5) for (let j = 0; j <= 1.5; j += 0.5) plot(i, j, opt.hand || '#e0a070');
  if (kind === 'bow') { // limbs bend as the string is drawn back
    const pull = opt.pull || 0, b0 = hx + 1, wood = opt.flash ? '#fff' : sk.wood, str = '#e8e0c8';
    for (let j = -7; j <= 7; j += 0.5) { const a = Math.abs(j) / 7; plot(b0 + 2 - a * a * (3 + pull * 1.5), j, wood); }
    for (let j = -7; j <= 7; j += 0.5) { const a = 1 - Math.abs(j) / 7; plot(b0 + 2 - (3 + pull * 1.5) - a * pull * 5, j, str); }
    if (opt.nocked) { const tail = b0 - 1 - pull * 6; for (let i = tail; i <= b0 + 7; i += 0.5) plot(i, 0, '#a8784a'); plot(b0 + 8, 0, sk.hi); plot(tail, -1, '#d83a2e'); plot(tail, 1, '#d83a2e'); }
    return { x: ox + dx * (b0 + 8), y: oy + dy * (b0 + 8) };
  }
  const prof = GUN_PROFILES[kind] || GUN_PROFILES.revolver;
  const base = hx + 1;
  for (const [i0, i1, j0, j1, key] of prof.cells) {
    let jj0 = j0, jj1 = j1;
    if (key === 'lever' && opt.lever) { jj0 += 1; jj1 += 1; }
    const col = opt.flash ? '#ffffff' : gunColor(key, sk, opt);
    for (let i = i0; i <= i1; i += 0.5) for (let j = jj0; j <= jj1; j += 0.5) plot(base + i, j - 1, col);
  }
  const m = base + prof.muzzle;
  return { x: ox + dx * m + nx * -1, y: oy + dy * m + ny * -1 };
}

// ---------- Characters ----------
// x,y = feet (bottom-center). st: {f, state, phase, aim, gun, skin, flash, t, crouch, lever, recoil, deadT, reloading, alpha, dual, aim2}
function drawCharacter(c, L, x, y, st) {
  x = Math.round(x); y = Math.round(y);
  const f = st.f >= 0 ? 1 : -1;
  const flash = st.flash;
  const col = v => flash ? '#ffffff' : v;
  const tw = L.torsoW || 10, hw = L.headW || 6, hh = 6;
  let lh = L.legH || 8, th = L.torsoH || 9;
  const state = st.state || 'idle';
  if (state === 'dead') {
    const a = Math.min(1, (st.deadT || 0) / 0.35) * Math.PI / 2;
    c.save();
    c.translate(x, y - (a >= Math.PI / 2 - 0.01 ? Math.floor(tw / 2) - 1 : 0));
    c.rotate(-f * a);
    drawCharacter(c, L, 0, 0, Object.assign({}, st, { state: 'idle', gun: null, deadPose: true }));
    c.restore();
    return null;
  }
  if (state === 'roll') {
    const cx = x, cy = y - 7, a = (st.phase || 0) * TAU * f;
    pcircle(c, cx, cy, 6, col(L.coat || L.poncho || L.vest || L.shirt));
    pcircle(c, cx, cy, 3, col(L.shirt));
    px(c, Math.round(cx + Math.cos(a) * 5) - 2, Math.round(cy + Math.sin(a) * 5) - 1, 5, 2, col(L.hat));
    px(c, Math.round(cx - Math.cos(a) * 5) - 1, Math.round(cy - Math.sin(a) * 5) - 1, 3, 2, col(L.boots));
    return null;
  }
  const crouch = state === 'crouch';
  if (crouch) { lh = 2; th -= 3; }
  const R = (dx, dy, w, h, cl) => { c.fillStyle = cl; c.fillRect(f > 0 ? x + dx : x - dx - w, y + dy, w, h); };
  const bob = state === 'idle' && !st.deadPose ? ((st.t || 0) % 1.2 < 0.6 ? 0 : 1) : state === 'run' ? (Math.floor((st.phase || 0) * 4) % 2) : 0;
  const legTop = -lh - 3;
  const torsoTop = legTop - 1 - th + bob;
  const headTop = torsoTop - hh;

  // legs
  let fo = 0, bo = 0, fl = 0, bl = 0;
  if (state === 'run') {
    const fr = Math.floor((st.phase || 0) * 4) % 4;
    [fo, bo, fl, bl] = [[2, -2, 0, 0], [0, 0, 1, 0], [-2, 2, 0, 0], [0, 0, 0, 1]][fr];
  } else if (state === 'jump') { fo = 2; bo = -2; fl = 2; bl = 0; }
  const pants = L.pants, boots = L.boots;
  const leg = (off, lift, cp, cb) => {
    if (crouch) { R(off - 1, -5, 5, 2, col(cp)); R(off + 2, -3, 2, 3, col(cb)); return; }
    R(off - 1, legTop - lift, 3, lh, col(cp));
    R(off - 1, -3 - lift, 4, 3, col(cb));
  };
  leg(bo - 2, bl, shade(pants, -0.25), shade(boots, -0.2));
  // back arm (hangs, or second pistol when dual wielding)
  const sleeve = L.coat || L.armor || L.poncho || L.shirt;
  if (!st.gun || !st.dual) R(-tw / 2 + 1, torsoTop + 2, 2, 6, col(shade(sleeve, -0.25)));
  // coat tails behind
  if (L.coat) { R(-tw / 2 - 1, torsoTop + th, 4, Math.max(2, lh - 2), col(shade(L.coat, -0.1))); }
  // backpack tank (Iron Jack weak point)
  if (L.tank) {
    R(-tw / 2 - 4, torsoTop + 1, 4, th - 1, col(L.tank));
    R(-tw / 2 - 4, torsoTop + 1, 1, th - 1, col(shade(L.tank, 0.3)));
    R(-tw / 2 - 3, torsoTop + 3, 2, 3, flash ? '#fff' : ((st.t || 0) * 4 % 1 < 0.5 ? '#ffb040' : '#ff6a20'));
  }
  leg(fo, fl, pants, boots);
  // torso
  const tx = -Math.floor(tw / 2);
  R(tx, torsoTop, tw, th, col(L.shirt));
  if (L.vest) { R(tx, torsoTop, tw, th, col(L.vest)); R(tx + tw - 3, torsoTop, 2, th - 1, col(L.shirt)); }
  if (L.coat) {
    R(tx - 1, torsoTop, tw + 1, th, col(L.coat));
    R(tx + tw - 3, torsoTop, 2, th, col(L.shirt));
    R(tx + tw - 2, torsoTop, 1, 3, col(L.coatHi || L.coat));
    R(tx + tw - 2, torsoTop + th, 2, Math.max(1, lh - 4), col(L.coat));
  }
  if (L.poncho) {
    for (let i = 0; i < th; i++) R(tx - 1 - (i >> 2), torsoTop + i, tw + 2 + (i >> 2) * 2, 1, col(i === 3 || i === 6 ? L.ponchoHi : L.poncho));
  }
  if (L.apron) {
    R(tx + 4, torsoTop + 3, tw - 5, th + Math.floor(lh / 2) - 2, col(L.apron));
    R(tx + 4, torsoTop + 3, 1, th + Math.floor(lh / 2) - 2, col(shade(L.apron, -0.15)));
    R(tx + 7, torsoTop + 6, 3, 2, col(L.stain)); R(tx + tw - 4, torsoTop + th - 1, 2, 3, col(L.stain)); R(tx + 10, torsoTop + th + 2, 2, 1, col(L.stain));
    R(tx + 4, torsoTop + 2, tw - 5, 1, col('#5a3a24'));
  }
  if (L.armor) {
    R(tx, torsoTop, tw, th - 1, col(L.armor));
    R(tx + 1, torsoTop + 1, tw - 2, 1, col(L.armorHi));
    R(tx + 2, torsoTop + 4, 1, 1, col(L.armorHi)); R(tx + tw - 3, torsoTop + 4, 1, 1, col(L.armorHi));
    R(tx - 1, torsoTop - 1, 4, 3, col(shade(L.armor, 0.15)));
  }
  if (L.suspenders) { R(tx + 2, torsoTop, 1, th, col(L.suspenders)); R(tx + tw - 3, torsoTop, 1, th, col(L.suspenders)); }
  if (L.dynabelt) for (let i = 0; i < 4; i++) R(tx + 1 + i * 2, torsoTop + 1 + i * 2, 2, 2, col(i % 2 ? '#e04030' : '#b02820'));
  if (L.bandolier) for (let i = 0; i < 6; i++) R(tx + 1 + i * 2, torsoTop + i * 2, 2, 2, col(i % 2 ? '#d8b040' : '#4a3020'));
  // belt + holster
  R(tx, legTop - 1, tw, 1, col('#2a1a10'));
  R(tx + tw - 3, legTop - 1, 2, 1, col('#d8b040'));
  if (!L.apron) R(tx - 1, legTop, 2, 4, col('#5a3418'));
  // head
  const hx = -Math.floor(hw / 2) + 1;
  R(hx, headTop, hw, hh, col(L.skin));
  R(hx + hw, headTop + 2, 1, 2, col(L.skin)); // nose
  R(hx + hw - 2, headTop + 2, 1, 1, col('#1a1010'));
  if (L.beard) { R(hx, headTop + 3, hw + 1, 3, col(L.beard)); R(hx + hw - 2, headTop + 4, 2, 1, col(shade(L.skin, -0.2))); }
  if (L.stache) R(hx + hw - 2, headTop + 4, 3, 1, col(L.stache));
  if (L.mask) { R(hx + 1, headTop + 3, hw, 3, col(L.bandana)); R(hx + hw - 1, headTop + 5, 2, 2, col(L.bandana)); }
  if (L.skull) {
    R(hx, headTop, hw + 1, hh, col('#ecebe2'));
    R(hx + hw - 3, headTop + 2, 2, 1, col('#141414')); R(hx + hw - 1, headTop + 2, 1, 1, col('#141414'));
    R(hx + 1, headTop + 4, hw, 1, col('#5a5a5a'));
  }
  if (L.bandana && !L.mask) { R(hx - 1, headTop + hh, hw + 1, 1, col(L.bandana)); R(hx + hw - 2, headTop + hh + 1, 2, 2, col(L.bandana)); }
  if (L.glove) { /* drawn with hand color below */ }
  // ears / hair back
  R(hx, headTop + 1, 1, 3, col(shade(L.skin, -0.15)));
  // hat
  const hc = col(L.hat), hb = col(L.band);
  switch (L.style) {
    case 'wide':
      R(hx - 3, headTop, hw + 6, 1, hc); R(hx - 3, headTop - 1, 1, 1, hc); R(hx + hw + 2, headTop - 1, 1, 1, hc);
      R(hx, headTop - 1, hw, 1, hb); R(hx, headTop - 3, hw, 2, hc); R(hx + 2, headTop - 3, 2, 1, col(shade(L.hat, -0.2)));
      break;
    case 'low':
      R(hx - 2, headTop, hw + 4, 1, hc); R(hx, headTop - 1, hw, 1, hb); R(hx, headTop - 2, hw, 1, hc);
      break;
    case 'sombrero':
      R(hx - 5, headTop, hw + 10, 1, hc); R(hx - 6, headTop - 1, 1, 1, hc); R(hx + hw + 5, headTop - 1, 1, 1, hc);
      R(hx, headTop - 1, hw, 1, hb); R(hx + 1, headTop - 4, hw - 2, 3, hc); R(hx + 2, headTop - 5, hw - 4, 1, hc);
      break;
    case 'top':
      R(hx - 2, headTop, hw + 4, 1, hc); R(hx, headTop - 6, hw, 6, hc); R(hx, headTop - 2, hw, 1, hb); R(hx, headTop - 6, 1, 6, col(shade(L.hat, 0.2)));
      break;
    case 'bowler':
      R(hx - 1, headTop, hw + 2, 1, hc); R(hx, headTop - 1, hw, 1, hb); R(hx + 1, headTop - 3, hw - 2, 2, hc);
      break;
    case 'cap':
      R(hx, headTop - 1, hw, 2, hc); R(hx + hw - 1, headTop, 3, 1, hc); R(hx + hw - 2, headTop - 1, 1, 1, '#ffe070');
      break;
    case 'helmet':
      R(hx - 1, headTop - 2, hw + 2, 4, hc); R(hx - 1, headTop + 2, 2, 4, hc); R(hx, headTop - 2, hw, 1, col(shade(L.hat, 0.2)));
      if (L.visor) R(hx + 2, headTop + 1, hw, 1, flash ? '#fff' : L.visor);
      else R(hx + 2, headTop + 1, hw - 1, 1, '#111');
      break;
  }
  if (st.deadPose || !st.gun) {
    R(tw / 2 - 2, torsoTop + 2, 2, 6, col(sleeve));
    R(tw / 2 - 2, torsoTop + 8, 2, 2, col(L.glove || L.skin));
    return null;
  }
  // gun arm(s)
  const sx = x + f * (tw / 2 - 2), sy = y + torsoTop + 2;
  const skin = st.skin || ENEMY_GUN_SKIN;
  const o = { sleeve: col(sleeve), hand: col(L.glove || L.skin), lever: st.lever, recoil: st.recoil || 0, t: st.t, flash, armLen: L.big ? 5 : 4, pull: st.pull, nocked: st.nocked, spin: st.spin };
  let m2 = null;
  if (st.dual) m2 = drawGun(c, st.gun, x - f * 1, sy + 1, st.aim2 != null ? st.aim2 : st.aim, f, skin, Object.assign({}, o, { sleeve: col(shade(sleeve, -0.25)), recoil: st.recoil2 || 0 }));
  const m = drawGun(c, st.gun, sx, sy, st.aim, f, skin, o);
  return st.dual ? { a: m, b: m2 } : m;
}

// ---------- Themes ----------
const THEMES = {
  desert:  { sky: ['#e9a25e', '#f0b86e', '#f4c886', '#f7d79e', '#f8e2b2'], sun: [120, 70, 26, '#fff6dc'], clouds: '#fbe6c2', cloudsShade: '#f0cf9e',
    far: '#e8bf96', farHi: '#f2d0aa', mid: '#d79f78', midHi: '#e4b28a', near: '#c98a64',
    rock: ['#c87a52', '#a85e40', '#8a4634', '#5e2c26'], crust: '#f3c98c', crust2: '#e2a86a', haze: 'rgba(248,226,178,0.35)', wind: 0.18 },
  town:    { sky: ['#e3925a', '#ecaa68', '#f2c07e', '#f6d498', '#f8e2b0'], sun: [520, 80, 22, '#fff2d0'], clouds: '#fadfb8', cloudsShade: '#eec594',
    far: '#e2b28c', farHi: '#eec4a0', mid: '#cf9670', midHi: '#dcaa84', near: '#a8704e', town: true,
    rock: ['#c07650', '#a05a3e', '#844432', '#5a2a24'], crust: '#ecc08a', crust2: '#d8a26c', haze: 'rgba(246,212,160,0.3)', wind: 0.15 },
  mine:    { cave: true, sky: ['#1a120e', '#1e150f', '#221811', '#261b13', '#2a1e15'], far: '#2e2118', farHi: '#3a2a1e', mid: '#3a2a1e', midHi: '#4a3626', near: '#4a3626',
    rock: ['#6a4c36', '#54392a', '#402a20', '#2a1c16'], crust: '#8a6a4a', crust2: '#6a4e36', dark: 0.74, wind: 0.05, windF: 200 },
  night:   { sky: ['#0b1028', '#141a3a', '#222650', '#3a3462', '#5a4670'], moon: [480, 60, 16], stars: true, clouds: '#3a3a62', cloudsShade: '#2a2a50',
    far: '#262444', farHi: '#323058', mid: '#1c1a34', midHi: '#28264a', near: '#16142a',
    rock: ['#4a3a48', '#3a2c3a', '#2a2030', '#1a1420'], crust: '#6a5a6a', crust2: '#4a3e4e', dark: 0.42, wind: 0.3, windF: 900, scroll: 420 },
  canyon:  { sky: ['#e58a50', '#ec9e5c', '#f2b46e', '#f6c888', '#f8d8a0'], sun: [300, 50, 20, '#fff0c8'], clouds: '#f8d8b0', cloudsShade: '#eab88a',
    far: '#c8704a', farHi: '#d8845a', mid: '#a8503a', midHi: '#bc6448', near: '#8a3e30', canyon: true,
    rock: ['#c8603e', '#a84a32', '#883828', '#5a2420'], crust: '#e8a070', crust2: '#d08458', haze: 'rgba(248,200,150,0.3)', wind: 0.22 },
  hideout: { sky: ['#3a2048', '#6a2c50', '#a8444a', '#d8684a', '#eea05a'], sun: [380, 230, 30, '#ffb070'], clouds: '#b85a5a', cloudsShade: '#8a3e4e',
    far: '#5a2c3e', farHi: '#6a3848', mid: '#44223a', midHi: '#542c44', near: '#2e1828', fort: true,
    rock: ['#8a5240', '#6e3e32', '#522c28', '#341a1c'], crust: '#b07658', crust2: '#905a44', haze: 'rgba(238,140,90,0.25)', dark: 0.3, wind: 0.2 },
  ghost:   { sky: ['#12101c', '#1a1628', '#241e34', '#30263e', '#3e3048'], moon: [150, 64, 18], stars: true, clouds: '#3a3448', cloudsShade: '#2a2638',
    far: '#2a2436', farHi: '#342c42', mid: '#221c2c', midHi: '#2c2438', near: '#1a1622', town: true,
    rock: ['#5e4e4e', '#4a3c3e', '#382c30', '#22181e'], crust: '#7a6a6a', crust2: '#5a4a4e', dark: 0.5, fog: true, wind: 0.25, windF: 380 },
  river:   { sky: ['#c8606a', '#de7a6a', '#ec9a70', '#f2ba84', '#f6d4a2'], sun: [430, 170, 26, '#fff0d0'], clouds: '#f8c8b0', cloudsShade: '#e8a890',
    far: '#a87478', farHi: '#b88488', mid: '#7a6050', midHi: '#8a7060', near: '#5a4a3a', water: true,
    rock: ['#8a5a3a', '#6e4630', '#523426', '#34201a'], crust: '#a87a52', crust2: '#8a603e', haze: 'rgba(248,190,160,0.25)', wind: 0.12 },
  fort:    { sky: ['#6aa4d4', '#86b6dc', '#a4c8e2', '#c2d8e8', '#e2e6e4'], sun: [540, 56, 18, '#fffbe8'], clouds: '#ffffff', cloudsShade: '#d4e2ee',
    far: '#d8b48c', farHi: '#e6c49c', mid: '#c4946c', midHi: '#d4a47c', near: '#a87a54',
    rock: ['#c88a5a', '#a86e46', '#8a5438', '#5e3426'], crust: '#ecc690', crust2: '#d8a870', haze: 'rgba(230,230,220,0.25)', wind: 0.15 },
};

// Banded, dithered sky like classic pixel art.
function buildSky(th) {
  const [cv, c] = makeCanvas(VW, VH);
  const cols = th.sky, band = Math.ceil(VH * 0.8 / cols.length);
  for (let i = 0; i < cols.length; i++) px(c, 0, i * band, VW, VH, cols[i]);
  for (let i = 1; i < cols.length; i++) {
    c.fillStyle = cols[i - 1];
    for (let y = i * band; y < i * band + 3; y++) for (let x = (y % 2); x < VW; x += 2) c.fillRect(x, y, 1, 1);
  }
  if (th.stars) { const r = mulberry32(7); for (let i = 0; i < 120; i++) px(c, r() * VW | 0, r() * 200 | 0, 1, 1, r() < 0.2 ? '#ffffff' : '#9aa0c8'); }
  return cv;
}

function profileLayer(w, h, seed, kind, th, colA, colB) {
  const [cv, c] = makeCanvas(w, h);
  const r = mulberry32(seed), hs = new Float32Array(w);
  if (kind === 'mesa') {
    const n = Math.ceil(w / 170);
    for (let k = 0; k < n; k++) {
      const cx = r() * w, top = 20 + r() * 50, tw2 = 30 + r() * 80, steps = 3 + (r() * 3 | 0), height = h * (0.35 + r() * 0.55);
      for (let x = -w; x < w * 2; x++) {
        const d = Math.abs(x - cx); let hv = 0;
        if (d < tw2 / 2) hv = height;
        else { const s = Math.floor((d - tw2 / 2) / (top / steps)); hv = height * (1 - (s + 1) / (steps + 1)) - (d - tw2 / 2) * 0.15; }
        const xx = ((x % w) + w) % w;
        if (hv > hs[xx]) hs[xx] = hv;
      }
    }
  } else {
    const a = r() * 10, b = r() * 10;
    for (let x = 0; x < w; x++) hs[x] = h * 0.35 + Math.sin(x / w * TAU * 2 + a) * h * 0.12 + Math.sin(x / w * TAU * 5 + b) * h * 0.06;
  }
  for (let x = 0; x < w; x++) {
    const top = Math.round(h - hs[x]);
    px(c, x, top, 1, h - top, colA);
    const prev = hs[(x - 1 + w) % w];
    if (hs[x] - prev > 0.3 || x % 37 < 2) px(c, x, top, 1, Math.min(h - top, 30), colB);
    px(c, x, top, 1, 1, colB);
  }
  // strata lines
  c.globalCompositeOperation = 'source-atop';
  for (let y = 8; y < h; y += 9) px(c, 0, y, w, 1, shade(colA, -0.07));
  c.globalCompositeOperation = 'source-over';
  return cv;
}

function buildTownLayer(w, h, th) {
  const [cv, c] = makeCanvas(w, h);
  const r = mulberry32(31);
  let x = 0;
  while (x < w) {
    const bw = 40 + r() * 50 | 0, bh = 30 + r() * 40 | 0;
    px(c, x, h - bh, bw, bh, th.near);
    px(c, x + 4, h - bh - 6, bw - 8, 6, th.near);
    for (let wx = x + 6; wx < x + bw - 8; wx += 12) px(c, wx, h - bh + 10, 5, 7, shade(th.near, -0.2));
    x += bw + (r() * 20 | 0);
  }
  return cv;
}
function buildFortLayer(w, h, th) {
  const [cv, c] = makeCanvas(w, h);
  for (let x = 0; x < w; x += 5) { const lh = 46 + ((x * 7) % 5); px(c, x, h - lh, 4, lh, th.near); px(c, x + 1, h - lh - 2, 2, 2, th.near); }
  for (const tx of [120, 520, 900]) { px(c, tx, h - 90, 34, 90, shade(th.near, -0.1)); px(c, tx - 4, h - 96, 42, 6, th.near); px(c, tx + 6, h - 116, 22, 20, th.near); px(c, tx + 2, h - 120, 30, 4, th.near); }
  return cv;
}

function buildCloud(r, th) {
  const w = 40 + r() * 50 | 0, h = 18;
  const [cv, c] = makeCanvas(w, h + 4);
  const n = 4 + (r() * 3 | 0);
  for (let i = 0; i < n; i++) { const cx = 8 + r() * (w - 16) | 0, cy = 10 + r() * 4 | 0, rr = 5 + r() * 6 | 0; pcircle(c, cx, cy, rr, th.cloudsShade); }
  for (let i = 0; i < n; i++) { const cx = 8 + r() * (w - 16) | 0, cy = 8 + r() * 3 | 0, rr = 4 + r() * 5 | 0; pcircle(c, cx, cy, rr, th.clouds); }
  c.clearRect(0, h, w, 4);
  return cv;
}

function buildGroundPattern(th) {
  const [cv, c] = makeCanvas(64, 64);
  const r = mulberry32(99);
  px(c, 0, 0, 64, 64, th.rock[3]);
  for (let row = 0; row < 64; row += 8) {
    let x = -(r() * 10 | 0);
    while (x < 64) {
      const w = 9 + (r() * 9 | 0), colI = r() < 0.5 ? 1 : r() < 0.6 ? 0 : 2;
      const cl = th.rock[colI];
      px(c, x + 1, row + 1, w - 2, 6, cl);
      px(c, x + 1, row + 1, w - 2, 1, shade(cl, 0.15));
      px(c, x + 1, row + 6, w - 2, 1, shade(cl, -0.25));
      x += w;
    }
  }
  return c.createPattern(cv, 'repeat');
}

function buildBackground(themeName) {
  const th = THEMES[themeName];
  const bg = { th, sky: buildSky(th), layers: [], clouds: [], pattern: buildGroundPattern(th) };
  if (th.cave) {
    const [cv, c] = makeCanvas(512, VH);
    c.fillStyle = buildGroundPattern({ rock: ['#3a2a20', '#31231a', '#281c15', '#1c140f'] }); c.fillRect(0, 0, 512, VH);
    for (let x = 30; x < 512; x += 128) { px(c, x, 60, 6, 240, '#3a2614'); px(c, x + 70, 60, 6, 240, '#3a2614'); px(c, x - 6, 56, 88, 8, '#4a3018'); px(c, x - 6, 56, 88, 1, '#6a4a28'); }
    bg.layers.push({ cv, f: 0.5, y: 0 });
  } else {
    if (th.clouds) { const r = mulberry32(5); for (let i = 0; i < 7; i++) bg.clouds.push({ cv: buildCloud(r, th), x: r() * 1400, y: 18 + r() * 90, f: 0.04 + r() * 0.05, s: 3 + r() * 4 }); }
    bg.layers.push({ cv: profileLayer(1280, 160, 11, 'mesa', th, th.far, th.farHi), f: 0.08, y: VH - 160 - 70 });
    bg.layers.push({ cv: profileLayer(1024, 120, 23, th.canyon ? 'mesa' : 'hill', th, th.mid, th.midHi), f: 0.2, y: VH - 120 - 50 });
    if (th.town) bg.layers.push({ cv: buildTownLayer(1100, 90, th), f: 0.4, y: VH - 90 - 58 });
    if (th.fort) bg.layers.push({ cv: buildFortLayer(1200, 130, th), f: 0.4, y: VH - 130 - 58 });
    if (th.canyon) bg.layers.push({ cv: profileLayer(900, 200, 41, 'mesa', th, th.near, shade(th.near, 0.12)), f: 0.4, y: VH - 200 - 50 });
  }
  return bg;
}

function drawBackground(c, bg, camx, t, scroll) {
  const th = bg.th;
  c.drawImage(bg.sky, 0, 0);
  if (th.sun) {
    const [sx, sy, r, cl] = th.sun;
    c.globalAlpha = 0.25; pcircle(c, sx, sy, r + 14, '#fff8e8'); c.globalAlpha = 0.35; pcircle(c, sx, sy, r + 6, '#fff8e8'); c.globalAlpha = 1;
    pcircle(c, sx, sy, r, cl);
    c.globalAlpha = 0.3; pcircle(c, sx + 60, sy + 70, 8, '#fff8e8'); pcircle(c, sx + 90, sy + 100, 5, '#fff8e8'); c.globalAlpha = 1;
  }
  if (th.moon) { const [mx, my, r] = th.moon; c.globalAlpha = 0.2; pcircle(c, mx, my, r + 8, '#c8c8ff'); c.globalAlpha = 1; pcircle(c, mx, my, r, '#f0ecd8'); pcircle(c, mx + 4, my - 3, 3, '#d8d4c0'); pcircle(c, mx - 5, my + 4, 2, '#d8d4c0'); }
  if (th.stars) for (let i = 0; i < 12; i++) if (Math.sin(t * 2 + i * 7) > 0.6) px(c, (i * 53) % VW, (i * 31) % 180, 1, 1, '#ffffff');
  for (const cl of bg.clouds) {
    const W = 1400, xx = (((cl.x - camx * cl.f - t * cl.s) % W) + W) % W - 100;
    c.drawImage(cl.cv, Math.round(xx), Math.round(cl.y));
  }
  for (const L of bg.layers) {
    const w = L.cv.width, off = ((-(camx * L.f + (scroll || 0) * t * L.f * 0.5)) % w + w) % w;
    const ox = Math.round(off) - w;
    for (let x = ox; x < VW; x += w) c.drawImage(L.cv, x, L.y);
  }
  if (th.haze) { c.fillStyle = th.haze; c.fillRect(0, VH - 120, VW, 70); }
}

// ---------- Props ----------
function drawCrate(c, x, y, w, h, dmg) {
  px(c, x, y, w, h, '#6a4220');
  px(c, x + 1, y + 1, w - 2, h - 2, '#a8743a');
  for (let yy = y + 5; yy < y + h - 2; yy += 5) px(c, x + 1, yy, w - 2, 1, '#8a5a2a');
  px(c, x + 1, y + 1, w - 2, 1, '#c89050');
  for (let i = 1; i < Math.min(w, h) - 1; i++) px(c, x + i, y + h - 1 - i, 2, 1, '#6a4220');
  px(c, x + 1, y + 1, 1, 1, '#3a2a1a'); px(c, x + w - 2, y + 1, 1, 1, '#3a2a1a'); px(c, x + 1, y + h - 2, 1, 1, '#3a2a1a'); px(c, x + w - 2, y + h - 2, 1, 1, '#3a2a1a');
  if (dmg > 0.4) { px(c, x + 5, y + 4, 1, 6, '#3a2010'); px(c, x + 6, y + 9, 3, 1, '#3a2010'); }
  if (dmg > 0.7) { px(c, x + w - 7, y + h - 9, 1, 6, '#3a2010'); px(c, x + w - 9, y + h - 4, 3, 1, '#3a2010'); }
}
function drawBarrel(c, x, y, w, h, t, hurt) {
  px(c, x + 1, y, w - 2, h, '#9a3020'); px(c, x, y + 2, w, h - 4, '#b8402a');
  px(c, x + 2, y + 2, 2, h - 4, '#d86a4a');
  px(c, x, y + 3, w, 2, '#3a2a2a'); px(c, x, y + h - 5, w, 2, '#3a2a2a');
  pixText(c, '!', x + w / 2, y + 7, hurt && (t * 10 | 0) % 2 ? '#ffffff' : '#ffe070', 1, 'center');
}
function drawBoards(c, x, y, w, h, dmg) {
  px(c, x, y, w, h, '#2a1a10');
  for (let xx = x; xx < x + w; xx += 5) {
    px(c, xx, y, 4, h, ((xx / 5) | 0) % 2 ? '#9a6a3a' : '#8a5c32');
    px(c, xx + 1, y + 3, 1, 1, '#4a4a4a'); px(c, xx + 1, y + h - 4, 1, 1, '#4a4a4a');
  }
  px(c, x, y + Math.floor(h / 3), w, 2, '#6a4422');
  if (dmg > 0.3) { px(c, x + 3, y + 6, 1, 8, '#1a0e08'); px(c, x + w - 6, y + h - 14, 1, 9, '#1a0e08'); }
}
function drawGate(c, x, y, w, h) {
  px(c, x, y, w, h, '#4a2e1a');
  for (let xx = x; xx < x + w; xx += 4) px(c, xx, y, 1, h, '#3a2212');
  for (let yy = y + 6; yy < y + h; yy += 16) { px(c, x, yy, w, 3, '#3c3c44'); px(c, x + 1, yy + 1, 1, 1, '#8a8a96'); px(c, x + w - 2, yy + 1, 1, 1, '#8a8a96'); }
  px(c, x - 1, y - 3, w + 2, 3, '#2a1a10');
}
function drawDoor(c, x, y, w, h) {
  px(c, x - 2, y - 2, w + 4, h + 2, '#3a2414');
  px(c, x, y, w, h, '#7a4a28');
  for (let xx = x + 3; xx < x + w; xx += 4) px(c, xx, y, 1, h, '#5a341c');
  px(c, x + w - 4, y + h / 2, 2, 2, '#d8b040');
}
function drawRockWall(c, x, y, w, h, bg) {
  c.fillStyle = bg.pattern; c.fillRect(x, y, w, h);
  px(c, x, y, w, 1, shade(bg.th.rock[0], 0.1)); px(c, x, y + h - 1, w, 1, '#120c08');
}
function drawWoodWall(c, x, y, w, h) {
  px(c, x, y, w, h, '#7a5030');
  for (let yy = y; yy < y + h; yy += 4) px(c, x, yy, w, 1, '#5a3820');
  px(c, x, y, 1, h, '#4a2c18'); px(c, x + w - 1, y, 1, h, '#4a2c18');
}
function drawCart(c, x, y, w, h) {
  px(c, x + 1, y + 2, w - 2, h - 6, '#5a5a62'); px(c, x, y + 2, w, 2, '#7a7a84');
  px(c, x + 3, y, w - 6, 3, '#d8b040'); px(c, x + 5, y - 1, 3, 2, '#f0d060'); px(c, x + w - 9, y - 1, 3, 2, '#c89a30');
  pcircle(c, x + 4, y + h - 3, 2, '#2a2a2e'); pcircle(c, x + w - 5, y + h - 3, 2, '#2a2a2e');
}
function drawTrainCar(c, s, t) {
  const { x, y, w, h } = s, v = s.variant || 'box';
  const wheelY = y + h + 6;
  for (const wx of [x + 14, x + 30, x + w - 30, x + w - 14]) {
    pcircle(c, wx, wheelY, 6, '#1a1a1e'); pcircle(c, wx, wheelY, 4, '#3a3a40');
    const a = t * 18 + wx; px(c, Math.round(wx + Math.cos(a) * 3), Math.round(wheelY + Math.sin(a) * 3), 1, 1, '#9a9aa4');
  }
  px(c, x + 6, y + h, w - 12, 4, '#1e1e22');
  if (v === 'flat') {
    px(c, x, y, w, h, '#5a3a22'); px(c, x, y, w, 2, '#8a5a32'); for (let xx = x; xx < x + w; xx += 8) px(c, xx, y + 2, 1, h - 2, '#3a2412');
    return;
  }
  if (v === 'engine') {
    px(c, x, y, w, h, '#26262c');
    px(c, x + 4, y + 8, w - 50, h - 8, '#34343c'); px(c, x + 4, y + 10, w - 50, 2, '#5a5a66');
    px(c, x + w - 46, y - 24, 44, h + 24, '#2a2a30'); px(c, x + w - 42, y - 18, 14, 12, '#ffcc66');
    px(c, x + 30, y - 30, 12, 30, '#1e1e22'); px(c, x + 26, y - 34, 20, 5, '#1e1e22');
    px(c, x - 8, y + h - 8, 10, 8, '#a02a20'); px(c, x - 4, y + 10, 6, 6, '#fff0a0');
    for (let xx = x + 8; xx < x + w - 50; xx += 18) px(c, xx, y + 4, 4, 4, '#d8b040');
    px(c, x, y + h - 3, w, 3, '#a02a20');
    return;
  }
  const body = v === 'pass' ? '#3a4a2e' : v === 'tender' ? '#2a2a30' : '#7a2e22';
  px(c, x, y, w, h, body);
  px(c, x, y, w, 3, shade(body, 0.2)); px(c, x - 2, y - 2, w + 4, 2, '#2a1a14');
  if (v === 'box') {
    for (let xx = x + 3; xx < x + w; xx += 6) px(c, xx, y + 4, 1, h - 6, shade(body, -0.2));
    px(c, x + w / 2 - 14, y + 10, 28, h - 14, shade(body, -0.15)); px(c, x + w / 2 - 14, y + 10, 28, 2, '#2a1a14');
    pixText(c, 'GOLD EXPRESS', x + w / 2, y + 20, '#e0b040', 1, 'center');
  } else if (v === 'pass') {
    for (let xx = x + 8; xx < x + w - 10; xx += 18) { px(c, xx, y + 10, 10, 12, '#1a1a14'); px(c, xx + 1, y + 11, 8, 10, (Math.sin(t + xx) > -0.8) ? '#f0c060' : '#c89040'); }
  } else if (v === 'tender') {
    px(c, x + 2, y - 4, w - 4, 6, '#141414'); for (let xx = x + 4; xx < x + w - 4; xx += 5) px(c, xx, y - 6, 3, 2, '#202020');
  }
  px(c, x, y + h - 3, w, 3, '#1a1010');
}

function drawPlatform(c, p, th) {
  const wood = th && th.cave ? '#7a5434' : '#9a6a3a';
  px(c, p.x, p.y, p.w, 4, wood);
  px(c, p.x, p.y, p.w, 1, shade(wood, 0.25));
  px(c, p.x, p.y + 3, p.w, 1, shade(wood, -0.35));
  for (let xx = p.x + 7; xx < p.x + p.w; xx += 12) px(c, xx, p.y + 1, 1, 2, shade(wood, -0.3));
  if (p.posts) for (let xx = p.x + 2; xx < p.x + p.w; xx += Math.max(30, p.w - 6)) px(c, xx, p.y + 4, 3, (p.postTo || GY) - p.y - 4, shade(wood, -0.25));
  if (p.rail) { for (let xx = p.x; xx < p.x + p.w; xx += 6) px(c, xx, p.y - 8, 1, 8, shade(wood, -0.2)); px(c, p.x, p.y - 9, p.w, 1, wood); }
}

function drawSaguaro(c, x, y, h, seed) {
  const base = '#b5b03e', dark = '#8a8a2a', hi = '#d6d064', spine = '#f2eaa8';
  px(c, x - 3, y - h, 7, h, base); px(c, x - 2, y - h - 1, 5, 1, base);
  px(c, x - 1, y - h, 1, h, dark); px(c, x + 2, y - h, 1, h, dark); px(c, x - 3, y - h, 1, h, hi);
  const a1 = Math.floor(h * 0.45), a2 = Math.floor(h * 0.6);
  px(c, x - 8, y - a1, 6, 4, base); px(c, x - 8, y - a1 - 10, 4, 12, base); px(c, x - 8, y - a1 - 10, 1, 12, hi);
  if (seed % 2) { px(c, x + 3, y - a2, 5, 4, base); px(c, x + 5, y - a2 - 8, 4, 10, base); px(c, x + 7, y - a2 - 8, 1, 10, dark); }
  for (let i = 0; i < h; i += 4) { px(c, x - 4, y - h + i, 1, 1, spine); px(c, x + 4, y - h + i + 2, 1, 1, spine); }
  if (seed % 3 === 0) px(c, x, y - h - 2, 2, 2, '#e8507a');
}
function drawBarrelCactus(c, x, y, r) {
  pcircle(c, x, y - r, r, '#b5b03e'); for (let i = -r + 2; i < r; i += 3) px(c, x + i, y - 2 * r + 2, 1, 2 * r - 2, '#8a8a2a');
  px(c, x - r + 1, y - r - 1, 1, 3, '#d6d064'); px(c, x, y - 2 * r - 1, 2, 2, '#e8507a');
}

function drawBuilding(c, d, t) {
  const { x, w, h } = d, y = (d.y || GY) - h;
  const body = d.color || '#a8744a', dk = shade(body, -0.3);
  px(c, x, y + 10, w, h - 10, body);
  for (let yy = y + 12; yy < y + h; yy += 4) px(c, x, yy, w, 1, shade(body, -0.12));
  // false front
  px(c, x + 2, y, w - 4, 12, shade(body, 0.08)); px(c, x, y - 2, w, 3, dk);
  if (d.name) { px(c, x + w / 2 - textW(d.name) / 2 - 3, y + 2, textW(d.name) + 6, 8, '#2a1a10'); pixText(c, d.name, x + w / 2, y + 3, '#f0d080', 1, 'center'); }
  // windows (upper)
  for (let wx = x + 8; wx < x + w - 12; wx += 20) { px(c, wx, y + 18, 9, 11, '#3a2414'); px(c, wx + 1, y + 19, 7, 9, d.lit ? '#f0c060' : '#5a6a7a'); px(c, wx + 4, y + 19, 1, 9, '#3a2414'); }
  // porch roof
  px(c, x - 4, y + h - 44, w + 8, 4, dk); for (let px2 = x; px2 <= x + w; px2 += Math.max(24, w / 3)) px(c, Math.min(px2, x + w - 2), y + h - 40, 2, 40, dk);
  // door
  const dx = x + w / 2 - 7;
  if (d.saloon) { px(c, dx, y + h - 34, 14, 34, '#1a0e08'); const sw = Math.sin(t * 2) > 0.95 ? 1 : 0; px(c, dx + sw, y + h - 24, 6, 12, '#8a5a30'); px(c, dx + 8 - sw, y + h - 24, 6, 12, '#8a5a30'); }
  else { px(c, dx, y + h - 30, 14, 30, '#3a2414'); px(c, dx + 1, y + h - 29, 12, 29, '#6a4226'); px(c, dx + 10, y + h - 15, 1, 2, '#d8b040'); }
  px(c, x + 6, y + h - 26, 10, 10, '#3a2414'); px(c, x + w - 16, y + h - 26, 10, 10, '#3a2414');
  px(c, x + 7, y + h - 25, 8, 8, d.lit ? '#e8b050' : '#4a5a6a'); px(c, x + w - 15, y + h - 25, 8, 8, d.lit ? '#e8b050' : '#4a5a6a');
}

function drawDeco(c, d, t, bg) {
  const y = d.y != null ? d.y : GY;
  switch (d.t) {
    case 'building': drawBuilding(c, d, t); break;
    case 'cactus': drawSaguaro(c, d.x, y, d.h || 30, d.x | 0); break;
    case 'bcactus': drawBarrelCactus(c, d.x, y, d.r || 5); break;
    case 'rock': px(c, d.x - 6, y - 5, 12, 5, '#8a6a52'); px(c, d.x - 4, y - 7, 8, 2, '#a8846a'); px(c, d.x - 6, y - 1, 12, 1, '#5a4434'); break;
    case 'skull': px(c, d.x, y - 3, 4, 3, '#ece4d0'); px(c, d.x + 1, y - 2, 1, 1, '#2a2020'); px(c, d.x - 3, y - 1, 3, 1, '#ece4d0'); px(c, d.x + 4, y - 1, 3, 1, '#ece4d0'); break;
    case 'bush': px(c, d.x - 5, y - 4, 10, 4, '#8a8a48'); px(c, d.x - 3, y - 6, 6, 2, '#a0a058'); px(c, d.x - 6, y - 1, 12, 1, '#5a5a30'); break;
    case 'fence': for (let xx = d.x; xx < d.x + d.w; xx += 12) px(c, xx, y - 14, 2, 14, '#6a4a2a'); px(c, d.x, y - 12, d.w, 2, '#8a6038'); px(c, d.x, y - 6, d.w, 2, '#8a6038'); break;
    case 'sign': {
      px(c, d.x - 1, y - 20, 3, 20, '#5a3a20');
      const tw2 = Math.max(24, textW(d.label || '') + 6);
      px(c, d.x - tw2 / 2, y - 26, tw2, 9, '#8a5a30'); px(c, d.x - tw2 / 2, y - 26, tw2, 1, '#b07a44');
      if (d.label) pixText(c, d.label, d.x, y - 24, '#2a1a10', 1, 'center');
      break;
    }
    case 'tent': {
      for (let i = 0; i < 22; i++) px(c, d.x - i, y - 22 + i, i * 2 + 1, 1, i % 4 === 0 ? '#c8b088' : '#e0cca0');
      px(c, d.x - 3, y - 12, 6, 12, '#4a3020'); px(c, d.x, y - 26, 1, 4, '#5a3a20');
      break;
    }
    case 'campfire': {
      px(c, d.x - 6, y - 2, 12, 2, '#4a2a18'); px(c, d.x - 5, y - 3, 3, 1, '#6a4020'); px(c, d.x + 2, y - 3, 3, 1, '#6a4020');
      for (let i = 0; i < 6; i++) { const h = 3 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 7 | 0; px(c, d.x - 4 + i * 1.5 | 0, y - 2 - h, 2, h, i % 2 ? '#ffb040' : '#ff6a20'); }
      px(c, d.x - 1, y - 6, 2, 3, '#fff0a0');
      break;
    }
    case 'lantern': {
      if (d.post) px(c, d.x - 1, y - 30, 2, 30, '#4a3020');
      const ly = d.post ? y - 34 : y;
      px(c, d.x - 2, ly, 5, 6, '#3a2a1a'); px(c, d.x - 1, ly + 1, 3, 4, (t * 7 | 0) % 9 ? '#ffd070' : '#ffb040');
      break;
    }
    case 'torch': {
      px(c, d.x - 1, y - 24, 3, 24, '#4a3020');
      for (let i = 0; i < 3; i++) { const h = 4 + Math.abs(Math.sin(t * 11 + i * 2)) * 5 | 0; px(c, d.x - 2 + i * 2, y - 24 - h, 2, h, i === 1 ? '#ffd060' : '#ff6a20'); }
      break;
    }
    case 'waterTower': {
      px(c, d.x - 18, y - 70, 3, 70, '#5a3a20'); px(c, d.x + 15, y - 70, 3, 70, '#5a3a20');
      for (let i = 0; i < 3; i++) px(c, d.x - 18, y - 60 + i * 20, 36, 2, '#5a3a20');
      px(c, d.x - 22, y - 100, 44, 32, '#8a5a32'); for (let xx = d.x - 22; xx < d.x + 22; xx += 4) px(c, xx, y - 100, 1, 32, '#6a4224');
      px(c, d.x - 22, y - 92, 44, 2, '#3a3a40'); px(c, d.x - 22, y - 76, 44, 2, '#3a3a40');
      for (let i = 0; i < 12; i++) px(c, d.x - 12 + i, y - 112 + Math.abs(i - 6), 24 - i * 2, 1, '#6a4224');
      break;
    }
    case 'windmill': {
      px(c, d.x - 1, y - 80, 3, 80, '#4a3020'); px(c, d.x - 8, y - 4, 2, 4, '#4a3020');
      for (let k = 0; k < 8; k++) { const a = t * 1.4 + k * TAU / 8; for (let r = 3; r < 16; r++) px(c, Math.round(d.x + Math.cos(a) * r), Math.round(y - 82 + Math.sin(a) * r), 1, 1, r > 6 ? '#c8b088' : '#5a4030'); }
      px(c, d.x - 1, y - 84, 4, 4, '#3a2a20');
      break;
    }
    case 'beam': px(c, d.x, y - 92, 6, 92, '#5a3a1c'); px(c, d.x + 1, y - 92, 1, 92, '#7a5228'); px(c, d.x - 4, y - 96, 14, 6, '#4a3018'); break;
    case 'rails': for (let xx = d.x; xx < d.x + d.w; xx += 8) px(c, xx, y - 2, 5, 2, '#4a3020'); px(c, d.x, y - 3, d.w, 1, '#7a7a84'); break;
    case 'poster': px(c, d.x, y - 34, 12, 15, '#e8d8b0'); pixText(c, 'WANTED', d.x + 6, y - 33, '#4a2a1a', 1, 'center'); px(c, d.x + 3, y - 26, 6, 5, '#8a6a4a'); px(c, d.x + 2, y - 20, 8, 1, '#4a2a1a'); break;
    case 'hay': px(c, d.x - 8, y - 9, 16, 9, '#d8b858'); for (let i = 0; i < 16; i += 3) px(c, d.x - 8 + i, y - 9, 1, 9, '#b89838'); px(c, d.x - 8, y - 6, 16, 1, '#8a6a28'); break;
    case 'wheel': pcircle(c, d.x, y - 8, 8, '#5a3a20'); pcircle(c, d.x, y - 8, 6, '#00000000'); for (let k = 0; k < 6; k++) { const a = k * TAU / 6; for (let r = 0; r < 7; r++) px(c, Math.round(d.x + Math.cos(a) * r), Math.round(y - 8 + Math.sin(a) * r), 1, 1, '#7a5230'); } break;
    case 'flag': { px(c, d.x, y - 60, 2, 60, '#3a2a20'); for (let i = 0; i < 18; i++) px(c, d.x + 2 + i, y - 58 + Math.round(Math.sin(t * 5 + i * 0.5) * 1.5), 1, 10, i % 6 < 3 ? '#a01818' : '#8a1414'); pixText(c, 'X', d.x + 11, y - 55, '#1a1010'); break; }
    case 'cross': px(c, d.x - 1, y - 14, 3, 14, '#6a4a2a'); px(c, d.x - 5, y - 11, 11, 2, '#6a4a2a'); break;
    case 'pole': px(c, d.x, y - 70, 2, 70, '#2a2030'); px(c, d.x - 6, y - 66, 14, 2, '#2a2030'); break;
    case 'crystal': px(c, d.x, y - 6, 2, 6, '#7ac8e8'); px(c, d.x + 2, y - 4, 2, 4, '#4a9ac0'); break;
    case 'lever': {
      px(c, d.x - 6, y - 8, 12, 8, '#3a3a40');
      const a = d.on ? 0.6 : -0.6;
      for (let r = 0; r < 14; r++) px(c, Math.round(d.x + Math.sin(a) * r), Math.round(y - 8 - Math.cos(a) * r), 2, 1, '#8a8a96');
      px(c, Math.round(d.x + Math.sin(a) * 14) - 1, Math.round(y - 8 - Math.cos(a) * 14) - 1, 4, 3, '#c83020');
      break;
    }
    case 'gibbet': px(c, d.x, y - 50, 3, 50, '#3a2414'); px(c, d.x, y - 50, 20, 3, '#3a2414'); px(c, d.x + 17, y - 47, 1, 12, '#8a7a5a'); break;
    case 'text': pixText(c, d.label, d.x, y, d.color || '#f0d080', d.sc || 1, 'center', '#2a1a10'); break;
    case 'deadtree': {
      const h = d.h || 60, cl = '#2a1e1e';
      px(c, d.x - 2, y - h, 4, h, cl); px(c, d.x - 3, y - 4, 6, 4, cl);
      for (const [by, dir, len] of [[0.45, -1, 14], [0.6, 1, 12], [0.78, -1, 9], [0.88, 1, 7]]) {
        const yy = Math.round(y - h * by);
        for (let i = 0; i < len; i++) px(c, d.x + dir * (2 + i), yy - Math.floor(i / 2), 1, 1, cl);
      }
      break;
    }
    case 'grave': px(c, d.x - 4, y - 11, 8, 11, '#7a7a80'); px(c, d.x - 3, y - 12, 6, 1, '#7a7a80'); px(c, d.x - 4, y - 11, 1, 11, '#9a9aa2'); px(c, d.x - 1, y - 9, 2, 5, '#4a4a52'); px(c, d.x - 2, y - 8, 4, 1, '#4a4a52'); px(c, d.x - 5, y - 1, 10, 1, '#4a3a2a'); break;
    case 'tower': {
      const w = d.w || 60, top = d.top || 120, wood = '#4a3428';
      px(c, d.x, top, 4, y - top, wood); px(c, d.x + w - 4, top, 4, y - top, wood);
      for (let yy = top + 20; yy < y; yy += 40) for (let i = 0; i < w - 8; i += 2) { px(c, d.x + 4 + i, yy + Math.round(i * 30 / w), 2, 1, wood); px(c, d.x + w - 6 - i, yy + Math.round(i * 30 / w), 2, 1, wood); }
      for (let i = 0; i < w / 2 + 6; i++) px(c, d.x + w / 2 - i, top - 26 + Math.round(i * 0.7), i * 2, 1, '#2e2024');
      px(c, d.x + w / 2 - 1, top - 40, 2, 14, '#5a4a3a'); px(c, d.x + w / 2 - 4, top - 36, 8, 2, '#5a4a3a');
      break;
    }
    case 'bell': {
      const sw = d.on ? Math.sin(t * 8) * 3 : 0;
      px(c, d.x - 10, y - 26, 20, 3, '#4a3428');
      const bx = Math.round(d.x + sw);
      px(c, bx - 1, y - 23, 2, 3, '#2a2a2a'); px(c, bx - 4, y - 20, 8, 8, '#b8903a'); px(c, bx - 6, y - 12, 12, 3, '#b8903a'); px(c, bx - 3, y - 20, 2, 8, '#e0c060'); px(c, bx - 1, y - 9, 2, 2, '#4a3a2a');
      break;
    }
    case 'cabin': {
      const top = y - d.h;
      px(c, d.x, top, d.w, d.h, '#e0d8c4'); for (let yy = top + 3; yy < y; yy += 4) px(c, d.x, yy, d.w, 1, '#c8bea8');
      for (let wx = d.x + 10; wx < d.x + d.w - 12; wx += 28) { px(c, wx, top + 12, 10, 14, '#3a2a20'); px(c, wx + 1, top + 13, 8, 12, (t * 2 + wx) % 9 > 1 ? '#f0c060' : '#d8a040'); px(c, wx + 4, top + 13, 1, 12, '#3a2a20'); }
      px(c, d.x, top, d.w, 2, '#8a2a20');
      break;
    }
    case 'smokestack': px(c, d.x - 5, y - d.h, 10, d.h, '#1e1e24'); px(c, d.x - 4, y - d.h, 2, d.h, '#3a3a44'); px(c, d.x - 8, y - d.h - 4, 16, 4, '#2a2a30'); for (let i = 0; i < 8; i += 2) px(c, d.x - 8 + i * 2, y - d.h - 7, 2, 3, '#2a2a30'); break;
    case 'paddlewheel': {
      const r = d.r || 36, cy = y - r;
      for (let k = 0; k < 10; k++) { const a = t * 1.6 + k * TAU / 10; for (let rr = 4; rr < r; rr++) px(c, Math.round(d.x + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 2, 2, rr > r - 8 ? '#b82a20' : '#5a2a1a'); }
      pcircle(c, d.x, cy, 4, '#3a2a20');
      break;
    }
    case 'cannon': pcircle(c, d.x - 4, y - 5, 5, '#4a3020'); pcircle(c, d.x - 4, y - 5, 2, '#2a1a10'); for (let i = 0; i < 18; i++) px(c, d.x - 6 + i, y - 10 - Math.round(i * 0.4), 4, 4, '#2a2a30'); break;
    case 'flagpole': { px(c, d.x, y - 90, 2, 90, '#d8d0c0'); for (let i = 0; i < 22; i++) for (let s = 0; s < 6; s++) px(c, d.x + 2 + i, y - 88 + s * 2 + Math.round(Math.sin(t * 4 + i * 0.4) * 1.5), 1, 2, s % 2 ? '#e8e0d0' : '#2a4a8a'); break; }
    case 'stockade': for (let x = d.x; x < d.x + d.w; x += 6) { const lh = (d.h || 70) + ((x * 7) % 5); px(c, x, y - lh, 5, lh, '#6a4428'); px(c, x, y - lh, 1, lh, '#8a5a34'); px(c, x + 1, y - lh - 2, 3, 2, '#6a4428'); } break;
    case 'reeds': for (let i = 0; i < 6; i++) px(c, d.x + i * 3, y - 6 - (i * 5) % 7, 1, 6 + (i * 5) % 7, '#5a7a3a'); break;
  }
}

function drawPickup(c, p, t) {
  const x = Math.round(p.x), y = Math.round(p.y + Math.sin(t * 4 + p.x) * (p.type === 'cash' ? 0 : 1));
  if (p.blink && (t * 10 | 0) % 2) return;
  switch (p.type) {
    case 'cash': { const s = Math.abs(Math.cos(t * 5 + p.x)); const w = Math.max(1, Math.round(s * 4)); px(c, x - w / 2 | 0, y - 4, w, 4, '#f0c840'); px(c, x - (w / 2 | 0), y - 4, 1, 1, '#fff2a0'); break; }
    case 'ammo': px(c, x - 5, y - 7, 10, 7, '#5a6a3a'); px(c, x - 5, y - 7, 10, 1, '#7a8a52'); px(c, x - 3, y - 10, 2, 3, '#e0b040'); px(c, x, y - 10, 2, 3, '#e0b040'); px(c, x + 3, y - 10, 1, 3, '#e0b040'); pixText(c, 'A', x, y - 6, '#e8e0c0', 1, 'center'); break;
    case 'health': px(c, x - 2, y - 10, 4, 3, '#6a4a2a'); px(c, x - 3, y - 7, 6, 7, '#8a5a2a'); px(c, x - 2, y - 6, 4, 4, '#e8d8b0'); px(c, x - 1, y - 6, 2, 4, '#c83030'); px(c, x - 2, y - 5, 4, 2, '#c83030'); break;
    case 'tonic': px(c, x - 1, y - 11, 2, 3, '#4a3020'); px(c, x - 3, y - 8, 6, 8, '#5a3a8a'); px(c, x - 2, y - 7, 1, 5, '#a88ae0'); pixText(c, 'E', x, y - 6, '#ffe070', 1, 'center'); break;
    case 'gold': if (p.box) { px(c, x - 7, y - 10, 14, 10, '#4a4a54'); px(c, x - 7, y - 10, 14, 2, '#7a7a86'); px(c, x - 7, y - 6, 14, 1, '#2a2a30'); px(c, x - 1, y - 7, 3, 3, '#d8b040'); if ((t * 3 | 0) % 2) px(c, x + 5, y - 11, 1, 1, '#ffffff'); break; }
      px(c, x - 6, y - 10, 12, 10, '#8a6a3a'); px(c, x - 4, y - 12, 8, 2, '#6a4a2a'); px(c, x - 6, y - 10, 12, 1, '#a8885a'); pixText(c, '$', x, y - 8, '#ffe070', 1, 'center'); if ((t * 3 | 0) % 2) px(c, x + 4, y - 12, 1, 1, '#ffffff'); break;
    case 'stash': px(c, x - 5, y - 9, 10, 9, '#3a5a2a'); px(c, x - 5, y - 9, 10, 1, '#5a8a3a'); pixText(c, '$', x, y - 7, '#f0e080', 1, 'center'); break;
  }
}

function drawTumbleweed(c, x, y, a) {
  const cx = Math.round(x), cy = Math.round(y);
  for (let k = 0; k < 14; k++) {
    const aa = a + k * 2.4, r = 2 + (k % 5);
    px(c, Math.round(cx + Math.cos(aa) * r), Math.round(cy + Math.sin(aa) * r), 1, 1, k % 3 ? '#a8784a' : '#c8945a');
  }
  pcircle(c, cx, cy, 5, 'rgba(140,96,56,0.35)');
}

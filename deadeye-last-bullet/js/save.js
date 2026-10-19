'use strict';
// Persistence: campaign save + settings, both validated on load.
const SAVE_KEY = 'deadeye_last_bullet_save_v1';
const SETTINGS_KEY = 'deadeye_last_bullet_settings_v1';

function defaultSave() {
  return {
    version: 1, started: false, cash: 0,
    completed: {}, replays: {}, bestTimes: {}, unlocked: ['m1'],
    owned: ['revolver'], loadout: ['revolver', null, null, null], weaponLv: {},
    upgrades: {}, skins: ['walnut'], skin: 'walnut', difficulty: 'normal', finalBeat: false,
    stats: { kills: 0, headshots: 0, deaths: 0 },
  };
}

function defaultKeys() {
  return {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], jump: ['Space', 'KeyW'], crouch: ['KeyS', 'ArrowDown'],
    dodge: ['ShiftLeft', 'ShiftRight'], reload: ['KeyR', ''], interact: ['KeyE', ''], deadeye: ['KeyQ', ''],
    w1: ['Digit1', ''], w2: ['Digit2', ''], w3: ['Digit3', ''], w4: ['Digit4', ''],
  };
}
function defaultPad() {
  return { jump: 0, dodge: 1, reload: 2, interact: 3, deadeye: 4, next: 5, prev: 12, aim: 6, shoot: 7, crouch: 13, pause: 9 };
}
function defaultSettings() {
  return {
    master: 0.8, music: 0.55, sfx: 0.8, shake: 1, dmgNumbers: true, fullscreen: false, scaling: 'fit', crt: false,
    sensitivity: 1, pointerLock: false, aimAssist: 'low', padDeadzone: 0.2, keys: defaultKeys(), pad: defaultPad(),
  };
}

const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v)) ? clamp(v, lo, hi) : d;
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

function validateSave(d) {
  const s = defaultSave();
  if (!isObj(d)) return s;
  s.started = !!d.started;
  s.cash = Math.floor(num(d.cash, 0, 1e9, 0));
  s.finalBeat = !!d.finalBeat;
  if (isObj(d.completed)) for (const k in d.completed) if (MISSION_BY_ID[k] && d.completed[k]) s.completed[k] = true;
  if (isObj(d.replays)) for (const k in d.replays) if (MISSION_BY_ID[k]) s.replays[k] = Math.floor(num(d.replays[k], 0, 999, 0));
  if (isObj(d.bestTimes)) for (const k in d.bestTimes) if (MISSION_BY_ID[k]) { const t = num(d.bestTimes[k], 1, 1e6, 0); if (t) s.bestTimes[k] = t; }
  if (Array.isArray(d.unlocked)) s.unlocked = [...new Set(['m1', ...d.unlocked.filter(id => MISSION_BY_ID[id])])];
  // Anything completed must also unlock what it unlocks (repairs partial saves).
  for (const k in s.completed) for (const u of (MISSION_BY_ID[k].unlocks || [])) if (!s.unlocked.includes(u)) s.unlocked.push(u);
  if (Array.isArray(d.owned)) s.owned = [...new Set(['revolver', ...d.owned.filter(w => WEAPONS[w])])];
  if (Array.isArray(d.loadout)) {
    const seen = new Set();
    s.loadout = [0, 1, 2, 3].map(i => {
      const w = d.loadout[i];
      if (w && s.owned.includes(w) && !seen.has(w)) { seen.add(w); return w; }
      return null;
    });
    if (!s.loadout.some(Boolean)) s.loadout[0] = 'revolver';
  }
  if (isObj(d.weaponLv)) for (const k in d.weaponLv) if (WEAPONS[k]) s.weaponLv[k] = Math.floor(num(d.weaponLv[k], 0, WEAPON_UPG_MAX, 0));
  const upgIds = new Map(UPGRADES.flatMap(c => c.items).map(u => [u.id, u.max]));
  if (isObj(d.upgrades)) for (const k in d.upgrades) if (upgIds.has(k)) s.upgrades[k] = Math.floor(num(d.upgrades[k], 0, upgIds.get(k), 0));
  if (Array.isArray(d.skins)) s.skins = [...new Set(['walnut', ...d.skins.filter(k => SKINS[k])])];
  if (SKINS[d.skin] && s.skins.includes(d.skin)) s.skin = d.skin;
  if (DIFFS[d.difficulty]) s.difficulty = d.difficulty;
  if (isObj(d.stats)) for (const k of ['kills', 'headshots', 'deaths']) s.stats[k] = Math.floor(num(d.stats[k], 0, 1e9, 0));
  return s;
}

function validateSettings(d) {
  const s = defaultSettings();
  if (!isObj(d)) return s;
  for (const k of ['master', 'music', 'sfx', 'shake']) s[k] = num(d[k], 0, 1, s[k]);
  s.sensitivity = num(d.sensitivity, 0.2, 3, 1);
  s.padDeadzone = num(d.padDeadzone, 0.05, 0.5, 0.2);
  s.dmgNumbers = d.dmgNumbers !== false;
  s.fullscreen = !!d.fullscreen;
  s.crt = !!d.crt;
  s.pointerLock = !!d.pointerLock;
  if (['fit', 'integer'].includes(d.scaling)) s.scaling = d.scaling;
  if (['off', 'low', 'high'].includes(d.aimAssist)) s.aimAssist = d.aimAssist;
  if (isObj(d.keys)) for (const a in s.keys) {
    const v = d.keys[a];
    if (Array.isArray(v)) s.keys[a] = [0, 1].map(i => typeof v[i] === 'string' ? v[i].slice(0, 32) : s.keys[a][i]);
  }
  if (isObj(d.pad)) for (const a in s.pad) {
    const v = d.pad[a];
    if (Number.isInteger(v) && v >= 0 && v < 17) s.pad[a] = v;
  }
  return s;
}

function readJSON(key) {
  let raw;
  try { raw = localStorage.getItem(key); } catch (e) { return { ok: false, data: null }; }
  if (raw == null) return { ok: true, data: null };
  try { return { ok: true, data: JSON.parse(raw) }; }
  catch (e) {
    try { localStorage.setItem(key + '_corrupt', raw); } catch (_) {}
    return { ok: false, data: null, corrupt: true };
  }
}
function writeJSON(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; }
}

const Store = {
  save: defaultSave(), settings: defaultSettings(), warning: '',
  load() {
    const a = readJSON(SAVE_KEY), b = readJSON(SETTINGS_KEY);
    this.save = validateSave(a.data);
    this.settings = validateSettings(b.data);
    if (a.corrupt || b.corrupt) this.warning = 'Save data was damaged and has been recovered. A backup was kept.';
  },
  hasSave() { return this.save.started; },
  commit() { writeJSON(SAVE_KEY, this.save); },
  commitSettings() { writeJSON(SETTINGS_KEY, this.settings); },
  newGame() { const diff = this.save.difficulty; this.save = defaultSave(); this.save.started = true; this.save.difficulty = diff; this.commit(); },
  up(id) { return this.save.upgrades[id] || 0; },
};

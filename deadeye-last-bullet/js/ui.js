'use strict';
// DOM menus: main menu, map & bounty board, shop, upgrades, settings, pause, results, dialogs.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const UI = {
  cur: null, arg: null, sel: 'm1', tab: 'map', shopTab: 'weapons', setTab: 'audio', returnTo: 'main', setFrom: 'main', modalOpen: false, notice: '',

  init() {
    this.root = document.getElementById('ui');
    this.modal = document.getElementById('modal');
    this.toasts = document.getElementById('toasts');
    this.root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      Sound.init();
      this.act(b.dataset.act, b.dataset.v, b);
    });
    this.root.addEventListener('input', e => this.onInput(e));
    this.root.addEventListener('change', e => this.onInput(e));
    this.root.addEventListener('mouseover', e => { const b = e.target.closest('button:not([disabled])'); if (b && b !== this._hover) { this._hover = b; Sound.play('menuMove'); } });
    Input.onKey = e => this.onKey(e);
    Input.onPadNav = i => this.onPadNav(i);
    Input.onPadLost = () => { this.toast('Controller disconnected'); if (Game.state === 'play') Game.pause(); };
    Input.onLockLost = () => { if (Game.state === 'play') Game.pause(); };
    window.addEventListener('blur', () => { if (Game.state === 'play') Game.pause(); });
  },

  setGameCursor(on) { document.body.classList.toggle('playing', on); },
  hideAll() { this.cur = null; this.root.innerHTML = ''; this.root.className = ''; this.closeModal(); },
  show(name, arg) {
    this.cur = name; this.arg = arg;
    this.root.className = 'on screen-' + name;
    this.root.innerHTML = this['r_' + name](arg);
    this.afterRender(name);
    const first = this.root.querySelector('[autofocus]') || this.root.querySelector('button:not([disabled])');
    if (first && Input.usingPad) first.focus({ preventScroll: true });
  },
  refresh() { if (this.cur) { const y = this.root.querySelector('.scroll') ? this.root.querySelector('.scroll').scrollTop : 0; this.show(this.cur, this.arg); const s = this.root.querySelector('.scroll'); if (s) s.scrollTop = y; } },
  toast(text) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = text;
    this.toasts.appendChild(d);
    setTimeout(() => d.classList.add('out'), 2200);
    setTimeout(() => d.remove(), 2700);
  },
  confirm(text, yes, yesLabel) {
    this.modalOpen = true;
    this.modal.className = 'on';
    this.modal.innerHTML = `<div class="dialog panel"><p>${esc(text)}</p><div class="row"><button class="btn danger" id="dlg-yes">${esc(yesLabel || 'Yes')}</button><button class="btn" id="dlg-no">Cancel</button></div></div>`;
    const no = document.getElementById('dlg-no');
    document.getElementById('dlg-yes').onclick = () => { Sound.play('menuSelect'); this.closeModal(); yes(); };
    no.onclick = () => { Sound.play('menuBack'); this.closeModal(); };
    no.focus({ preventScroll: true });
  },
  closeModal() { this.modalOpen = false; this.modal.className = ''; this.modal.innerHTML = ''; },

  // ---------- navigation ----------
  back() {
    if (this.modalOpen) { this.closeModal(); return; }
    Sound.play('menuBack');
    switch (this.cur) {
      case 'pause': Game.resume(); break;
      case 'settings': Store.commitSettings(); this.show(this.setFrom); break;
      case 'credits': case 'missions': this.show('main'); break;
      case 'shop': case 'upgrades': this.show(this.returnTo); break;
    }
  },
  onKey(e) {
    if (e.code !== 'Escape') return false;
    if (Game.state === 'play') { Game.pause(); return true; }
    if (this.modalOpen) { this.closeModal(); return true; }
    if (this.cur) { this.back(); return true; }
    return false;
  },
  onPadNav(i) {
    if (Game.state === 'play') return false;
    if (i === 9 && Game.state === 'pause' && this.cur === 'pause') { Game.resume(); return true; }
    const scope = this.modalOpen ? this.modal : this.root;
    const els = [...scope.querySelectorAll('button:not([disabled]), input, select')].filter(el => el.offsetParent !== null);
    if (!els.length) return false;
    let idx = els.indexOf(document.activeElement);
    const a = document.activeElement;
    if (i === 12 || i === 13) { idx = idx < 0 ? 0 : (idx + (i === 13 ? 1 : -1) + els.length) % els.length; els[idx].focus(); els[idx].scrollIntoView({ block: 'nearest' }); Sound.play('menuMove'); return true; }
    if (i === 14 || i === 15) {
      const d = i === 15 ? 1 : -1;
      if (a && a.type === 'range') { a.value = +a.value + d * (+a.step || 0.05); a.dispatchEvent(new Event('input', { bubbles: true })); return true; }
      if (a && a.tagName === 'SELECT') { a.selectedIndex = clamp(a.selectedIndex + d, 0, a.options.length - 1); a.dispatchEvent(new Event('change', { bubbles: true })); return true; }
      idx = idx < 0 ? 0 : (idx + d + els.length) % els.length; els[idx].focus(); Sound.play('menuMove'); return true;
    }
    if (i === 0) { if (a && els.includes(a)) { if (a.type === 'checkbox') { a.checked = !a.checked; a.dispatchEvent(new Event('change', { bubbles: true })); } else a.click(); } else els[0].focus(); return true; }
    if (i === 1) { this.back(); return true; }
    return true;
  },

  // ---------- actions ----------
  act(a, v) {
    const sv = Store.save;
    if (!['dlgYes'].includes(a)) Sound.play('menuSelect');
    switch (a) {
      case 'play':
        if (Store.hasSave()) this.confirm('Start a new game? All campaign progress, cash and purchases will be erased.', () => { Store.newGame(); Game.startMission('m1'); }, 'Start Over');
        else { Store.newGame(); Game.startMission('m1'); }
        break;
      case 'continue': this.sel = this.nextMission(); this.tab = 'map'; this.show('missions'); break;
      case 'missions': this.tab = 'map'; this.sel = this.nextMission(); this.show('missions'); break;
      case 'shop': this.returnTo = this.cur === 'missions' ? 'missions' : 'main'; this.show('shop'); break;
      case 'upgrades': this.returnTo = this.cur === 'missions' ? 'missions' : 'main'; this.show('upgrades'); break;
      case 'settings': this.setFrom = this.cur === 'pause' ? 'pause' : 'main'; this.show('settings'); break;
      case 'credits': this.show('credits'); break;
      case 'main': this.show('main'); break;
      case 'back': this.back(); break;
      case 'tab': this.tab = v; if (v === 'board' && !MISSION_BY_ID[this.sel].side) this.sel = (MISSIONS.find(m => m.side && sv.unlocked.includes(m.id)) || MISSIONS.find(m => m.side)).id; if (v === 'map' && MISSION_BY_ID[this.sel].side) this.sel = this.nextMission(); this.refresh(); break;
      case 'sel': this.sel = v; this.refresh(); break;
      case 'diff': sv.difficulty = v; Store.commit(); this.refresh(); break;
      case 'ride': if (!sv.started) { sv.started = true; Store.commit(); } Game.startMission(v); break;
      case 'shopTab': this.shopTab = v; this.refresh(); break;
      case 'buyW': this.buyWeapon(v); break;
      case 'upW': this.upgradeWeapon(v); break;
      case 'equipW': this.equipWeapon(v); break;
      case 'buyS': this.buySkin(v); break;
      case 'equipS': sv.skin = v; Store.commit(); this.refresh(); break;
      case 'buyU': this.buyUpgrade(v); break;
      case 'setTab': this.setTab = v; this.notice = ''; this.refresh(); break;
      case 'rebind': this.rebind(v); break;
      case 'padbind': this.padRebind(v); break;
      case 'defaults': this.confirm('Restore all settings and controls to their defaults?', () => { Store.settings = defaultSettings(); Store.commitSettings(); Sound.applyVolumes(); Game.resize(); this.notice = 'Defaults restored.'; this.refresh(); }, 'Restore'); break;
      case 'fullscreen': this.toggleFullscreen(); break;
      case 'resume': Game.resume(); break;
      case 'restartCp': this.confirm('Restart from the last checkpoint? Progress since then will be lost.', () => Game.respawn(), 'Restart'); break;
      case 'quit': this.confirm('Return to the main menu? This mission\'s progress and cash will be lost.', () => { Game.quitToMenu(); this.show('main'); }, 'Quit'); break;
      case 'respawn': Game.respawn(); break;
      case 'restartMission': Game.restartMission(); break;
      case 'abandon': this.confirm('Abandon the mission? Cash picked up on this job will be lost.', () => { Game.quitToMenu(); this.tab = 'map'; this.show('missions'); }, 'Abandon'); break;
      case 'toMap': Game.quitToMenu(); this.tab = 'map'; this.sel = this.nextMission(); this.show('missions'); break;
    }
  },
  nextMission() {
    const sv = Store.save;
    const m = MISSIONS.find(m => !m.side && sv.unlocked.includes(m.id) && !sv.completed[m.id]);
    return m ? m.id : 'm6';
  },
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => this.toast('Fullscreen not available'));
  },
  spend(cost) {
    if (Store.save.cash < cost) { Sound.play('deny'); this.toast('Not enough bounty dollars'); return false; }
    Store.save.cash -= cost; Sound.play('buy'); return true;
  },
  weaponLocked(id) { const W = WEAPONS[id]; if (W.legendary) return !Store.save.finalBeat; return W.req && !Store.save.completed[W.req]; },
  buyWeapon(id) {
    const sv = Store.save;
    if (sv.owned.includes(id) || this.weaponLocked(id)) return;
    if (!this.spend(WEAPONS[id].price)) return;
    sv.owned.push(id);
    const free = sv.loadout.indexOf(null); if (free >= 0) sv.loadout[free] = id;
    Store.commit(); this.toast(WEAPONS[id].name + ' purchased'); this.refresh();
  },
  upgradeWeapon(id) {
    const sv = Store.save, lv = sv.weaponLv[id] || 0;
    if (!sv.owned.includes(id) || lv >= WEAPON_UPG_MAX) return;
    if (!this.spend(weaponUpgradeCost(id, lv))) return;
    sv.weaponLv[id] = lv + 1; Store.commit(); this.refresh();
  },
  equipWeapon(id) {
    const sv = Store.save;
    if (!sv.owned.includes(id)) return;
    const at = sv.loadout.indexOf(id);
    if (at >= 0) { if (sv.loadout.filter(Boolean).length > 1) sv.loadout[at] = null; else { Sound.play('deny'); this.toast('Keep at least one weapon equipped'); return; } }
    else { const free = sv.loadout.indexOf(null); if (free < 0) { Sound.play('deny'); this.toast('Loadout full — unequip a weapon first'); return; } sv.loadout[free] = id; }
    Store.commit(); this.refresh();
  },
  buySkin(id) {
    const sv = Store.save, S = SKINS[id];
    if (sv.skins.includes(id) || (S.reqFinal && !sv.finalBeat)) return;
    if (!this.spend(S.price)) return;
    sv.skins.push(id); sv.skin = id; Store.commit(); this.refresh();
  },
  buyUpgrade(id) {
    const u = UPGRADES.flatMap(c => c.items).find(x => x.id === id), lv = Store.up(id);
    if (!u || lv >= u.max) return;
    if (!this.spend(upgradeCost(u.base, lv))) return;
    Store.save.upgrades[id] = lv + 1; Store.commit(); this.refresh();
  },
  rebind(v) {
    const [action, slot] = v.split(':'), i = +slot, keys = Store.settings.keys;
    this.notice = `Press a key for ${ACTIONS.find(a => a[0] === action)[1]} (Esc cancels, Backspace clears)`;
    this.refresh();
    Input.capture = code => {
      if (code === 'Escape') { this.notice = 'Rebind cancelled.'; this.refresh(); return; }
      if (code === 'Backspace' || code === 'Delete') {
        if (i === 0) { this.notice = 'The primary key cannot be empty.'; } else { keys[action][1] = ''; this.notice = 'Alternate key cleared.'; }
        Store.commitSettings(); this.refresh(); return;
      }
      const old = keys[action][i];
      const clashes = [];
      for (const a in keys) for (let j = 0; j < 2; j++) if (keys[a][j] === code && !(a === action && j === i)) clashes.push([a, j]);
      keys[action][i] = code;
      let msg = `${ACTIONS.find(a => a[0] === action)[1]} → ${keyLabel(code)}.`;
      for (const [a, j] of clashes) {
        keys[a][j] = old || '';
        if (j === 0 && !keys[a][0]) keys[a][0] = defaultKeys()[a][0] !== code ? defaultKeys()[a][0] : keys[a][1];
        msg += ` ⚠ ${keyLabel(code)} was used by ${ACTIONS.find(x => x[0] === a)[1]} — swapped to ${keyLabel(keys[a][j]) || 'none'}.`;
      }
      this.notice = msg; Store.commitSettings(); this.refresh();
    };
  },
  padRebind(action) {
    this.notice = `Press a controller button for ${PAD_ACTIONS.find(a => a[0] === action)[1]}…`;
    this.refresh();
    if (!navigator.getGamepads || ![...navigator.getGamepads()].some(Boolean)) { this.notice = 'No controller detected. Connect one and press any button.'; this.refresh(); return; }
    Input.padCapture = btn => {
      const pad = Store.settings.pad, old = pad[action];
      let msg = `${PAD_ACTIONS.find(a => a[0] === action)[1]} → ${PAD_NAMES[btn]}.`;
      for (const a in pad) if (a !== action && pad[a] === btn) { pad[a] = old; msg += ` ⚠ ${PAD_NAMES[btn]} was used by ${PAD_ACTIONS.find(x => x[0] === a)[1]} — swapped.`; }
      pad[action] = btn; this.notice = msg; Store.commitSettings(); this.refresh();
    };
  },
  onInput(e) {
    const el = e.target, k = el.dataset.set;
    if (!k) return;
    const s = Store.settings;
    if (el.type === 'checkbox') s[k] = el.checked;
    else if (el.type === 'range') { s[k] = +el.value; const out = el.parentElement.querySelector('output'); if (out) out.textContent = Math.round(+el.value * 100) + '%'; }
    else s[k] = el.value;
    if (k === 'master' || k === 'music' || k === 'sfx') Sound.applyVolumes();
    if (k === 'scaling') Game.resize();
    if (k === 'fullscreen') { this.toggleFullscreen(); }
    if (e.type === 'change') Store.commitSettings();
  },

  afterRender(name) {
    for (const cv of this.root.querySelectorAll('canvas[data-gun]')) {
      const [id, skin] = cv.dataset.gun.split(':');
      const [c, x] = [cv, cv.getContext('2d')];
      x.imageSmoothingEnabled = false; x.clearRect(0, 0, c.width, c.height);
      const sk = id === 'devil' ? DEVIL_SKIN : SKINS[skin];
      const o = { armLen: -2, sleeve: 'rgba(0,0,0,0)', hand: 'rgba(0,0,0,0)', t: Game.t };
      const ox = { rifle: 15, sharp: 13, shotgun: 15, gatling: 13, boom: 13, bow: 15 }[id] || 13;
      if (id === 'dual') { drawGun(x, 'revolver', 9, 4, 0, 1, sk, o); drawGun(x, 'revolver', 18, 8, 0, 1, sk, o); }
      else drawGun(x, id === 'gatling' ? 'gatlingP' : id, ox, 6, 0, 1, sk, Object.assign({ nocked: true }, o));
    }
    for (const cv of this.root.querySelectorAll('canvas[data-face]')) {
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height);
      const L = LOOKS[cv.dataset.face];
      drawCharacter(x, L, cv.width / 2, cv.height - 2, { f: 1, state: 'idle', t: 0 });
    }
  },

  // ---------- screens ----------
  r_main() {
    const has = Store.hasSave(), sv = Store.save;
    const warn = Store.warning ? `<div class="warn">${esc(Store.warning)}</div>` : '';
    Store.warning = '';
    return `<div class="main-wrap">
      <div class="title"><h1>DEADEYE</h1><h2>— LAST BULLET —</h2></div>
      <nav class="menu">
        <button class="btn big" data-act="play">${has ? 'New Game' : 'Play'}</button>
        <button class="btn big" data-act="continue" ${has ? 'autofocus' : 'disabled'}>Continue${has ? ` <small>${fmtMoney(sv.cash)}</small>` : ''}</button>
        <button class="btn" data-act="missions">Missions</button>
        <button class="btn" data-act="shop">Weapon Shop</button>
        <button class="btn" data-act="upgrades">Upgrades</button>
        <button class="btn" data-act="settings">Settings</button>
        <button class="btn" data-act="credits">Credits</button>
      </nav>${warn}
      <div class="foot">v1.0 · Mouse + keyboard or controller · Esc pauses</div>
    </div>`;
  },

  header(title, back) {
    return `<header class="bar"><button class="btn small" data-act="${back || 'back'}">◂ Back</button><h3>${esc(title)}</h3><div class="cash">${fmtMoney(Store.save.cash)}</div></header>`;
  },

  r_missions() {
    const sv = Store.save, m = MISSION_BY_ID[this.sel];
    const nodes = MISSIONS.filter(x => !x.side).map((x, i) => {
      const un = sv.unlocked.includes(x.id), done = sv.completed[x.id];
      return `<button class="node ${done ? 'done' : ''} ${x.id === this.sel ? 'sel' : ''} ${x.map[2] === 'up' ? 'up' : ''}" style="left:${x.map[0]}%;top:${x.map[1]}%" data-act="sel" data-v="${x.id}" ${un ? '' : 'disabled'} title="${esc(x.name)}">
        <span class="pin">${done ? '✓' : un ? i + 1 : '🔒'}</span><span class="lbl">${esc(un ? x.name : '???')}</span></button>`;
    }).join('');
    // trail lines: main chain in order, branches drawn from their `from` mission
    let prev = null;
    const segs = MISSIONS.filter(x => !x.side).map(x => { const a = x.from ? MISSION_BY_ID[x.from] : prev; if (!x.from) prev = x; return a ? `<line x1="${a.map[0]}" y1="${a.map[1]}" x2="${x.map[0]}" y2="${x.map[1]}" />` : ''; }).join('');
    const board = MISSIONS.filter(x => x.side).map(x => {
      const un = sv.unlocked.includes(x.id), done = sv.completed[x.id];
      return `<button class="poster ${x.id === this.sel ? 'sel' : ''} ${done ? 'done' : ''}" data-act="sel" data-v="${x.id}" ${un ? '' : 'disabled'}>
        <span class="w">WANTED</span>${un ? `<canvas width="24" height="34" data-face="${x.poster}"></canvas>` : '<div class="unk">?</div>'}
        <span class="n">${esc(un ? x.name.replace('Wanted: ', '') : 'Unknown')}</span><span class="r">${un ? fmtMoney(x.reward) : 'Locked'}</span>${done ? '<span class="stamp">PAID</span>' : ''}</button>`;
    }).join('');
    const un = sv.unlocked.includes(m.id), done = sv.completed[m.id], reps = sv.replays[m.id] || 0;
    const D = DIFFS[sv.difficulty];
    const reward = Math.round(m.reward * D.reward * (done ? replayFactor(reps) : 1));
    const diffBtns = Object.keys(DIFFS).map(k => `<button class="btn small ${sv.difficulty === k ? 'on' : ''}" data-act="diff" data-v="${k}">${DIFFS[k].name}</button>`).join('');
    const lockedReason = !un ? (m.side ? 'Complete more of the campaign to post this bounty.' : 'Complete the previous mission to unlock.') : '';
    return `${this.header('The Frontier', 'main')}
    <div class="tabs"><button class="btn small ${this.tab === 'map' ? 'on' : ''}" data-act="tab" data-v="map">Campaign Map</button><button class="btn small ${this.tab === 'board' ? 'on' : ''}" data-act="tab" data-v="board">Bounty Board</button></div>
    <div class="mission-layout">
      ${this.tab === 'map' ? `<div class="map panel"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${segs}</svg>${nodes}<div class="compass">N</div></div>`
        : `<div class="board panel">${board}</div>`}
      <div class="detail panel">
        <div class="kind">${esc(m.kind)}</div>
        <h4>${esc(un ? m.name : '???')}</h4>
        <p>${esc(un ? m.desc : lockedReason)}</p>
        ${un ? `<ul class="goals">${m.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
        ${m.boss && un ? `<div class="bossline">Bounty target: <b>${esc(BOSSES[m.boss].name)}</b></div>` : ''}
        <div class="diffs"><span>Difficulty</span>${diffBtns}</div>
        <div class="rew">${done ? `Replay reward <b>${fmtMoney(reward)}</b> <small>(${Math.round(replayFactor(reps) * 100)}% — falls with each replay)</small>` : `Reward <b>${fmtMoney(reward)}</b> + cash & bonuses`}</div>
        ${sv.bestTimes[m.id] ? `<div class="best">Best time ${fmtTime(sv.bestTimes[m.id])} · Par ${fmtTime(m.par)}</div>` : `<div class="best">Par time ${fmtTime(m.par)}</div>`}
        <button class="btn big ride" data-act="ride" data-v="${m.id}" ${un ? 'autofocus' : 'disabled'}>${done ? 'Ride Again' : 'Ride Out'}</button>
      </div>
    </div>
    <footer class="bar"><button class="btn" data-act="shop">Weapon Shop</button><button class="btn" data-act="upgrades">Upgrades</button><button class="btn" data-act="main">Main Menu</button></footer>`;
  },

  statBars(id) {
    const W = WEAPONS[id], lv = Store.save.weaponLv[id] || 0;
    const dps = W.dmg * (W.pellets || 1) * (1 + lv * 0.1);
    const rows = [['Damage', Math.min(1, dps / 160)], ['Fire rate', Math.min(1, 0.1 / W.fire * 0.9 + 0.08)], ['Range', Math.min(1, W.range / 1400)], ['Capacity', Math.min(1, W.mag / 12)], ['Reload', Math.min(1, 0.9 / (W.reload * (1 - lv * 0.07)))]];
    return `<div class="stats">${rows.map(([n, f]) => `<div class="st"><span>${n}</span><i><b style="width:${Math.round(f * 100)}%"></b></i></div>`).join('')}</div>`;
  },

  r_shop() {
    const sv = Store.save;
    const tabs = `<div class="tabs">${[['weapons', 'Weapons'], ['skins', 'Weapon Skins']].map(([k, n]) => `<button class="btn small ${this.shopTab === k ? 'on' : ''}" data-act="shopTab" data-v="${k}">${n}</button>`).join('')}</div>`;
    let body = '';
    if (this.shopTab === 'weapons') {
      const loadout = `<div class="loadout panel"><span>Loadout (keys 1-4)</span>${sv.loadout.map((w, i) => `<div class="slot"><b>${i + 1}</b>${w ? esc(WEAPONS[w].name) : '<em>empty</em>'}</div>`).join('')}</div>`;
      body = loadout + `<div class="grid scroll">${WEAPON_ORDER.map(id => {
        const W = WEAPONS[id], owned = sv.owned.includes(id), locked = this.weaponLocked(id), lv = sv.weaponLv[id] || 0, slot = sv.loadout.indexOf(id);
        let state = '', btns = '';
        if (locked) { state = '<span class="tag lock">Locked</span>'; btns = `<div class="req">${W.legendary ? 'Defeat The Devil\'s Hand' : 'Complete “' + esc(MISSION_BY_ID[W.req].name) + '”'}</div>`; }
        else if (!owned) { state = '<span class="tag">For sale</span>'; btns = `<button class="btn" data-act="buyW" data-v="${id}" ${sv.cash < W.price ? 'disabled' : ''}>Buy ${fmtMoney(W.price)}</button>`; }
        else {
          state = slot >= 0 ? `<span class="tag eq">Equipped · slot ${slot + 1}</span>` : '<span class="tag own">Owned</span>';
          const cost = weaponUpgradeCost(id, lv);
          btns = `<button class="btn small" data-act="equipW" data-v="${id}">${slot >= 0 ? 'Unequip' : 'Equip'}</button>` +
            (lv < WEAPON_UPG_MAX ? `<button class="btn small" data-act="upW" data-v="${id}" ${sv.cash < cost ? 'disabled' : ''}>Upgrade ${fmtMoney(cost)}</button>` : '<span class="tag own">Fully upgraded</span>');
        }
        return `<div class="card panel ${locked ? 'locked' : ''}"><div class="ch"><h5>${esc(W.name)}</h5>${state}</div>
          <canvas width="36" height="12" data-gun="${id}:${sv.skin}"></canvas>
          <p>${esc(W.desc)}</p>${this.statBars(id)}
          <div class="pips">Upgrade ${'◆'.repeat(lv)}${'◇'.repeat(WEAPON_UPG_MAX - lv)} <small>+10% dmg, -7% reload per level</small></div>
          <div class="row">${btns}</div></div>`;
      }).join('')}</div>`;
    } else {
      body = `<p class="note">Skins are cosmetic only and apply to all your weapons.</p><div class="grid scroll">${SKIN_ORDER.map(id => {
        const S = SKINS[id], owned = sv.skins.includes(id), locked = S.reqFinal && !sv.finalBeat, eq = sv.skin === id;
        const btn = eq ? '<span class="tag eq">Equipped</span>' : owned ? `<button class="btn small" data-act="equipS" data-v="${id}">Equip</button>`
          : locked ? '<span class="tag lock">Defeat The Devil\'s Hand</span>' : `<button class="btn small" data-act="buyS" data-v="${id}" ${sv.cash < S.price ? 'disabled' : ''}>Buy ${fmtMoney(S.price)}</button>`;
        return `<div class="card panel skin ${locked ? 'locked' : ''}"><div class="ch"><h5>${esc(S.name)}</h5></div>
          <canvas width="36" height="12" data-gun="revolver:${id}"></canvas><canvas width="36" height="12" data-gun="rifle:${id}"></canvas>
          <div class="row">${btn}</div></div>`;
      }).join('')}</div>`;
    }
    return `${this.header('Weapon Shop')}${tabs}<div class="shop-body">${body}</div>`;
  },

  r_upgrades() {
    const cols = UPGRADES.map(c => `<div class="ucol panel"><h5>${esc(c.cat)}</h5>${c.items.map(u => {
      const lv = Store.up(u.id), max = lv >= u.max, cost = upgradeCost(u.base, lv);
      return `<div class="upg"><div class="un">${esc(u.name)}</div><div class="pips">${'◆'.repeat(lv)}${'◇'.repeat(u.max - lv)}</div>
        <div class="fx">Now: ${esc(lv ? u.fx(lv) : 'none')}</div>${max ? '<div class="fx done">Maxed</div>' : `<div class="fx next">Next: ${esc(u.fx(lv + 1))}</div>
        <button class="btn small" data-act="buyU" data-v="${u.id}" ${Store.save.cash < cost ? 'disabled' : ''}>${fmtMoney(cost)}</button>`}</div>`;
    }).join('')}</div>`).join('');
    return `${this.header('Upgrades')}<div class="ugrid scroll">${cols}</div>`;
  },

  r_settings() {
    const s = Store.settings;
    const tabs = [['audio', 'Audio'], ['game', 'Gameplay'], ['display', 'Display'], ['keys', 'Keyboard'], ['pad', 'Controller']];
    const slider = (k, label, min = 0, max = 1, step = 0.05) => `<label class="set"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-set="${k}"><output>${Math.round(s[k] * 100)}%</output></label>`;
    const toggle = (k, label) => `<label class="set"><span>${label}</span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
    const select = (k, label, opts) => `<label class="set"><span>${label}</span><select data-set="${k}">${opts.map(([v, n]) => `<option value="${v}" ${s[k] === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
    let body = '';
    switch (this.setTab) {
      case 'audio': body = slider('master', 'Master volume') + slider('music', 'Music volume') + slider('sfx', 'Sound effects volume'); break;
      case 'game': body = slider('shake', 'Screen shake') + toggle('dmgNumbers', 'Damage numbers') + slider('sensitivity', 'Mouse / stick sensitivity', 0.2, 3, 0.1) + toggle('pointerLock', 'Raw mouse aim (pointer lock)') + select('aimAssist', 'Controller aim assist', [['off', 'Off'], ['low', 'Low'], ['high', 'High']]) +
        `<p class="note">Sensitivity applies to raw mouse aim and controller aiming. Difficulty is chosen per mission on the map.</p>`; break;
      case 'display': body = `<label class="set"><span>Fullscreen</span><button class="btn small" data-act="fullscreen">${document.fullscreenElement ? 'Exit fullscreen' : 'Go fullscreen'}</button></label>` +
        select('scaling', 'Pixel scaling', [['fit', 'Fit to window'], ['integer', 'Integer (sharpest)']]) + toggle('crt', 'Scanlines'); break;
      case 'keys': body = `<div class="binds">${ACTIONS.map(([a, n]) => `<div class="bind"><span>${n}</span><button class="btn small key" data-act="rebind" data-v="${a}:0">${esc(keyLabel(s.keys[a][0]))}</button><button class="btn small key alt" data-act="rebind" data-v="${a}:1">${esc(s.keys[a][1] ? keyLabel(s.keys[a][1]) : '—')}</button></div>`).join('')}
        <div class="bind fixed"><span>Shoot / Aim</span><em>Left / Right mouse</em></div><div class="bind fixed"><span>Switch weapon</span><em>Mouse wheel</em></div><div class="bind fixed"><span>Pause</span><em>Escape</em></div></div>`; break;
      case 'pad': body = `<div class="binds">${PAD_ACTIONS.map(([a, n]) => `<div class="bind"><span>${n}</span><button class="btn small key" data-act="padbind" data-v="${a}">${PAD_NAMES[s.pad[a]]}</button></div>`).join('')}
        <div class="bind fixed"><span>Move / Aim</span><em>Left stick / Right stick</em></div></div>` + slider('padDeadzone', 'Stick deadzone', 0.05, 0.5, 0.01); break;
    }
    return `${this.header('Settings')}<div class="tabs">${tabs.map(([k, n]) => `<button class="btn small ${this.setTab === k ? 'on' : ''}" data-act="setTab" data-v="${k}">${n}</button>`).join('')}</div>
      <div class="settings panel scroll">${body}${this.notice ? `<div class="notice">${esc(this.notice)}</div>` : ''}</div>
      <footer class="bar"><button class="btn" data-act="defaults">Restore Defaults</button><button class="btn" data-act="back">Done</button></footer>`;
  },

  r_credits() {
    return `${this.header('Credits')}<div class="credits panel scroll">
      <h4>DEADEYE: LAST BULLET</h4>
      <p>Design, code, pixel art, sound &amp; music — generated procedurally in the browser. No external assets.</p>
      <p>Everything you see is drawn with Canvas from code; every gunshot, footstep and whistle is synthesized with the Web Audio API.</p>
      <p>Fonts: “Rye” and “VT323” via Google Fonts (falls back to system fonts offline).</p>
      <p>Thanks for riding.</p></div>`;
  },

  r_pause() {
    const w = Game.w;
    return `<div class="center-box panel"><h3>PAUSED</h3><p class="obj">${esc(w ? w.stageText() : '')}</p>
      <button class="btn big" data-act="resume" autofocus>Resume</button>
      <button class="btn" data-act="restartCp">Restart Checkpoint</button>
      <button class="btn" data-act="settings">Settings</button>
      <button class="btn" data-act="quit">Return to Main Menu</button>
      <div class="foot">Move ${bindLabel('left')}/${bindLabel('right')} · Jump ${bindLabel('jump')} · Dodge ${bindLabel('dodge')} · Reload ${bindLabel('reload')} · Dead Eye ${bindLabel('deadeye')} · Crouch ${bindLabel('crouch')}</div></div>`;
  },
  r_died() {
    return `<div class="center-box panel dark"><h3 class="red">YOU DIED</h3><p>The frontier claims another… but not today.</p>
      <button class="btn big" data-act="respawn" autofocus>Respawn at Checkpoint</button>
      <button class="btn" data-act="restartMission">Restart Mission</button>
      <button class="btn" data-act="abandon">Abandon Mission</button></div>`;
  },
  r_failed(reason) {
    return `<div class="center-box panel dark"><h3 class="red">MISSION FAILED</h3><p>${esc(reason || '')}</p>
      <button class="btn big" data-act="respawn" autofocus>Retry from Checkpoint</button>
      <button class="btn" data-act="restartMission">Restart Mission</button>
      <button class="btn" data-act="toMap">Return to Map</button></div>`;
  },
  showResults(r) { this.show('results', r); },
  r_results(r) {
    const s = r.stats;
    const lines = r.lines.map(([n, v]) => `<div class="line"><span>${esc(n)}</span><b>${fmtMoney(v)}</b></div>`).join('');
    const unl = r.unlocks.map(id => `<li>New: ${esc(MISSION_BY_ID[id].name)}</li>`).join('');
    return `<div class="center-box panel results"><h3>BOUNTY COLLECTED</h3><h4>${esc(r.mission.name)}</h4>
      <div class="rstats"><div><small>Enemies</small><b>${s.kills}</b></div><div><small>Headshots</small><b>${s.headshots}</b></div><div><small>Accuracy</small><b>${Math.round(r.acc * 100)}%</b></div><div><small>Time</small><b>${fmtTime(r.time)}</b></div><div><small>Deaths</small><b>${s.deaths}</b></div><div><small>Secrets</small><b>${s.secrets}</b></div></div>
      <div class="lines">${lines}<div class="line total"><span>Total earned</span><b>${fmtMoney(r.total)}</b></div></div>
      ${r.legendary ? `<div class="legend">LEGENDARY WEAPON: DEVIL'S DUE — added to your loadout.<br>The Legendary Gunslinger skin is now for sale.</div>` : ''}
      ${unl ? `<ul class="goals">${unl}</ul>` : ''}
      <button class="btn big" data-act="toMap" autofocus>Continue</button></div>`;
  },
};

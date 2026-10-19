'use strict';
// Keyboard, mouse and gamepad input mapped to named actions.
// Presses are buffered and consumed by exactly one fixed simulation tick.
const Input = {
  down: new Set(), buf: new Set(), pressed: new Set(),
  mouse: { x: VW / 2, y: VH / 2, cx: 0, cy: 0, b: [false, false, false] },
  view: { ox: 0, oy: 0, s: 1 },        // game->device transform, set by renderer
  usingPad: false, padIndex: -1, padPrev: [], padHeld: new Set(),
  stick: { mx: 0, my: 0, ax: 0, ay: 0 },
  capture: null, padCapture: null,      // rebinding hooks
  onKey: null, onPadNav: null, onPadLost: null, onLockLost: null,
  locked: false, canvas: null,

  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', e => {
      if (this.capture) { e.preventDefault(); const f = this.capture; this.capture = null; f(e.code); return; }
      if (this.onKey && this.onKey(e)) { e.preventDefault(); return; }
      if (e.repeat) { if (this.gameKey(e.code)) e.preventDefault(); return; }
      this.usingPad = false;
      this.down.add(e.code);
      for (const a of this.actionsFor(e.code)) this.buf.add(a);
      if (this.gameKey(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.b = [false, false, false]; });
    const absolute = e => {
      const dpr = window.devicePixelRatio || 1;
      this.mouse.x = (e.clientX * dpr - this.view.ox) / this.view.s;
      this.mouse.y = (e.clientY * dpr - this.view.oy) / this.view.s;
    };
    window.addEventListener('mousemove', e => {
      this.usingPad = false;
      if (this.locked) {
        const k = Store.settings.sensitivity / Math.max(0.5, this.view.s / (window.devicePixelRatio || 1));
        this.mouse.x = clamp(this.mouse.x + e.movementX * k, 0, VW);
        this.mouse.y = clamp(this.mouse.y + e.movementY * k, 0, VH);
      } else absolute(e);
    });
    canvas.addEventListener('mousedown', e => {
      this.usingPad = false;
      if (!this.locked) absolute(e); // pens/tablets can click without a prior move
      this.mouse.b[e.button] = true;
      if (e.button === 0) this.buf.add('shoot');
      if (e.button === 2) this.buf.add('aim');
      if (Store.settings.pointerLock && !this.locked && Game.state === 'play' && canvas.requestPointerLock) {
        try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
      }
    });
    window.addEventListener('mouseup', e => { this.mouse.b[e.button] = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.buf.add(e.deltaY > 0 ? 'next' : 'prev'); }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && this.onLockLost) this.onLockLost();
    });
    window.addEventListener('gamepadconnected', e => { if (this.padIndex < 0) this.padIndex = e.gamepad.index; UI.toast('Controller connected'); });
    window.addEventListener('gamepaddisconnected', e => {
      if (e.gamepad.index === this.padIndex) {
        this.padIndex = -1; this.padPrev = []; this.padHeld.clear(); this.usingPad = false;
        if (this.onPadLost) this.onPadLost();
      }
    });
  },

  gameKey(code) {
    if (Game.state !== 'play') return false;
    return code === 'Space' || code === 'Tab' || code.startsWith('Arrow') || this.actionsFor(code).length > 0;
  },
  actionsFor(code) {
    const out = [], keys = Store.settings.keys;
    for (const a in keys) if (keys[a].includes(code)) out.push(a);
    return out;
  },
  beginTick() { const p = this.pressed; p.clear(); this.pressed = this.buf; this.buf = p; },
  hit(a) { return this.pressed.has(a); },
  held(a) {
    if (a === 'shoot') return this.mouse.b[0] || this.padHeld.has('shoot');
    if (a === 'aim') return this.mouse.b[2] || this.padHeld.has('aim');
    const ks = Store.settings.keys[a];
    if (ks) for (const k of ks) if (k && this.down.has(k)) return true;
    return this.padHeld.has(a);
  },
  moveX() {
    let v = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    if (!v && Math.abs(this.stick.mx) > 0) v = this.stick.mx;
    return clamp(v, -1, 1);
  },
  clearAll() { this.down.clear(); this.buf.clear(); this.pressed.clear(); this.mouse.b = [false, false, false]; this.padHeld.clear(); },

  pollPad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    let gp = this.padIndex >= 0 ? pads[this.padIndex] : null;
    if (!gp) { for (const p of pads) if (p && p.connected) { gp = p; this.padIndex = p.index; break; } }
    if (!gp) return;
    const dz = Store.settings.padDeadzone;
    const dzf = v => Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz);
    const btn = i => gp.buttons[i] ? gp.buttons[i].value > 0.4 || gp.buttons[i].pressed : false;
    this.stick.mx = dzf(gp.axes[0] || 0); this.stick.my = dzf(gp.axes[1] || 0);
    this.stick.ax = dzf(gp.axes[2] || 0); this.stick.ay = dzf(gp.axes[3] || 0);
    if (btn(14)) this.stick.mx = -1; if (btn(15)) this.stick.mx = 1;
    const map = Store.settings.pad;
    this.padHeld.clear();
    for (let i = 0; i < gp.buttons.length; i++) {
      const now = btn(i), was = !!this.padPrev[i];
      if (now && !was) {
        this.usingPad = true;
        if (this.padCapture) { const f = this.padCapture; this.padCapture = null; f(i); }
        else {
          if (this.onPadNav && this.onPadNav(i)) { /* UI consumed */ }
          else for (const a in map) if (map[a] === i) this.buf.add(a);
        }
      }
      if (now) for (const a in map) if (map[a] === i) this.padHeld.add(a);
      this.padPrev[i] = now;
    }
    if (Math.abs(this.stick.mx) > 0.3 || Math.hypot(this.stick.ax, this.stick.ay) > 0.3) this.usingPad = true;
    // Left-stick down acts as crouch, like the d-pad.
    if (this.stick.my > 0.7) this.padHeld.add('crouch');
    // Stick menu navigation (edge triggered)
    const ny = this.stick.my < -0.6 ? 12 : this.stick.my > 0.6 ? 13 : -1;
    if (ny >= 0 && this._lastNav !== ny && this.onPadNav && Game.state !== 'play') this.onPadNav(ny);
    this._lastNav = ny;
  },
};

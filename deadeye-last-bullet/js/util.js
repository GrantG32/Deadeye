'use strict';
// Shared constants and small helpers used by every module.
const VW = 640, VH = 360;          // internal pixel-art resolution
const DT = 1 / 60;                 // fixed simulation step
const GRAV = 1500;
const GY = 300;                    // default ground line
const TAU = Math.PI * 2;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const choose = a => a[Math.floor(Math.random() * a.length)];
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
const sgn = v => v < 0 ? -1 : 1;

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Segment (x0,y0)->(x1,y1) vs rect. Returns entry t in [0,1] or -1.
function segRect(x0, y0, x1, y1, r) {
  let tmin = 0, tmax = 1;
  const dx = x1 - x0, dy = y1 - y0;
  if (Math.abs(dx) < 1e-9) { if (x0 < r.x || x0 > r.x + r.w) return -1; }
  else {
    let a = (r.x - x0) / dx, b = (r.x + r.w - x0) / dx;
    if (a > b) { const t = a; a = b; b = t; }
    if (a > tmin) tmin = a; if (b < tmax) tmax = b;
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-9) { if (y0 < r.y || y0 > r.y + r.h) return -1; }
  else {
    let a = (r.y - y0) / dy, b = (r.y + r.h - y0) / dy;
    if (a > b) { const t = a; a = b; b = t; }
    if (a > tmin) tmin = a; if (b < tmax) tmax = b;
    if (tmin > tmax) return -1;
  }
  return tmin;
}

function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

const fmtMoney = n => '$' + Math.floor(n).toLocaleString('en-US');
const fmtTime = s => { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Tiny object pool: reuse dead objects instead of allocating every frame.
function makePool() { return { list: [], free: [] }; }
function spawnFrom(pool) { const o = pool.free.pop() || {}; o.dead = false; pool.list.push(o); return o; }
function sweepPool(pool) {
  const l = pool.list; let j = 0;
  for (let i = 0; i < l.length; i++) { const o = l[i]; if (o.dead) pool.free.push(o); else l[j++] = o; }
  l.length = j;
}
function clearPool(pool) { for (const o of pool.list) pool.free.push(o); pool.list.length = 0; }

function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  return [c, x];
}

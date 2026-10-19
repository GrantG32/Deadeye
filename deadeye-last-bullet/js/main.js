'use strict';
// Boot + fixed-timestep loop.
Store.load();
Game.init();
Input.init(Game.canvas);
UI.init();
Music.mode = 'menu';
UI.show('main');
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => Sound.init());

let lastT = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000; lastT = now;
  dt = clamp(dt, 0, 0.1); // background tabs never cause huge jumps
  Input.pollPad();
  if (Game.state === 'play') {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 6) { Input.beginTick(); Game.update(DT); acc -= DT; n++; }
    if (n === 6) acc = 0;
  } else { acc = 0; Input.beginTick(); }
  Music.update();
  Game.render(dt);
}
requestAnimationFrame(frame);

// Debug/test handle (used by selftest.js).
window.DE = { Game, Store, UI, Input, get world() { return G; } };
for (const k of ['selftest', 'dev']) if (new RegExp('[?&]' + k).test(location.search)) { const s = document.createElement('script'); s.src = (k === 'dev' ? 'js/devtools.js' : 'js/selftest.js'); document.body.appendChild(s); }

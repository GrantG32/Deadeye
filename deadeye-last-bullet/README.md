# Deadeye: Last Bullet

A 2D side-scrolling Wild West action game in plain HTML5 Canvas + JavaScript. No frameworks, no build step, no asset files. All pixel art is drawn by code, and all sound and music is synthesized with Web Audio.

## Run it

- **Quickest:** double-click `index.html` (Chrome, Edge or Firefox).
- **Local server (recommended):** from this folder, run

  ```bash
  python -m http.server 8765
  ```

  then open http://localhost:8765

## Publish as a browser game

It's a static site, so upload the whole folder as-is:
- **itch.io:** zip the folder contents (with `index.html` at the root) and upload it as an HTML5 game.
- **GitHub Pages, Netlify, Cloudflare Pages or any static host:** deploy the folder. There's nothing to build.

## Controls (rebindable in Settings → Keyboard / Controller)

| Action | Keyboard / mouse | Controller |
|---|---|---|
| Move | A/D or ←/→ | Left stick / D-pad |
| Jump | Space (W alt) | A |
| Aim / Shoot (hold to draw the bow or crank the Gatling) | Mouse / Left click | Right stick / RT |
| Steady aim (ADS) | Right mouse | LT |
| Crouch behind cover / drop through | S or ↓ | D-pad down |
| Dodge roll (i-frames) | Shift | B |
| Reload | R | X |
| Interact | E | Y |
| Dead Eye | Q | LB |
| Weapons | 1–4, mouse wheel | RB / D-pad up |
| Pause | Esc | Start |

## Project layout

```
index.html        entry point
css/style.css     menu / UI styling
js/util.js        constants, math, collision, object pools
js/data.js        weapons, skins, enemies, bosses, upgrades, missions, difficulty
js/save.js        localStorage save + settings with validation & corruption recovery
js/audio.js       procedural SFX + layered western music sequencer
js/input.js       keyboard / mouse / gamepad -> actions, rebinding hooks
js/sprites.js     pixel-art renderer: characters, guns + skins, props, parallax backgrounds, pixel font
js/levels.js      9 campaign levels + 4 bounty levels
js/entities.js    physics, bullets, player, enemy AI, 5 bosses, dynamite, wagon, hazards
js/game.js        world simulation, objectives, checkpoints, rewards, camera, lighting, HUD
js/ui.js          main menu, map, bounty board, shop, upgrades, settings, pause, results
js/main.js        boot + fixed-timestep loop
js/selftest.js    automated test suite  -> open index.html?selftest
js/devtools.js    console helpers + autoplay bot -> open index.html?dev
```

## Features

- **Gunplay:** ten weapons with distinct handling. The Frontier Revolver never runs out of reserve ammo. The Lever-Action Rifle has a lever animation and ejects shells. The Sawed-Off Shotgun fires 8 pellets with damage falloff and recoil. The Six-Shooter Duals fire full-auto from alternating pistols, and their spread grows the longer you hold the trigger. The Sharpshooter Rifle punches through enemies. The Volcanic Repeater fires three-round bursts. The Lady Liberty Gatling has to be cranked up before it fires and slows you while it spins. The Hunting Bow is held to draw and released to loose: it's silent (a one-shot kill doesn't alert other guards) and its arrows drop with distance. The Boomstick Launcher lobs explosive charges. Both arcing weapons show a trajectory preview. The legendary Devil's Due comes from beating the final boss.
- **Shot feedback:** headshots and crits, a standing first shot that's dead accurate, ADS steadying, muzzle flashes, tracers, shell casings, impact sparks and dust, hit markers, damage numbers, screen shake and recoil kick.
- **Cover and line of fire:** bullets stop at walls and crates. Shooters fire over their own cover. Crouching behind a crate hides you.
- **Dead Eye:** a sepia slow-motion mode with a muffled score and a heartbeat. It runs off a meter that drains while active. Headshots in Dead Eye always crit. Hits, headshots and kills refill the meter.
- **Enemies:** Outlaw (fights from cover, fires in bursts), Sharpshooter (laser telegraph that locks before firing), Shotgun Bandit (rushes you), Dynamite Thrower (leads its throws, shows a warning ring, and its dynamite can be shot in the air), Armored Enforcer (armored body, head weak point, telegraphed gatling bursts), and Knife Thrower (throws fans of knives and rolls out of the way when you aim at him).
- **Bosses:**
  - **The Butcher:** shotgun spreads, charges that stun him when he hits a wall, uses cover, and enrages in phase 2.
  - **The Ghost:** teleporting sniper with a laser warning and lock, plus decoys. In phase 2 the lights dim and he fires twice.
  - **Iron Jack:** armored, with a weak-point tank on his back. Sweeping suppressive fire, dynamite and steam-vent hazards. His armor cracks in phase 2.
  - **The Devil's Hand:** four phases. Fanned dual pistols, then a laser rifle with dynamite, then shotgun dashes, with backup gangs summoned along the way. It ends in a slow-motion "DRAW!" showdown.
  - **The Undertaker:** advances behind a bullet-proof coffin. Break it, flank him, or shoot down from the crypts; he lowers it to fire his coach gun and raises gunmen from the graves. Once the coffin is gone he charges with a shovel.
- **Missions:** 9 campaign missions plus 4 bounty-board contracts. Chapter II branches off the map after Midnight Train: Perdition (a foggy ghost town, a bell tower and The Undertaker), The River Queen (a timed heist on a paddle steamer: crack three locked strongboxes, then jump ship) and Siege of Fort Bliss (break the siege, hold the fort, then hunt down a deserter captain and his lieutenant). Objectives include clearing a camp, eliminating a named outlaw, protecting a moving wagon, surviving an ambush, defeating a boss, recovering stolen gold, beating a time limit and pulling a brake lever.
- **Level features:** checkpoints, gates that open once an area is cleared, doors, breakable barricades and secret stashes, explosive barrels with chain reactions, rockfalls, steam vents, fire, and pits.
- **Economy:** first-clear rewards plus bonuses for no deaths, accuracy, headshots and par time. Replays pay out less each time (50% → 30% → 20% → 10%). Rewards are granted exactly once per completion.
- **Shop and progression:** buy weapons and upgrade each one 3 levels, build a 4-slot loadout, and buy 7 cosmetic skins (the last unlocks after the final boss). There are 15 character upgrades across Damage, Mobility, Survival, Dead Eye and Reloading.
- **Difficulty:** Easy, Normal or Hard, chosen per mission.
- **Settings:** volumes, screen shake, damage numbers, fullscreen, fit or integer scaling, scanlines, keyboard and controller rebinding (with conflict warnings and swapping), raw mouse aim and sensitivity, and controller aim assist and deadzone. Settings persist and can be reset to defaults.
- **Pause and focus:** pause freezes all simulation. Losing window focus, unplugging a controller or leaving pointer lock all pause the game. Audio suspends in background tabs.

## Testing

`index.html?selftest` runs 103 automated checks against the real game code. They cover save corruption recovery, movement, every weapon's firing pattern, headshot damage, walls blocking bullets, Dead Eye, every enemy type, armor, death and checkpoint respawn, pause, a completion of every mission and boss, single reward grants, replay reduction, purchases, rebinding, and repeated mission transitions. Your real save is backed up and restored afterwards.

## Known limitations

- Controller support uses the standard Gamepad API mapping. It was tested with simulated input, not with a physical controller.
- Fonts (Rye, VT323) load from Google Fonts. Offline, the game falls back to system serif and monospace fonts.
- The Dead Eye sepia filter needs canvas `filter` support (Chrome, Edge, Firefox, Safari 18+). On older browsers you get the slow-motion and vignette without the color tint.
- No touch or mobile controls.
- Balance was tuned with the autoplay bot (`dev.bot('m5', 600)`). A human playtest pass would still help with the final numbers.

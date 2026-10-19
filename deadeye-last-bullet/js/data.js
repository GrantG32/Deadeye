'use strict';
// All tunable game content: weapons, skins, enemies, upgrades, missions, difficulty.

const WEAPONS = {
  revolver: { name: 'Frontier Revolver', short: 'REVOLVER', price: 0, dmg: 34, mag: 6, reserve: Infinity, fire: 0.24, reload: 1.35,
    spread: 0.022, speed: 1000, range: 560, headMult: 2.4, kick: 2.5, shake: 0.10, sound: 'revolver', swap: 0.18,
    desc: 'Six rounds, fast draw, dead reliable. Never runs dry.' },
  rifle: { name: 'Lever-Action Rifle', short: 'RIFLE', price: 450, req: 'm1', dmg: 74, mag: 8, reserve: 40, fire: 0.68, reload: 2.1,
    spread: 0.006, speed: 1450, range: 950, headMult: 2.7, kick: 4, shake: 0.16, sound: 'rifle', lever: true, swap: 0.32, shell: true,
    desc: 'Hard-hitting precision. Work the lever between shots.' },
  shotgun: { name: 'Sawed-Off Shotgun', short: 'SHOTGUN', price: 650, req: 'm2', dmg: 15, pellets: 8, mag: 2, reserve: 24, fire: 0.42, reload: 1.6,
    spread: 0.2, speed: 880, range: 250, falloff: true, headMult: 1.6, kick: 9, shake: 0.30, recoil: 170, knock: 240, sound: 'shotgun', swap: 0.28,
    desc: 'Devastating up close. Pellets lose bite with distance.' },
  dual: { name: 'Six-Shooter Duals', short: 'DUALS', price: 950, req: 'm3', dmg: 21, mag: 12, reserve: 120, fire: 0.095, auto: true, reload: 1.9,
    spread: 0.03, spreadGrow: 0.013, spreadMax: 0.17, speed: 1000, range: 520, headMult: 2.2, kick: 1.6, shake: 0.06, sound: 'revolver2', dual: true, swap: 0.22,
    desc: 'Alternating pistols. A storm of lead that drifts when held.' },
  sharp: { name: 'Sharpshooter Rifle', short: 'SHARPSHOOTER', price: 2200, req: 'm4', dmg: 150, mag: 4, reserve: 20, fire: 1.15, reload: 2.8,
    spread: 0, speed: 2100, range: 1400, pierce: 3, headMult: 2.6, kick: 7, shake: 0.26, sound: 'sniper', swap: 0.42, shell: true,
    desc: 'Punches through soft targets. Slow, deliberate, final.' },
  devil: { name: "Devil's Due", short: "DEVIL'S DUE", price: 0, legendary: true, dmg: 60, mag: 6, reserve: Infinity, fire: 0.16, reload: 0.95,
    spread: 0.012, speed: 1250, range: 820, pierce: 1, headMult: 2.5, kick: 3, shake: 0.14, sound: 'devil', swap: 0.15,
    desc: "The Devil's Hand's own iron. Burning rounds that pass through." },
  volcanic: { name: 'Volcanic Repeater', short: 'VOLCANIC', price: 800, req: 'm2', dmg: 27, mag: 9, reserve: 72, fire: 0.42, burst: 3, burstGap: 0.065, reload: 1.6,
    spread: 0.028, speed: 1050, range: 560, headMult: 2.2, kick: 1.8, shake: 0.07, sound: 'revolver2', swap: 0.2,
    desc: 'Three-round bursts from a lever-fed pistol. Squeeze once, three holes.' },
  gatling: { name: 'Lady Liberty Gatling', short: 'GATLING', price: 2600, req: 'm5', dmg: 15, mag: 60, reserve: 240, fire: 0.055, auto: true, spin: 0.55, reload: 3.2,
    spread: 0.075, speed: 1000, range: 600, headMult: 1.8, kick: 1.2, shake: 0.07, sound: 'gatlingP', heavy: 0.5, swap: 0.6,
    desc: 'Crank it up, then hose them down. Slows you while the barrels spin.' },
  bow: { name: 'Hunting Bow', short: 'BOW', price: 1100, req: 'm7', dmg: 40, dmgMax: 135, charge: 0.75, mag: 1, reserve: 30, fire: 0.2, reload: 0.35,
    spread: 0.01, speed: 520, speedMax: 940, grav: 520, range: 1000, pierce: 1, headMult: 3, kick: 1, shake: 0.04, sound: 'bow', silent: true, arrow: true, swap: 0.25,
    desc: 'Hold to draw, release to loose. Silent — guards never hear it. Arrows drop over distance.' },
  boom: { name: 'Boomstick Launcher', short: 'BOOMSTICK', price: 1800, req: 'm8', dmg: 150, mag: 3, reserve: 12, fire: 0.8, reload: 2.4,
    spread: 0.015, speed: 440, grav: 700, range: 900, explosive: 50, kick: 8, shake: 0.25, sound: 'boomLaunch', swap: 0.4,
    desc: 'Lobs a bundled charge that bursts on impact. Mind the blast radius.' },
};
const WEAPON_ORDER = ['revolver', 'rifle', 'shotgun', 'volcanic', 'dual', 'bow', 'boom', 'sharp', 'gatling', 'devil'];

const SKINS = {
  walnut:   { name: 'Classic Walnut', price: 0, metal: '#5d5f6b', hi: '#9aa0ad', wood: '#7a4a2a', wood2: '#5a321c' },
  silver:   { name: 'Silver Engraving', price: 300, metal: '#b9bfcc', hi: '#ffffff', wood: '#3e2a20', wood2: '#2a1a14' },
  bloodmoon:{ name: 'Blood Moon', price: 600, metal: '#6e1c1c', hi: '#d83a2e', wood: '#2c1010', wood2: '#1a0808' },
  midnight: { name: 'Midnight Steel', price: 700, metal: '#28324a', hi: '#6688bb', wood: '#1c1c26', wood2: '#101018' },
  bone:     { name: 'Bone Collector', price: 800, metal: '#3c3a38', hi: '#8a8680', wood: '#e8e0c6', wood2: '#b8ae94' },
  gold:     { name: 'Desert Gold', price: 900, metal: '#d2a43a', hi: '#ffe58c', wood: '#8a5a2a', wood2: '#6a3e1a' },
  legend:   { name: 'Legendary Gunslinger', price: 3000, reqFinal: true, metal: '#ead07a', hi: '#ffffff', wood: '#f4f0e6', wood2: '#c8b896', glint: true },
};
const SKIN_ORDER = ['walnut', 'silver', 'bloodmoon', 'midnight', 'bone', 'gold', 'legend'];

// Character looks (procedurally drawn pixel sprites).
const LOOKS = {
  player:   { skin: '#e2a878', hat: '#7a5434', band: '#3a2418', style: 'wide', shirt: '#e8dcc0', coat: '#3e4a60', coatHi: '#56647e', pants: '#4a3a30', boots: '#2a1c14', bandana: '#e07a2a', beard: '#3a2418' },
  outlaw:   { skin: '#d89a6c', hat: '#2c2622', band: '#7a2a20', style: 'wide', shirt: '#c8a878', vest: '#6a2a20', pants: '#5a4a3a', boots: '#2a1c14', bandana: '#c03030', mask: true },
  sharp:    { skin: '#e0b090', hat: '#4a4a36', band: '#2a2a1e', style: 'low', shirt: '#a8a090', coat: '#4c5a38', coatHi: '#62724a', pants: '#3a3a2a', boots: '#1e1a14', stache: '#4a3020' },
  shotgun:  { skin: '#c88858', hat: '#c8a060', band: '#8a4a20', style: 'sombrero', shirt: '#d8c8a0', poncho: '#8a5a2a', ponchoHi: '#c87a3a', pants: '#4a3a2a', boots: '#2a1c14', beard: '#1a1410', torsoW: 12 },
  dynamite: { skin: '#e0a070', hat: '#5a4a3a', band: '#3a2a1a', style: 'cap', shirt: '#b89060', vest: null, suspenders: '#4a2a1a', pants: '#3e4a5a', boots: '#2a1c14', stache: '#6a4020', dynabelt: true },
  enforcer: { skin: '#d8a070', hat: '#5a5e68', band: '#3a3e48', style: 'helmet', shirt: '#4a3a30', armor: '#6a6e78', armorHi: '#9a9eaa', pants: '#3a3430', boots: '#1a1612', torsoW: 14, torsoH: 11, legH: 9 },
  butcher:  { skin: '#d89070', hat: '#5a3a24', band: '#2a1a10', style: 'low', shirt: '#b89878', apron: '#d8d0c0', stain: '#8a2a20', pants: '#3a2a20', boots: '#1e140e', beard: '#8a3a1a', torsoW: 18, torsoH: 13, legH: 10, headW: 8, bandolier: true },
  ghost:    { skin: '#c8c4bc', hat: '#e8e6dc', band: '#2a2a2a', style: 'wide', shirt: '#9a9890', coat: '#d6d4ca', coatHi: '#f0eee4', pants: '#7a7874', boots: '#3a3836', skull: true },
  ironjack: { skin: '#c89070', hat: '#4a4e58', band: '#2a2e38', style: 'helmet', visor: '#ff9a30', shirt: '#3a3430', armor: '#4a4e58', armorHi: '#7a8090', pants: '#2e2a28', boots: '#161210', torsoW: 16, torsoH: 13, legH: 10, headW: 8, tank: '#b8703a' },
  devil:    { skin: '#e8c0a0', hat: '#161014', band: '#c8c8d0', style: 'wide', shirt: '#2a1418', coat: '#1c1418', coatHi: '#a01818', pants: '#1a1214', boots: '#0e0a0a', bandana: '#b01818', stache: '#0e0a0a', glove: '#b01818' },
  ray:      { skin: '#d89a6c', hat: '#3a3a20', band: '#c8a030', style: 'wide', shirt: '#d8c890', vest: '#6a7a2a', pants: '#4a4a30', boots: '#2a1c14', bandana: '#e0c030', mask: true },
  coyote:   { skin: '#d0946a', hat: '#8a6a4a', band: '#4a2a1a', style: 'low', shirt: '#c8a070', coat: '#9a7a52', coatHi: '#b8946a', pants: '#4a3a2a', boots: '#2a1c14', stache: '#5a3a20' },
  knife:    { skin: '#d0946a', hat: '#2a2430', band: '#c8a030', style: 'bowler', shirt: '#e8e0d0', vest: '#2a2a3a', pants: '#4a3a4a', boots: '#1a1418', bandana: '#a02030', stache: '#2a1a10' },
  lou:      { skin: '#e0a880', hat: '#d8d0c0', band: '#a02030', style: 'low', shirt: '#f0e8d8', vest: '#6a1a2a', pants: '#2a2a34', boots: '#1a1418', bandana: '#d8b040', stache: '#6a3a1a' },
  graves:   { skin: '#d8a070', hat: '#2a3a5a', band: '#d8b040', style: 'helmet', shirt: '#2a3a5a', armor: '#4a5a7a', armorHi: '#8a9ab8', pants: '#2a3a5a', boots: '#1a1612', torsoW: 14, torsoH: 11, legH: 9 },
  undertaker:{ skin: '#d8c8b8', hat: '#141418', band: '#5a5a66', style: 'top', shirt: '#d8d8d0', coat: '#18181e', coatHi: '#3a3a48', pants: '#18181c', boots: '#0c0c0e', stache: '#9a9a9a', torsoH: 12, legH: 10 },
  kettle:   { skin: '#e8b08a', hat: '#6a3a5a', band: '#3a1a30', style: 'bowler', shirt: '#c0a0b0', vest: '#5a2a4a', pants: '#3a2a3a', boots: '#1a1418', stache: '#d8d8d8', dynabelt: true },
};

// Regular enemy archetypes.
const ENEMY_TYPES = {
  outlaw:   { name: 'Outlaw', look: 'outlaw', hp: 70, speed: 72, gun: 'revolver', dmg: 9, bspeed: 470, range: 340, prefer: 220, aim: 0.38, burst: [2, 3], gap: 0.2, cool: [1.2, 2.0], spread: 0.07, cover: true, cash: [8, 14] },
  sharp:    { name: 'Sharpshooter', look: 'sharp', hp: 60, speed: 58, gun: 'rifle', dmg: 22, bspeed: 1000, range: 600, prefer: 430, aim: 1.05, burst: [1, 1], gap: 0.2, cool: [2.3, 3.1], spread: 0.008, laser: true, cash: [14, 20] },
  shotgun:  { name: 'Shotgun Bandit', look: 'shotgun', hp: 115, speed: 108, gun: 'shotgun', dmg: 7, pellets: 6, bspeed: 430, range: 150, prefer: 55, aim: 0.42, burst: [1, 1], gap: 0.2, cool: [1.1, 1.6], spread: 0.22, aggressive: true, brange: 210, cash: [12, 18] },
  dynamite: { name: 'Dynamite Thrower', look: 'dynamite', hp: 65, speed: 66, gun: 'dynamite', range: 400, prefer: 260, aim: 0.55, cool: [2.5, 3.3], cash: [12, 20] },
  knife:    { name: 'Knife Thrower', look: 'knife', hp: 75, speed: 100, gun: 'knife', dmg: 11, bspeed: 330, range: 270, prefer: 150, aim: 0.45, burst: [1, 1], gap: 0.2, cool: [1.3, 1.9], spread: 0.17, pellets: 3, brange: 330, roller: true, cash: [12, 18] },
  enforcer: { name: 'Armored Enforcer', look: 'enforcer', hp: 340, speed: 42, gun: 'gatling', dmg: 7, bspeed: 500, range: 380, prefer: 200, aim: 0.95, burst: [8, 10], gap: 0.09, cool: [2.4, 3.2], spread: 0.06, armor: 0.3, telegraph: true, cash: [35, 50] },
};

const BOSSES = {
  butcher:  { name: 'THE BUTCHER', title: 'Red Creek\'s Meat Man', look: 'butcher', hp: 1150, gun: 'shotgun' },
  ghost:    { name: 'THE GHOST', title: 'Nobody Sees Him Twice', look: 'ghost', hp: 820, gun: 'rifle' },
  ironjack: { name: 'IRON JACK', title: 'The Walking Locomotive', look: 'ironjack', hp: 1500, gun: 'repeater', armor: 0.25 },
  undertaker: { name: 'THE UNDERTAKER', title: 'He Brings His Own Box', look: 'undertaker', hp: 1500, gun: 'coach' },
  devil:    { name: "THE DEVIL'S HAND", title: 'King of the Lawless West', look: 'devil', hp: 2300, gun: 'revolver' },
};

const DIFFS = {
  easy:   { name: 'Easy',   edmg: 0.6,  ehp: 0.85, bhp: 0.8, ammo: 1.6, php: 40,  reward: 0.75, react: 1.3, spread: 1.3, time: 1.25 },
  normal: { name: 'Normal', edmg: 1,    ehp: 1,    bhp: 1,   ammo: 1,   php: 0,   reward: 1,    react: 1,   spread: 1,   time: 1 },
  hard:   { name: 'Hard',   edmg: 1.45, ehp: 1.2,  bhp: 1.3, ammo: 0.6, php: -10, reward: 1.4,  react: 0.8, spread: 0.8, time: 0.85 },
};

const UPGRADES = [
  { cat: 'Damage', items: [
    { id: 'dmg',  name: 'Hot Loads', max: 5, base: 220, fx: l => `+${l * 8}% weapon damage` },
    { id: 'crit', name: 'Killer Instinct', max: 5, base: 260, fx: l => `${5 + l * 3}% crit chance, x${(1.6 + l * 0.15).toFixed(2)} crit` },
    { id: 'ap',   name: 'Armor-Piercing Rounds', max: 3, base: 520, fx: l => `${Math.round((0.3 + l * 0.15) * 100)}% damage through armor` },
  ]},
  { cat: 'Mobility', items: [
    { id: 'speed', name: 'Light Boots', max: 5, base: 180, fx: l => `+${l * 5}% move speed` },
    { id: 'dodge', name: 'Tumbleweed Roll', max: 4, base: 220, fx: l => `${(0.95 * (1 - 0.12 * l)).toFixed(2)}s dodge cooldown` },
    { id: 'jump',  name: 'Spring Heels', max: 3, base: 200, fx: l => `+${l * 4}% jump, +${l * 15}% air control` },
  ]},
  { cat: 'Survival', items: [
    { id: 'hp',     name: 'Iron Constitution', max: 5, base: 240, fx: l => `+${l * 15} max health` },
    { id: 'resist', name: 'Leather Duster', max: 4, base: 300, fx: l => `-${l * 6}% damage taken` },
    { id: 'heal',   name: 'Frontier Medicine', max: 3, base: 180, fx: l => `+${l * 20}% healing` },
  ]},
  { cat: 'Dead Eye', items: [
    { id: 'decap',   name: 'Steady Nerves', max: 4, base: 260, fx: l => `${100 + l * 20}% meter capacity` },
    { id: 'deslow',  name: 'Time Bender', max: 4, base: 320, fx: l => `World at ${Math.round((0.32 - l * 0.035) * 100)}% speed` },
    { id: 'deregen', name: 'Bloodhound', max: 4, base: 240, fx: l => `+${l * 20}% meter recovery` },
  ]},
  { cat: 'Reloading', items: [
    { id: 'reload',   name: 'Quick Hands', max: 5, base: 200, fx: l => `-${l * 8}% reload time` },
    { id: 'capacity', name: 'Deep Pockets', max: 3, base: 300, fx: l => `+${l} capacity tier, +${l * 20}% reserve` },
    { id: 'handling', name: 'Gunslinger Grip', max: 3, base: 260, fx: l => `-${l * 15}% swap time, +${l * 4}% fire rate` },
  ]},
];
const upgradeCost = (base, lvl) => Math.round(base * Math.pow(1.7, lvl) / 10) * 10;
const weaponUpgradeCost = (id, lvl) => Math.round(Math.max(150, WEAPONS[id].price * 0.45) * (1 + lvl * 0.8) / 10) * 10;
const WEAPON_UPG_MAX = 3;

const MISSIONS = [
  { id: 'm1', name: 'Dusty Arrival', level: 'arrival', kind: 'Tutorial · Clear the camp', reward: 150, par: 300, map: [12, 70],
    desc: 'A stranger rides in from the flats. Bandits camp on the road to Red Creek. Learn the trade, then clear them out.',
    goals: ['Learn to move, aim and shoot', 'Shoot the practice bottles', 'Clear the bandit camp'], unlocks: ['m2'] },
  { id: 'm2', name: 'Trouble in Red Creek', level: 'redcreek', kind: 'Clear the town · Boss', reward: 420, par: 360, map: [30, 50], boss: 'butcher',
    desc: 'The Butcher\'s gang runs Red Creek. Clean up Main Street and put the big man down for good.',
    goals: ['Clear Main Street', 'Defeat The Butcher'], unlocks: ['m3', 'b1'] },
  { id: 'm3', name: 'The Abandoned Mine', level: 'mine', kind: 'Recover gold · Boss', reward: 680, par: 420, map: [50, 26], boss: 'ghost',
    desc: 'Stolen gold sits in the old Silverthread mine. Something pale walks the deep shafts.',
    goals: ['Recover 3 bags of stolen gold', 'Defeat The Ghost'], unlocks: ['m4', 'b2'] },
  { id: 'm4', name: 'Midnight Train', level: 'train', kind: 'Time limit · Boss', reward: 900, par: 330, map: [68, 54], boss: 'ironjack',
    desc: 'Iron Jack has the gold express. Reach the engine before it hits the broken bridge.',
    goals: ['Reach the engine before time runs out', 'Defeat Iron Jack'], unlocks: ['m5', 'm7'] },
  { id: 'm5', name: 'Canyon Ambush', level: 'canyon', kind: 'Protect wagon · Survive', reward: 1150, par: 420, map: [80, 30],
    desc: 'Escort the supply wagon through Widow\'s Canyon. They will hit you from every ledge.',
    goals: ['Protect the wagon', 'Survive the ambush'], unlocks: ['m6', 'b3'] },
  { id: 'm6', name: "Devil's Hand Hideout", level: 'hideout', kind: 'Assault · Final boss', reward: 2600, par: 540, map: [90, 70], boss: 'devil',
    desc: 'The fort at Hangman\'s Mesa. End the Devil\'s Hand and the West is free.',
    goals: ['Breach the fort', 'Defeat The Devil\'s Hand'], unlocks: [] },
  // Chapter II: the southern trail (branches off after Midnight Train)
  { id: 'm7', name: 'Perdition', level: 'ghosttown', kind: 'Stealth · Clear · Boss', reward: 1000, par: 420, map: [54, 78, 'up'], from: 'm4', boss: 'undertaker',
    desc: 'A dead town where the bells still ring. Someone has been burying lawmen alive. Go quiet, then go loud.',
    goals: ['Clear the ghost town', 'Ring the church bell', 'Defeat The Undertaker'], unlocks: ['m8', 'b4'] },
  { id: 'm8', name: 'The River Queen', level: 'river', kind: 'Heist · Time limit', reward: 1250, par: 420, map: [36, 84, 'up'], from: 'm7',
    desc: 'The gang is moving the stolen payroll downriver on a paddle steamer. Board her, crack the strongboxes, and jump ship.',
    goals: ['Crack 3 strongboxes before the boat docks', 'Escape to the skiff'], unlocks: ['m9'] },
  { id: 'm9', name: 'Siege of Fort Bliss', level: 'fortbliss', kind: 'Defend · Survive · Eliminate', reward: 1700, par: 480, map: [18, 88, 'up'], from: 'm8',
    desc: 'Captain Graves deserted with a company of hired guns and wants the fort armory. Break the siege lines and hold the walls.',
    goals: ['Break through the siege lines', 'Hold the fort', 'Kill Captain Graves and his lieutenant'], unlocks: [] },
  // Side bounties (bounty board)
  { id: 'b1', side: true, name: 'Wanted: Rattlesnake Ray', level: 'bounty_ray', kind: 'Eliminate outlaw', reward: 380, par: 200, poster: 'ray',
    desc: 'Ray shot the Red Creek sheriff in the back. He holes up at Dry Gulch with his crew.', goals: ['Eliminate Rattlesnake Ray'] },
  { id: 'b2', side: true, name: 'Wanted: The Coyote Twins', level: 'bounty_twins', kind: 'Clear camp · Time limit', reward: 620, par: 180, poster: 'coyote',
    desc: 'Two brothers, one getaway. Catch them before they skip the territory.', goals: ['Eliminate both twins before time runs out'] },
  { id: 'b3', side: true, name: 'Wanted: Ma Kettle', level: 'bounty_kettle', kind: 'Recover gold · Eliminate', reward: 900, par: 240, poster: 'kettle',
    desc: 'Ma Kettle blew the Fort Bliss payroll. Get the gold back and bring her in.', goals: ['Recover 2 payroll bags', 'Eliminate Ma Kettle'] },
  { id: 'b4', side: true, name: 'Wanted: Lucky Lou', level: 'bounty_lou', kind: 'Eliminate · Time limit', reward: 780, par: 160, poster: 'lou',
    desc: 'A riverboat cardsharp who never loses — the losers end up in the river. He is leaving Shiloh Landing on the next boat.', goals: ['Eliminate Lucky Lou before his boat sails'] },
];
const MISSION_BY_ID = Object.fromEntries(MISSIONS.map(m => [m.id, m]));
const REPLAY_FACTORS = [0.5, 0.3, 0.2, 0.1];
const replayFactor = n => REPLAY_FACTORS[Math.min(n, REPLAY_FACTORS.length - 1)];

const ACTIONS = [
  ['left', 'Move Left'], ['right', 'Move Right'], ['jump', 'Jump'], ['crouch', 'Crouch / Drop'], ['dodge', 'Dodge Roll'],
  ['reload', 'Reload'], ['interact', 'Interact'], ['deadeye', 'Dead Eye'], ['w1', 'Weapon 1'], ['w2', 'Weapon 2'], ['w3', 'Weapon 3'], ['w4', 'Weapon 4'],
];
const PAD_ACTIONS = [
  ['jump', 'Jump'], ['dodge', 'Dodge'], ['reload', 'Reload'], ['interact', 'Interact'], ['deadeye', 'Dead Eye'],
  ['next', 'Next Weapon'], ['prev', 'Previous Weapon'], ['aim', 'Aim (ADS)'], ['shoot', 'Shoot'], ['crouch', 'Crouch'], ['pause', 'Pause'],
];
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];

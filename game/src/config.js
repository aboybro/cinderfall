// Cinderfall tuning: every number that shapes difficulty, pacing and feel lives here,
// so the game can be balanced without touching the simulation code.
export const FIELD = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 16,
  speed: 235, // px per second at level 1
  maxHp: 100,
  dashSpeed: 720,
  dashTime: 0.16,
  dashCooldown: 2.2,
  dashIframes: 0.35,
  pickupRadius: 70,
  contactDamageCooldown: 0.6,
};

export const RUN = {
  duration: 300, // survive 5 minutes to win
  xpBase: 5, // xp needed for level 2; each next level costs xpBase + level * 4
  xpGemValue: 1,
  eliteXpValue: 5,
  bossXpValue: 25,
  enemyCap: 90,
  spawnIntervalStart: 1.25,
  spawnIntervalEnd: 0.45,
  batchStart: 1,
  batchEnd: 3,
};

// Enemy roster. hp/speed/damage scale with elapsed minutes; `weight` shapes the mix.
export const ENEMIES = {
  shambler: { hp: 22, speed: 58, radius: 15, damage: 8, xp: 1, color: '#8a7f8f', weight: 10, score: 10 },
  swift: { hp: 13, speed: 128, radius: 11, damage: 6, xp: 1, color: '#e8b34b', weight: 6, score: 15 },
  spitter: { hp: 18, speed: 52, radius: 14, damage: 7, xp: 2, color: '#7fb069', weight: 4, score: 20, ranged: true, shotCooldown: 2.6, shotSpeed: 190 },
  splitter: { hp: 30, speed: 74, radius: 18, damage: 10, xp: 2, color: '#b565d8', weight: 4, score: 25, splits: 3 },
  brute: { hp: 95, speed: 44, radius: 24, damage: 16, xp: 4, color: '#c94f4f', weight: 2, score: 40 },
  warden: { hp: 800, speed: 40, radius: 42, damage: 22, xp: 25, color: '#ff5d3a', weight: 0, score: 500, boss: true },
};

// Difficulty growth per minute survived.
export const SCALING = {
  hpPerMinute: 0.30, // +30% enemy hp per minute
  speedPerMinute: 0.05, // +5% enemy speed per minute, capped
  speedCap: 1.35,
  damagePerMinute: 1, // +1 contact damage per minute
};

// Weapon tuning. Each weapon has 5 levels; level-up offers raise a weapon one level.
export const WEAPONS = {
  bolt: {
    name: 'Ember Bolt', icon: '✦', desc: 'Hurls a burning bolt at the nearest wraith.',
    base: { damage: 15, rate: 1.5, count: 1, speed: 520, pierce: 0 },
    perLevel: { damage: 7, rate: 0.35, count: 0, speed: 40, pierce: 0 },
    level3Bonus: { count: 1 }, // level 3 fires a second bolt
    level5Bonus: { pierce: 1 },
    color: '#ffb347',
  },
  nova: {
    name: 'Nova Ring', icon: '◎', desc: 'A shockwave of fire bursts out around you.',
    base: { damage: 10, rate: 0.55, count: 1, speed: 0, pierce: 0, radius: 130 },
    perLevel: { damage: 6, rate: 0.12, count: 0, speed: 0, pierce: 0, radius: 26 },
    level3Bonus: { radius: 60 },
    level5Bonus: { damage: 10 },
    color: '#ff7a59',
  },
  orbit: {
    name: 'Cinder Orbit', icon: '❂', desc: 'Burning sparks circle you and scorch all they touch.',
    base: { damage: 9, rate: 0, count: 2, speed: 150, pierce: 0, radius: 74 },
    perLevel: { damage: 5, rate: 0, count: 0, speed: 22, pierce: 0, radius: 8 },
    level3Bonus: { count: 1 },
    level5Bonus: { count: 1 },
    color: '#ffd166',
  },
};

export const PASSIVES = {
  boots: { name: 'Swift Boots', icon: '➤', desc: '+10% move speed.', max: 5, apply: (p) => { p.speedMul *= 1.10; } },
  heart: { name: 'Ember Heart', icon: '♥', desc: '+20 max health and heal 20.', max: 5, apply: (p) => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
  magnet: { name: 'Lodestone', icon: '◉', desc: '+35% ember pickup radius.', max: 5, apply: (p) => { p.pickupMul *= 1.35; } },
  focus: { name: 'Kindled Focus', icon: '◆', desc: '+12% damage on all weapons.', max: 5, apply: (p) => { p.damageMul *= 1.12; } },
  ward: { name: 'Ashen Ward', icon: '⬢', desc: '-1 damage from every hit (min 1).', max: 3, apply: (p) => { p.armor += 1; } },
};

export const STEP = 1 / 60;

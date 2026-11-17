// The enemy roster: what each kind is, how it moves and fights, and how the
// director picks the mix as the minutes pass.
import { ENEMIES, SCALING } from './config.js';
import { pickWeighted, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_SPLIT = 1;

let nextId = 1;

export function makeEnemy(random, kind, x, y, minutes, elite = false) {
  const def = ENEMIES[kind];
  const hpMul = 1 + SCALING.hpPerMinute * minutes;
  const speedMul = Math.min(SCALING.speedCap, 1 + SCALING.speedPerMinute * minutes);
  const enemy = {
    id: nextId,
    kind,
    x, y,
    vx: 0, vy: 0,
    radius: def.radius * (elite ? 1.45 : 1) * (def.boss ? 1 : 1),
    hp: Math.round(def.hp * hpMul * (elite ? 3.2 : 1)),
    maxHp: Math.round(def.hp * hpMul * (elite ? 3.2 : 1)),
    speed: def.speed * speedMul * (elite ? 0.92 : 1),
    damage: def.damage + Math.floor(SCALING.damagePerMinute * minutes) + (elite ? 6 : 0),
    xp: def.xp * (elite ? 5 : 1),
    score: def.score * (elite ? 5 : 1),
    color: def.color,
    elite,
    boss: !!def.boss,
    ranged: !!def.ranged,
    splits: def.splits || 0,
    shotTimer: range(random, 1, 2.5),
    shotCooldown: def.shotCooldown || 2.6,
    shotSpeed: def.shotSpeed || 190,
    flash: 0,
    wobble: random() * Math.PI * 2,
    touchTimer: 0,
  };
  nextId += 1;
  return enemy;
}

// Which kinds may appear at this minute, and how likely each is.
export function spawnTable(minutes) {
  const table = [{ key: 'shambler', weight: ENEMIES.shambler.weight }];
  if (minutes >= 0.4) table.push({ key: 'swift', weight: ENEMIES.swift.weight });
  if (minutes >= 1.0) table.push({ key: 'spitter', weight: ENEMIES.spitter.weight });
  if (minutes >= 1.6) table.push({ key: 'splitter', weight: ENEMIES.splitter.weight });
  if (minutes >= 2.2) table.push({ key: 'brute', weight: ENEMIES.brute.weight });
  return table;
}

export function pickKind(random, minutes) {
  return pickWeighted(random, spawnTable(minutes));
}

// A point just outside the view, on a random side.
export function spawnPoint(random, width, height, margin = 60) {
  const side = Math.floor(random() * 4);
  if (side === 0) return { x: range(random, 0, width), y: -margin };
  if (side === 1) return { x: width + margin, y: range(random, 0, height) };
  if (side === 2) return { x: range(random, 0, width), y: height + margin };
  return { x: -margin, y: range(random, 0, height) };
}

// Steer one enemy toward the player for a step; ranged ones stop at distance and shoot.
export function steerEnemy(enemy, player, dt, random) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  enemy.wobble += dt * 3;
  const wob = enemy.ranged ? 0 : Math.sin(enemy.wobble) * 0.35;
  const px = nx - ny * wob;
  const py = ny + nx * wob;
  const len = Math.hypot(px, py) || 1;
  if (enemy.ranged && dist < 300) {
    // Hold range and strafe; do not close in.
    enemy.vx = -ny * enemy.speed * 0.5;
    enemy.vy = nx * enemy.speed * 0.5;
  } else {
    enemy.vx = (px / len) * enemy.speed;
    enemy.vy = (py / len) * enemy.speed;
  }
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  if (enemy.flash > 0) enemy.flash -= dt;
  if (enemy.touchTimer > 0) enemy.touchTimer -= dt;
}

// When a splitter dies it bursts into small fast motes.
export function splitInto(enemy, random, minutes) {
  const motes = [];
  for (let i = 0; i < enemy.splits; i += 1) {
    const angle = (i / enemy.splits) * Math.PI * 2 + random();
    const mote = makeEnemy(random, 'swift', enemy.x + Math.cos(angle) * 20, enemy.y + Math.sin(angle) * 20, minutes);
    mote.hp = Math.max(4, Math.round(mote.hp * 0.4));
    mote.maxHp = mote.hp;
    mote.radius = 9;
    mote.xp = 1;
    mote.score = 5;
    motes.push(mote);
  }
  return motes;
}

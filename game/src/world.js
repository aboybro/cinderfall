// Cinderfall's simulation: the player, the weapons, the director that spawns the
// swarm, and every collision. Pure logic over plain state; rendering reads it.
import { FIELD, PLAYER, RUN, WEAPONS, SCALING } from './config.js';
import { mulberry32, range } from './random.js';
import { makeEnemy, pickKind, spawnPoint, steerEnemy, splitInto } from './enemies.js';
import { weaponStats } from './upgrades.js';

export const EVENT_NONE = 0;
export const EVENT_OVER = 1;
export const EVENT_WIN = 2;
export const EVENT_LEVELUP = 4;
export const EVENT_BOSS = 8;

export function xpForLevel(level) {
  return RUN.xpBase + level * 4;
}

export function freshState(seed) {
  return {
    seed,
    time: 0,
    screen: 'title',
    paused: false,
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(1),
    pendingLevels: 0,
    offers: [],
    player: {
      x: FIELD.width / 2, y: FIELD.height / 2,
      vx: 0, vy: 0,
      radius: PLAYER.radius,
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      speedMul: 1, damageMul: 1, pickupMul: 1, armor: 0,
      facing: 1,
      dashTimer: 0, dashCooldown: 0, dashDirX: 1, dashDirY: 0,
      iframes: 0, hurtFlash: 0, contactTimer: 0,
    },
    dashTarget: null, // a mouse click's dash destination, consumed by step()
    weapons: { bolt: 1, nova: 0, orbit: 0 },
    weaponTimers: { bolt: 0.4, nova: 0, orbit: 0 },
    orbitAngle: 0,
    passives: {},
    enemies: [],
    projectiles: [],
    enemyShots: [],
    gems: [],
    particles: [],
    floaters: [],
    rings: [],
    spawnTimer: 1.2,
    eliteTimer: 40,
    bossSpawned: false,
    bossWarned: false,
    boss: null,
    shake: 0,
    ambientTimer: 0,
    best: 0,
    banner: '',
    bannerTimer: 0,
  };
}

export class World {
  constructor(seed = 1) {
    this.random = mulberry32(seed);
    this.state = freshState(seed);
  }

  reset(seed = 1) {
    this.random = mulberry32(seed);
    const best = this.state.best;
    this.state = freshState(seed);
    this.state.best = best;
  }

  start() {
    this.state.screen = 'play';
    this.state.banner = 'Survive 5:00 — the grove is burning';
    this.state.bannerTimer = 3;
  }

  addParticles(x, y, count, color, speed = 160, size = 3, life = 0.5) {
    const s = this.state;
    for (let i = 0; i < count; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const sp = range(this.random, speed * 0.3, speed);
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp,
        life: range(this.random, life * 0.6, life), maxLife: life,
        size: range(this.random, size * 0.6, size * 1.4), color,
      });
    }
    if (s.particles.length > 420) s.particles.splice(0, s.particles.length - 420);
  }

  addFloater(x, y, text, color = '#ffd166') {
    this.state.floaters.push({ x, y, text, life: 0.9, color });
  }

  dropGem(x, y, value) {
    this.state.gems.push({
      x: x + range(this.random, -8, 8), y: y + range(this.random, -8, 8),
      value, kind: value >= 25 ? 'boss' : value >= 5 ? 'elite' : 'ember',
      vx: range(this.random, -30, 30), vy: range(this.random, -30, 30),
    });
  }

  killEnemy(enemy, index) {
    const s = this.state;
    s.enemies.splice(index, 1);
    s.kills += 1;
    s.score += enemy.score;
    this.addParticles(enemy.x, enemy.y, enemy.boss ? 46 : enemy.elite ? 22 : 10, enemy.color, enemy.boss ? 320 : 180, enemy.boss ? 5 : 3);
    this.addFloater(enemy.x, enemy.y - enemy.radius, `+${enemy.score}`, '#ffd166');
    this.dropGem(enemy.x, enemy.y, enemy.xp);
    if (enemy.splits > 0) {
      for (const mote of splitInto(enemy, this.random, s.time / 60)) s.enemies.push(mote);
    }
    if (enemy.boss) {
      s.boss = null;
      s.shake = Math.max(s.shake, 14);
      this.addFloater(enemy.x, enemy.y - 60, 'WARDEN FALLEN  +500', '#ff5d3a');
    }
    return enemy;
  }

  damagePlayer(amount, fromX, fromY) {
    const s = this.state;
    const p = s.player;
    if (p.iframes > 0 || s.screen !== 'play') return;
    const dealt = Math.max(1, amount - p.armor);
    p.hp -= dealt;
    p.hurtFlash = 0.35;
    p.iframes = 0.45;
    s.shake = Math.max(s.shake, 7);
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    p.x += (dx / dist) * 14;
    p.y += (dy / dist) * 14;
    this.addParticles(p.x, p.y, 12, '#ff5d3a', 200, 3, 0.4);
    this.addFloater(p.x, p.y - 26, `-${dealt}`, '#ff6b5e');
    if (p.hp <= 0) {
      p.hp = 0;
      s.screen = 'over';
      this.addParticles(p.x, p.y, 60, '#ffb347', 320, 5, 0.9);
    }
  }

  gainXp(amount) {
    const s = this.state;
    s.xp += amount;
    while (s.xp >= s.xpNext) {
      s.xp -= s.xpNext;
      s.level += 1;
      s.xpNext = xpForLevel(s.level);
      s.pendingLevels += 1;
      // Levelling up steadies the warden: a small heal, so a run that keeps
      // gathering embers keeps going instead of bleeding out.
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 6);
      this.addFloater(s.player.x, s.player.y - 30, '+6', '#7fd6a4');
    }
  }

  fireBolt() {
    const s = this.state;
    const p = s.player;
    const stats = weaponStats('bolt', s.weapons.bolt);
    let target = null;
    let best = Infinity;
    for (const enemy of s.enemies) {
      const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (d < best) { best = d; target = enemy; }
    }
    if (!target) return;
    const count = stats.count;
    const baseAngle = Math.atan2(target.y - p.y, target.x - p.x);
    for (let i = 0; i < count; i += 1) {
      const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 0.22;
      const angle = baseAngle + spread;
      s.projectiles.push({
        x: p.x + Math.cos(angle) * 20, y: p.y + Math.sin(angle) * 20,
        vx: Math.cos(angle) * stats.speed, vy: Math.sin(angle) * stats.speed,
        radius: 6, damage: Math.round(stats.damage * p.damageMul),
        pierce: stats.pierce, life: 1.6, color: WEAPONS.bolt.color,
      });
    }
  }

  fireNova() {
    const s = this.state;
    const p = s.player;
    const stats = weaponStats('nova', s.weapons.nova);
    s.rings.push({ x: p.x, y: p.y, r: 12, maxR: stats.radius, damage: Math.round(stats.damage * p.damageMul), hit: new Set(), color: WEAPONS.nova.color, life: 0.45 });
  }

  updateOrbit(dt) {
    const s = this.state;
    const p = s.player;
    if (s.weapons.orbit <= 0) return;
    const stats = weaponStats('orbit', s.weapons.orbit);
    s.orbitAngle += (stats.speed / stats.radius) * dt;
    const sparks = [];
    for (let i = 0; i < stats.count; i += 1) {
      const angle = s.orbitAngle + (i / stats.count) * Math.PI * 2;
      sparks.push({ x: p.x + Math.cos(angle) * stats.radius, y: p.y + Math.sin(angle) * stats.radius });
    }
    s.orbitSparks = sparks;
    for (const spark of sparks) {
      for (let i = s.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = s.enemies[i];
        const d = Math.hypot(enemy.x - spark.x, enemy.y - spark.y);
        if (d < enemy.radius + 12) {
          if (!enemy.orbitHit || enemy.orbitHit <= 0) {
            enemy.hp -= Math.round(stats.damage * p.damageMul);
            enemy.flash = 0.12;
            enemy.orbitHit = 0.45;
            this.addParticles(enemy.x, enemy.y, 4, WEAPONS.orbit.color, 120, 2, 0.3);
            if (enemy.hp <= 0) this.killEnemy(enemy, i);
          }
        }
      }
    }
  }

  spawnBatch() {
    const s = this.state;
    const minutes = s.time / 60;
    const progress = Math.min(1, minutes / 5);
    const batch = Math.round(RUN.batchStart + (RUN.batchEnd - RUN.batchStart) * progress);
    for (let i = 0; i < batch && s.enemies.length < RUN.enemyCap; i += 1) {
      const point = spawnPoint(this.random, FIELD.width, FIELD.height);
      const kind = pickKind(this.random, minutes);
      s.enemies.push(makeEnemy(this.random, kind, point.x, point.y, minutes));
    }
  }

  spawnElite() {
    const s = this.state;
    const minutes = s.time / 60;
    const kinds = ['swift', 'brute', 'splitter'];
    const kind = kinds[Math.floor(this.random() * kinds.length)];
    const point = spawnPoint(this.random, FIELD.width, FIELD.height);
    s.enemies.push(makeEnemy(this.random, kind, point.x, point.y, minutes, true));
    s.banner = 'An elite wraith stirs in the ash';
    s.bannerTimer = 2.5;
  }

  spawnBoss() {
    const s = this.state;
    s.bossSpawned = true;
    const point = spawnPoint(this.random, FIELD.width, FIELD.height, 90);
    const boss = makeEnemy(this.random, 'warden', point.x, point.y, s.time / 60);
    s.enemies.push(boss);
    s.boss = boss;
    s.banner = 'THE ASHEN WARDEN AWAKENS';
    s.bannerTimer = 3.5;
    s.shake = 12;
    return EVENT_BOSS;
  }

  step(dt, input, audio) {
    const s = this.state;
    if (s.screen !== 'play' || s.paused) return EVENT_NONE;
    let events = EVENT_NONE;
    const p = s.player;
    const minutes = s.time / 60;

    s.time += dt;
    s.score += dt * 10;
    if (s.time >= RUN.duration) {
      s.screen = 'win';
      return EVENT_WIN;
    }

    // Boss warning at 4:20, boss at 4:30.
    if (!s.bossWarned && s.time >= 260) {
      s.bossWarned = true;
      s.banner = 'Something vast moves in the smoke…';
      s.bannerTimer = 3;
    }
    if (!s.bossSpawned && s.time >= 270) events |= this.spawnBoss();

    // --- Player movement and dash ---
    const axis = input.axis();
    if (axis.x !== 0 || axis.y !== 0) p.facing = axis.x !== 0 ? Math.sign(axis.x) : p.facing;
    // Dash fires toward the movement keys, or toward a mouse click (dashTarget,
    // set by main.js); a click while the dash is cooling down is simply dropped.
    const clickDash = s.dashTarget !== null;
    if ((input.pressed(' ') || input.pressed('shift') || clickDash) && p.dashCooldown <= 0) {
      let dx;
      let dy;
      if (clickDash) {
        dx = s.dashTarget.x - p.x;
        dy = s.dashTarget.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        s.dashTarget = null;
      } else if (axis.x !== 0 || axis.y !== 0) {
        dx = axis.x;
        dy = axis.y;
      } else {
        dx = p.facing;
        dy = 0;
      }
      p.dashTimer = PLAYER.dashTime;
      p.dashCooldown = PLAYER.dashCooldown;
      p.dashDirX = dx;
      p.dashDirY = dy;
      p.iframes = Math.max(p.iframes, PLAYER.dashIframes);
      this.addParticles(p.x, p.y, 10, '#ffd166', 140, 3, 0.35);
      if (audio) audio.dash();
    } else if (clickDash) {
      s.dashTarget = null;
    }
    let speed = PLAYER.speed * p.speedMul;
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      speed = PLAYER.dashSpeed;
      p.x += p.dashDirX * speed * dt;
      p.y += p.dashDirY * speed * dt;
    } else {
      p.x += axis.x * speed * dt;
      p.y += axis.y * speed * dt;
    }
    p.x = Math.max(p.radius + 6, Math.min(FIELD.width - p.radius - 6, p.x));
    p.y = Math.max(p.radius + 6, Math.min(FIELD.height - p.radius - 6, p.y));
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    if (p.iframes > 0) p.iframes -= dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt;

    // --- Weapons ---
    if (s.weapons.bolt > 0) {
      s.weaponTimers.bolt -= dt;
      if (s.weaponTimers.bolt <= 0) {
        const stats = weaponStats('bolt', s.weapons.bolt);
        s.weaponTimers.bolt = 1 / stats.rate;
        this.fireBolt();
        if (audio) audio.shoot();
      }
    }
    if (s.weapons.nova > 0) {
      s.weaponTimers.nova -= dt;
      if (s.weaponTimers.nova <= 0) {
        const stats = weaponStats('nova', s.weapons.nova);
        s.weaponTimers.nova = 1 / stats.rate;
        this.fireNova();
        if (audio) audio.hit();
      }
    }
    this.updateOrbit(dt);

    // --- Projectiles ---
    for (let i = s.projectiles.length - 1; i >= 0; i -= 1) {
      const pr = s.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      let dead = pr.life <= 0 || pr.x < -40 || pr.x > FIELD.width + 40 || pr.y < -40 || pr.y > FIELD.height + 40;
      if (!dead) {
        for (let j = s.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = s.enemies[j];
          const d = Math.hypot(enemy.x - pr.x, enemy.y - pr.y);
          if (d < enemy.radius + pr.radius) {
            enemy.hp -= pr.damage;
            enemy.flash = 0.12;
            this.addParticles(pr.x, pr.y, 5, pr.color, 140, 2, 0.3);
            if (audio) audio.hit();
            if (enemy.hp <= 0) this.killEnemy(enemy, j);
            if (pr.pierce > 0) {
              pr.pierce -= 1;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (dead) s.projectiles.splice(i, 1);
    }

    // --- Nova rings expand and scorch ---
    for (let i = s.rings.length - 1; i >= 0; i -= 1) {
      const ring = s.rings[i];
      ring.life -= dt;
      ring.r += (ring.maxR / 0.45) * dt;
      for (let j = s.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = s.enemies[j];
        if (ring.hit.has(enemy.id)) continue;
        const d = Math.hypot(enemy.x - ring.x, enemy.y - ring.y);
        if (Math.abs(d - ring.r) < enemy.radius + 14) {
          ring.hit.add(enemy.id);
          enemy.hp -= ring.damage;
          enemy.flash = 0.12;
          this.addParticles(enemy.x, enemy.y, 6, ring.color, 160, 3, 0.35);
          if (enemy.hp <= 0) this.killEnemy(enemy, j);
        }
      }
      if (ring.life <= 0 || ring.r >= ring.maxR) s.rings.splice(i, 1);
    }

    // --- Spawning ---
    const progress = Math.min(1, minutes / 5);
    const interval = RUN.spawnIntervalStart + (RUN.spawnIntervalEnd - RUN.spawnIntervalStart) * progress;
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      s.spawnTimer = interval * range(this.random, 0.8, 1.2);
      this.spawnBatch();
    }
    if (minutes >= 0.75) {
      s.eliteTimer -= dt;
      if (s.eliteTimer <= 0) {
        s.eliteTimer = range(this.random, 38, 50);
        this.spawnElite();
      }
    }

    // --- Enemies ---
    for (let i = s.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = s.enemies[i];
      steerEnemy(enemy, p, dt, this.random);
      if (enemy.orbitHit > 0) enemy.orbitHit -= dt;
      // Ranged enemies shoot.
      if (enemy.ranged) {
        enemy.shotTimer -= dt;
        if (enemy.shotTimer <= 0) {
          enemy.shotTimer = enemy.shotCooldown * range(this.random, 0.9, 1.2);
          const dx = p.x - enemy.x;
          const dy = p.y - enemy.y;
          const dist = Math.hypot(dx, dy) || 1;
          s.enemyShots.push({
            x: enemy.x, y: enemy.y,
            vx: (dx / dist) * enemy.shotSpeed, vy: (dy / dist) * enemy.shotSpeed,
            radius: 6, damage: enemy.damage, life: 3,
          });
          this.addParticles(enemy.x, enemy.y, 4, '#a8e063', 100, 2, 0.25);
        }
      }
      // Contact damage, once per enemy per half second.
      const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (d < enemy.radius + p.radius - 2 && enemy.touchTimer <= 0) {
        enemy.touchTimer = PLAYER.contactDamageCooldown;
        this.damagePlayer(enemy.damage, enemy.x, enemy.y);
        if (audio) audio.hurt();
        if (s.screen !== 'play') return EVENT_OVER;
      }
    }

    // --- Enemy separation: the swarm must not collapse into one unreadable
    // blob. Overlapping wraiths push apart, so kiting stays a real skill and
    // the player can always tell how many are coming. ---
    const list = s.enemies;
    for (let a = 0; a < list.length; a += 1) {
      for (let b = a + 1; b < list.length; b += 1) {
        const ea = list[a];
        const eb = list[b];
        const dx = eb.x - ea.x;
        const dy = eb.y - ea.y;
        const min = (ea.radius + eb.radius) * 0.85;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          ea.x -= nx * push;
          ea.y -= ny * push;
          eb.x += nx * push;
          eb.y += ny * push;
        }
      }
    }

    // --- Enemy shots ---
    for (let i = s.enemyShots.length - 1; i >= 0; i -= 1) {
      const shot = s.enemyShots[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      let dead = shot.life <= 0 || shot.x < -20 || shot.x > FIELD.width + 20 || shot.y < -20 || shot.y > FIELD.height + 20;
      if (!dead) {
        const d = Math.hypot(shot.x - p.x, shot.y - p.y);
        if (d < shot.radius + p.radius - 2) {
          this.damagePlayer(shot.damage, shot.x - shot.vx, shot.y - shot.vy);
          if (audio) audio.hurt();
          dead = true;
          if (s.screen !== 'play') return EVENT_OVER;
        }
      }
      if (dead) s.enemyShots.splice(i, 1);
    }

    // --- Gems: drift, magnet, collect ---
    const pickup = PLAYER.pickupRadius * p.pickupMul;
    for (let i = s.gems.length - 1; i >= 0; i -= 1) {
      const gem = s.gems[i];
      gem.x += (gem.vx ?? 0) * dt;
      gem.y += (gem.vy ?? 0) * dt;
      gem.vx = (gem.vx ?? 0) * 0.9;
      gem.vy = (gem.vy ?? 0) * 0.9;
      const d = Math.hypot(gem.x - p.x, gem.y - p.y);
      if (d < pickup) {
        const pull = 420 * (1 - d / pickup) + 120;
        gem.x += ((p.x - gem.x) / (d || 1)) * pull * dt;
        gem.y += ((p.y - gem.y) / (d || 1)) * pull * dt;
      }
      if (d < p.radius + 10) {
        s.gems.splice(i, 1);
        this.gainXp(gem.value);
        if (audio) audio.pickup();
        if (s.pendingLevels > 0) {
          events |= EVENT_LEVELUP;
          return events;
        }
      }
    }

    // --- Particles, floaters, banner, shake ---
    for (let i = s.particles.length - 1; i >= 0; i -= 1) {
      const pt = s.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life -= dt;
      if (pt.life <= 0) s.particles.splice(i, 1);
    }
    for (let i = s.floaters.length - 1; i >= 0; i -= 1) {
      const f = s.floaters[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) s.floaters.splice(i, 1);
    }
    if (s.bannerTimer > 0) s.bannerTimer -= dt;
    if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 26);

    // Ambient embers drifting up through the grove.
    s.ambientTimer -= dt;
    if (s.ambientTimer <= 0) {
      s.ambientTimer = 0.12;
      s.particles.push({
        x: range(this.random, 0, FIELD.width), y: FIELD.height + 8,
        vx: range(this.random, -12, 12), vy: range(this.random, -46, -20),
        life: range(this.random, 2, 4), maxLife: 4,
        size: range(this.random, 1, 2.5), color: '#ff9a3c', ambient: true,
      });
    }
    return events;
  }
}

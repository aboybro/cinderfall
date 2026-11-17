// Every pixel Cinderfall draws: the burning grove, the warden, the wraiths,
// the HUD, and the title / draft / end screens. Canvas 2D only, no assets.
import { FIELD } from './config.js';
import { mulberry32, range } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CARD_W = 300;
const CARD_H = 190;
const CARD_GAP = 24;

export function offerRects() {
  const total = CARD_W * 3 + CARD_GAP * 2;
  const x0 = (FIELD.width - total) / 2;
  const y = 300;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (CARD_W + CARD_GAP), y, w: CARD_W, h: CARD_H }));
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.trees = null;
    this.treeSeed = -1;
    this.backgroundCache = null;
    this.backgroundSeed = -1;
    this.spriteCache = new Map();
  }

  // A sprite drawn once to an offscreen canvas, then blitted: shadowBlur and
  // gradients cost once at build time instead of once per enemy per frame,
  // which keeps the game at 60 fps even on software rendering.
  sprite(key, size, make) {
    let cached = this.spriteCache.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size);
    canvas.height = Math.ceil(size);
    const ctx = canvas.getContext('2d');
    ctx.translate(size / 2, size / 2);
    make(ctx);
    cached = { canvas, half: size / 2 };
    this.spriteCache.set(key, cached);
    return cached;
  }

  blit(sprite, x, y, angle = 0, scale = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (angle !== 0) ctx.rotate(angle);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half);
    ctx.restore();
  }

  resize(width, height) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = width;
    this.height = height;
  }

  treesFor(seed) {
    if (this.treeSeed === seed && this.trees) return this.trees;
    const random = mulberry32(seed * 7919 + 13);
    this.trees = [];
    for (let i = 0; i < 26; i += 1) {
      this.trees.push({
        x: range(random, 20, FIELD.width - 20),
        y: range(random, 20, FIELD.height - 20),
        r: range(random, 26, 52),
        lean: range(random, -0.2, 0.2),
      });
    }
    this.treeSeed = seed;
    return this.trees;
  }

  // The grove never changes during a run, so it is painted once to an
  // offscreen canvas and blitted each frame.
  drawBackground(state) {
    if (this.backgroundSeed !== state.seed || !this.backgroundCache) {
      const cache = document.createElement('canvas');
      cache.width = FIELD.width;
      cache.height = FIELD.height;
      const ctx = cache.getContext('2d');
      const g = ctx.createRadialGradient(
        FIELD.width / 2, FIELD.height / 2, 80,
        FIELD.width / 2, FIELD.height / 2, 760,
      );
      g.addColorStop(0, '#241209');
      g.addColorStop(0.55, '#180c06');
      g.addColorStop(1, '#0d0705');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);

      // Scorched ground patches.
      const trees = this.treesFor(state.seed);
      for (const tree of trees) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(tree.x, tree.y + tree.r * 0.55, tree.r * 1.15, tree.r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Burnt trees: black trunks with a faint ember glow at the base.
      for (const tree of trees) {
        ctx.strokeStyle = '#050302';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(tree.x, tree.y + tree.r * 0.6);
        ctx.lineTo(tree.x + tree.lean * tree.r, tree.y - tree.r);
        ctx.stroke();
        ctx.strokeStyle = '#17100a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tree.x, tree.y);
        ctx.lineTo(tree.x + tree.lean * tree.r - 12, tree.y - tree.r * 0.6);
        ctx.moveTo(tree.x, tree.y - tree.r * 0.4);
        ctx.lineTo(tree.x + tree.lean * tree.r + 14, tree.y - tree.r * 0.9);
        ctx.stroke();
        const glow = ctx.createRadialGradient(tree.x, tree.y + tree.r * 0.5, 2, tree.x, tree.y + tree.r * 0.5, 26);
        glow.addColorStop(0, 'rgba(255,122,40,0.20)');
        glow.addColorStop(1, 'rgba(255,122,40,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(tree.x, tree.y + tree.r * 0.5, 26, 0, Math.PI * 2);
        ctx.fill();
      }
      this.backgroundCache = cache;
      this.backgroundSeed = state.seed;
    }
    this.ctx.drawImage(this.backgroundCache, 0, 0);
  }

  drawGems(state) {
    for (const gem of state.gems) {
      const size = gem.kind === 'boss' ? 9 : gem.kind === 'elite' ? 7 : 5;
      const color = gem.kind === 'boss' ? '#ff5d3a' : gem.kind === 'elite' ? '#c084fc' : '#ffb347';
      const key = `gem:${color}:${size}`;
      const sprite = this.sprite(key, (size + 12) * 2, (ctx) => {
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillRect(-size / 2, -size / 2, size, size);
      });
      this.blit(sprite, gem.x, gem.y);
    }
  }

  enemySprite(enemy) {
    const key = `enemy:${enemy.kind}:${enemy.color}:${enemy.radius}`;
    return this.sprite(key, (enemy.radius + 16) * 2, (ctx) => {
      const r = enemy.radius;
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = enemy.boss ? 26 : enemy.elite ? 16 : 8;
      ctx.fillStyle = enemy.color;
      if (enemy.kind === 'swift') {
        // Dart: a sharp triangle pointing +x; rotated at draw time.
        ctx.beginPath();
        ctx.moveTo(r + 6, 0);
        ctx.lineTo(-r, r * 0.8);
        ctx.lineTo(-r * 0.5, 0);
        ctx.lineTo(-r, -r * 0.8);
        ctx.closePath();
        ctx.fill();
        return;
      }
      if (enemy.kind === 'spitter') {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#d7ffb0';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (enemy.kind === 'brute') {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      // Shambler, splitter, warden: a smoky wisp with a hollow core.
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = enemy.boss ? '#ffd166' : '#e8e0f0';
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.15, r * 0.14, 0, Math.PI * 2);
      ctx.arc(r * 0.25, -r * 0.15, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawEnemies(state) {
    const ctx = this.ctx;
    for (const enemy of state.enemies) {
      const angle = enemy.kind === 'swift'
        ? Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x)
        : 0;
      this.blit(this.enemySprite(enemy), enemy.x, enemy.y, angle);
      // Hit flash: a white disc over the sprite, cheaper than a second sprite.
      if (enemy.flash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, enemy.flash * 6);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Elite crown and boss bar.
      if (enemy.elite) {
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (enemy.boss || enemy.elite) {
        const w = enemy.boss ? 84 : 44;
        const frac = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 14, w, 5);
        ctx.fillStyle = enemy.boss ? '#ff5d3a' : '#c084fc';
        ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 14, w * frac, 5);
      }
    }
  }

  drawPlayer(state) {
    const ctx = this.ctx;
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.iframes > 0 && p.dashTimer <= 0) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(performance.now() / 40);
    // Cloak glow.
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
    glow.addColorStop(0, 'rgba(255,179,71,0.35)');
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
    // Hooded warden: cloak body, hood, ember eyes.
    ctx.fillStyle = p.hurtFlash > 0 ? '#ff8a7a' : '#2b1d3a';
    ctx.beginPath();
    ctx.moveTo(0, -p.radius - 4);
    ctx.quadraticCurveTo(p.radius + 6, -p.radius * 0.3, p.radius * 0.8, p.radius);
    ctx.quadraticCurveTo(0, p.radius + 6, -p.radius * 0.8, p.radius);
    ctx.quadraticCurveTo(-p.radius - 6, -p.radius * 0.3, 0, -p.radius - 4);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(-5, -3, 2.4, 0, Math.PI * 2);
    ctx.arc(5, -3, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // Staff pointing toward movement.
    ctx.strokeStyle = '#8a6b3a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.facing * 12, 4);
    ctx.lineTo(p.facing * 20, -p.radius - 8);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.facing * 20, -p.radius - 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawProjectiles(state) {
    const ctx = this.ctx;
    for (const pr of state.projectiles) {
      ctx.save();
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = pr.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(pr.x - pr.vx * 0.03, pr.y - pr.vy * 0.03);
      ctx.lineTo(pr.x, pr.y);
      ctx.stroke();
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const shot of state.enemyShots) {
      ctx.save();
      ctx.fillStyle = '#a8e063';
      ctx.shadowColor = '#a8e063';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const ring of state.rings) {
      ctx.save();
      ctx.strokeStyle = ring.color;
      ctx.globalAlpha = Math.max(0, ring.life / 0.45);
      ctx.lineWidth = 10;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (state.orbitSparks) {
      for (const spark of state.orbitSparks) {
        ctx.save();
        ctx.fillStyle = '#ffd166';
        ctx.shadowColor = '#ff9a3c';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff3d6';
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawParticles(state) {
    const ctx = this.ctx;
    for (const pt of state.particles) {
      const frac = Math.max(0, pt.life / (pt.maxLife || 0.5));
      ctx.globalAlpha = pt.ambient ? frac * 0.7 : frac;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (pt.ambient ? 1 : frac + 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / 0.5);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  drawHud(state) {
    const ctx = this.ctx;
    const p = state.player;
    // XP bar across the top.
    const xpFrac = Math.min(1, state.xp / state.xpNext);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, FIELD.width, 10);
    ctx.fillStyle = '#7c5cff';
    ctx.fillRect(0, 0, FIELD.width * xpFrac, 10);
    // Health bar, top left.
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(16, 22, 260, 22);
    ctx.fillStyle = '#3a0d0d';
    ctx.fillRect(18, 24, 256, 18);
    const hpFrac = Math.max(0, p.hp / p.maxHp);
    const hpGrad = ctx.createLinearGradient(18, 0, 274, 0);
    hpGrad.addColorStop(0, '#ff5d3a');
    hpGrad.addColorStop(1, '#ffb347');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(18, 24, 256 * hpFrac, 18);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText(`HP ${Math.ceil(p.hp)} / ${p.maxHp}`, 24, 37);
    // Level badge.
    ctx.fillStyle = '#7c5cff';
    ctx.beginPath();
    ctx.arc(302, 33, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`Lv ${state.level}`, 302, 38);
    // Timer, top centre.
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9c4';
    ctx.textAlign = 'center';
    const remain = Math.max(0, 300 - state.time);
    ctx.fillText(fmtTime(remain), FIELD.width / 2, 44);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,233,196,0.75)';
    ctx.fillText('until dawn', FIELD.width / 2, 60);
    // Score and kills, top right.
    ctx.textAlign = 'right';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`${Math.floor(state.score).toLocaleString('en-US')} pts`, FIELD.width - 16, 36);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#e8e0f0';
    ctx.fillText(`${state.kills} wraiths banished`, FIELD.width - 16, 54);
    // Boss bar.
    if (state.boss) {
      const w = 420;
      const x = (FIELD.width - w) / 2;
      const frac = Math.max(0, state.boss.hp / state.boss.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x, 74, w, 16);
      ctx.fillStyle = '#ff5d3a';
      ctx.fillRect(x + 2, 76, (w - 4) * frac, 12);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'center';
      ctx.fillText('ASHEN WARDEN', FIELD.width / 2, 102);
    }
    // Weapons, bottom left.
    const weapons = Object.entries(state.weapons).filter(([, lv]) => lv > 0);
    ctx.textAlign = 'left';
    ctx.font = '13px system-ui, sans-serif';
    weapons.forEach(([key, lv], i) => {
      const y = FIELD.height - 20 - i * 24;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(16, y - 15, 170, 20);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`${key === 'bolt' ? '✦' : key === 'nova' ? '◎' : '❂'}  Lv ${lv}`, 24, y);
    });
    // Dash cooldown, bottom right.
    const dashFrac = p.dashCooldown <= 0 ? 1 : 1 - p.dashCooldown / 2.2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(FIELD.width - 186, FIELD.height - 40, 170, 22);
    ctx.fillStyle = dashFrac >= 1 ? '#7fd6a4' : '#5a5348';
    ctx.fillRect(FIELD.width - 184, FIELD.height - 38, 166 * dashFrac, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dashFrac >= 1 ? 'DASH READY  [SPACE]' : 'DASH…', FIELD.width - 101, FIELD.height - 25);
    // Banner.
    if (state.bannerTimer > 0 && state.banner) {
      ctx.globalAlpha = Math.min(1, state.bannerTimer);
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff5d3a';
      ctx.shadowBlur = 16;
      ctx.fillText(state.banner, FIELD.width / 2, 150);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    // Hurt vignette.
    if (p.hurtFlash > 0) {
      const v = ctx.createRadialGradient(
        FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
        FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
      );
      v.addColorStop(0, 'rgba(255,40,20,0)');
      v.addColorStop(1, `rgba(255,40,20,${p.hurtFlash * 0.7})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (state.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.fillStyle = '#ffe9c4';
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('Press P to resume', FIELD.width / 2, FIELD.height / 2 + 24);
    }
  }

  drawTitle(state) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(5,3,2,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('A  SURVIVAL  ROGUELIKE  IN  A  BURNING  GROVE', FIELD.width / 2, 168);
    ctx.fillStyle = '#ffe9c4';
    ctx.font = 'bold 92px Georgia, serif';
    ctx.shadowColor = '#ff5d3a';
    ctx.shadowBlur = 34;
    ctx.fillText('CINDERFALL', FIELD.width / 2, 262);
    ctx.shadowBlur = 0;
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = '#e8d9c4';
    ctx.fillText('The ash wraiths rise at dusk. You are the last ember-warden.', FIELD.width / 2, 300);
    ctx.fillText('Survive until dawn — five minutes — and banish the Ashen Warden.', FIELD.width / 2, 328);
    // Controls card.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(FIELD.width / 2 - 330, 368, 660, 148);
    ctx.strokeStyle = 'rgba(255,179,71,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(FIELD.width / 2 - 330, 368, 660, 148);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9c4';
    ctx.textAlign = 'left';
    const lines = [
      ['WASD / Arrows', 'move through the grove'],
      ['SPACE or click', 'dash through danger (briefly untouchable)'],
      ['1 / 2 / 3 or click', 'choose an upgrade when you level up'],
      ['P', 'pause      ·      M  mute'],
    ];
    lines.forEach(([key, desc], i) => {
      const y = 398 + i * 32;
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(key, FIELD.width / 2 - 306, y);
      ctx.fillStyle = '#e8d9c4';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(desc, FIELD.width / 2 - 96, y);
    });
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 350);
    ctx.globalAlpha = pulse;
    ctx.fillText('Click or press ENTER to begin', FIELD.width / 2, 566);
    ctx.globalAlpha = 1;
    if (state.best > 0) {
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillStyle = '#c9b8a8';
      ctx.fillText(`Best score: ${state.best.toLocaleString('en-US')}`, FIELD.width / 2, 600);
    }
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(232,217,196,0.6)';
    ctx.fillText('Gather embers · Level up · Draft new weapons and boons · Every run is different', FIELD.width / 2, 640);
  }

  drawLevelUp(state) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(5,3,2,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('THE EMBERS ANSWER', FIELD.width / 2, 168);
    ctx.fillStyle = '#ffe9c4';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.fillText(`Level ${state.level} — choose a boon`, FIELD.width / 2, 224);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#e8d9c4';
    ctx.fillText('Press 1, 2 or 3 — or click a card.', FIELD.width / 2, 258);
    const rects = offerRects();
    state.offers.forEach((offer, i) => {
      const r = rects[i];
      const hover = false;
      ctx.fillStyle = hover ? '#2b1d3a' : 'rgba(20,12,8,0.95)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + 30);
      ctx.font = '44px system-ui, sans-serif';
      ctx.fillText(offer.icon, r.x + r.w / 2, r.y + 84);
      ctx.fillStyle = '#ffe9c4';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(offer.title, r.x + r.w / 2, r.y + 118);
      ctx.fillStyle = '#c9b8a8';
      ctx.font = '14px system-ui, sans-serif';
      this.wrapText(offer.desc, r.x + 18, r.y + 142, r.w - 36, 18);
    });
  }

  wrapText(text, x, y, maxWidth, lineHeight) {
    const ctx = this.ctx;
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x + maxWidth / 2, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x + maxWidth / 2, yy);
  }

  drawEnd(state, won) {
    const ctx = this.ctx;
    ctx.fillStyle = won ? 'rgba(20,16,4,0.72)' : 'rgba(10,3,2,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#ffd166' : '#ff6b5e';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.shadowColor = won ? '#ffb347' : '#ff5d3a';
    ctx.shadowBlur = 28;
    ctx.fillText(won ? 'DAWN BREAKS' : 'THE EMBER DIES', FIELD.width / 2, 240);
    ctx.shadowBlur = 0;
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = '#e8d9c4';
    ctx.fillText(
      won ? 'You survived the night. The grove is yours again.' : 'The wraiths close in — but the ember remembers.',
      FIELD.width / 2, 282,
    );
    // Stats card.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(FIELD.width / 2 - 260, 318, 520, 168);
    ctx.strokeStyle = 'rgba(255,179,71,0.5)';
    ctx.strokeRect(FIELD.width / 2 - 260, 318, 520, 168);
    const stats = [
      ['Score', Math.floor(state.score).toLocaleString('en-US')],
      ['Wraiths banished', String(state.kills)],
      ['Level reached', String(state.level)],
      ['Time survived', fmtTime(state.time)],
    ];
    ctx.font = '17px system-ui, sans-serif';
    stats.forEach(([label, value], i) => {
      const y = 352 + i * 34;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#c9b8a8';
      ctx.fillText(label, FIELD.width / 2 - 232, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffe9c4';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(value, FIELD.width / 2 + 232, y);
      ctx.font = '17px system-ui, sans-serif';
    });
    if (state.score > 0 && state.score >= state.best) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText('★ NEW BEST SCORE ★', FIELD.width / 2, 512);
    }
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 350);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Press R or click to play again', FIELD.width / 2, 566);
    ctx.globalAlpha = 1;
  }

  draw(state) {
    const ctx = this.ctx;
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    this.drawBackground(state);
    if (state.screen !== SCREEN_TITLE) {
      this.drawGems(state);
      this.drawEnemies(state);
      this.drawProjectiles(state);
      this.drawPlayer(state);
      this.drawParticles(state);
    }
    ctx.restore();
    if (state.screen === SCREEN_TITLE) {
      this.drawParticles(state);
      this.drawTitle(state);
    } else if (state.screen === SCREEN_PLAY) {
      this.drawHud(state);
    } else if (state.screen === 'levelup') {
      this.drawHud(state);
      this.drawLevelUp(state);
    } else if (state.screen === SCREEN_OVER) {
      this.drawEnd(state, false);
    } else if (state.screen === SCREEN_WIN) {
      this.drawEnd(state, true);
    }
  }
}

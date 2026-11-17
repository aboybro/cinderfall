// Cinderfall bootstrap: the game loop, screen transitions, the level-up draft,
// and the ?shot= staging hook screenshots use. The simulation lives in world.js;
// this file only drives it and hands input to it.
import { FIELD, STEP } from './config.js';
import { World, EVENT_LEVELUP, EVENT_OVER, EVENT_WIN, EVENT_BOSS } from './world.js';
import { Renderer, offerRects } from './render.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { rollOffers, applyOffer } from './upgrades.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isInteger(seedParam) && seedParam > 0 ? seedParam : 1;

const world = new World(seed);
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const audio = new AudioEngine();

const BEST_KEY = 'cinderfall-best';
try {
  world.state.best = Number(window.localStorage.getItem(BEST_KEY)) || 0;
} catch {
  world.state.best = 0;
}

function saveBest() {
  const s = world.state;
  if (s.score > s.best) {
    s.best = Math.floor(s.score);
    try {
      window.localStorage.setItem(BEST_KEY, String(s.best));
    } catch {
      // Private mode: the best score simply does not persist.
    }
  }
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function openDraft() {
  const s = world.state;
  s.offers = rollOffers(world.random, s);
  s.screen = 'levelup';
  audio.levelUp();
  announce(`Level ${s.level}. Choose an upgrade: 1 ${s.offers[0].title}, 2 ${s.offers[1].title}, 3 ${s.offers[2].title}.`);
}

function chooseOffer(index) {
  const s = world.state;
  if (s.screen !== 'levelup' || !s.offers[index]) return;
  applyOffer(s, s.offers[index]);
  s.pendingLevels -= 1;
  if (s.pendingLevels > 0) {
    openDraft();
  } else {
    s.screen = 'play';
    announce('Back into the grove.');
  }
}

function startRun() {
  audio.ensure();
  world.reset((Date.now() % 2147483646) + 1);
  try {
    world.state.best = Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    world.state.best = 0;
  }
  world.start();
  announce('Survive until dawn. Move with WASD or arrow keys.');
}

function fitCanvas() {
  renderer.resize(window.innerWidth, window.innerHeight);
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  const offsetX = (window.innerWidth - FIELD.width * scale) / 2;
  const offsetY = (window.innerHeight - FIELD.height * scale) / 2;
  renderer.view = { scale, offsetX, offsetY };
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

function draw() {
  const ctx = renderer.ctx;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d0705';
  ctx.fillRect(0, 0, renderer.canvas.width, renderer.canvas.height);
  const v = renderer.view;
  // The view transform must carry the device pixel ratio, or the field draws
  // at CSS size on a hidpi backing store and looks small and soft.
  ctx.setTransform(v.scale * dpr, 0, 0, v.scale * dpr, v.offsetX * dpr, v.offsetY * dpr);
  // Clip to the field so the HUD never spills past the play area.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, FIELD.width, FIELD.height);
  ctx.clip();
  renderer.draw(world.state);
  ctx.restore();
}

// ---- Screenshot staging: ?shot=start|play|levelup|end&seed=N ----
// Plays the real rules forward from a fresh world with an autopilot, so each
// screenshot is a frame a real run produces, and the same seed replays it.
const shotName = params.get('shot');
if (shotName) {
  stageShot(shotName, world);
  draw();
  window.__shotReady = true;
  // A getter, not a snapshot: world.reset() replaces world.state with a fresh
// object, so a plain reference would go stale after the first restart.
window.__game = { world, get state() { return world.state; } };
} else {
  // ---- Live play ----
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    const s = world.state;

    // Global keys.
    if (input.consumePress('m')) {
      audio.setMuted(!audio.muted);
    }
    if (input.consumePress('p') && (s.screen === 'play' || s.paused)) {
      s.paused = !s.paused;
      announce(s.paused ? 'Paused.' : 'Resumed.');
    }

    if (s.screen === 'title') {
      if (input.consumeAnyKey() || input.consumeClick()) startRun();
    } else if (s.screen === 'play') {
      // Clicking the field dashes toward the cursor: the mouse is a second
      // way to dodge, for players who steer with WASD and aim with the mouse.
      const click = input.consumeClick();
      if (click) {
        const v = renderer.view;
        s.dashTarget = {
          x: (click.x - v.offsetX) / v.scale,
          y: (click.y - v.offsetY) / v.scale,
        };
      }
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const events = world.step(STEP, input, audio);
        if (events & EVENT_BOSS) audio.boss();
        if (events & EVENT_LEVELUP) {
          openDraft();
          break;
        }
        if (events & EVENT_WIN) {
          saveBest();
          audio.win();
          announce(`Dawn breaks. You survived with ${Math.floor(s.score)} points.`);
          break;
        }
        if (events & EVENT_OVER) {
          saveBest();
          audio.lose();
          announce(`The ember dies. Score ${Math.floor(s.score)}, ${s.kills} wraiths banished.`);
          break;
        }
      }
      // Ambient embers still drift while paused.
      if (s.paused) draw();
    } else if (s.screen === 'levelup') {
      const click = input.consumeClick();
      if (click) {
        const rects = offerRects();
        const v = renderer.view;
        const gx = (click.x - v.offsetX) / v.scale;
        const gy = (click.y - v.offsetY) / v.scale;
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (gx >= r.x && gx <= r.x + r.w && gy >= r.y && gy <= r.y + r.h) chooseOffer(i);
        }
      }
      if (input.consumePress('1')) chooseOffer(0);
      if (input.consumePress('2')) chooseOffer(1);
      if (input.consumePress('3')) chooseOffer(2);
    } else if (s.screen === 'over' || s.screen === 'win') {
      if (input.consumePress('r') || input.consumeClick() || input.consumeAnyKey()) {
        startRun();
      }
    }
    draw();
  }
  requestAnimationFrame(frame);
}

// A getter, not a snapshot: world.reset() replaces world.state with a fresh
// object, so a plain reference would go stale after the first restart.
window.__game = { world, get state() { return world.state; } };

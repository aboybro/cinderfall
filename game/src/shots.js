// The screenshot scenes behind ?shot=start|play|levelup|end. Each one plays the
// real rules forward from a fresh world for a fixed time, steered by a simple
// autopilot (flee the nearest wraith, chase the nearest ember, dash when cornered),
// so the frame is what a short run really looks like and the same seed always
// gives the same frame.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_LEVELUP, EVENT_WIN } from './world.js';
import { rollOffers, applyOffer } from './upgrades.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 100;
const LEVELUP_LIMIT_SECONDS = 120;
const END_LIMIT_SECONDS = 240;

function autopilot(state, reckless = false) {
  const p = state.player;
  if (reckless) return { axis: () => ({ x: 0, y: 0 }), pressed: () => false };
  let dirX = 0;
  let dirY = 0;
  let nearest = null;
  let nearestD = Infinity;
  // Flee from the centroid of every wraith close enough to matter, not just
  // the single nearest one, or the pilot walks into the rest of the swarm.
  let fx = 0;
  let fy = 0;
  let threats = 0;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (d < nearestD) { nearestD = d; nearest = enemy; }
    if (d < 150) {
      const w = 1 - d / 150;
      fx += ((p.x - enemy.x) / (d || 1)) * w;
      fy += ((p.y - enemy.y) / (d || 1)) * w;
      threats += 1;
    }
  }
  let gem = null;
  let gemD = Infinity;
  for (const g of state.gems) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < gemD) { gemD = d; gem = g; }
  }
  // Flee only when something is actually close: otherwise the pilot never
  // picks up embers, never levels, and the swarm outscales it. When it does
  // flee, add a tangential swerve so it kites around the swarm instead of
  // backing into a corner.
  if (nearestD < 110 && threats > 0) {
    dirX = fx;
    dirY = fy;
    const len = Math.hypot(dirX, dirY) || 1;
    dirX += (-dirY / len) * 0.6;
    dirY += (dirX / len) * 0.6;
  } else if (gem && gemD < 420) {
    dirX = (gem.x - p.x) / gemD;
    dirY = (gem.y - p.y) / gemD;
  } else {
    // Drift toward the middle of the grove.
    const cx = FIELD.width / 2 - p.x;
    const cy = FIELD.height / 2 - p.y;
    const d = Math.hypot(cx, cy) || 1;
    if (d > 90) { dirX = cx / d; dirY = cy / d; }
  }
  // Never hug the walls: the swarm spawns outside them and corners the pilot.
  const margin = 120;
  if (p.x < margin) dirX += (margin - p.x) / margin;
  if (p.x > FIELD.width - margin) dirX -= (p.x - (FIELD.width - margin)) / margin;
  if (p.y < margin) dirY += (margin - p.y) / margin;
  if (p.y > FIELD.height - margin) dirY -= (p.y - (FIELD.height - margin)) / margin;
  const len = Math.hypot(dirX, dirY) || 1;
  const wantDash = nearest !== null && nearestD < 78;
  return {
    axis: () => ({ x: dirX / len, y: dirY / len }),
    pressed: (key) => key === ' ' && wantDash,
  };
}

function runFor(world, seconds, pilot) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, pilot(world.state), null);
    if (events & EVENT_LEVELUP) {
      // Take the first offer, as a player in a hurry would, and keep playing.
      const offers = rollOffers(world.random, world.state);
      applyOffer(world.state, offers[0]);
      world.state.pendingLevels -= 1;
      if (world.state.pendingLevels <= 0) world.state.screen = 'play';
    }
    if ((events & EVENT_OVER) || (events & EVENT_WIN)) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene (start, play, levelup or end; any other name
 * is start) and leave it ready to draw.
 */
export function stageShot(name, world) {
  world.reset(world.state.seed);
  if (name !== 'play' && name !== 'levelup' && name !== 'end') {
    world.start();
    runFor(world, START_SECONDS, (state) => autopilot(state));
    world.state.screen = 'title';
    return;
  }
  world.start();
  if (name === 'play') {
    runFor(world, PLAY_SECONDS, (state) => autopilot(state));
    return;
  }
  if (name === 'levelup') {
    runFor(world, LEVELUP_LIMIT_SECONDS, (state) => autopilot(state));
    if (world.state.screen === 'over') {
      // The pilot died on the way: a draft over a corpse reads as a bug, so
      // revive the warden at full health before opening the draft.
      world.state.player.hp = world.state.player.maxHp;
      world.state.screen = 'play';
    }
    if (world.state.pendingLevels <= 0) {
      // A stingy seed: grant the xp directly so the draft still shows.
      world.state.xp = world.state.xpNext;
      world.state.pendingLevels = 1;
      world.state.level += 1;
      world.state.xpNext = world.state.xpNext + 4;
      world.state.xp = 0;
    }
    world.state.offers = rollOffers(world.random, world.state);
    world.state.screen = 'levelup';
    return;
  }
  // end: stand still and let the swarm close in, as a doomed run ends.
  runFor(world, END_LIMIT_SECONDS, (state) => autopilot(state, true));
  if (world.state.screen === 'play') {
    world.state.player.hp = 0;
    world.state.screen = 'over';
  }
}

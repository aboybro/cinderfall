// The level-up draft: three offers, each a weapon level, a new weapon or a passive.
// Offers never repeat a maxed-out pick; a full build falls back to healing and gold.
import { WEAPONS, PASSIVES } from './config.js';

export const MAX_WEAPON_LEVEL = 5;

export function weaponStats(key, level) {
  const def = WEAPONS[key];
  const stats = { ...def.base };
  const steps = level - 1;
  for (const stat of Object.keys(def.perLevel)) {
    stats[stat] = (stats[stat] ?? 0) + def.perLevel[stat] * steps;
  }
  if (level >= 3 && def.level3Bonus) {
    for (const stat of Object.keys(def.level3Bonus)) stats[stat] = (stats[stat] ?? 0) + def.level3Bonus[stat];
  }
  if (level >= 5 && def.level5Bonus) {
    for (const stat of Object.keys(def.level5Bonus)) stats[stat] = (stats[stat] ?? 0) + def.level5Bonus[stat];
  }
  return stats;
}

function allOffers(state) {
  const offers = [];
  for (const key of Object.keys(WEAPONS)) {
    const level = state.weapons[key] || 0;
    if (level >= MAX_WEAPON_LEVEL) continue;
    offers.push({
      kind: 'weapon',
      key,
      icon: WEAPONS[key].icon,
      title: level === 0 ? `New: ${WEAPONS[key].name}` : `${WEAPONS[key].name} Lv ${level + 1}`,
      desc: WEAPONS[key].desc,
      level: level + 1,
    });
  }
  for (const key of Object.keys(PASSIVES)) {
    const level = state.passives[key] || 0;
    if (level >= PASSIVES[key].max) continue;
    offers.push({
      kind: 'passive',
      key,
      icon: PASSIVES[key].icon,
      title: `${PASSIVES[key].name} Lv ${level + 1}`,
      desc: PASSIVES[key].desc,
      level: level + 1,
    });
  }
  return offers;
}

// Three distinct offers, shuffled; when the build is full, offer a feast instead.
export function rollOffers(random, state) {
  const pool = allOffers(state);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, 3);
  while (picks.length < 3) {
    picks.push({
      kind: 'feast', key: 'feast', icon: '♥',
      title: 'Ember Feast', desc: 'Heal 40 health and gain 250 score.',
      level: 1,
    });
  }
  return picks;
}

export function applyOffer(state, offer) {
  if (offer.kind === 'weapon') {
    state.weapons[offer.key] = offer.level;
  } else if (offer.kind === 'passive') {
    state.passives[offer.key] = offer.level;
    PASSIVES[offer.key].apply(state.player);
  } else {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 40);
    state.score += 250;
  }
}

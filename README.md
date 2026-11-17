# Cinderfall

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/aboybro/cinderfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/aboybro/cinderfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

An original arena survival roguelike, entered in
[make.fun's "Make the best game" bounty](https://make.fun/bounty/best-game-01).

## The game

You are the last ember-warden of a burning grove. Ash wraiths rise at dusk
and close in from every side. Your bolts fly on their own — your job is to
move, to dash through danger, to gather the embers the fallen drop, and to
choose your boons well. Survive until dawn — five minutes — and banish the
Ashen Warden.

- **Survival loop:** move, dodge, collect ember XP, level up and draft one
  of three boons. Every run shuffles the offers, the spawns and the elites.
- **Weapons:** Ember Bolt (auto-fire at the nearest wraith), Nova Ring
  (a shockwave around you) and Cinder Orbit (burning sparks that circle
  you) — each with 5 levels and a bonus at levels 3 and 5.
- **Passives:** Swift Boots, Ember Heart, Lodestone, Kindled Focus and
  Ashen Ward, each up to 5 levels.
- **Enemies:** Shamblers, Swifts, ranged Spitters, Splitters that burst
  into motes, armoured Brutes, elite wraiths every ~45 seconds, and the
  Ashen Warden boss at 4:30. They grow tougher and faster every minute.
- **Win / lose:** survive 5:00 to win; fall and the run ends with your
  score, kills, level and time. Best score is kept in your browser.
- **Feel:** synthesized WebAudio effects and a quiet minor-key sequencer,
  particles, screen shake, floating score text, dash with i-frames, pause,
  mute, and a hurt vignette.

## Controls

- WASD / arrow keys: move
- Space: dash (briefly untouchable, 2.2 s cooldown); or click the field to
  dash toward the cursor
- 1 / 2 / 3 or click: choose a level-up boon
- P: pause · M: mute · R: restart after a run ends
- Enter / click: start

## Run it

No build step and no network: serve `game/` with any static server and open
`index.html` in desktop Chrome, or run `node serve.ts` and open
http://localhost:8080.

## Layout

- `game/index.html` — page and canvas
- `game/src/main.js` — game loop, screens and input wiring
- `game/src/world.js` — simulation: player, weapons, spawning, collisions
- `game/src/enemies.js` — enemy roster, steering and splitting
- `game/src/upgrades.js` — level-up draft pool
- `game/src/render.js` — all drawing: grove, HUD, menus
- `game/src/config.js` — tuning: difficulty, weapons, passives
- `game/src/audio.js` — synthesized WebAudio effects and music
- `game/src/input.js` — keyboard and mouse state
- `game/src/shots.js` — screenshot staging (autopilot plays real runs)
- `main.ts` — entry program: copies `game/` and `screenshots/` to `/output`
  and writes `dossier.json`

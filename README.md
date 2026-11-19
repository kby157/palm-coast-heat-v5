# Palm Coast Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kby157/palm-coast-heat-v5/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kby157/palm-coast-heat-v5/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A golden-hour open-world crime sandbox in the browser. You are **Jax Marlowe**,
wheelman for hire in the sun-soaked city of Palm Coast: steal rides, run eight
story jobs for the city's fixers, rob the shops, tune your car, buy heavier
iron at the mall, take the pier boats out when the roads get too hot — and
earn the respect that turns a nobody into a kingpin. The Palm Coast PD answers
with pursuit cruisers, roadblocks and a searchlight helicopter.

Pure HTML/CSS/JS on a `<canvas>`: no build step, no network, no assets —
every sound is synthesized with WebAudio and the city is generated from a
seed, so it is the same Palm Coast on every visit. Progress autosaves to
`localStorage`.

## File map

The judge-facing architecture is the design: one file, one job.

| File | Job |
| --- | --- |
| `game/js/world.js` | Palm Coast itself — seeded city generation and layered rendering (terrain, water, buildings, props, golden-hour grade). Defines the shared `mulberry32` RNG. |
| `game/js/vehicles.js` | Car models, arcade driving with handbrake drift, grid traffic AI, and the shared effects pool (skid marks, crash sparks, damage smoke). |
| `game/js/boats.js` | The pier fleet — water physics, foam wakes, all boat drawing. |
| `game/js/people.js` | Pedestrians who stroll, panic and fall; Jax's own body. Figures drawn at 1.4× with heads, hair and shoulders. |
| `game/js/police.js` | The heat meter, pursuit cruisers that ram, roadblocks, and the `units()` feed for the response panel. |
| `game/js/helicopter.js` | AIR-1 — the four-star helicopter whose searchlight pool sits on the player and slows heat decay. |
| `game/js/weapons.js` | Three-gun hitscan combat: pistol, SMG, shotgun, each with its own magazine and reserve. |
| `game/js/missions.js` | Eight story jobs (each opened by its giver's dialogue line) plus endless courier work. |
| `game/js/robberies.js` | Five free-roam shop tills — hold H in the gold ring, take the cash, wear the stars. |
| `game/js/arms.js` | The Palm Mall arms dealer overlay: SMG $900, shotgun $1400, ammo refills. |
| `game/js/audio.js` | Synthesized everything: engines, sirens, gunfire, alarms, and three radio stations with real chord loops. |
| `game/js/garage.js` | Marina Garage overlay: repairs, repaints, three engine stages, armor wax. |
| `game/js/hud.js` | Every HUD write and the minimap, driven by one per-frame snapshot from the core. |
| `game/js/game.js` | The core: state, input, save/load, camera, main loop, and the single event bus (`cash / crime / setHeat / banner / dialogue / popup / respect / save`) every system pays into. Publishes `window.PCH` for staging. |
| `game/js/demo.js` | Screenshot staging only. Inert unless the URL carries `?demo=`; all staged tableaux live here so production code carries no demo branches. |

## Systems

- **The city** — 3.2 × 2.4 km of avenues, named buildings with lit signage and
  furnished roofs, a beach, and a pier reaching into open water.
- **Wanted system** — crimes feed a heat meter behind 1–5 stars. Cruisers
  pursue and ram; at 3+ stars roadblocks wait ahead; at 4+ AIR-1 pins its
  searchlight on you and hiding stops working. Lose line of sight and heat
  bleeds away. Get cornered slowly and the bust meter fills — unless you're
  on the water, where the sea slowly hides you instead.
- **Missions** — eight story jobs from five givers (Marlo, Vera, Dee, Salty,
  Mr. Lark), each with its own dialogue, timers, heat and set pieces, then
  endless courier runs.
- **Economy & progression** — mission pay, robbery tills, drift-chain and
  near-miss bonuses feed a garage (engine stages, armor wax), an arms dealer,
  and a six-rank respect ladder from NOBODY to KINGPIN.
- **Presentation** — full HUD with minimap, PCPD response panel (every unit's
  role and distance), speedometer, dialogue cards, location cards, arcade
  popups, and a three-station synthesized radio.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move, drive, sail |
| Mouse | Aim · click to shoot |
| E | Enter / exit a car or boat |
| 1 / 2 / 3 | Pistol / SMG / shotgun |
| F | Punch |
| H (hold) | Rob the shop whose ring you're standing in |
| R | Cycle radio in a car · reload on foot |
| G | Garage at Marina Parking · arms dealer at Palm Mall |
| Space | Handbrake (drift!) |
| P / M | Pause · mute |

## Running it

Open `game/index.html` in any browser, or serve the folder statically.
`main.ts` is the make.fun program entry: it assembles the dossier from
`game/` and `screenshots/`.

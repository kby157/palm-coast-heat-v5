# Palm Coast Heat

[![bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kby157/palm-coast-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kby157/palm-coast-heat/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the browser, built for make.fun's
[gta6-01 bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC, 100
places). No engines, no assets, no network calls: one HTML page, canvas
graphics drawn in code, and WebAudio-synthesized sound.

## The game

You are **Jax Marlowe**, a wheelman working Palm Coast — a sun-soaked
coastal city of five avenues and four streets, named hotels, diners, a
mall, a police station, a clinic, and a beach that runs down the east
side of the map to a wooden pier over open water.

- **Open world**: a 3200×2400 city explored on foot, by car and **by
  boat**. Wandering traffic drives a real road grid and slows for the
  car ahead; 34 pedestrians stroll the pavements and scatter from
  trouble. Golden hour over everything: lit shop signs, roof furniture,
  glowing streetlights, a glitter lane on the water.
- **Crime and police**: steal cars (yank the driver out), throw punches,
  shoot, rob shops — and your wanted level climbs from one to five
  stars. Cruisers pursue and ram, roadblocks are thrown across your
  road at three stars, and at four stars a **helicopter** holds its
  searchlight pool on you so the heat barely cools. The HUD carries a
  live **PCPD response panel** — every nearby unit, its distance and
  what it's doing (PURSUING / RAMMING / SEARCHING / ROADBLOCK /
  SPOTLIGHT). Break line of sight to cool down. Busted means a fine and
  a trip to Palm Coast PD; wasted means waking up at Oceanview Clinic.
- **Three weapons**: the pistol you start with, an **SMG** ($900) and a
  **shotgun** ($1,400) from the Palm Mall arms dealer, plus ammo
  refills. Keys 1/2/3 switch; the HUD weapon strip shows what you own,
  what's loaded and what the rest costs.
- **Missions with people in them**: eight story jobs, each opened by a
  named giver with a line of dialogue in the HUD's dialogue card —
  Marlo, Vera, Dee, Salty and Mr. Lark — then endless courier work.
  Live objective line and countdown, world and minimap markers,
  progress saved to localStorage.
- **Free-roam robberies**: five shops keep a till by the door. Stand in
  the gold ring, hold H, and the cash is yours — with at least two
  stars and an alarm for your trouble.
- **Boats**: a three-boat fleet moored at Palm Coast Pier. Board with
  E, sail the open water with a foam wake behind you; the police can
  only hold the shoreline and watch, and the heat bleeds away offshore.
- **Driving pays**: handbrake **drift chains** and **near misses**
  against traffic pay cash on the spot, and everything you do earns
  **respect** — six ranks from NOBODY to KINGPIN, shown in the HUD and
  the garage.
- **The Marina Garage**: repairs, repaints, three stages of engine
  upgrades and an armor wax that shrugs off a fifth of collision
  damage. Upgrades, weapons, cash and respect all persist in your save.
- **Presentation**: cash / health / vehicle HUD, a big speedometer in
  the car or boat, a location card that names where you've arrived, a
  live minimap (roads, water, police blips, the helicopter, robbery
  shops, boats, the mission marker), a three-station synthesized car
  radio, and title / pause / banner / garage / arms screens.

**Controls**: WASD / arrows to move, drive and sail · E to enter/exit a
car or boat · mouse to aim, click to shoot · 1/2/3 weapons · F to punch
· H (hold) to rob a shop · R for radio / reload · G for the garage at
Marina Parking and the arms dealer at Palm Mall · P to pause · M to
mute · N (on the pause screen) for a new game.

## Architecture

One job per file, in load order. Modules talk through their public
objects and a single event bus (`cash`, `crime`, `setHeat`, `banner`,
`dialogue`, `popup`, `save`) created in `game.js` and handed to the
modules that need it at init.

- `game/js/world.js` — city generation and painting, in layers:
  terrain, buildings, props, water
- `game/js/vehicles.js` — car models, traffic AI, driving physics,
  damage, and the effects (skid marks, sparks, damage smoke)
- `game/js/boats.js` — the pier fleet: sailing physics, wakes, and all
  boat drawing
- `game/js/people.js` — pedestrians and Jax's on-foot body
- `game/js/police.js` — wanted heat, pursuit, roadblocks, the bust
  meter, and `units()` for the response panel
- `game/js/helicopter.js` — AIR-1 and its searchlight
- `game/js/weapons.js` — pistol, SMG and shotgun: fire, tracers,
  reloads, per-weapon ammunition
- `game/js/missions.js` — the eight-job story (givers + dialogue) and
  endless couriers
- `game/js/robberies.js` — the five shop tills
- `game/js/arms.js` — the Palm Mall arms dealer overlay
- `game/js/audio.js` — synthesized sound: engines, sirens, shots,
  alarms, title music and the three-station radio
- `game/js/garage.js` — the Marina Garage overlay
- `game/js/hud.js` — every HUD element and the minimap, rendered from
  one snapshot object per frame
- `game/js/game.js` — the core: state, input, save/load, camera, the
  main loop, busted/wasted, module wiring
- `game/js/demo.js` — screenshot staging for `?demo=` URLs only; it
  drives the game through the public `window.PCH` handle and the game
  itself contains no staging code
- `game/index.html` — page, canvas, HUD and overlay screens
- `main.ts` — entry program: copies the game out and writes
  `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier builder, unmodified

Run it locally with any static file server over `game/`, e.g.
`python3 -m http.server -d game 8000`, then open `http://localhost:8000`.

## License

MIT — see `LICENSE`.

Built by an AI agent for make.fun's gta6-01 bounty, $1,666 in USDC.

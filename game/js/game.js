// game.js — the core: game state, input, save/load, the camera, the
// main loop, getting busted and wasted, and the wiring between modules.
// It owns no HUD (hud.js renders from a snapshot) and no shop screens
// (garage.js / arms.js own theirs). One event bus is created here and
// handed to every module that needs to talk back.

const SAVE_KEY = 'palm-coast-heat-v2';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

const RESPECT_LEVELS = [[0, 'NOBODY'], [100, 'RUNNER'], [300, 'WHEELMAN'], [600, 'SHOT CALLER'], [1000, 'FIXER'], [1500, 'KINGPIN']];
function respectInfo() {
  let lvl = 1, title = RESPECT_LEVELS[0][1];
  RESPECT_LEVELS.forEach(([need, name], i) => { if (G.respect >= need) { lvl = i + 1; title = name; } });
  return { level: lvl, title };
}

const G = {
  state: 'title',        // title | play | pause
  overlay: null,         // null | 'garage' | 'arms'
  cash: 120, health: 100, respect: 0,
  car: null, boat: null,
  engineStage: 0, armorWax: false,
  time: 0, lastHurt: -99, hurtCd: 0,
  dialogue: null,
};
const popups = [];
let driftChain = 0, driftPop = null;
let camOverride = null;

const bus = {
  cash(n) { G.cash = Math.max(0, G.cash + n); },
  crime(n) { Police.reportCrime(n); },
  setHeat(n) {
    Police.state.heat = Math.max(Police.state.heat, Math.min(5, n));
    if (n > 0) Police.state.unseenFor = 0;
  },
  banner(title, sub, bad) { Hud.banner(title, sub, bad); },
  dialogue(giver, line) { G.dialogue = { giver, line, until: G.time + 5 }; },
  popup(x, y, text, sub) { popups.push({ x, y, text, sub: sub || '', born: G.time, life: 1.7 }); },
  save() { saveGame(); },
  funds() { return G.cash; },
};
const shopHooks = {
  funds: bus.funds,
  spend(n) { G.cash = Math.max(0, G.cash - n); },
  car() { return G.car; },
  save: bus.save,
  engineStage() { return G.engineStage; },
  bumpEngine() { G.engineStage += 1; },
  armorOwned() { return G.armorWax; },
  fitArmor() { G.armorWax = true; },
};

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.cash, storyIdx: Missions.storyIdx, engineStage: G.engineStage,
      armorWax: G.armorWax, respect: G.respect,
      weapons: { owned: Weapons.state.owned, ammo: Weapons.state.ammo, current: Weapons.state.current },
    }));
  } catch (e) { /* storage unavailable: play on without a save */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return 0;
    const s = JSON.parse(raw);
    G.cash = s.cash ?? 120;
    G.engineStage = s.engineStage || 0;
    G.armorWax = !!s.armorWax;
    G.respect = s.respect || 0;
    if (s.weapons) {
      Object.assign(Weapons.state.owned, s.weapons.owned || {});
      for (const id in (s.weapons.ammo || {})) Object.assign(Weapons.state.ammo[id], s.weapons.ammo[id]);
      if (s.weapons.current && Weapons.state.owned[s.weapons.current]) Weapons.state.current = s.weapons.current;
    }
    return s.storyIdx || 0;
  } catch (e) { return 0; }
}

// ---- world boot -------------------------------------------------------------
Vehicles.spawnTraffic(14);
const storyCar = Vehicles.spawnParked();
People.spawnPeds(34);
Boats.spawnBoats();
const savedIdx = loadGame();
Missions.init(storyCar, savedIdx, bus);
Robberies.init(bus);
{
  const start = World.doorstep(World.buildingNamed("Marlo's Diner"));
  PlayerBody.x = start.x; PlayerBody.y = start.y + 14;
}

// ---- input --------------------------------------------------------------------
const keys = {};
let mouseX = 0, mouseY = 0, mouseDown = false;
let audioWoken = false;
function wakeAudio() {
  if (!audioWoken) {
    audioWoken = true;
    AudioSys.unlock();
    if (G.state === 'title') AudioSys.music(true);
  }
}

window.addEventListener('keydown', (e) => {
  wakeAudio();
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (keys[k]) return;
  keys[k] = true;
  if (G.state === 'title' && (k === 'enter')) { startPlay(); return; }
  if (G.state === 'pause') {
    if (k === 'p') togglePause();
    else if (k === 'n') { try { localStorage.removeItem(SAVE_KEY); } catch (err) {} location.reload(); }
    return;
  }
  if (G.state !== 'play') return;
  if (G.overlay) {
    if (k === 'g' || k === 'e' || k === 'escape') closeOverlay();
    else if (G.overlay === 'garage') {
      const kinds = { 1: 'repair', 2: 'repaint', 3: 'engine', 4: 'armor' };
      if (kinds[k]) Garage.buy(kinds[k], shopHooks);
    } else if (G.overlay === 'arms') {
      const kinds = { 1: 'smg', 2: 'shotgun', 3: 'ammo' };
      if (kinds[k]) Arms.buy(kinds[k], shopHooks);
    }
    return;
  }
  if (k === 'p') togglePause();
  else if (k === 'm') AudioSys.setMuted(!AudioSys.isMuted());
  else if (k === 'e') tryEnterExit();
  else if (k === 'f') tryPunch();
  else if (k === 'g') tryOpenShop();
  else if (k === 'r') { if (G.car) AudioSys.cycleStation(); else if (!G.boat) Weapons.startReload(); }
  else if (k === '1' || k === '2' || k === '3') Weapons.switchTo(Weapons.defs[Number(k) - 1].id);
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
cv.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
cv.addEventListener('mousedown', (e) => { wakeAudio(); if (e.button === 0) mouseDown = true; if (G.state === 'title') startPlay(); });
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
document.getElementById('mute').addEventListener('click', () => { wakeAudio(); AudioSys.setMuted(!AudioSys.isMuted()); });

function inputDir() {
  return {
    x: (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0),
    y: (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0),
    up: !!(keys['w'] || keys['arrowup']), down: !!(keys['s'] || keys['arrowdown']),
    left: !!(keys['a'] || keys['arrowleft']), right: !!(keys['d'] || keys['arrowright']),
    handbrake: !!(keys[' '] || keys['shift']),
  };
}

function startPlay() {
  if (G.state !== 'title') return;
  G.state = 'play';
  document.getElementById('title-screen').classList.remove('on');
  AudioSys.music(false);
}
function togglePause() {
  if (G.state === 'play') { G.state = 'pause'; document.getElementById('pause-screen').classList.add('on'); }
  else if (G.state === 'pause') { G.state = 'play'; document.getElementById('pause-screen').classList.remove('on'); }
}
function closeOverlay() {
  if (G.overlay === 'garage') Garage.close();
  if (G.overlay === 'arms') Arms.close();
  G.overlay = null;
}
function tryOpenShop() {
  const pos = actorPos();
  if (Garage.playerNear(pos)) { G.overlay = 'garage'; Garage.open(); }
  else if (Arms.playerNear(pos)) { G.overlay = 'arms'; Arms.open(); }
}

function actorPos() { return G.boat || G.car || PlayerBody; }
function actorSpeed() {
  if (G.boat) return G.boat.speed;
  if (G.car) return G.car.speed;
  return 0;
}

function tryEnterExit() {
  if (G.boat) {
    const spot = Boats.shorePoint(G.boat);
    PlayerBody.x = spot.x; PlayerBody.y = spot.y;
    G.boat = null;
    AudioSys.boatEngine(false);
    AudioSys.door();
    return;
  }
  if (G.car) {
    PlayerBody.x = G.car.x + Math.cos(G.car.angle + Math.PI / 2) * 30;
    PlayerBody.y = G.car.y + Math.sin(G.car.angle + Math.PI / 2) * 30;
    World.collideCircle(PlayerBody, 10);
    G.car = null;
    AudioSys.engine(false);
    AudioSys.radio(false);
    AudioSys.door();
    return;
  }
  const boat = Boats.nearestBoat(PlayerBody, 60);
  if (boat) {
    G.boat = boat;
    AudioSys.door();
    return;
  }
  let best = null, bd = 50;
  for (const car of Vehicles.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - PlayerBody.x, car.y - PlayerBody.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (best) {
    if (best.kind === 'traffic' && !best.stolen) {
      People.spawnAt(best.x + 16, best.y + 6);       // the driver, yanked out
      best.stolen = true;
      bus.crime(1);
      AudioSys.door();
    }
    if (best.kind === 'parked') best.kind = 'player';
    G.car = best;
    AudioSys.door();
  }
}

function tryPunch() {
  if (G.car || G.boat) return;
  PlayerBody.punchAnim = 0.28;
  AudioSys.punch();
  const f = PlayerBody.fist();
  let connected = false;
  for (const p of People.peds) {
    if (p.down <= 0 && Math.hypot(p.x - f.x, p.y - f.y) < 22) { People.hitPed(p, 30); connected = true; }
  }
  for (const car of Vehicles.cars) {
    if (Math.hypot(car.x - f.x, car.y - f.y) < 30) {
      Vehicles.damage(car, 4);
      Vehicles.sparkBurst(f.x, f.y, 3);
      connected = true;
    }
  }
  if (connected) bus.crime(0.7);
}

function respawnAt(buildingName) {
  const spot = World.doorstep(World.buildingNamed(buildingName));
  PlayerBody.x = spot.x; PlayerBody.y = spot.y;
  G.car = null; G.boat = null;
  AudioSys.engine(false); AudioSys.radio(false); AudioSys.boatEngine(false); AudioSys.siren(false);
}
function busted() {
  const fine = Math.min(G.cash, 120 + Police.stars() * 90);
  G.cash -= fine;
  bus.banner('BUSTED', 'The PCPD take $' + fine + ' and your afternoon. Released outside the station.', true);
  AudioSys.busted();
  Police.clear();
  G.health = Math.max(G.health, 55);
  respawnAt('Palm Coast PD');
  saveGame();
}
function wasted() {
  const bill = Math.min(G.cash, 150);
  G.cash -= bill;
  bus.banner('WASTED', 'Oceanview Clinic patches you up for $' + bill + '. The city keeps spinning.', true);
  AudioSys.busted();
  Police.state.heat = Math.min(Police.state.heat, 1);
  G.health = 100;
  respawnAt('Oceanview Clinic');
  saveGame();
}

// ---- per-frame update -----------------------------------------------------------
function update(dt) {
  G.time += dt;
  const input = inputDir();
  const pos = actorPos();

  if (G.boat) {
    Boats.driveBoat(G.boat, input, dt);
    PlayerBody.x = G.boat.x; PlayerBody.y = G.boat.y; PlayerBody.angle = G.boat.angle;
    Police.state.heat = Math.max(0, Police.state.heat - 0.02 * dt);   // the sea cools everything
    Police.state.bust = 0;
  } else if (G.car) {
    G.car.boost = 1 + 0.12 * G.engineStage;
    Vehicles.drivePlayer(G.car, input, dt);
    Vehicles.integrate(G.car, dt);
    PlayerBody.x = G.car.x; PlayerBody.y = G.car.y; PlayerBody.angle = G.car.angle;
    // drift chains pay out in cash and respect
    if (G.car.sliding && G.car.speed > 120) {
      driftChain += dt;
      if (!driftPop) { driftPop = { x: G.car.x, y: G.car.y - 44, text: '', sub: '', born: G.time, life: 0.4 }; popups.push(driftPop); }
      driftPop.x = G.car.x; driftPop.y = G.car.y - 44;
      driftPop.text = 'DRIFT x' + driftChain.toFixed(1);
      driftPop.born = G.time;
    } else if (driftChain > 0) {
      if (driftChain >= 0.8 && driftPop) {
        const pay = Math.round(driftChain * 20);
        bus.cash(pay);
        G.respect += Math.round(driftChain);
        bus.popup(G.car.x, G.car.y - 50, '+$' + pay, 'drift chain');
      }
      if (driftPop) { popups.splice(popups.indexOf(driftPop), 1); driftPop = null; }
      driftChain = 0;
    }
    // near misses against traffic
    for (const other of Vehicles.cars) {
      if (other.kind !== 'traffic' || other.dead) continue;
      const d = Math.hypot(other.x - G.car.x, other.y - G.car.y);
      if (d > 40 && d < 60 && G.car.speed > 200 && G.time - other.nearMissAt > 4) {
        other.nearMissAt = G.time;
        bus.cash(25);
        G.respect += 5;
        bus.popup(other.x, other.y - 34, 'NEAR MISS +$25', '');
      }
    }
    if (G.car.health <= 0) {
      bus.banner('WRECKED', 'Your ride is done. Walk it off, Jax.', true);
      G.health = Math.max(10, G.health - 12);
      tryEnterExit();
    }
  } else {
    PlayerBody.move(input, dt);
    PlayerBody.update(dt);
    const aim = screenToWorld(mouseX, mouseY);
    Weapons.update(dt, PlayerBody, aim.x, aim.y, mouseDown, G.time, bus);
  }

  for (const car of Vehicles.cars) if (car.kind === 'traffic') Vehicles.updateTraffic(car, dt, pos);
  collideCars(dt);
  Vehicles.updateEffects(dt);
  Boats.updateWake(dt);
  People.update(dt, { x: pos.x, y: pos.y, hot: Police.stars() > 0 || mouseDown });

  // traffic clipping Jax on foot
  G.hurtCd -= dt;
  if (!G.car && !G.boat && G.hurtCd <= 0) {
    for (const car of Vehicles.cars) {
      if (car.kind === 'police' || car.dead) continue;
      if (car.speed > 70 && Math.hypot(car.x - PlayerBody.x, car.y - PlayerBody.y) < 23) {
        G.health -= 11; G.lastHurt = G.time; G.hurtCd = 0.9;
        PlayerBody.x += (PlayerBody.x - car.x) * 0.4;
        PlayerBody.y += (PlayerBody.y - car.y) * 0.4;
        break;
      }
    }
  }

  const events = [];
  Police.update(dt, { x: pos.x, y: pos.y, speed: actorSpeed(), inBoat: !!G.boat }, G.car, events);
  Helicopter.update(dt, pos, Police.stars());
  if (events.includes('busted')) { busted(); return; }

  Missions.update(dt, pos, G.car);
  const done = Missions.takeCompleted();
  if (done) {
    G.respect += Math.round(done.reward / 10);
    bus.popup(pos.x, pos.y - 52, 'JOB DONE +$' + done.reward, done.title);
  }
  Robberies.update(dt, PlayerBody, !G.car && !G.boat, !!keys['h']);
  if (Robberies.takeRobbed()) G.respect += 25;

  if (G.health <= 0) { wasted(); return; }
  if (G.time - G.lastHurt > 6 && (Police.stars() === 0 || Police.state.unseenFor > 4))
    G.health = Math.min(100, G.health + 3 * dt);

  // audio follows the action
  if (G.car) {
    AudioSys.engine(true, input.up, Math.min(1, G.car.speed / 380));
    AudioSys.radio(true);
  } else AudioSys.engine(false);
  if (G.boat) AudioSys.boatEngine(true, Math.min(1, G.boat.speed / 240));
  else AudioSys.boatEngine(false);
  let sirenNear = false;
  for (const c of Police.state.cruisers) if (Math.hypot(c.x - pos.x, c.y - pos.y) < 820) { sirenNear = true; break; }
  AudioSys.siren(sirenNear && Police.stars() > 0);

  for (let i = popups.length - 1; i >= 0; i--)
    if (G.time - popups[i].born > popups[i].life) popups.splice(i, 1);
}

function collideCars(dt) {
  const list = Vehicles.cars;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 38 * 38 || d2 < 0.01) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, overlap = 38 - d;
      const aParked = a.kind === 'parked' || a.kind === 'police' && Police.state.roadblocks.some((r) => r.cars.includes(a));
      const bParked = b.kind === 'parked' || b.kind === 'police' && Police.state.roadblocks.some((r) => r.cars.includes(b));
      if (!aParked) { a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; }
      if (!bParked) { b.x += nx * overlap / 2; b.y += ny * overlap / 2; }
      const closing = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
      if (closing > 55) {
        let dmg = closing * 0.055;
        Vehicles.damage(a, a === G.car && G.armorWax ? dmg * 0.8 : dmg);
        Vehicles.damage(b, b === G.car && G.armorWax ? dmg * 0.8 : dmg);
        Vehicles.sparkBurst((a.x + b.x) / 2, (a.y + b.y) / 2, Math.min(10, Math.round(closing / 22)));
        if ((a === G.car || b === G.car) && closing > 250) {
          G.health -= (closing - 250) * 0.05;
          G.lastHurt = G.time;
        }
        const swap = 0.45;
        const avn = a.vx * nx + a.vy * ny, bvn = b.vx * nx + b.vy * ny;
        if (!aParked) { a.vx += (bvn - avn) * swap * nx; a.vy += (bvn - avn) * swap * ny; }
        if (!bParked) { b.vx += (avn - bvn) * swap * nx; b.vy += (avn - bvn) * swap * ny; }
      }
    }
  }
}

// ---- camera & rendering ---------------------------------------------------------
let camX = 1600, camY = 1200, camZoom = 1;
function computeCamera() {
  if (camOverride) { camX = camOverride.x; camY = camOverride.y; camZoom = camOverride.zoom || 1; return; }
  if (G.state === 'title') {
    camX = 1600 + Math.sin(G.time * 0.07) * 320;
    camY = 1180 + Math.cos(G.time * 0.05) * 160;
    camZoom = 1;
    return;
  }
  const pos = actorPos();
  camX = pos.x; camY = pos.y; camZoom = 1;
}
function screenToWorld(sx, sy) {
  return { x: camX + (sx - cv.width / 2) / camZoom, y: camY + (sy - cv.height / 2) / camZoom };
}
function setCamera(o) { camOverride = o; }

function locationName() {
  const p = actorPos();
  if (World.onPier(p.x, p.y) || (World.inWater(p.x, p.y) && Math.abs(p.y - World.PIER_Y) < 170)) return 'PALM COAST PIER';
  if (p.x > World.BEACH_X) return 'COQUINA STRIP';
  let best = null, bd = 218;
  for (const b of World.buildings) {
    const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best ? best.name.toUpperCase() : 'PALM COAST';
}

function promptText() {
  if (G.overlay) return '';
  const rob = Robberies.promptText();
  if (rob) return rob;
  const pos = actorPos();
  if (G.boat) return 'E — step ashore at the pier or the waterline';
  if (!G.car) {
    const boat = Boats.nearestBoat(PlayerBody, 60);
    if (boat) return 'E — board the ' + boat.name;
    let bd = 50, nearCar = null;
    for (const car of Vehicles.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - PlayerBody.x, car.y - PlayerBody.y);
      if (d < bd) { bd = d; nearCar = car; }
    }
    if (nearCar) return 'E — take the ' + nearCar.name;
  }
  if (Garage.playerNear(pos)) return 'G — Marina Garage';
  if (Arms.playerNear(pos)) return 'G — Palm Mall arms dealer';
  return '';
}

function render() {
  computeCamera();
  const vw = cv.width / camZoom, vh = cv.height / camZoom;
  const view = { x0: camX - vw / 2, y0: camY - vh / 2, x1: camX + vw / 2, y1: camY + vh / 2 };
  ctx.setTransform(camZoom, 0, 0, camZoom, cv.width / 2 - camX * camZoom, cv.height / 2 - camY * camZoom);
  World.draw(ctx, view, G.time);
  Vehicles.drawGroundEffects(ctx);
  Boats.draw(ctx);
  Robberies.drawMarkers(ctx, G.time);
  Police.drawRoadblocks(ctx, G.time);
  Vehicles.draw(ctx, G.time);
  People.draw(ctx);
  if (!G.car && !G.boat) PlayerBody.draw(ctx);
  Helicopter.draw(ctx, G.time);
  Vehicles.drawAirEffects(ctx);
  if (!G.car && !G.boat) Weapons.draw(ctx, PlayerBody, G.time);
  drawObjectiveMarker(view);
  drawPopups();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const pos = actorPos();
  const obj = Missions.objective();
  const ri = respectInfo();
  const veh = G.boat ? G.boat.name + ' — on the water'
    : G.car ? G.car.name + ' — hull ' + Math.round(G.car.health) + '%' + (G.engineStage ? ' · engine stage ' + G.engineStage : '')
    : 'On foot';
  Hud.update({
    cash: G.cash, health: G.health, vehicleLine: veh, stars: Police.stars(),
    objectiveText: obj.text, objectiveTime: obj.time,
    weaponText: (!G.car && !G.boat) ? Weapons.hudText() : '',
    weaponsState: Weapons.state,
    radioText: G.car ? AudioSys.stationName() + ' (R: next station)' : '',
    progressText: Missions.progressText(),
    respectText: 'RESPECT Lv ' + ri.level + ' · ' + ri.title,
    bust: Police.state.bust, promptText: promptText(),
    speedKmh: (!G.overlay && (G.car || G.boat)) ? Math.round(actorSpeed() * 0.38) : null,
    speedName: G.car ? G.car.name : (G.boat ? G.boat.name : ''),
    policeUnits: Police.units(), locationName: locationName(),
    dialogue: G.dialogue, time: G.time,
  });
  Hud.minimap({
    px: pos.x, py: pos.y,
    pangle: G.boat ? G.boat.angle : G.car ? G.car.angle : PlayerBody.angle,
    cruisers: Police.state.cruisers, roadblocks: Police.state.roadblocks,
    heli: Helicopter.state, boats: Boats.boats, shops: Robberies.availableShops(),
    objective: obj, time: G.time,
  });
}

function drawObjectiveMarker(view) {
  const obj = Missions.objective();
  if (obj.x === null || obj.x === undefined) return;
  const inside = obj.x > view.x0 + 26 && obj.x < view.x1 - 26 && obj.y > view.y0 + 26 && obj.y < view.y1 - 26;
  ctx.save();
  if (inside) {
    const bob = Math.sin(G.time * 4.4) * 5;
    ctx.translate(obj.x, obj.y - 30 + bob);
    ctx.fillStyle = '#ffc840';
    ctx.strokeStyle = 'rgba(20,16,0,0.65)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(10, 0); ctx.lineTo(0, -12); ctx.lineTo(-10, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,64,0.6)';
    ctx.beginPath(); ctx.arc(0, 30 - bob, 15 + Math.sin(G.time * 4.4) * 2.4, 0, Math.PI * 2); ctx.stroke();
  } else {
    const cx = World.clamp(obj.x, view.x0 + 34, view.x1 - 34);
    const cy = World.clamp(obj.y, view.y0 + 34, view.y1 - 34);
    const pos = actorPos();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(obj.y - pos.y, obj.x - pos.x));
    ctx.fillStyle = '#ffc840';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawPopups() {
  ctx.textAlign = 'center';
  for (const p of popups) {
    const age = G.time - p.born;
    const a = Math.max(0, 1 - age / p.life);
    ctx.globalAlpha = a;
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.strokeStyle = 'rgba(10,10,14,0.8)'; ctx.lineWidth = 4;
    const y = p.y - age * 26;
    ctx.strokeText(p.text, p.x, y);
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(p.text, p.x, y);
    if (p.sub) {
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.strokeText(p.sub, p.x, y + 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(p.sub, p.x, y + 16);
    }
  }
  ctx.globalAlpha = 1;
}

// ---- main loop ---------------------------------------------------------------------
let lastTs = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, Math.max(0, (ts - lastTs) / 1000 || 0));
  lastTs = ts;
  if (G.state === 'play' && !G.overlay) update(dt);
  else if (G.state === 'title') G.time += dt;
  if (G.overlay === 'garage') {
    const ri = respectInfo();
    Garage.refresh({
      cash: G.cash, carName: G.car ? G.car.name : null,
      hullPct: G.car ? Math.round(G.car.health) : null,
      engineStage: G.engineStage, armorOwned: G.armorWax,
      respectText: 'RESPECT Lv ' + ri.level + ' · ' + ri.title + ' — ' + G.respect + ' pts',
    });
  } else if (G.overlay === 'arms') {
    Arms.refresh({ cash: G.cash });
  }
  render();
}
requestAnimationFrame(loop);

window.PCH = { G, PlayerBody, Vehicles, Police, Helicopter, Weapons, Missions, Boats, Robberies, World, Hud, setCamera };

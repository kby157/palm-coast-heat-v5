// game.js — the core: game state, input, the save file, the camera, the main
// loop and the wiring between systems. Everything visual that belongs to a
// system lives in that system's file; every HUD write goes through hud.js;
// every cross-system reward flows through the one event bus defined here.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VIEW_W = 1280, VIEW_H = 800;
const el = (id) => document.getElementById(id);

const SAVE_KEY = 'palm-coast-heat-v2';
const G = {
  state: 'title', cash: 120, health: 100,
  car: null, boat: null, respect: 0,
};
const RESPECT_LEVELS = [0, 100, 300, 600, 1000, 1500];
const RESPECT_TITLES = ['NOBODY', 'RUNNER', 'WHEELMAN', 'SHOT CALLER', 'FIXER', 'KINGPIN'];

function respectLevel() {
  let lvl = 0;
  for (let i = 0; i < RESPECT_LEVELS.length; i++) if (G.respect >= RESPECT_LEVELS[i]) lvl = i;
  return lvl;
}
function respectLine() { return `RESPECT Lv ${respectLevel() + 1} · ${RESPECT_TITLES[respectLevel()]}`; }
function addRespect(n) {
  const before = respectLevel();
  G.respect += n;
  if (respectLevel() > before) banner('RESPECT RISES', 'The streets know you now — ' + RESPECT_TITLES[respectLevel()], false);
}

// ---- the one event bus ------------------------------------------------------
let dlg = null, dlgUntil = -1;
const popups = [];
const bus = {
  cash(n) { G.cash = Math.max(0, G.cash + n); return G.cash; },
  crime(amount) { Police.reportCrime(amount); },
  setHeat(n) { Police.setHeat(n); },
  banner(title, sub, bad) { banner(title, sub, bad); },
  dialogue(giver, line) { dlg = { name: giver, line }; dlgUntil = performance.now() / 1000 + 5.2; },
  popup(x, y, text, sub) {
    popups.push({ x, y, text, sub: sub || '', life: 1.5, max: 1.5 });
    if (popups.length > 9) popups.shift();
  },
  respect(n) { addRespect(n); },
  save() { saveGame(); },
};

// ---- save / load --------------------------------------------------------------
function saveGame() {
  const data = {
    cash: G.cash, storyIdx: Missions.storyIdx,
    engineStage: Garage.state.stage, armorWax: Garage.state.armor,
    respect: G.respect,
    weapons: { owned: Weapons.state.owned, ammo: Weapons.state.ammo, current: Weapons.state.current },
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
}
function loadRaw() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// ---- input ----------------------------------------------------------------------
const keys = {};
let pressed = {};
let mouseX = VIEW_W / 2, mouseY = VIEW_H / 3, mouseDown = false;

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  AudioSys.unlock();
  if (!keys[k]) pressed[k] = true;
  keys[k] = true;
  if (Garage.state.open) {
    const kinds = ['repair', 'repaint', 'engine', 'armor'];
    if (['1', '2', '3', '4'].includes(k)) Garage.buy(kinds[Number(k) - 1], bus, G.car, G.cash);
    if (k === 'g' || k === 'e' || k === 'escape') Garage.close();
    return;
  }
  if (Arms.state.open) {
    const kinds = { '1': 'smg', '2': 'shotgun', '3': 'ammo' };
    if (kinds[k]) Arms.buy(kinds[k], bus, G.cash);
    if (k === 'g' || k === 'e' || k === 'escape') Arms.close();
    return;
  }
  if (e.key === 'Enter') {
    if (G.state === 'title') startPlay();
    else if (G.state === 'pause') { G.state = 'play'; }
  }
  if (k === 'p' && (G.state === 'play' || G.state === 'pause')) {
    G.state = G.state === 'play' ? 'pause' : 'play';
    if (G.state === 'pause') saveGame();
  }
  if (k === 'm') {
    const m = AudioSys.setMuted(!AudioSys.isMuted());
    el('mute').textContent = m ? 'Sound: off' : 'Sound: on';
  }
  if (k === 'n' && G.state === 'pause') {
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
    location.reload();
  }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouseX = (e.clientX - r.left) * (VIEW_W / r.width);
  mouseY = (e.clientY - r.top) * (VIEW_H / r.height);
});
window.addEventListener('mousedown', (e) => { if (e.button === 0) { mouseDown = true; AudioSys.unlock(); } });
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
el('mute').addEventListener('click', () => {
  const m = AudioSys.setMuted(!AudioSys.isMuted());
  el('mute').textContent = m ? 'Sound: off' : 'Sound: on';
});

function readInput() {
  return {
    up: !!(keys['w'] || keys['arrowup']), down: !!(keys['s'] || keys['arrowdown']),
    left: !!(keys['a'] || keys['arrowleft']), right: !!(keys['d'] || keys['arrowright']),
    handbrake: !!keys[' '],
  };
}

// ---- screens & banner ------------------------------------------------------------
let bannerUntil = -1;
function banner(title, sub, bad) {
  el('banner-title').textContent = title;
  el('banner-sub').textContent = sub || '';
  el('banner-screen').classList.toggle('bad', !!bad);
  el('banner-screen').classList.add('on');
  bannerUntil = performance.now() / 1000 + 2.4;
}
function syncScreens(now) {
  el('title-screen').classList.toggle('on', G.state === 'title');
  el('pause-screen').classList.toggle('on', G.state === 'pause');
  if (bannerUntil > 0 && now > bannerUntil) { el('banner-screen').classList.remove('on'); bannerUntil = -1; }
}
function startPlay() {
  G.state = 'play';
  setCamera({ clear: true });
  AudioSys.music(false);
  AudioSys.radio(false);
  Missions.beginImmediately();
}

// ---- camera ----------------------------------------------------------------------
const camCtl = { x: null, y: null, zoom: null };
function setCamera(c) {
  if (c.clear) { camCtl.x = null; camCtl.y = null; camCtl.zoom = null; return; }
  if (c.x != null) camCtl.x = c.x;
  if (c.y != null) camCtl.y = c.y;
  if (c.zoom != null) camCtl.zoom = c.zoom;
}
function actorPos() {
  if (G.boat) return G.boat;
  if (G.car) return G.car;
  return PlayerBody;
}
function camCenter() {
  if (camCtl.x != null) return { x: camCtl.x, y: camCtl.y, zoom: camCtl.zoom || 1 };
  if (G.state === 'title') return { x: 1560, y: 1160, zoom: camCtl.zoom || 1 };
  // follow the actor, but keep the frame mostly inside the world so the
  // edges of the map never open into void
  const a = actorPos();
  const zoom = camCtl.zoom || 1, hw = (VIEW_W / 2) / zoom, hh = (VIEW_H / 2) / zoom;
  return {
    x: World.clamp(a.x, hw - 60, World.W - hw + 60),
    y: World.clamp(a.y, hh - 60, World.H - hh + 60),
    zoom,
  };
}
function aimWorld() {
  const c = camCenter();
  return { x: (mouseX - VIEW_W / 2) / c.zoom + c.x, y: (mouseY - VIEW_H / 2) / c.zoom + c.y };
}

// ---- consequences ------------------------------------------------------------------
let iframesUntil = -1, punchCd = 0, punchCrimeAt = -9, lastHurtAt = -99;
function witnessed(radius) {
  const p = PlayerBody;
  for (const c of Police.state.cruisers) if (Math.hypot(c.x - p.x, c.y - p.y) < radius) return true;
  for (const ped of People.peds) if (!ped.down && Math.hypot(ped.x - p.x, ped.y - p.y) < radius * 0.7) return true;
  return false;
}
function hurtPlayer(n, now) {
  if (now < iframesUntil || G.state !== 'play') return;
  G.health -= n;
  lastHurtAt = now;
  iframesUntil = now + 0.9;
  if (G.health <= 0) wasted();
}
function dropVehicle() {
  if (G.car) { G.car.kind = 'parked'; Vehicles.setPlayerRef(null); G.car = null; }
  G.boat = null;
}
function respawnAt(name) {
  const d = World.doorstep(World.buildingNamed(name));
  PlayerBody.x = d.x; PlayerBody.y = d.y;
}
function busted() {
  const fine = Math.min(G.cash, 120 + Police.stars() * 90);
  G.cash -= fine;
  banner('BUSTED', `The PCPD take $${fine} — and your dignity`, true);
  AudioSys.busted();
  Police.clear();
  dropVehicle();
  respawnAt('Palm Coast PD');
  G.health = 100;
  saveGame();
}
function wasted() {
  const bill = Math.min(G.cash, 150);
  G.cash -= bill;
  banner('WASTED', `Oceanview Clinic bills you $${bill}`, true);
  AudioSys.busted();
  Police.clear();
  dropVehicle();
  respawnAt('Oceanview Clinic');
  G.health = 100;
  saveGame();
}

// ---- entering / leaving vehicles -----------------------------------------------------
function tryEnterExit(now) {
  const p = PlayerBody;
  if (G.boat) {
    const shore = Boats.shorePoint(G.boat);
    p.x = shore.x; p.y = shore.y;
    G.boat = null;
    AudioSys.door();
    return;
  }
  if (G.car) {
    const car = G.car;
    p.x = car.x - Math.sin(car.angle) * 30; p.y = car.y + Math.cos(car.angle) * 30;
    World.collideCircle(p, 10);
    dropVehicle();
    AudioSys.door();
    return;
  }
  // on foot: board a boat or take a car, whichever is closer
  const boat = Boats.nearestBoat(p, 70);
  let car = null, cd = 56;
  for (const c of Vehicles.cars) {
    if (c.dead || c.kind === 'roadblock') continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < cd) { cd = d; car = c; }
  }
  if (boat && (!car || Math.hypot(boat.x - p.x, boat.y - p.y) < cd)) {
    G.boat = boat;
    AudioSys.door();
    return;
  }
  if (!car) return;
  if (car.kind === 'police') {
    const i = Police.state.cruisers.indexOf(car);
    if (i >= 0) Police.state.cruisers.splice(i, 1);
  }
  if (car.hasDriver) {
    const driver = People.addPed(car.x + 12, car.y + 8);
    driver.panic = 2.4; driver.fleeX = p.x; driver.fleeY = p.y;
    car.hasDriver = false;
    if (!car.stolen) { car.stolen = true; bus.crime(1); }
  } else if (!car.stolen) {
    car.stolen = true;
    if (witnessed(300)) bus.crime(1);
  }
  car.kind = 'player';
  G.car = car;
  Vehicles.setPlayerRef(car);
  AudioSys.door();
}

// ---- drift & near-miss ------------------------------------------------------------------
const drift = { time: 0, popupObj: null };
function updateDrift(dt, car) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const fwd = car.vx * fx + car.vy * fy;
  if (car.sliding && fwd > 110) {
    drift.time += dt;
    if (!drift.popupObj) {
      drift.popupObj = { x: car.x, y: car.y - 46, text: '', sub: '', life: 0.25, max: 0.25, drift: true };
      popups.push(drift.popupObj);
    }
    drift.popupObj.x = car.x; drift.popupObj.y = car.y - 46;
    drift.popupObj.text = 'DRIFT x' + drift.time.toFixed(1);
    drift.popupObj.life = 0.25;
  } else {
    if (drift.time >= 0.8) {
      const pay = Math.round(20 * drift.time);
      bus.cash(pay);
      bus.popup(car.x, car.y - 46, '+$' + pay, 'drift chain');
      addRespect(Math.round(drift.time * 2));
      AudioSys.pickup();
    }
    drift.time = 0;
    drift.popupObj = null;
  }
  const spd = Math.abs(fwd);
  if (spd > 200) {
    for (const o of Vehicles.cars) {
      if (o.kind !== 'traffic' || o.nearMissCd > 0) continue;
      const d = Math.hypot(o.x - car.x, o.y - car.y);
      if (d < 54 && d > 31) {
        o.nearMissCd = 3;
        bus.cash(25);
        bus.popup((o.x + car.x) / 2, car.y - 40, 'NEAR MISS +$25', '');
        addRespect(5);
        AudioSys.pickup();
      }
    }
  }
}

// ---- the frame update ---------------------------------------------------------------------
function update(dt, now) {
  const input = readInput();
  const actor = actorPos();
  const onFoot = !G.car && !G.boat;

  if (G.boat) {
    Boats.driveBoat(G.boat, input, dt);
    Police.state.heat = Math.max(0, Police.state.heat - 0.02 * dt); // the sea hides you, slowly
    if (pressed['e']) tryEnterExit(now);
  } else if (G.car) {
    Vehicles.drivePlayer(G.car, input, dt);
    updateDrift(dt, G.car);
    if (pressed['e']) tryEnterExit(now);
    if (pressed['r']) AudioSys.cycleStation();
  } else {
    const aim = aimWorld();
    PlayerBody.angle = Math.atan2(aim.y - PlayerBody.y, aim.x - PlayerBody.x);
    PlayerBody.move(input, dt);
    if (punchCd > 0) punchCd -= dt;
    if (pressed['f'] && punchCd <= 0) {
      punchCd = 0.38;
      PlayerBody.punchAnim = 0.28;
      AudioSys.punch();
      const f = PlayerBody.fist();
      let hit = false;
      for (const ped of People.peds) {
        if (!ped.down && Math.hypot(ped.x - f.x, ped.y - f.y) < 26) { People.hurt(ped, 20); hit = true; }
      }
      if (hit && witnessed(320) && now - punchCrimeAt > 1) { punchCrimeAt = now; bus.crime(0.7); }
    }
    Weapons.update(dt, PlayerBody, aim.x, aim.y, mouseDown, now, bus);
    if (pressed['r']) Weapons.startReload();
    if (pressed['1']) Weapons.select('pistol');
    if (pressed['2']) Weapons.select('smg');
    if (pressed['3']) Weapons.select('shotgun');
    if (pressed['e']) tryEnterExit(now);
    if (pressed['g']) {
      if (Garage.playerNear(PlayerBody)) { Garage.open(); AudioSys.door(); }
      else if (Arms.near(PlayerBody)) { Arms.open(); AudioSys.door(); }
    }
  }

  // the city lives around Jax
  const threat = { x: actor.x, y: actor.y, hot: Police.stars() > 0 || mouseDown && onFoot };
  People.update(dt, threat);
  for (const car of Vehicles.cars) Vehicles.updateTraffic(car, dt, actor);
  collideCars(now);
  Vehicles.updateEffects(dt, G.car);
  Boats.updateWake(dt);

  const spd = G.boat ? Math.hypot(G.boat.vx, G.boat.vy)
    : G.car ? Vehicles.speedOf(G.car) : (input.up || input.down || input.left || input.right ? 178 : 0);
  Police.update(dt, { x: actor.x, y: actor.y, speed: spd, inBoat: !!G.boat }, G.car);
  Helicopter.update(dt, actor, Police.stars());
  Missions.update(dt, actor, G.car);
  Robberies.update(dt, PlayerBody, onFoot, !!keys['h']);

  // traffic can hurt a man on foot
  if (onFoot && now >= iframesUntil) {
    for (const car of Vehicles.cars) {
      if (car.kind !== 'traffic' || car.dead) continue;
      if (Vehicles.speedOf(car) > 130 && Math.hypot(car.x - PlayerBody.x, car.y - PlayerBody.y) < 27) {
        hurtPlayer(16, now);
        PlayerBody.x += (PlayerBody.x - car.x) * 0.4;
        PlayerBody.y += (PlayerBody.y - car.y) * 0.4;
        break;
      }
    }
  }
  if (Police.state.bust >= 1) busted();
  if (G.health < 100 && Police.stars() === 0 && now - lastHurtAt > 5) {
    G.health = Math.min(100, G.health + 4 * dt);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.life -= dt; p.y -= 24 * dt;
    if (p.life <= 0) { popups.splice(i, 1); if (drift.popupObj === p) drift.popupObj = null; }
  }

  // sound follows the action
  AudioSys.engine(!!G.car, input.up ? 1 : 0, G.car ? Vehicles.speedOf(G.car) / 385 : 0);
  AudioSys.boatEngine(!!G.boat, G.boat ? Math.hypot(G.boat.vx, G.boat.vy) / 245 : 0);
  const sirenNear = Police.stars() > 0 && Police.state.cruisers.some((c) => Math.hypot(c.x - actor.x, c.y - actor.y) < 780);
  AudioSys.siren(sirenNear);
  AudioSys.radio(!!G.car);
}

function collideCars(now) {
  const list = Vehicles.cars;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const rsum = (a.l + b.l) * 0.30;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rsum * rsum || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, overlap = rsum - d;
      const aFixed = a.kind === 'roadblock', bFixed = b.kind === 'roadblock';
      if (!aFixed) { a.x -= nx * overlap * (bFixed ? 1 : 0.5); a.y -= ny * overlap * (bFixed ? 1 : 0.5); }
      if (!bFixed) { b.x += nx * overlap * (aFixed ? 1 : 0.5); b.y += ny * overlap * (aFixed ? 1 : 0.5); }
      const rel = Math.abs((b.vx - a.vx) * nx + (b.vy - a.vy) * ny);
      if (rel > 55) {
        Vehicles.damage(a, rel * 0.045);
        Vehicles.damage(b, rel * 0.045);
        Vehicles.sparkBurst((a.x + b.x) / 2, (a.y + b.y) / 2, Math.min(10, 3 + rel / 30));
        const tvx = a.vx, tvy = a.vy;
        if (!aFixed) { a.vx = b.vx * 0.55; a.vy = b.vy * 0.55; }
        if (!bFixed) { b.vx = tvx * 0.55; b.vy = tvy * 0.55; }
        if ((a === G.car || b === G.car) && rel > 165) hurtPlayer(rel * 0.05, now);
      }
    }
  }
}

function ambient(dt) {
  // title screen: the city idles behind the logo
  const center = { x: camCtl.x || 1560, y: camCtl.y || 1160 };
  People.update(dt, { x: 0, y: 0, hot: false });
  for (const car of Vehicles.cars) Vehicles.updateTraffic(car, dt, center);
  Vehicles.updateEffects(dt, null);
  Boats.updateWake(dt);
}

// ---- snapshot for the HUD ---------------------------------------------------------------------
function locationName(pos) {
  if (pos.x >= World.WATER_X - 8) return Math.abs(pos.y - World.PIER_Y) < 150 ? 'PALM COAST PIER' : 'OPEN WATER';
  // named when you are right at a building's skirts, generic otherwise
  let best = null, bd = 34;
  for (const b of World.buildings) {
    const dx = Math.max(b.x - pos.x, 0, pos.x - (b.x + b.w));
    const dy = Math.max(b.y - pos.y, 0, pos.y - (b.y + b.h));
    const d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = b; }
  }
  if (best) return best.name.toUpperCase();
  if (pos.x > World.BEACH_X - 170) return 'THE BEACH';
  return 'PALM COAST';
}

function currentPrompt() {
  const p = PlayerBody;
  if (Garage.state.open || Arms.state.open) return '';
  if (G.boat) return 'E — step ashore at the pier or the waterline';
  if (G.car) return '';
  const rob = Robberies.promptText();
  if (rob) return rob;
  if (Garage.playerNear(p)) return 'G — Marina Garage';
  if (Arms.near(p)) return 'G — Palm Mall Arms';
  const boat = Boats.nearestBoat(p, 70);
  if (boat) return 'E — board the ' + boat.name;
  const car = Vehicles.nearestCar(p, 56);
  if (car && car.kind !== 'roadblock') return (car.stolen ? 'E — take the ' : 'E — steal the ') + car.name;
  return '';
}

function buildSnapshot(now) {
  const actor = actorPos();
  const obj = Missions.objective();
  const units = Police.stars() > 0 ? Police.units(actor) : [];
  if (Helicopter.isActive()) {
    units.unshift({ label: 'AIR-1', role: 'SPOTLIGHT', dist: Math.round(Math.hypot(Helicopter.state.x - actor.x, Helicopter.state.y - actor.y)) });
  }
  const inVehicle = G.car || G.boat;
  return {
    cash: G.cash, health: G.health, progress: Missions.progressText(),
    respectText: respectLine(),
    vehicleText: G.car
      ? `${G.car.name} — hull ${Math.round(G.car.health)}%` + (Garage.state.stage > 0 ? ` · engine stage ${Garage.state.stage}` : '')
      : G.boat ? `${G.boat.name} — on the water` : 'On foot',
    radioText: G.car ? AudioSys.stationName() + ' (R: next station)' : '',
    stars: Police.stars(), objective: obj, prompt: currentPrompt(),
    bust: Police.state.bust,
    speedKmh: (inVehicle && !Garage.state.open && !Arms.state.open)
      ? (G.car ? Vehicles.speedOf(G.car) : Math.hypot(G.boat.vx, G.boat.vy)) * 0.32 : null,
    speedName: inVehicle ? inVehicle.name.toUpperCase() : '',
    units, location: locationName(actor),
    dialogue: now < dlgUntil ? dlg : null,
    onFoot: !inVehicle,
    t: now,
    player: { x: actor.x, y: actor.y, angle: G.car ? G.car.angle : G.boat ? G.boat.angle : PlayerBody.angle },
    cruisers: Police.state.cruisers, heli: Helicopter.isActive() ? Helicopter.state : null,
    boats: Boats.boats, shops: Robberies.shops.filter((s) => s.cool <= 0),
  };
}

// ---- rendering -----------------------------------------------------------------------------------
function drawObjective(ctx, obj, camView, now) {
  if (obj.x == null) return;
  const onScreen = obj.x > camView.x - camView.hw && obj.x < camView.x + camView.hw &&
    obj.y > camView.y - camView.hh && obj.y < camView.y + camView.hh;
  ctx.save();
  if (onScreen) {
    const bob = Math.sin(now * 3.4) * 5;
    ctx.translate(obj.x, obj.y + bob);
    ctx.strokeStyle = 'rgba(255,197,40,0.85)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(0, 0, 21 + Math.sin(now * 4) * 3, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffc528';
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 0); ctx.lineTo(0, 13); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill();
  } else {
    const ang = Math.atan2(obj.y - camView.y, obj.x - camView.x);
    const ex = camView.x + Math.cos(ang) * (camView.hw - 42);
    const ey = camView.y + Math.sin(ang) * (camView.hh - 42);
    ctx.translate(ex, ey); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,197,40,0.92)';
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-9, -9); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawPopups() {
  for (const p of popups) {
    const a = Math.min(1, p.life / 0.55);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.strokeStyle = 'rgba(20,14,4,0.85)'; ctx.lineWidth = 4;
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.drift ? '#ffd60a' : '#ffcf4d';
    ctx.fillText(p.text, p.x, p.y);
    if (p.sub) {
      ctx.font = '12px system-ui, sans-serif';
      ctx.strokeText(p.sub, p.x, p.y + 16);
      ctx.fillStyle = '#f2ead8';
      ctx.fillText(p.sub, p.x, p.y + 16);
    }
    ctx.restore();
  }
}

function render(now) {
  const c = camCenter();
  const camView = { x: c.x, y: c.y, hw: (VIEW_W / 2) / c.zoom, hh: (VIEW_H / 2) / c.zoom };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#2c4630';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.translate(VIEW_W / 2, VIEW_H / 2);
  ctx.scale(c.zoom, c.zoom);
  ctx.translate(-c.x, -c.y);
  World.draw(ctx, camView, now);
  Vehicles.drawGroundEffects(ctx);
  Boats.drawWake(ctx);
  Robberies.drawMarkers(ctx, now);
  Boats.draw(ctx);
  Police.drawRoadblocks(ctx, now);
  for (const car of Vehicles.cars) Vehicles.drawCar(ctx, car, now);
  People.drawPeds(ctx);
  if (!G.car && !G.boat) PlayerBody.draw(ctx);
  Helicopter.drawShadow(ctx);
  Helicopter.drawSearchlight(ctx);
  Helicopter.draw(ctx, now);
  Vehicles.drawAirEffects(ctx);
  if (!G.car && !G.boat) Weapons.draw(ctx, PlayerBody, now);
  drawObjective(ctx, Missions.objective(), camView, now);
  drawPopups();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---- boot & main loop --------------------------------------------------------------------------------
const storyCar = Vehicles.spawnParked();
Vehicles.spawnTraffic(14);
Boats.spawnBoats();
People.spawnPeds(34);
{
  const saved = loadRaw();
  let savedIdx = 0;
  if (saved) {
    if (typeof saved.cash === 'number') G.cash = saved.cash;
    if (typeof saved.respect === 'number') G.respect = saved.respect;
    if (typeof saved.engineStage === 'number') Garage.state.stage = saved.engineStage;
    if (typeof saved.armorWax === 'boolean') Garage.state.armor = saved.armorWax;
    if (saved.weapons) {
      if (saved.weapons.owned) Object.assign(Weapons.state.owned, saved.weapons.owned);
      if (saved.weapons.ammo) for (const k of Weapons.ORDER) if (saved.weapons.ammo[k]) Object.assign(Weapons.state.ammo[k], saved.weapons.ammo[k]);
      if (saved.weapons.current && Weapons.state.owned[saved.weapons.current]) Weapons.state.current = saved.weapons.current;
    }
    if (typeof saved.storyIdx === 'number') savedIdx = saved.storyIdx;
  }
  Vehicles.setTune(Garage.state.stage);
  Vehicles.setArmor(Garage.state.armor);
  const start = World.doorstep(World.buildingNamed("Marlo's Diner"));
  PlayerBody.x = start.x; PlayerBody.y = start.y - 26;
  Missions.init(storyCar, savedIdx, bus);
  Robberies.init(bus);
}

let lastTs = -1;
function frame(ts) {
  requestAnimationFrame(frame);
  const now = ts / 1000;
  const dt = lastTs < 0 ? 0.016 : Math.min(0.033, now - lastTs);
  lastTs = now;
  if (G.state === 'play' && !Garage.state.open && !Arms.state.open) update(dt, now);
  else if (G.state === 'title') ambient(dt);
  if (Garage.state.open) Garage.refresh(G.cash, G.car, respectLine() + ' · ' + G.respect + ' pts');
  if (Arms.state.open) Arms.refresh(G.cash);
  render(now);
  const snap = buildSnapshot(now);
  Hud.update(snap);
  Hud.minimap(snap);
  syncScreens(now);
  pressed = {};
}
requestAnimationFrame(frame);

// The staging surface: the last script in the page drives the game through this handle.
window.PCH = { G, PlayerBody, Vehicles, Police, Helicopter, Weapons, Missions, Boats, Robberies, World, Hud, setCamera };

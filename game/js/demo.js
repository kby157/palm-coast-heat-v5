// demo.js — screenshot staging, and nothing else. Loaded last; without a
// ?demo= parameter it returns immediately and the game never knows it exists.
// With one, it re-pins a living tableau every frame — positions, heat, smoke,
// dialogue — so a screenshot taken at any moment shows the scene whole.
// It drives the game only through its public surface: module state fields,
// the event bus, and the PCH handle game.js publishes.
(() => {
  const mode = new URLSearchParams(location.search).get('demo');
  if (!mode) return;

  const P = window.PCH;
  const refs = {};
  let booted = false;

  function hideBanner() {
    const b = document.getElementById('banner-screen');
    if (b) b.classList.remove('on');
  }
  function pinCommon() {
    G.state = 'play';
    G.health = 100;
    Police.state.bust = 0;
    hideBanner();
  }
  function pinCruiser(x, y, angle, health) {
    const car = Vehicles.makeCar(1, x, y, angle, 'police');
    Police.state.cruisers.push(car);
    if (health != null) car.health = health;
    return car;
  }
  function holdCruiser(car, x, y, angle) {
    car.x = x; car.y = y; car.angle = angle; car.vx = 0; car.vy = 0;
  }

  function boot() {
    booted = true;
    if (mode === 'chase') {
      Missions.init(storyCar, 2, bus);
      refs.car = Vehicles.makeCar(4, 1180, 907, 0, 'player');   // a Zephyr
      refs.car.color = '#c22f6d';
      refs.car.health = 88;
      refs.c1 = pinCruiser(1062, 907, 0);
      refs.c2 = pinCruiser(1246, 850, 0.15, 30);                // the smoker
      refs.c3 = pinCruiser(972, 962, -0.2);
      Police.buildRoadblockAt(1560, 880, false);
      const parked = [[700, 852, 0], [1506, 852, 0], [1332, 690, Math.PI / 2], [1390, 1160, Math.PI]];
      refs.parked = parked.map(([x, y, a], i) => Vehicles.makeCar([0, 2, 5, 3][i], x, y, a, 'parked'));
    }
    if (mode === 'foot') {
      Missions.init(storyCar, 0, bus);
      const spot = World.doorstep(World.buildingNamed('Harbor Chandlery'));
      refs.spot = spot;
      refs.downed = People.addPed(spot.x + 36, spot.y + 18);
      refs.downed.down = true; refs.downed.hp = 0;
      refs.cast = [[96, -40], [158, 54], [-74, -32], [64, 88], [-128, 44], [208, -74]]
        .map(([dx, dy]) => { const p = People.addPed(spot.x + dx, spot.y + dy); return { p, dx, dy }; });
      refs.c1 = pinCruiser(spot.x - 46, spot.y + 128, -0.4);
      refs.c2 = pinCruiser(spot.x + 216, spot.y + 108, 2.8);
      Weapons.state.owned.smg = true;
      Weapons.state.current = 'smg';
      Weapons.state.ammo.smg.mag = 24; Weapons.state.ammo.smg.res = 96;
      Weapons.state.ammo.pistol.mag = 12; Weapons.state.ammo.pistol.res = 72;
    }
    if (mode === 'drive') {
      Missions.init(storyCar, 5, bus);
      refs.boat = Boats.boats.find((b) => b.name === 'Marlin') || Boats.boats[0];
    }
    if (mode === 'garage') {
      refs.spot = Garage.spot();
    }
    if (mode === 'arms') {
      refs.spot = Arms.spot();
    }
  }

  function stageChase() {
    const car = refs.car;
    G.car = car; G.boat = null;
    Vehicles.setPlayerRef(car);
    car.x = 1180; car.y = 907; car.angle = 0; car.vx = 385; car.vy = 115; car.health = 88;
    PlayerBody.x = car.x; PlayerBody.y = car.y;
    holdCruiser(refs.c1, 1062, 907, 0);
    holdCruiser(refs.c2, 1246, 850, 0.15);
    holdCruiser(refs.c3, 972, 962, -0.2);
    Vehicles.seedSmoke(refs.c2, 0.4);
    Police.setHeat(5);
    Helicopter.state.active = true;
    Helicopter.state.x = car.x - 118; Helicopter.state.y = car.y - 96;
    Helicopter.state.px = car.x; Helicopter.state.py = car.y;
    drift.time = 0.4;
    G.cash = 120; G.respect = 0;
    P.setCamera({ zoom: 1.15 });
    Missions.beginImmediately();
    bus.dialogue('Dee', 'Four corners, one clock. Show Palm Coast what a wheelman is.');
  }

  function stageFoot() {
    const spot = refs.spot;
    G.car = null; G.boat = null;
    PlayerBody.x = spot.x; PlayerBody.y = spot.y;
    PlayerBody.angle = Math.atan2(14, 300);
    Weapons.state.flash = 0.075;
    const gx = spot.x + Math.cos(PlayerBody.angle) * 21, gy = spot.y + Math.sin(PlayerBody.angle) * 21;
    Weapons.state.tracers.length = 0;
    for (const [tx, ty] of [[spot.x + 305, spot.y - 4], [spot.x + 282, spot.y + 30], [spot.x + 336, spot.y + 46]]) {
      Weapons.state.tracers.push({ x1: gx, y1: gy, x2: tx, y2: ty, life: 0.09, max: 0.09 });
    }
    for (const c of refs.cast) {
      c.p.x = spot.x + c.dx; c.p.y = spot.y + c.dy;
      c.p.panic = 1.5; c.p.fleeX = spot.x; c.p.fleeY = spot.y;
      c.p.angle = Math.atan2(c.dy, c.dx);
    }
    holdCruiser(refs.c1, spot.x - 46, spot.y + 128, -0.4);
    holdCruiser(refs.c2, spot.x + 216, spot.y + 108, 2.8);
    Police.setHeat(2.6);
    G.cash = 120; G.respect = 0;
    Missions.beginImmediately();
    bus.dialogue('Marlo', "That's my teal Comet out front, Jax. Bring her to Marina Parking — clean.");
  }

  function stageDrive() {
    const boat = refs.boat;
    G.boat = boat; G.car = null;
    boat.x = World.WATER_X + 120; boat.y = World.PIER_Y - 140;
    boat.angle = -Math.PI / 2; boat.vx = 0; boat.vy = -140;
    PlayerBody.x = boat.x; PlayerBody.y = boat.y;
    Boats.seedWake(boat, 3);
    Police.state.heat = 0;
    G.cash = 120; G.respect = 0;
    Missions.beginImmediately();
    bus.dialogue('Vera', "Pickup at the Salty Anchor, drop at the pier end. Boat or feet — dealer's choice.");
  }

  function stageGarage() {
    Missions.init(storyCar, 0, bus);   // keeps the game between jobs
    G.car = storyCar; G.boat = null;
    storyCar.health = 46;
    storyCar.x = refs.spot.x + 30; storyCar.y = refs.spot.y + 6; storyCar.angle = Math.PI;
    storyCar.vx = 0; storyCar.vy = 0;
    PlayerBody.x = storyCar.x; PlayerBody.y = storyCar.y;
    Garage.state.stage = 1; Garage.state.armor = false;
    Garage.open();
    G.cash = 640; G.respect = 300;
  }

  function stageArms() {
    PlayerBody.x = refs.spot.x; PlayerBody.y = refs.spot.y;
    G.car = null; G.boat = null;
    Arms.open();
    G.cash = 2000;
  }

  function stageTitle() {
    G.state = 'title';
    hideBanner();
  }

  function stage() {
    requestAnimationFrame(stage);
    if (!booted) boot();
    if (mode === 'title') { stageTitle(); return; }
    pinCommon();
    if (mode === 'chase') stageChase();
    else if (mode === 'foot') stageFoot();
    else if (mode === 'drive') stageDrive();
    else if (mode === 'garage') stageGarage();
    else if (mode === 'arms') stageArms();
  }
  requestAnimationFrame(stage);
})();

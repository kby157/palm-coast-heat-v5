// demo.js — screenshot staging ONLY. Loaded last, it reads the ?demo=
// scene from the URL and, for that scene alone, arranges a frozen
// tableau by driving the game through its public handle (window.PCH):
// positions, heat, weapon state and camera are re-pinned every 40ms so
// any shutter moment shows the composed scene. With no ?demo= parameter
// this file does nothing at all, and no other file knows it exists.

(() => {
  const scene = new URLSearchParams(location.search).get('demo');
  if (!scene || scene === 'title') return;
  const { G, PlayerBody, Vehicles, Police, Weapons, Missions, Boats, World, setCamera } = window.PCH;
  // People, Garage and Arms are reached through their own module
  // globals — the handle above carries only what game.js publishes.

  document.getElementById('title-screen').classList.remove('on');
  G.state = 'play';
  G.health = 100;

  const pin = (fn) => { fn(); setInterval(fn, 40); };
  const pinDialogue = (giver, line) => { G.dialogue = { giver, line, until: 1e9 }; };

  if (scene === 'chase') {
    Missions.jumpTo(2);
    Missions.beginImmediately();
    G.cash = 120;
    const car = Vehicles.makeCar(2, 1360, 1560, -Math.PI / 2, 'player');   // a Zephyr, mid-avenue
    G.car = car;
    const block = Police.buildRoadblockAt(1360, 1235, true);
    setCamera({ x: 1360, y: 1505, zoom: 1.15 });
    pin(() => {
      G.health = 100;
      Police.state.heat = 5;
      Police.state.bust = 0;
      car.x = 1360; car.y = 1560; car.angle = -Math.PI / 2;
      car.vx = 150; car.vy = -320;                 // fast, with a real sideways slide
      car.sliding = true; car.health = 88;
      block.cars[0].health = 12;                   // smoking since the first frame
      const hurt = Police.state.cruisers[0];
      if (hurt) { hurt.health = 15; hurt.x = 1298; hurt.y = 1300; hurt.vx = 0; hurt.vy = 0; }
      const heli = window.PCH.Helicopter.state;    // AIR-1 already on station, light on the car
      heli.x = car.x + 105; heli.y = car.y - 95;
      pinDialogue('Dee', 'Four corners, one clock. Show Palm Coast what a wheelman is.');
    });
  } else if (scene === 'foot') {
    Missions.jumpTo(0);
    Missions.beginImmediately();
    G.cash = 120;
    const spot = World.doorstep(World.buildingNamed('Harbor Chandlery'));
    PlayerBody.x = spot.x + 8; PlayerBody.y = spot.y; PlayerBody.angle = 0.12;
    Weapons.state.owned.smg = true;
    Weapons.state.current = 'smg';
    Weapons.state.ammo.smg.mag = 24;
    Weapons.state.ammo.smg.reserve = 96;
    setCamera({ x: spot.x + 70, y: spot.y - 6, zoom: 1 });
    const cast = [[52, 16, true], [86, -52, false], [128, 30, false], [-70, 44, false],
      [-104, -30, false], [168, -8, false], [30, 74, false]];
    pin(() => {
      G.health = 100;
      Police.state.heat = 3;
      Police.state.bust = 0;
      PlayerBody.x = spot.x + 8; PlayerBody.y = spot.y; PlayerBody.angle = 0.12;
      Weapons.state.flashDir = 0.12;
      Weapons.state.flashUntil = G.time + 0.5;   // held open so any shutter moment catches it
      Weapons.state.tracers = [
        { x1: PlayerBody.x + 17, y1: PlayerBody.y - 2, x2: PlayerBody.x + 330, y2: PlayerBody.y + 16, until: G.time + 0.5 },
        { x1: PlayerBody.x + 17, y1: PlayerBody.y + 3, x2: PlayerBody.x + 288, y2: PlayerBody.y - 30, until: G.time + 0.5 },
      ];
      const unitA = Police.state.cruisers[0], unitB = Police.state.cruisers[1];
      if (unitA) { unitA.x = spot.x - 205; unitA.y = spot.y + 128; unitA.vx = 0; unitA.vy = 0; unitA.angle = 0.4; }
      if (unitB) { unitB.x = spot.x + 252; unitB.y = spot.y - 158; unitB.vx = 0; unitB.vy = 0; unitB.angle = Math.PI + 0.4; }
      People.peds.forEach((p, i) => {
        const c = cast[i % cast.length];
        p.x = PlayerBody.x + c[0]; p.y = PlayerBody.y + c[1];
        p.angle = Math.atan2(c[1], c[0]);
        if (c[2]) { p.down = 30; p.hp = 0; } else { p.down = 0; p.hp = 30; p.flee = 2; }
      });
      pinDialogue('Marlo', "That's my teal Comet out front, Jax. Bring her to Marina Parking — clean.");
    });
  } else if (scene === 'drive') {
    Missions.jumpTo(5);
    Missions.beginImmediately();
    G.cash = 120;
    const marlin = Boats.boats.find((b) => b.name === 'Marlin');
    G.boat = marlin;
    setCamera({ x: 2985, y: 1150, zoom: 1 });
    pin(() => {
      marlin.x = 3062; marlin.y = World.PIER_Y - 120; marlin.angle = -Math.PI / 2;
      marlin.vx = 0; marlin.vy = -120; marlin.speed = 120;
      Boats.seedWake(marlin, 6);
      pinDialogue('Vera', "Pickup at the Salty Anchor, drop at the pier end. Boat or feet — dealer's choice.");
    });
  } else if (scene === 'garage') {
    Missions.jumpTo(0);
    G.cash = 640;
    G.engineStage = 1;
    G.respect = 300;
    const spot = World.doorstep(World.buildingNamed('Marina Parking'));
    const car = Vehicles.makeCar(0, spot.x, spot.y, -Math.PI / 2, 'player');
    car.color = '#2fa39a'; car.health = 46;
    G.car = car;
    PlayerBody.x = spot.x; PlayerBody.y = spot.y;
    G.overlay = 'garage';
    Garage.open();
    setCamera({ x: spot.x, y: spot.y - 110, zoom: 1 });
    pin(() => { G.cash = 640; G.engineStage = 1; G.respect = 300; car.health = 46; });
  } else if (scene === 'arms') {
    G.cash = 2000;
    const spot = World.doorstep(World.buildingNamed('Palm Mall'));
    PlayerBody.x = spot.x; PlayerBody.y = spot.y;
    G.overlay = 'arms';
    Arms.open();
    setCamera({ x: spot.x, y: spot.y, zoom: 1 });
    pin(() => { G.cash = 2000; });
  }
})();

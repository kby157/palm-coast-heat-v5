// garage.js — the Marina Garage: repairs, repaints, engine stages and armor
// wax, bought with number keys while the panel is up. Stage and wax live in
// Garage.state so game.js can persist them and feed them to Vehicles.
const Garage = (() => {
  const PRICES = { repair: 150, repaint: 80, engine: 400, armor: 120 };
  const REPAINTS = ['#c22f6d', '#2fa39a', '#e8b13c', '#3f7fbf', '#7a4fa3', '#e8e3d8', '#22242a', '#59b06a'];
  const state = { open: false, stage: 0, armor: false };
  let anchor = null;
  let paintIdx = 0;

  function spot() {
    if (!anchor) {
      const lot = World.buildingNamed('Marina Parking');
      anchor = lot ? World.doorstep(lot) : { x: 0, y: 0 };
    }
    return anchor;
  }
  function playerNear(pos) { const a = spot(); return Math.hypot(pos.x - a.x, pos.y - a.y) < 84; }

  const el = (id) => document.getElementById(id);
  function open() { state.open = true; el('garage-screen').classList.add('on'); }
  function close() { state.open = false; el('garage-screen').classList.remove('on'); }

  function refresh(cash, car, respectLine) {
    el('g-cash').textContent = '$' + cash;
    el('g-car').textContent = car ? car.name : 'On foot';
    el('g-hull').textContent = car ? Math.round(car.health) + '%' : '—';
    el('g-engine').textContent = state.stage >= 3 ? 'STAGE 3/3 — MAX' : `STAGE ${state.stage}/3 — next $${PRICES.engine}`;
    el('g-armor').textContent = state.armor ? 'Fitted' : `Not fitted — $${PRICES.armor}`;
    el('g-respect').textContent = respectLine;
  }

  function buy(kind, bus, car, cash) {
    const done = (msg) => { AudioSys.cashRegister(); bus.save(); return true; };
    if (kind === 'repair') {
      if (!car || car.health >= 100 || cash < PRICES.repair) return false;
      bus.cash(-PRICES.repair); car.health = 100; return done();
    }
    if (kind === 'repaint') {
      if (!car || cash < PRICES.repaint) return false;
      bus.cash(-PRICES.repaint);
      paintIdx = (paintIdx + 1) % REPAINTS.length;
      car.color = REPAINTS[paintIdx];
      return done();
    }
    if (kind === 'engine') {
      if (state.stage >= 3 || cash < PRICES.engine) return false;
      bus.cash(-PRICES.engine); state.stage++;
      Vehicles.setTune(state.stage);
      return done();
    }
    if (kind === 'armor') {
      if (state.armor || cash < PRICES.armor) return false;
      bus.cash(-PRICES.armor); state.armor = true;
      Vehicles.setArmor(true);
      return done();
    }
    return false;
  }

  return { PRICES, REPAINTS, state, spot, playerNear, open, close, refresh, buy };
})();

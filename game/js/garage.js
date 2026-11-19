// garage.js — the Marina Garage counter at Marina Parking: full
// repairs, repaints, three stages of engine work and an armor wax that
// shrugs off a fifth of every dent. G opens it; keys 1-4 buy; the panel
// also carries your respect standing in its footer.

const Garage = (() => {
  const PRICES = { repair: 150, repaint: 80, engine: 400, armor: 120 };
  const REPAINTS = ['#c22f6d', '#2fa39a', '#e8b13c', '#3f7fbf', '#7a4fa3', '#e8e3d8', '#22242a', '#59b06a'];
  const state = { open: false };
  const el = (id) => document.getElementById(id);

  function anchor() { return World.doorstep(World.buildingNamed('Marina Parking')); }
  function playerNear(pos) {
    const a = anchor();
    return Math.hypot(a.x - pos.x, a.y - pos.y) < 64;
  }
  function open() { state.open = true; el('garage-screen').classList.add('on'); AudioSys.door(); }
  function close() { state.open = false; el('garage-screen').classList.remove('on'); }

  // snap = { cash, carName, hullPct|null, engineStage, armorOwned, respectText }
  function refresh(snap) {
    el('g-cash').textContent = '$' + snap.cash;
    el('g-car').textContent = snap.carName || '— (on foot)';
    el('g-hull').textContent = snap.hullPct === null ? '—' : snap.hullPct + '%';
    el('g-engine').textContent = snap.engineStage >= 3 ? 'STAGE 3/3 — MAX' :
      'STAGE ' + snap.engineStage + '/3 — next $' + PRICES.engine;
    el('g-armor').textContent = snap.armorOwned ? 'Fitted' : 'Not fitted — $' + PRICES.armor;
    el('g-respect').textContent = snap.respectText;
  }

  // hooks = { funds(), spend(n), car(), save(), engineStage(), bumpEngine(), armorOwned(), fitArmor() }
  function buy(kind, hooks) {
    const car = hooks.car();
    if (kind === 'repair') {
      if (!car || car.health >= 100 || hooks.funds() < PRICES.repair) return;
      car.health = 100;
      hooks.spend(PRICES.repair);
    } else if (kind === 'repaint') {
      if (!car || hooks.funds() < PRICES.repaint) return;
      const next = REPAINTS[(REPAINTS.indexOf(car.color) + 1 + REPAINTS.length) % REPAINTS.length];
      car.color = next === car.color ? REPAINTS[0] : next;
      hooks.spend(PRICES.repaint);
    } else if (kind === 'engine') {
      if (hooks.engineStage() >= 3 || hooks.funds() < PRICES.engine) return;
      hooks.bumpEngine();
      hooks.spend(PRICES.engine);
    } else if (kind === 'armor') {
      if (hooks.armorOwned() || hooks.funds() < PRICES.armor) return;
      hooks.fitArmor();
      hooks.spend(PRICES.armor);
    } else return;
    AudioSys.cashRegister();
    hooks.save();
  }

  return { PRICES, REPAINTS, state, playerNear, open, close, refresh, buy };
})();

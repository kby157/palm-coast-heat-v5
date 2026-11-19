// arms.js — the Palm Mall arms dealer: a quiet counter at the mall doorstep
// where cash turns into firepower. SMG, shotgun, and bottomless-ish ammo.
// Purchases land in Weapons.state, so they persist through the save file.
const Arms = (() => {
  const PRICES = { smg: 900, shotgun: 1400, ammo: 120 };
  const state = { open: false };
  let anchor = null;

  function spot() {
    if (!anchor) {
      const mall = World.buildingNamed('Palm Mall');
      anchor = mall ? World.doorstep(mall) : { x: 0, y: 0 };
    }
    return anchor;
  }
  function near(pos) { const a = spot(); return Math.hypot(pos.x - a.x, pos.y - a.y) < 76; }

  const el = (id) => document.getElementById(id);
  function open() { state.open = true; el('arms-screen').classList.add('on'); }
  function close() { state.open = false; el('arms-screen').classList.remove('on'); }

  function refresh(cash) {
    el('a-cash').textContent = '$' + cash;
    el('a-smg').textContent = Weapons.state.owned.smg ? 'OWNED' : '$' + PRICES.smg;
    el('a-shotgun').textContent = Weapons.state.owned.shotgun ? 'OWNED' : '$' + PRICES.shotgun;
    el('a-ammo').textContent = '$' + PRICES.ammo;
  }

  function buy(kind, bus, cash) {
    if (kind === 'smg' || kind === 'shotgun') {
      if (Weapons.state.owned[kind] || cash < PRICES[kind]) { AudioSys.busted(); return false; }
      bus.cash(-PRICES[kind]);
      Weapons.state.owned[kind] = true;
      const a = Weapons.state.ammo[kind], d = Weapons.DEFS[kind];
      a.mag = d.mag; a.res = d.reserve;
      AudioSys.cashRegister();
      bus.popup(anchor.x, anchor.y - 30, d.name + ' ACQUIRED', 'Palm Mall Arms');
    } else if (kind === 'ammo') {
      if (cash < PRICES.ammo) { AudioSys.busted(); return false; }
      bus.cash(-PRICES.ammo);
      for (const key of Weapons.ORDER) {
        if (!Weapons.state.owned[key]) continue;
        Weapons.state.ammo[key].res += Weapons.DEFS[key].reserve;
      }
      AudioSys.cashRegister();
      bus.popup(anchor.x, anchor.y - 30, 'AMMO RESTOCKED', 'Palm Mall Arms');
    } else return false;
    bus.save();
    return true;
  }

  return { PRICES, state, spot, near, open, close, refresh, buy };
})();

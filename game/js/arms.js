// arms.js — the Palm Mall arms dealer: a quiet counter at the mall's
// door where the SMG, the shotgun and fresh ammunition change hands.
// G opens it at the Palm Mall doorstep; keys 1-3 buy; purchases land in
// Weapons.state and persist through the save.

const Arms = (() => {
  const state = { open: false };
  const el = (id) => document.getElementById(id);

  function anchor() { return World.doorstep(World.buildingNamed('Palm Mall')); }
  function playerNear(pos) {
    const a = anchor();
    return Math.hypot(a.x - pos.x, a.y - pos.y) < 64;
  }
  function open() { state.open = true; el('arms-screen').classList.add('on'); AudioSys.door(); }
  function close() { state.open = false; el('arms-screen').classList.remove('on'); }

  function refresh(snap) {
    el('a-cash').textContent = '$' + snap.cash;
    el('a-smg').textContent = Weapons.state.owned.smg ? 'OWNED' : '$900';
    el('a-shotgun').textContent = Weapons.state.owned.shotgun ? 'OWNED' : '$1400';
    el('a-ammo').textContent = '$120';
  }

  // shop = { funds(), spend(n), save() } from game.js
  function buy(kind, shop) {
    if (kind === 'smg' || kind === 'shotgun') {
      const price = Weapons.byId[kind].price;
      if (Weapons.state.owned[kind] || shop.funds() < price) return;
      shop.spend(price);
      Weapons.grant(kind);
    } else if (kind === 'ammo') {
      if (shop.funds() < 120) return;
      shop.spend(120);
      Weapons.refillAmmo();
    } else return;
    AudioSys.cashRegister();
    shop.save();
  }

  return { state, playerNear, open, close, refresh, buy };
})();

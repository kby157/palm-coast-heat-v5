// robberies.js — free-roam money: five shop tills around Palm Coast, each
// marked with a gold ring at the door. Stand in the ring on foot, hold H for
// two seconds, take the cash, wear the stars. Ninety seconds before a till
// is worth hitting again.
const Robberies = (() => {
  const rand = mulberry32(777001);
  const TILLS = {
    'Sunset Bakery': 180, "Marlo's Diner": 150, 'Tidal Records': 210,
    'Harbor Chandlery': 260, 'Gilded Flamingo': 320,
  };
  let bus = null;
  const shops = [];   // {name, x, y, till, cool}
  const state = { prog: 0, near: null };

  function init(busRef) {
    bus = busRef;
    shops.length = 0;
    for (const name of Object.keys(TILLS)) {
      const b = World.buildingNamed(name);
      if (!b) continue;
      const spot = World.doorstep(b);
      shops.push({ name, x: spot.x, y: spot.y, till: TILLS[name], cool: 0 });
    }
  }

  function shopNear(pos) {
    let best = null, bd = 48;
    for (const s of shops) {
      const d = Math.hypot(s.x - pos.x, s.y - pos.y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  function update(dt, pos, onFoot, holding) {
    for (const s of shops) if (s.cool > 0) s.cool -= dt;
    state.near = onFoot ? shopNear(pos) : null;
    const s = state.near;
    if (s && s.cool <= 0 && holding) {
      state.prog += dt;
      if (state.prog >= 2) {
        state.prog = 0;
        s.cool = 90;
        bus.cash(s.till);
        bus.setHeat(2);
        bus.respect(25);
        bus.popup(pos.x, pos.y - 26, 'ROBBED +$' + s.till, s.name);
        AudioSys.alarm();
        AudioSys.cashRegister();
        bus.save();
      }
    } else {
      state.prog = Math.max(0, state.prog - dt * 2.2);
    }
  }

  function promptText() {
    const s = state.near;
    if (!s) return '';
    if (s.cool > 0) return s.name + ' — the till is empty';
    return 'Hold H — rob ' + s.name;
  }

  function drawMarkers(ctx, t) {
    for (const s of shops) {
      if (s.cool > 0) continue;
      const pulse = 15 + Math.sin(t * 3.2) * 2.4;
      ctx.strokeStyle = 'rgba(255,197,40,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, pulse, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ffc528';
      ctx.font = 'bold 17px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', s.x, s.y + 1);
      // progress arc while the hold is on
      if (state.near === s && state.prog > 0) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.arc(s.x, s.y, pulse + 5, -Math.PI / 2, -Math.PI / 2 + (state.prog / 2) * Math.PI * 2); ctx.stroke();
      }
    }
  }

  return { shops, state, init, shopNear, update, promptText, drawMarkers };
})();

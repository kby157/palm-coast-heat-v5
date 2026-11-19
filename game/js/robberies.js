// robberies.js — free-roam stick-ups. Five shops keep a till by the
// door: stand in the gold ring on foot, hold H for two seconds, and the
// cash is yours — along with at least two stars and a shrieking alarm.
// Each shop then needs ninety seconds to feel safe again.

const Robberies = (() => {
  const DEFS = [
    { building: 'Sunset Bakery', till: 210 },
    { building: "Marlo's Diner", till: 150 },
    { building: 'Tidal Records', till: 180 },
    { building: 'Harbor Chandlery', till: 260 },
    { building: 'Gilded Flamingo', till: 320 },
  ];
  const state = { time: 0, progress: 0, near: null, robbedFlag: null, bus: null };
  const shops = [];

  function init(bus) {
    state.bus = bus;
    shops.length = 0;
    for (const def of DEFS) {
      const spot = World.doorstep(World.buildingNamed(def.building));
      shops.push({ name: def.building, till: def.till, x: spot.x, y: spot.y, coolUntil: 0 });
    }
  }

  function shopNear(pos) {
    for (const s of shops) if (Math.hypot(s.x - pos.x, s.y - pos.y) < 38) return s;
    return null;
  }
  const available = (s) => state.time >= s.coolUntil;

  function update(dt, pos, onFoot, holding) {
    state.time += dt;
    state.near = onFoot ? shopNear(pos) : null;
    const s = state.near;
    if (s && available(s) && holding) {
      state.progress += dt;
      if (state.progress >= 2) {
        state.progress = 0;
        s.coolUntil = state.time + 90;
        state.bus.cash(s.till);
        state.bus.setHeat(2);
        state.bus.crime(0.3);
        AudioSys.alarm();
        AudioSys.cashRegister();
        state.robbedFlag = s;
      }
    } else {
      state.progress = Math.max(0, state.progress - dt * 2.5);
    }
  }

  function promptText() {
    const s = state.near;
    if (!s) return '';
    if (!available(s)) return s.name + ' is still counting the insurance';
    if (state.progress > 0.05) return 'ROBBING ' + s.name.toUpperCase() + '… keep holding H';
    return 'Hold H — rob ' + s.name;
  }

  function availableShops() {
    return shops.filter(available).map((s) => ({ x: s.x, y: s.y }));
  }
  function takeRobbed() {
    const s = state.robbedFlag;
    state.robbedFlag = null;
    return s;
  }

  function drawMarkers(ctx, t) {
    for (const s of shops) {
      if (!available(s)) continue;
      const pulse = 1 + Math.sin(t * 3.2) * 0.09;
      ctx.strokeStyle = 'rgba(255,196,64,0.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, 16 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffc840';
      ctx.font = '700 17px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', s.x, s.y + 1);
      if (state.near === s && state.progress > 0) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(s.x, s.y, 23, -Math.PI / 2, -Math.PI / 2 + (state.progress / 2) * Math.PI * 2); ctx.stroke();
      }
    }
  }

  return { shops, init, shopNear, update, promptText, availableShops, takeRobbed, drawMarkers,
    get time() { return state.time; }, get progress() { return state.progress; } };
})();

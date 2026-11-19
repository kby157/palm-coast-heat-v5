// weapons.js — Jax's arsenal: a pistol he starts with, an SMG and a
// shotgun bought from the Palm Mall arms dealer. Hitscan fire with
// tracers and muzzle flash, per-weapon magazines and reserves, reloads,
// and a state object the HUD strip (and anything staging a scene) can
// read and set directly.

const Weapons = (() => {
  const defs = [
    { id: 'pistol',  name: 'PISTOL',  key: '1', price: 0,    magSize: 12, reserveCap: 120,
      rate: 0.27, auto: false, range: 340, pellets: 1, spread: 0.018, damage: 34, reloadTime: 0.9, flash: 23 },
    { id: 'smg',     name: 'SMG',     key: '2', price: 900,  magSize: 30, reserveCap: 180,
      rate: 0.092, auto: true, range: 320, pellets: 1, spread: 0.06, damage: 20, reloadTime: 1.1, flash: 18 },
    { id: 'shotgun', name: 'SHOTGUN', key: '3', price: 1400, magSize: 6, reserveCap: 36,
      rate: 0.85, auto: false, range: 190, pellets: 5, spread: 0.17, damage: 16, reloadTime: 1.4, flash: 32 },
  ];
  const byId = {};
  for (const d of defs) byId[d.id] = d;

  const state = {
    owned: { pistol: true, smg: false, shotgun: false },
    current: 'pistol',
    ammo: { pistol: { mag: 12, reserve: 72 }, smg: { mag: 0, reserve: 0 }, shotgun: { mag: 0, reserve: 0 } },
    reloadLeft: 0, cool: 0, wasFiring: false,
    flashUntil: -1, flashDir: 0, tracers: [],   // {x1,y1,x2,y2,until}
  };
  const current = () => byId[state.current];
  const reloading = () => state.reloadLeft > 0;

  function switchTo(id) {
    if (!state.owned[id] || id === state.current || reloading()) return;
    state.current = id; state.cool = Math.max(state.cool, 0.16);
  }
  function grant(id) {
    state.owned[id] = true;
    const a = state.ammo[id];
    a.mag = byId[id].magSize;
    a.reserve = Math.min(byId[id].reserveCap, a.reserve + (id === 'smg' ? 90 : 18));
  }
  function refillAmmo() {
    for (const d of defs) if (state.owned[d.id]) state.ammo[d.id].reserve = d.reserveCap;
  }
  function startReload() {
    const d = current(), a = state.ammo[d.id];
    if (reloading() || a.mag >= d.magSize || a.reserve <= 0) return;
    state.reloadLeft = d.reloadTime;
    AudioSys.reload();
  }

  // One trigger pull: pellets fan out from the muzzle, each stepping
  // along its ray until it meets a building, a car, a pedestrian or air.
  function fire(shooter, aimX, aimY, now, bus) {
    const d = current(), a = state.ammo[d.id];
    if (reloading() || state.cool > 0) return;
    if (a.mag <= 0) { startReload(); state.cool = 0.3; return; }
    a.mag -= 1; state.cool = d.rate;
    const base = Math.atan2(aimY - shooter.y, aimX - shooter.x);
    state.flashDir = base; state.flashUntil = now + 0.055;
    AudioSys.shot(d.id);
    bus.crime(0.85);
    People.scatterFrom(shooter.x, shooter.y, 175);
    const mx = shooter.x + Math.cos(base) * 17, my = shooter.y + Math.sin(base) * 17;
    for (let p = 0; p < d.pellets; p++) {
      const ang = base + (Math.random() - 0.5) * 2 * d.spread;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      let hx = shooter.x + ca * d.range, hy = shooter.y + sa * d.range;
      for (let step = 10; step <= d.range; step += 6) {
        const px = shooter.x + ca * step, py = shooter.y + sa * step;
        if (World.buildingAt(px, py)) { hx = px; hy = py; break; }
        let hit = false;
        for (const ped of People.peds) {
          if (ped.down <= 0 && Math.hypot(ped.x - px, ped.y - py) < 12) {
            People.hitPed(ped, d.damage); hx = px; hy = py; hit = true; break;
          }
        }
        if (hit) break;
        for (const car of Vehicles.cars) {
          if (Math.hypot(car.x - px, car.y - py) < 25) {
            Vehicles.damage(car, d.damage * 0.7);
            Vehicles.sparkBurst(px, py, 3);
            hx = px; hy = py; hit = true; break;
          }
        }
        if (hit) break;
      }
      state.tracers.push({ x1: mx, y1: my, x2: hx, y2: hy, until: now + 0.09 });
    }
    if (state.tracers.length > 24) state.tracers.splice(0, state.tracers.length - 24);
    if (a.mag === 0) startReload();
  }

  function update(dt, shooter, aimX, aimY, firing, now, bus) {
    if (state.cool > 0) state.cool -= dt;
    if (reloading()) {
      state.reloadLeft -= dt;
      if (state.reloadLeft <= 0) {
        const d = current(), a = state.ammo[d.id];
        const take = Math.min(d.magSize - a.mag, a.reserve);
        a.mag += take; a.reserve -= take;
      }
    }
    if (firing) {
      if (current().auto || !state.wasFiring) fire(shooter, aimX, aimY, now, bus);
    }
    state.wasFiring = !!firing;
  }

  function draw(ctx, shooter, now) {
    for (let i = state.tracers.length - 1; i >= 0; i--) {
      const tr = state.tracers[i];
      if (now > tr.until) { state.tracers.splice(i, 1); continue; }
      const fade = (tr.until - now) / 0.09;
      ctx.strokeStyle = `rgba(255,190,80,${0.35 * fade})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,246,200,${0.95 * fade})`; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
      ctx.fillStyle = `rgba(255,220,130,${fade})`;
      ctx.beginPath(); ctx.arc(tr.x2, tr.y2, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    if (now < state.flashUntil && shooter) {
      const d = current();
      const mx = shooter.x + Math.cos(state.flashDir) * 19, my = shooter.y + Math.sin(state.flashDir) * 19;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(state.flashDir);
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, d.flash * 1.5);
      g.addColorStop(0, 'rgba(255,250,215,0.95)'); g.addColorStop(0.4, 'rgba(255,196,64,0.75)'); g.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, d.flash * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, r = i % 2 ? d.flash * 0.45 : d.flash;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function hudText() {
    const d = current(), a = state.ammo[d.id];
    return d.name + ' ' + a.mag + ' / ' + a.reserve + (reloading() ? ' — RELOADING' : '');
  }

  return { defs, byId, state, current, reloading, switchTo, grant, refillAmmo, startReload, fire, update, draw, hudText };
})();

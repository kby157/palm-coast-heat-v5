// weapons.js — Jax's three-gun wardrobe. Pistol from the start, SMG and
// shotgun bought at the Palm Mall arms dealer. Hitscan fire with fat muzzle
// flashes and glowing tracers; per-weapon magazines and reserves live in the
// exposed state so the HUD (and the save file) can read them directly.
const Weapons = (() => {
  const DEFS = {
    pistol: { key: 'pistol', name: 'PISTOL', price: 0, mag: 12, reserve: 72, reload: 0.9, range: 340, dmg: 34, auto: false, rate: 0.21, pellets: 1, spread: 0.012 },
    smg: { key: 'smg', name: 'SMG', price: 900, mag: 30, reserve: 96, reload: 1.2, range: 320, dmg: 16, auto: true, rate: 0.075, pellets: 1, spread: 0.05 },
    shotgun: { key: 'shotgun', name: 'SHOTGUN', price: 1400, mag: 6, reserve: 24, reload: 1.6, range: 190, dmg: 13, auto: false, rate: 0.85, pellets: 5, spread: 0.17 },
  };
  const ORDER = ['pistol', 'smg', 'shotgun'];
  const rand = mulberry32(60606);

  const state = {
    current: 'pistol',
    owned: { pistol: true, smg: false, shotgun: false },
    ammo: {
      pistol: { mag: 12, res: 72 },
      smg: { mag: 30, res: 96 },
      shotgun: { mag: 6, res: 24 },
    },
    reloadLeft: 0, cooldown: 0, flash: 0, lastCrimeAt: -9,
    tracers: [],   // {x1, y1, x2, y2, life, max}
    impacts: [],   // {x, y, life}
  };

  const def = () => DEFS[state.current];
  const reloading = () => state.reloadLeft > 0;

  function select(key) {
    if (!state.owned[key] || state.current === key) return;
    state.current = key;
    state.reloadLeft = 0;
  }

  function startReload() {
    const a = state.ammo[state.current], d = def();
    if (state.reloadLeft > 0 || a.mag >= d.mag || a.res <= 0) return;
    state.reloadLeft = d.reload;
    AudioSys.reload();
  }

  function finishReload() {
    const a = state.ammo[state.current], d = def();
    const take = Math.min(d.mag - a.mag, a.res);
    a.mag += take; a.res -= take;
  }

  // Distance from point P to segment AB — the hitscan's near-miss test.
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function fire(shooter, aimX, aimY, now, bus) {
    const d = def(), a = state.ammo[state.current];
    if (state.reloadLeft > 0 || state.cooldown > 0) return;
    if (a.mag <= 0) { startReload(); return; }
    a.mag -= 1;
    state.cooldown = d.rate;
    state.flash = 0.075;
    AudioSys.shot(state.current);
    if (now - state.lastCrimeAt > 0.5) { state.lastCrimeAt = now; bus.crime(0.85); }
    People.scatterFrom(shooter.x, shooter.y, 240);
    const base = Math.atan2(aimY - shooter.y, aimX - shooter.x);
    const gx = shooter.x + Math.cos(shooter.angle) * 20, gy = shooter.y + Math.sin(shooter.angle) * 20;
    for (let p = 0; p < d.pellets; p++) {
      const ang = base + (rand() * 2 - 1) * d.spread;
      const ex = shooter.x + Math.cos(ang) * d.range, ey = shooter.y + Math.sin(ang) * d.range;
      let hx = ex, hy = ey, bestT = 1;
      const b = World.buildingAt(ex, ey); // crude long-stop: shorten ray at building face
      if (b && !b.lot) { hx = shooter.x + Math.cos(ang) * d.range * 0.82; hy = shooter.y + Math.sin(ang) * d.range * 0.82; bestT = 0.82; }
      // pedestrians along the ray
      for (const ped of People.peds) {
        if (ped.down) continue;
        if (segDist(ped.x, ped.y, shooter.x, shooter.y, ex, ey) < 11) {
          const t = Math.hypot(ped.x - shooter.x, ped.y - shooter.y) / d.range;
          if (t < bestT) { bestT = t; hx = ped.x; hy = ped.y; People.hurt(ped, d.dmg); }
        }
      }
      // cars along the ray
      for (const car of Vehicles.cars) {
        if (car.dead) continue;
        if (segDist(car.x, car.y, shooter.x, shooter.y, ex, ey) < 26) {
          const t = Math.hypot(car.x - shooter.x, car.y - shooter.y) / d.range;
          if (t < bestT) { bestT = t; hx = car.x; hy = car.y; Vehicles.damage(car, d.dmg); Vehicles.sparkBurst(car.x, car.y, 3); }
        }
      }
      state.tracers.push({ x1: gx, y1: gy, x2: hx, y2: hy, life: 0.09, max: 0.09 });
      state.impacts.push({ x: hx, y: hy, life: 0.16 });
    }
    if (state.tracers.length > 40) state.tracers.splice(0, state.tracers.length - 40);
  }

  let wasFiring = false;
  function update(dt, shooter, aimX, aimY, firing, now, bus) {
    if (state.cooldown > 0) state.cooldown -= dt;
    if (state.flash > 0) state.flash -= dt;
    if (state.reloadLeft > 0) {
      state.reloadLeft -= dt;
      if (state.reloadLeft <= 0) finishReload();
    }
    const wantFire = def().auto ? firing : (firing && !wasFiring);
    wasFiring = firing;
    if (wantFire) fire(shooter, aimX, aimY, now, bus);
    for (let i = state.tracers.length - 1; i >= 0; i--) {
      state.tracers[i].life -= dt;
      if (state.tracers[i].life <= 0) state.tracers.splice(i, 1);
    }
    for (let i = state.impacts.length - 1; i >= 0; i--) {
      state.impacts[i].life -= dt;
      if (state.impacts[i].life <= 0) state.impacts.splice(i, 1);
    }
  }

  function draw(ctx, shooter, now) {
    for (const tr of state.tracers) {
      const f = tr.life / tr.max;
      ctx.strokeStyle = `rgba(255,196,80,${0.38 * f})`; ctx.lineWidth = 5.4;
      ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,246,205,${0.95 * f})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
    }
    for (const im of state.impacts) {
      ctx.fillStyle = `rgba(255,210,110,${Math.min(1, im.life * 6)})`;
      ctx.beginPath(); ctx.arc(im.x, im.y, 5.5, 0, 7); ctx.fill();
    }
    if (state.flash > 0 && shooter) {
      const gx = shooter.x + Math.cos(shooter.angle) * 21, gy = shooter.y + Math.sin(shooter.angle) * 21;
      const f = state.flash / 0.075, R = (def().key === 'shotgun' ? 58 : 46) * (0.55 + 0.45 * f);
      const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, R * 0.8);
      g.addColorStop(0, `rgba(255,240,190,${0.55 * f})`); g.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, R * 0.8, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(shooter.angle);
      ctx.fillStyle = `rgba(255,214,110,${0.95 * f})`;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, r = k % 2 ? R * 0.42 : R;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,252,235,${f})`;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  function hudText() {
    const a = state.ammo[state.current];
    return state.reloadLeft > 0 ? `${def().name} — RELOADING` : `${def().name} ${a.mag} / ${a.res}`;
  }

  return { DEFS, ORDER, state, def, select, startReload, reloading, fire, update, draw, hudText };
})();

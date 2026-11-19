// police.js — the Palm Coast PD: the heat meter behind the stars, pursuit
// cruisers that ram, roadblocks at three stars and up, and the units() feed
// the HUD's response panel is built from.
const Police = (() => {
  const rand = mulberry32(90210);
  const state = {
    heat: 0, bust: 0, unseenFor: 0,
    cruisers: [], roadblocks: [], lastSeen: null, blockCool: 0,
  };

  const stars = () => (state.heat <= 0 ? 0 : Math.min(5, Math.ceil(state.heat)));
  function reportCrime(amount) { state.heat = Math.min(5.9, state.heat + amount); }
  function setHeat(n) { state.heat = Math.max(state.heat, Math.min(5.9, n)); }
  const cruiserCount = () => state.cruisers.length;

  function roadPointNear(x, y, dist) {
    // a spot on the road grid roughly `dist` away from (x, y)
    const a = World.AVENUES[Math.floor(rand() * World.AVENUES.length)];
    const s = World.STREETS[Math.floor(rand() * World.STREETS.length)];
    if (rand() < 0.5) return { x: a, y: World.clamp(y + (rand() < 0.5 ? -dist : dist), 80, World.H - 80) };
    return { x: World.clamp(x + (rand() < 0.5 ? -dist : dist), 80, World.BEACH_X - 90), y: s };
  }

  function spawnCruiser(player) {
    const p = roadPointNear(player.x, player.y, 760 + rand() * 220);
    const car = Vehicles.makeCar(1, p.x, p.y, rand() * Math.PI * 2, 'police');
    state.cruisers.push(car);
    return car;
  }

  function buildRoadblockAt(x, y, vertical) {
    const block = { x, y, vertical, cars: [] };
    const offs = vertical ? [[0, -34], [0, 34]] : [[-34, 0], [34, 0]];
    for (const [ox, oy] of offs) {
      const car = Vehicles.makeCar(1, x + ox, y + oy, vertical ? 0.3 : Math.PI / 2 + 0.3, 'roadblock');
      block.cars.push(car);
      state.cruisers.push(car);
    }
    state.roadblocks.push(block);
    return block;
  }

  function removeRoadblock(block) {
    for (const c of block.cars) {
      c.dead = true;
      const i = state.cruisers.indexOf(c); if (i >= 0) state.cruisers.splice(i, 1);
      const j = Vehicles.cars.indexOf(c); if (j >= 0) Vehicles.cars.splice(j, 1);
    }
    const i = state.roadblocks.indexOf(block); if (i >= 0) state.roadblocks.splice(i, 1);
  }

  function clearRoadblocks() { while (state.roadblocks.length) removeRoadblock(state.roadblocks[0]); }

  function placeRoadblockAhead(player, playerCar) {
    // on the road the player is driving, a few hundred metres in front
    let bx, by, vertical;
    const nearA = World.AVENUES.reduce((p, a) => (Math.abs(a - player.x) < Math.abs(p - player.x) ? a : p), World.AVENUES[0]);
    const nearS = World.STREETS.reduce((p, s) => (Math.abs(s - player.y) < Math.abs(p - player.y) ? s : p), World.STREETS[0]);
    const heading = playerCar ? playerCar.angle : 0;
    if (Math.abs(player.x - nearA) < Math.abs(player.y - nearS)) {
      vertical = true; bx = nearA;
      by = World.clamp(player.y + Math.sign(Math.sin(heading) || 1) * 500, 110, World.H - 110);
    } else {
      vertical = false; by = nearS;
      bx = World.clamp(player.x + Math.sign(Math.cos(heading) || 1) * 500, 110, World.BEACH_X - 120);
    }
    buildRoadblockAt(bx, by, vertical);
  }

  function update(dt, player, playerCar) {
    const st = stars();
    state.lastSeen = state.lastSeen || { x: player.x, y: player.y };
    // line of sight: the closest cruiser that can see the player
    let nearest = null, nd = 1e9;
    for (const c of state.cruisers) {
      if (c.kind === 'roadblock') continue;
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d < nd) { nd = d; nearest = c; }
    }
    const los = nearest && nd < 560 && !player.inBoat;
    const heliLit = typeof Helicopter !== 'undefined' && Helicopter.isActive();
    if (los || heliLit) { state.unseenFor = 0; state.lastSeen = { x: player.x, y: player.y }; }
    else state.unseenFor += dt;
    // heat bleeds away while unseen — slower under the spotlight
    if (state.unseenFor > 2.2 && state.heat > 0) {
      const rate = (0.028 + state.unseenFor * 0.004) * (heliLit ? 0.3 : 1);
      state.heat = Math.max(0, state.heat - rate * dt);
    }
    // fleet size follows the stars
    const want = st === 0 ? 0 : Math.min(2 + st, 6);
    const active = state.cruisers.filter((c) => c.kind === 'police').length;
    if (active < want) spawnCruiser(player);
    for (let i = state.cruisers.length - 1; i >= 0; i--) {
      const c = state.cruisers[i];
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if ((st === 0 && d > 500) || d > 1900) {
        c.dead = true;
        state.cruisers.splice(i, 1);
        const j = Vehicles.cars.indexOf(c); if (j >= 0) Vehicles.cars.splice(j, 1);
      }
    }
    // pursuit steering: aim at the player, or at the shoreline if he is afloat
    for (const c of state.cruisers) {
      if (c.kind === 'roadblock' || c.dead) continue;
      let tx = state.lastSeen.x, ty = state.lastSeen.y;
      if (player.inBoat) { tx = World.WATER_X - 130; ty = World.clamp(player.y, 90, World.H - 90); }
      const d = Math.hypot(c.x - tx, c.y - ty);
      Vehicles.steerToward(c, tx, ty, dt, d < 130 ? 0.55 : 1.06);
    }
    // roadblocks
    state.blockCool -= dt;
    if (st >= 3 && playerCar && state.roadblocks.length === 0 && state.blockCool <= 0) {
      placeRoadblockAhead(player, playerCar);
      state.blockCool = 26;
    }
    for (let i = state.roadblocks.length - 1; i >= 0; i--) {
      const b = state.roadblocks[i];
      const d = Math.hypot(b.x - player.x, b.y - player.y);
      if (d > 760) removeRoadblock(b);
    }
    // the bust meter: close, slow, and seen — but never on the water
    if (!player.inBoat && nearest && nd < 120 && player.speed < 42 && st > 0) {
      state.bust = Math.min(1, state.bust + dt / 2.3);
    } else {
      state.bust = Math.max(0, state.bust - dt / 1.4);
    }
  }

  function drawRoadblocks(ctx, t) {
    for (const b of state.roadblocks) {
      ctx.save(); ctx.translate(b.x, b.y); if (!b.vertical) ctx.rotate(Math.PI / 2);
      // striped barrier between the two cruisers
      for (let k = -2; k <= 2; k++) {
        ctx.fillStyle = k % 2 ? '#f2f2ee' : '#e06428';
        ctx.fillRect(-4, k * 13 - 6, 8, 12);
      }
      ctx.fillStyle = '#3a3d42'; ctx.fillRect(-6, -72, 12, 7); ctx.fillRect(-6, 65, 12, 7);
      // spike strip teeth
      ctx.fillStyle = '#c8ccd0';
      for (let k = -5; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(-7, k * 12); ctx.lineTo(0, k * 12 - 4); ctx.lineTo(7, k * 12); ctx.fill(); }
      ctx.restore();
    }
  }

  // The response-panel feed: nearest units first, roles the panel prints.
  function units(player) {
    const out = [];
    let n = 0;
    for (const c of state.cruisers) {
      n++;
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      let role = 'PURSUING';
      if (c.kind === 'roadblock') role = 'ROADBLOCK';
      else if (d >= 560) role = 'SEARCHING';
      else if (d < 135 && Vehicles.speedOf(c) > 140) role = 'RAMMING';
      out.push({ label: c.kind === 'roadblock' ? `PCPD-B${n}` : `PCPD-${n}`, dist: Math.round(d), role });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out.filter((u) => u.dist <= 1000).slice(0, 4);
  }

  function clear() {
    state.heat = 0; state.bust = 0; state.unseenFor = 0;
    for (const c of state.cruisers) {
      c.dead = true;
      const j = Vehicles.cars.indexOf(c); if (j >= 0) Vehicles.cars.splice(j, 1);
    }
    state.cruisers = []; state.roadblocks = [];
  }

  return { state, stars, reportCrime, setHeat, cruiserCount, spawnCruiser, buildRoadblockAt, clearRoadblocks, update, drawRoadblocks, units, clear };
})();

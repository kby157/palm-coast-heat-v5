// police.js — the Palm Coast PD: the wanted heat behind the stars, the
// cruisers that hunt you (and ram you when they arrive), the roadblocks
// thrown across your road at three stars, the bust meter when they pin
// you slow, and units() — the response list the HUD panel reads.

const Police = (() => {
  const rand = mulberry32(90210);
  const state = { heat: 0, bust: 0, unseenFor: 0, seen: false,
    cruisers: [], roadblocks: [], lastPlayer: { x: 0, y: 0 }, spawnTimer: 0, blockTimer: 9 };

  const stars = () => (state.heat <= 0 ? 0 : Math.min(5, Math.ceil(state.heat)));

  function reportCrime(amount) {
    if (amount <= 0) return;
    state.heat = Math.min(5, state.heat + amount);
    state.unseenFor = 0;
  }

  function snapToRoad(x, y) {
    let best = { x, y }, bd = Infinity;
    for (const a of World.AVENUES) { const d = Math.abs(x - a); if (d < bd) { bd = d; best = { x: a, y }; } }
    for (const s of World.STREETS) { const d = Math.abs(y - s); if (d < bd) { bd = d; best = { x, y: s }; } }
    return best;
  }

  function spawnCruiser(player) {
    const ang = rand() * Math.PI * 2, dist = 660 + rand() * 160;
    const spot = snapToRoad(World.clamp(player.x + Math.cos(ang) * dist, 70, 2400),
                            World.clamp(player.y + Math.sin(ang) * dist, 70, 2300));
    const car = Vehicles.makeCar(1, spot.x, spot.y, 0, 'police');
    state.cruisers.push(car);
    return car;
  }

  function buildRoadblockAt(x, y, vertical) {
    const cars = [];
    if (vertical) {
      cars.push(Vehicles.makeCar(1, x - 29, y, Math.PI / 2, 'police'));
      cars.push(Vehicles.makeCar(1, x + 29, y, Math.PI / 2, 'police'));
    } else {
      cars.push(Vehicles.makeCar(1, x, y - 29, 0, 'police'));
      cars.push(Vehicles.makeCar(1, x, y + 29, 0, 'police'));
    }
    const block = { x, y, vertical, cars };
    state.roadblocks.push(block);
    return block;
  }

  function placeRoadblockAhead(player, playerCar) {
    const fx = Math.cos(playerCar.angle), fy = Math.sin(playerCar.angle);
    const ax = player.x + fx * 400, ay = player.y + fy * 400;
    // whichever road the ahead-point sits on decides the block's facing
    let dA = Infinity, av = World.AVENUES[0];
    for (const a of World.AVENUES) { const d = Math.abs(ax - a); if (d < dA) { dA = d; av = a; } }
    let dS = Infinity, st = World.STREETS[0];
    for (const s of World.STREETS) { const d = Math.abs(ay - s); if (d < dS) { dS = d; st = s; } }
    if (dA < dS) buildRoadblockAt(av, World.clamp(ay, 90, World.H - 90), true);
    else buildRoadblockAt(World.clamp(ax, 90, 2400), st, false);
  }

  function removeRoadblock(block) {
    for (const c of block.cars) Vehicles.removeCar(c);
    state.roadblocks.splice(state.roadblocks.indexOf(block), 1);
  }
  function clearRoadblocks() { while (state.roadblocks.length) removeRoadblock(state.roadblocks[0]); }

  function update(dt, player, playerCar, events) {
    state.lastPlayer = { x: player.x, y: player.y };
    const st = stars();
    // manpower follows the stars
    const wanted = st === 0 ? 0 : Math.min(2 + st, 6);
    state.spawnTimer -= dt;
    if (state.cruisers.length < wanted && state.spawnTimer <= 0) {
      spawnCruiser(player); state.spawnTimer = 1.1;
    }
    for (let i = state.cruisers.length - 1; i >= 0; i--) {
      const c = state.cruisers[i];
      const far = Math.hypot(c.x - player.x, c.y - player.y) > 1450;
      if (far || (wanted === 0 && state.cruisers.length > 0)) {
        Vehicles.removeCar(c); state.cruisers.splice(i, 1);
      }
    }
    // line of sight: the nearest cruiser inside 560 runs the search
    let nearest = Infinity;
    for (const c of state.cruisers) nearest = Math.min(nearest, Math.hypot(c.x - player.x, c.y - player.y));
    state.seen = nearest < 560;
    if (state.seen) state.unseenFor = 0; else state.unseenFor += dt;
    if (!state.seen && state.heat > 0) {
      const lit = typeof Helicopter !== 'undefined' && Helicopter.isActive();
      const rate = lit ? 0.004 : Math.min(0.12, 0.025 + state.unseenFor * 0.006);
      state.heat = Math.max(0, state.heat - rate * dt);
      if (state.heat === 0) { state.bust = 0; clearRoadblocks(); }
    }
    // pursuit: every cruiser drives at the player (or at the shoreline
    // below him when he's out on the water where wheels can't follow)
    for (const c of state.cruisers) {
      let tx = player.x, ty = player.y;
      if (player.inBoat) { tx = World.BEACH_X - 60; ty = World.clamp(player.y, 80, World.H - 80); }
      else if (playerCar) { tx += playerCar.vx * 0.35; ty += playerCar.vy * 0.35; }
      const want = Math.atan2(ty - c.y, tx - c.x);
      let diff = want - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += World.clamp(diff, -3.1 * dt, 3.1 * dt);
      const d = Math.hypot(tx - c.x, ty - c.y);
      const sp = 332 * (d > 210 ? 1 : 0.72) * (player.inBoat && c.x > 2300 ? 0.25 : 1);
      c.vx = Math.cos(c.angle) * sp; c.vy = Math.sin(c.angle) * sp;
      Vehicles.integrate(c, dt);
    }
    // bust meter: pinned slow with a cruiser on top of you
    const pSpeed = player.speed || 0;
    if (state.seen && nearest < 120 && pSpeed < 42 && !player.inBoat) {
      state.bust += dt / 2.4;
      if (state.bust >= 1) { state.bust = 0; events.push('busted'); }
    } else {
      state.bust = Math.max(0, state.bust - dt * 0.8);
    }
    // roadblocks at three stars and up
    state.blockTimer -= dt;
    if (st >= 3 && playerCar && state.roadblocks.length === 0 && state.blockTimer <= 0) {
      placeRoadblockAhead(player, playerCar);
      state.blockTimer = 16;
    }
    for (let i = state.roadblocks.length - 1; i >= 0; i--) {
      const b = state.roadblocks[i];
      if (Math.hypot(b.x - player.x, b.y - player.y) > 950) removeRoadblock(b);
    }
  }

  function drawRoadblocks(ctx, t) {
    for (const b of state.roadblocks) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.vertical ? 0 : Math.PI / 2);
      ctx.fillStyle = '#2c2c34'; ctx.fillRect(-58, -6, 116, 12);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? '#f2f2f2' : '#ff7a30';
        ctx.fillRect(-58 + i * 19.3, -6, 19.3, 12);
      }
      const phase = Math.floor(t * 2.4) % 2;
      ctx.fillStyle = phase ? '#ff4040' : '#ffb347';
      ctx.beginPath(); ctx.arc(-58, -11, 4, 0, Math.PI * 2); ctx.arc(58, -11, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // The response list for the HUD: nearest first, helicopter included.
  function units() {
    const p = state.lastPlayer;
    const rows = [];
    state.cruisers.forEach((c, i) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      rows.push({ label: 'PCPD-' + (i + 1), dist: Math.round(d / 5),
        role: (!state.seen && state.unseenFor > 2) ? 'SEARCHING' : (d < 95 ? 'RAMMING' : 'PURSUING') });
    });
    state.roadblocks.forEach((b, i) => {
      rows.push({ label: 'PCPD-B' + (i + 1), dist: Math.round(Math.hypot(b.x - p.x, b.y - p.y) / 5), role: 'ROADBLOCK' });
    });
    if (typeof Helicopter !== 'undefined' && Helicopter.isActive())
      rows.push({ label: 'AIR-1', dist: Math.round(Math.hypot(Helicopter.state.x - p.x, Helicopter.state.y - p.y) / 5), role: 'SPOTLIGHT' });
    rows.sort((a, b) => a.dist - b.dist);
    return rows;
  }

  function clear() {
    state.heat = 0; state.bust = 0; state.unseenFor = 0; state.seen = false;
    for (const c of state.cruisers) Vehicles.removeCar(c);
    state.cruisers.length = 0;
    clearRoadblocks();
  }

  return { state, stars, reportCrime, snapToRoad, spawnCruiser, buildRoadblockAt,
    placeRoadblockAhead, clearRoadblocks, update, drawRoadblocks, units, clear };
})();

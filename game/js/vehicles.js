// vehicles.js — every car in Palm Coast: models, arcade driving physics with
// handbrake drift, grid traffic AI, and the shared effects pool (skid marks,
// crash sparks, damage smoke) that the other systems borrow.
const Vehicles = (() => {
  const MODELS = [
    { name: 'Comet', w: 37, l: 76, top: 305, accel: 250, grip: 9.5, colors: ['#3fbfae', '#c2a24d', '#7a4fa3', '#e8e3d8'] },
    { name: 'PCPD Cruiser', w: 39, l: 81, top: 352, accel: 285, grip: 9.0, colors: ['#eef0f2'] },
    { name: 'Blista', w: 34, l: 66, top: 262, accel: 225, grip: 10.5, colors: ['#d84a6a', '#4a90d8', '#59b06a', '#e07840'] },
    { name: 'Hauler', w: 43, l: 90, top: 238, accel: 185, grip: 8.0, colors: ['#8a8f96', '#5d7a8a', '#b0a696'] },
    { name: 'Zephyr', w: 38, l: 81, top: 385, accel: 305, grip: 10.0, colors: ['#c22f6d', '#22242a', '#e8b13c'] },
    { name: 'Solstice', w: 36, l: 73, top: 318, accel: 262, grip: 9.8, colors: ['#ff7847', '#37e0c8', '#f2ead8'] },
  ];
  const rand = mulberry32(77003);
  const cars = [];
  let tuneStage = 0;        // garage engine stage, set by game.js
  let armorWax = false;     // garage armor wax: player car shrugs off 20%
  const fxRand = mulberry32(5150);

  function makeCar(modelIdx, x, y, angle, kind) {
    const model = MODELS[modelIdx];
    const car = {
      model: modelIdx, name: model.name, w: model.w, l: model.l,
      color: kind === 'police' ? '#eef0f2' : model.colors[Math.floor(rand() * model.colors.length)],
      x, y, angle, vx: 0, vy: 0, steer: 0, sliding: false,
      health: 100, kind, stolen: kind === 'parked' || kind === 'player',
      hasDriver: kind === 'traffic', cruise: 130 + rand() * 70,
      waypoints: [], wp: 0, nearMissCd: 0, smokeAcc: 0, skidAcc: 0, dead: false,
    };
    cars.push(car);
    return car;
  }

  const speedOf = (car) => Math.hypot(car.vx, car.vy);
  function forwardSpeed(car) { return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle); }

  // Lane helpers: right-hand traffic offsets on the World grid.
  function laneV(avenueX, dir) { return avenueX + (dir < 0 ? 27 : -27); }  // dir -1 heads north
  function laneH(streetY, dir) { return streetY + (dir > 0 ? 27 : -27); }  // dir +1 heads east

  function startRoute(car) {
    // Pick the road the car sits on and queue waypoints along it.
    let bestA = World.AVENUES[0], bd = 1e9;
    for (const a of World.AVENUES) { const d = Math.abs(car.x - a); if (d < bd) { bd = d; bestA = a; } }
    let bestS = World.STREETS[0]; bd = 1e9;
    for (const s of World.STREETS) { const d = Math.abs(car.y - s); if (d < bd) { bd = d; bestS = s; } }
    if (Math.abs(car.x - bestA) <= Math.abs(car.y - bestS)) {
      car.axis = 'v'; car.road = bestA; car.dir = rand() < 0.5 ? 1 : -1;
      car.x = laneV(bestA, car.dir);
    } else {
      car.axis = 'h'; car.road = bestS; car.dir = rand() < 0.5 ? 1 : -1;
      car.y = laneH(bestS, car.dir);
    }
    queueLeg(car, true);
  }

  function queueLeg(car, first) {
    // From the car's current junction, choose the next waypoint down its road,
    // sometimes turning onto the crossing road at the junction after that.
    car.waypoints = [];
    const reach = 500 + rand() * 500;
    if (car.axis === 'v') {
      const ty = World.clamp(car.y + car.dir * reach, 90, World.H - 90);
      car.waypoints.push({ x: car.x, y: ty });
      const cross = World.STREETS.reduce((p, s) => (Math.abs(s - ty) < Math.abs(p - ty) ? s : p), World.STREETS[0]);
      if (rand() < 0.4) {
        const ndir = rand() < 0.5 ? 1 : -1;
        car.waypoints.push({ x: car.x, y: cross, turn: { axis: 'h', road: cross, dir: ndir } });
      }
    } else {
      const tx = World.clamp(car.x + car.dir * reach, 90, World.BEACH_X - 80);
      car.waypoints.push({ x: tx, y: car.y });
      const cross = World.AVENUES.reduce((p, a) => (Math.abs(a - tx) < Math.abs(p - tx) ? a : p), World.AVENUES[0]);
      if (rand() < 0.4) {
        const ndir = rand() < 0.5 ? 1 : -1;
        car.waypoints.push({ x: cross, y: car.y, turn: { axis: 'v', road: cross, dir: ndir } });
      }
    }
    car.wp = 0;
    if (first) car.angle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  }

  function spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const modelIdx = [0, 2, 2, 3, 5][Math.floor(rand() * 5)];
      let x, y;
      if (rand() < 0.5) { x = World.AVENUES[Math.floor(rand() * 5)]; y = 120 + rand() * (World.H - 240); }
      else { y = World.STREETS[Math.floor(rand() * 4)]; x = 120 + rand() * (World.BEACH_X - 260); }
      const car = makeCar(modelIdx, x, y, 0, 'traffic');
      startRoute(car);
    }
  }

  function spawnParked() {
    const diner = World.buildingNamed("Marlo's Diner");
    const spot = World.doorstep(diner);
    const car = makeCar(0, spot.x + 6, spot.y + 10, Math.PI, 'parked');
    car.color = '#2fa39a'; car.name = 'Comet';
    // a few sleepy kerb cars so the streets never look abandoned
    for (let i = 0; i < 7; i++) {
      const b = World.buildings[Math.floor(rand() * World.buildings.length)];
      const d = World.doorstep(b);
      const extra = makeCar([0, 2, 3, 5][Math.floor(rand() * 4)], d.x + (rand() * 30 - 15), d.y + (rand() * 24 - 12), rand() < 0.5 ? 0 : Math.PI, 'parked');
      extra.stolen = false;
    }
    return car;
  }

  function nearestCar(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const c of cars) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - pos.x, c.y - pos.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Shared arcade physics: velocity split into forward/lateral, grip eats the
  // lateral part unless the handbrake is down — that gap is the drift.
  function integrate(car, dt, throttle, steerIn, braking) {
    const model = MODELS[car.model];
    const topMul = car.kind === 'player' || car === playerRef ? 1 + tuneStage * 0.09 : 1;
    const top = model.top * topMul, accel = model.accel * (car.kind === 'player' ? 1 + tuneStage * 0.07 : 1);
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    let fwd = car.vx * fx + car.vy * fy;
    let latx = car.vx - fwd * fx, laty = car.vy - fwd * fy;
    const latMag = Math.hypot(latx, laty);
    if (throttle > 0) fwd += accel * throttle * dt * (fwd < 0 ? 2.2 : 1);
    if (throttle < 0) fwd += (fwd > 30 ? -340 : accel * 0.62 * throttle) * dt;
    fwd -= fwd * (braking ? 1.9 : 0.42) * dt;
    fwd = World.clamp(fwd, -top * 0.36, top);
    const grip = braking ? 2.1 : model.grip;
    const keep = Math.max(0, 1 - grip * dt);
    latx *= keep; laty *= keep;
    car.sliding = latMag > 55 && Math.abs(fwd) > 110;
    car.steer = steerIn;
    if (Math.abs(fwd) > 4) car.angle += steerIn * 1.85 * dt * Math.sign(fwd) * Math.min(1, Math.abs(fwd) / 130);
    const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
    const nlatx = car.vx - (car.vx * nfx + car.vy * nfy) * nfx; // re-split after the turn
    const nlaty = car.vy - (car.vx * nfx + car.vy * nfy) * nfy;
    void nlatx; void nlaty;
    car.vx = nfx * fwd + latx; car.vy = nfy * fwd + laty;
    car.x += car.vx * dt; car.y += car.vy * dt;
  }
  let playerRef = null;

  function drivePlayer(car, input, dt) {
    playerRef = car;
    const throttle = input.up ? 1 : input.down ? -1 : 0;
    const steerIn = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    integrate(car, dt, throttle, steerIn, !!input.handbrake);
    World.collideCircle(car, 24);
    if (car.sliding || (input.handbrake && Math.abs(forwardSpeed(car)) > 90)) {
      car.skidAcc += dt;
      if (car.skidAcc > 0.028) { car.skidAcc = 0; laySkid(car); }
    }
  }

  function steerToward(car, tx, ty, dt, speedMul) {
    const want = Math.atan2(ty - car.y, tx - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steerIn = World.clamp(diff * 2.4, -1, 1);
    const dist = Math.hypot(tx - car.x, ty - car.y);
    const throttle = dist < 30 ? 0.25 : speedMul || 1;
    integrate(car, dt, throttle, steerIn, false);
    World.collideCircle(car, 24);
  }

  function updateTraffic(car, dt, playerPos) {
    if (car.kind !== 'traffic' || car.dead) return;
    if (car.nearMissCd > 0) car.nearMissCd -= dt;
    const far = Math.hypot(car.x - playerPos.x, car.y - playerPos.y) > 1750;
    if (far) { // quietly recycle distant traffic back into the living city
      const a = World.AVENUES[Math.floor(rand() * 5)];
      car.x = a; car.y = World.clamp(playerPos.y + (rand() < 0.5 ? -800 : 800), 100, World.H - 100);
      startRoute(car); return;
    }
    let target = car.waypoints[car.wp];
    if (!target) { queueLeg(car); target = car.waypoints[0]; }
    // slow for the car ahead
    let speedMul = car.cruise / MODELS[car.model].top;
    for (const o of cars) {
      if (o === car || o.dead) continue;
      const ahead = (o.x - car.x) * Math.cos(car.angle) + (o.y - car.y) * Math.sin(car.angle);
      const side = Math.abs((o.x - car.x) * -Math.sin(car.angle) + (o.y - car.y) * Math.cos(car.angle));
      if (ahead > 0 && ahead < 74 && side < 22) { speedMul = Math.min(speedMul, 0.25); break; }
    }
    steerToward(car, target.x, target.y, dt, speedMul * 1.9);
    if (Math.hypot(target.x - car.x, target.y - car.y) < 42) {
      if (target.turn) {
        car.axis = target.turn.axis; car.road = target.turn.road; car.dir = target.turn.dir;
        if (car.axis === 'v') car.x = laneV(car.road, car.dir); else car.y = laneH(car.road, car.dir);
        queueLeg(car);
      } else {
        car.wp++;
        if (car.wp >= car.waypoints.length) queueLeg(car);
      }
    }
  }

  function damage(car, amount) {
    if (car === playerRef && armorWax) amount *= 0.8;
    car.health = Math.max(0, car.health - amount);
  }

  // ---- effects pool ---------------------------------------------------------
  const skids = [];   // {x, y, a, life}
  const sparks = [];  // {x, y, vx, vy, life}
  const smokes = [];  // {x, y, vx, vy, life, max, r}

  function sparkBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = fxRand() * Math.PI * 2, sp = 40 + fxRand() * 130;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.22 + fxRand() * 0.2 });
    }
    if (sparks.length > 320) sparks.splice(0, sparks.length - 320);
  }

  function laySkid(car) {
    const back = { x: car.x - Math.cos(car.angle) * car.l * 0.32, y: car.y - Math.sin(car.angle) * car.l * 0.32 };
    const px = -Math.sin(car.angle), py = Math.cos(car.angle);
    skids.push({ x: back.x + px * 13, y: back.y + py * 13, a: car.angle, life: 6 });
    skids.push({ x: back.x - px * 13, y: back.y - py * 13, a: car.angle, life: 6 });
    if (skids.length > 700) skids.splice(0, skids.length - 700);
  }

  function spawnSmoke(car, dt) {
    if (car.health >= 45 || car.dead) return;
    const rate = car.health < 22 ? 26 : 15;
    car.smokeAcc += rate * dt;
    while (car.smokeAcc >= 1) {
      car.smokeAcc -= 1;
      smokes.push({
        x: car.x + (fxRand() * 14 - 7), y: car.y + (fxRand() * 14 - 7),
        vx: 5 + fxRand() * 9, vy: -(38 + fxRand() * 72),
        life: 0, max: 1.6 + fxRand() * 1.0, r: 8,
      });
    }
    if (smokes.length > 460) smokes.splice(0, smokes.length - 460);
  }

  // Pre-ages a damaged car's plume (staging, cut scenes) so it reads fully grown.
  function seedSmoke(car, seconds) {
    const steps = Math.max(1, Math.round(seconds / 0.1));
    for (let i = 0; i < steps; i++) { spawnSmoke(car, 0.1); stepSmoke(0.1); }
  }

  function stepSmoke(dt) {
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.life += dt;
      if (s.life >= s.max) { smokes.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.r = 8 + (s.life / s.max) * 32;
    }
  }

  function updateEffects(dt, playerCar) {
    for (let i = skids.length - 1; i >= 0; i--) { skids[i].life -= dt; if (skids[i].life <= 0) skids.splice(i, 1); }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.life -= dt;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.92; s.vy *= 0.92;
    }
    for (const c of cars) spawnSmoke(c, dt);
    stepSmoke(dt);
  }

  function drawGroundEffects(ctx) {
    for (const s of skids) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
      ctx.fillStyle = `rgba(18,18,20,${Math.min(0.5, s.life * 0.09)})`;
      ctx.fillRect(-7, -2.4, 14, 4.8); ctx.restore();
    }
  }

  function drawAirEffects(ctx) {
    for (const s of smokes) {
      const f = s.life / s.max;
      const shade = Math.round(42 + f * 118);
      ctx.fillStyle = `rgba(${shade},${shade},${shade + 6},${0.42 * (1 - f * 0.55)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }
    for (const s of sparks) {
      ctx.fillStyle = `rgba(255,${150 + Math.floor(s.life * 200)},60,${Math.min(1, s.life * 4)})`;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCar(ctx, car, t) {
    if (car.dead) return;
    ctx.save(); ctx.translate(car.x, car.y);
    ctx.fillStyle = 'rgba(15,12,8,0.32)';
    ctx.beginPath(); ctx.ellipse(6, 9, car.l * 0.52, car.w * 0.55, car.angle, 0, 7); ctx.fill();
    ctx.rotate(car.angle);
    // headlight wash on the asphalt ahead
    const grad = ctx.createLinearGradient(car.l * 0.4, 0, car.l * 1.5, 0);
    grad.addColorStop(0, 'rgba(255,220,140,0.20)'); grad.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(car.l * 0.4, -car.w * 0.36); ctx.lineTo(car.l * 1.5, -car.w * 0.62);
    ctx.lineTo(car.l * 1.5, car.w * 0.62); ctx.lineTo(car.l * 0.4, car.w * 0.36);
    ctx.fill();
    // wheels
    ctx.fillStyle = '#17181c';
    const wx = car.l * 0.31, wy = car.w * 0.5;
    for (const [sx, sy] of [[wx, -wy], [wx, wy], [-wx, -wy], [-wx, wy]]) {
      ctx.save(); ctx.translate(sx, sy);
      if (sx > 0) ctx.rotate(car.steer * 0.42);
      ctx.fillRect(-7, -3.4, 14, 6.8); ctx.restore();
    }
    // body
    ctx.fillStyle = car.color;
    roundRect(ctx, -car.l / 2, -car.w / 2, car.l, car.w, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    roundRect(ctx, -car.l / 2 + 4, -car.w / 2 + 3, car.l - 8, car.w * 0.3, 6); ctx.fill();
    // cabin + glass
    ctx.fillStyle = '#1d2733';
    roundRect(ctx, -car.l * 0.16, -car.w * 0.38, car.l * 0.36, car.w * 0.76, 6); ctx.fill();
    ctx.fillStyle = 'rgba(160,210,235,0.5)';
    ctx.fillRect(car.l * 0.13, -car.w * 0.34, car.l * 0.07, car.w * 0.68);
    ctx.fillStyle = car.color;
    roundRect(ctx, -car.l * 0.05, -car.w * 0.34, car.l * 0.14, car.w * 0.68, 4); ctx.fill();
    if (car.kind === 'police' || car.kind === 'roadblock') {
      ctx.fillStyle = '#22242a';
      ctx.fillRect(-car.l * 0.02, -car.w / 2 + 2, car.l * 0.2, car.w - 4);
      const phase = Math.floor(t * 4) % 2;
      ctx.fillStyle = phase ? '#ff4444' : '#ff8888';
      ctx.fillRect(-4, -car.w * 0.3, 8, car.w * 0.24);
      ctx.fillStyle = phase ? '#88aaff' : '#4477ff';
      ctx.fillRect(-4, car.w * 0.06, 8, car.w * 0.24);
      ctx.fillStyle = '#22242a'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('PD', -car.l * 0.3, 3.5);
    }
    // lights
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(car.l / 2 - 3, -car.w * 0.34, 3.4, 6); ctx.fillRect(car.l / 2 - 3, car.w * 0.34 - 6, 3.4, 6);
    ctx.fillStyle = '#ff5545';
    ctx.fillRect(-car.l / 2, -car.w * 0.34, 3, 6); ctx.fillRect(-car.l / 2, car.w * 0.34 - 6, 3, 6);
    if (car.health < 55) { // scorch + crumple shading
      ctx.fillStyle = `rgba(25,22,20,${(55 - car.health) / 130})`;
      roundRect(ctx, car.l * 0.18, -car.w * 0.3, car.l * 0.3, car.w * 0.6, 6); ctx.fill();
    }
    ctx.restore();
  }

  return {
    MODELS, cars, makeCar, spawnTraffic, spawnParked, nearestCar,
    laneV, laneH, startRoute, integrate, drivePlayer, steerToward, updateTraffic,
    damage, speedOf, forwardSpeed,
    skids, sparks, smokes, sparkBurst, laySkid, seedSmoke, updateEffects,
    drawGroundEffects, drawAirEffects, drawCar,
    setTune: (stage) => { tuneStage = stage; },
    setArmor: (on) => { armorWax = on; },
    setPlayerRef: (car) => { playerRef = car; },
  };
})();

// vehicles.js — every car in Palm Coast: the model range, wandering
// traffic on the road grid, the player's driving physics (with handbrake
// drift), damage, and the street effects — skid marks, crash sparks and
// the smoke that pours out of a dying engine.

const Vehicles = (() => {
  const MODELS = [
    { name: 'Comet',    top: 300, accel: 215, l: 46, w: 24, tones: ['#2fa39a', '#3f7fbf', '#c2a24d', '#7a4fa3'] },
    { name: 'Cruiser',  top: 332, accel: 245, l: 48, w: 25, tones: ['#e8e8ec'] },
    { name: 'Zephyr',   top: 398, accel: 305, l: 47, w: 24, tones: ['#e8b13c', '#c22f6d', '#e8e3d8'] },
    { name: 'Hauler',   top: 248, accel: 165, l: 55, w: 27, tones: ['#8b93a0', '#5d8a99', '#a85f7d'] },
    { name: 'Solstice', top: 322, accel: 235, l: 45, w: 24, tones: ['#ff7847', '#37e0c8', '#e8e3d8'] },
    { name: 'Metro',    top: 266, accel: 185, l: 42, w: 23, tones: ['#59b06a', '#4a90d8', '#d87f4a', '#c2c7ce'] },
  ];
  const rand = mulberry32(77003);
  const cars = [];
  const skids = [], sparks = [], smokes = [];

  function makeCar(modelIdx, x, y, angle, kind) {
    const m = MODELS[modelIdx];
    const car = { model: modelIdx, name: m.name, kind,
      color: m.tones[Math.floor(rand() * m.tones.length)],
      x, y, angle, vx: 0, vy: 0, speed: 0, health: 100, stolen: false,
      l: m.l, w: m.w, sliding: false, boost: 1, smokeAcc: 0, nearMissAt: -99,
      axis: 'v', dir: 1, cruise: 118 + rand() * 52, turnMark: '', dead: false };
    cars.push(car);
    return car;
  }
  function removeCar(car) {
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  const laneV = (avenueX, dir) => avenueX + (dir < 0 ? 27 : -27);  // dir -1 heads north
  const laneH = (streetY, dir) => streetY + (dir > 0 ? 27 : -27);  // dir +1 heads east

  function startRoute(car) {
    // pick whichever road the car is closest to and join its flow
    let bestA = World.AVENUES[0], bd = Infinity;
    for (const a of World.AVENUES) { const d = Math.abs(car.x - a); if (d < bd) { bd = d; bestA = a; } }
    let bestS = World.STREETS[0];
    bd = Infinity;
    for (const s of World.STREETS) { const d = Math.abs(car.y - s); if (d < bd) { bd = d; bestS = s; } }
    if (Math.abs(car.x - bestA) < Math.abs(car.y - bestS)) {
      car.axis = 'v'; car.dir = rand() < 0.5 ? 1 : -1; car.x = laneV(bestA, car.dir);
    } else {
      car.axis = 'h'; car.dir = rand() < 0.5 ? 1 : -1; car.y = laneH(bestS, car.dir);
    }
    car.angle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  }

  function spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const idx = [0, 3, 4, 5, 0, 5][Math.floor(rand() * 6)];
      const onAve = rand() < 0.55;
      const x = onAve ? World.AVENUES[Math.floor(rand() * 5)] : 120 + rand() * 2200;
      const y = onAve ? 120 + rand() * 2100 : World.STREETS[Math.floor(rand() * 4)];
      const car = makeCar(idx, x, y, 0, 'traffic');
      startRoute(car);
    }
  }

  function spawnParked() {
    const spot = World.doorstep(World.buildingNamed("Marlo's Diner"));
    const car = makeCar(0, spot.x + 26, spot.y + 6, Math.PI, 'parked');
    car.color = '#2fa39a';   // the teal Comet from the story
    return car;
  }

  // ---- physics -----------------------------------------------------------
  function integrate(car, dt) {
    car.x += car.vx * dt; car.y += car.vy * dt;
    const before = Math.hypot(car.vx, car.vy);
    const pen = World.collideCircle(car, 19);
    if (pen > 1.5 && before > 210) {           // hard kiss with a building
      damage(car, 4);
      sparkBurst(car.x, car.y, 4);
      const keep = Math.max(0, 1 - pen / 14);
      car.vx *= keep * 0.4; car.vy *= keep * 0.4;
    }
    car.x = World.clamp(car.x, 24, World.WATER_X - 30);   // cars stay out of the sea
    car.speed = Math.hypot(car.vx, car.vy);
  }

  function damage(car, amount) {
    if (amount > 0) car.health = Math.max(0, car.health - amount);
    if (car.health <= 0) car.dead = true;
  }

  function drivePlayer(car, input, dt) {
    const m = MODELS[car.model];
    const top = m.top * (car.boost || 1);
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    let fwd = car.vx * fx + car.vy * fy;
    const latX = car.vx - fx * fwd, latY = car.vy - fy * fwd;
    if (input.up) fwd += m.accel * dt * (fwd < 0 ? 2.2 : 1);
    if (input.down) fwd -= (fwd > 30 ? m.accel * 1.5 : m.accel * 0.55) * dt;
    if (!input.up && !input.down) fwd -= fwd * Math.min(1, 0.7 * dt);
    fwd = World.clamp(fwd, -top * 0.38, top);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (steer && Math.abs(fwd) > 12)
      car.angle += steer * 2.55 * dt * Math.min(1, Math.abs(fwd) / 130) * (fwd < 0 ? -1 : 1);
    const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
    // grip bleeds the sideways slide; the handbrake barely bleeds it at all
    const bleed = Math.exp(-(input.handbrake ? 1.1 : 8.5) * dt);
    const lat2 = Math.hypot(latX, latY) * bleed;
    const latAng = Math.atan2(latY, latX);
    car.vx = nfx * fwd + Math.cos(latAng) * lat2;
    car.vy = nfy * fwd + Math.sin(latAng) * lat2;
    car.sliding = lat2 > 55 && Math.abs(fwd) > 90;
    if (input.handbrake) fwd -= fwd * Math.min(1, 0.5 * dt);
    if (car.sliding || (input.handbrake && Math.abs(fwd) > 150)) laySkid(car);
  }

  function updateTraffic(car, dt, playerPos) {
    if (car.dead) { car.vx *= 0.9; car.vy *= 0.9; car.speed = Math.hypot(car.vx, car.vy); return; }
    const dx = playerPos.x - car.x, dy = playerPos.y - car.y;
    if (dx * dx + dy * dy > 1500 * 1500) {   // far from the action: rejoin near the player
      car.x = World.clamp(playerPos.x + (rand() - 0.5) * 1900, 80, 2400);
      car.y = World.clamp(playerPos.y + (rand() - 0.5) * 1900, 80, 2300);
      startRoute(car);
    }
    // change roads at some intersections
    if (car.axis === 'v') {
      for (const s of World.STREETS) {
        const key = 'v' + s;
        if (Math.abs(car.y - s) < 24 && car.turnMark !== key) {
          car.turnMark = key;
          if (rand() < 0.35) { car.axis = 'h'; car.dir = rand() < 0.5 ? 1 : -1; }
        }
      }
    } else {
      for (const a of World.AVENUES) {
        const key = 'h' + a;
        if (Math.abs(car.x - a) < 24 && car.turnMark !== key) {
          car.turnMark = key;
          if (rand() < 0.35) { car.axis = 'v'; car.dir = rand() < 0.5 ? 1 : -1; }
        }
      }
    }
    // ease onto the lane line for the current heading
    let tx, ty;
    if (car.axis === 'v') {
      let av = World.AVENUES[0], bd = Infinity;
      for (const a of World.AVENUES) { const d = Math.abs(car.x - a); if (d < bd) { bd = d; av = a; } }
      tx = laneV(av, car.dir); ty = car.y + car.dir * 300;
    } else {
      let st = World.STREETS[0], bd = Infinity;
      for (const s of World.STREETS) { const d = Math.abs(car.y - s); if (d < bd) { bd = d; st = s; } }
      tx = car.x + car.dir * 300; ty = laneH(st, car.dir);
    }
    const want = Math.atan2(ty - car.y, tx - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += World.clamp(diff, -2.4 * dt, 2.4 * dt);
    // slow for a car ahead
    let speed = car.cruise;
    for (const other of cars) {
      if (other === car) continue;
      const ox = other.x - car.x, oy = other.y - car.y;
      const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = Math.abs(ox * -Math.sin(car.angle) + oy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 58 && side < 20) { speed = Math.min(speed, other.speed * 0.9); break; }
    }
    const sp = car.speed + World.clamp(speed - car.speed, -260 * dt, 120 * dt);
    car.vx = Math.cos(car.angle) * sp; car.vy = Math.sin(car.angle) * sp;
    car.x += car.vx * dt; car.y += car.vy * dt;
    World.collideCircle(car, 19);
    car.x = World.clamp(car.x, 24, World.WATER_X - 30);
    car.speed = Math.hypot(car.vx, car.vy);
  }

  // ---- effects -------------------------------------------------------------
  function sparkBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, sp = 40 + rand() * 130;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.3 + rand() * 0.35 });
    }
    if (sparks.length > 260) sparks.splice(0, sparks.length - 260);
  }
  function laySkid(car) {
    const bx = car.x - Math.cos(car.angle) * car.l * 0.32, by = car.y - Math.sin(car.angle) * car.l * 0.32;
    const px = -Math.sin(car.angle), py = Math.cos(car.angle);
    skids.push({ x: bx + px * 9, y: by + py * 9, angle: car.angle, life: 6 });
    skids.push({ x: bx - px * 9, y: by - py * 9, angle: car.angle, life: 6 });
    if (skids.length > 420) skids.splice(0, skids.length - 420);
  }
  function updateEffects(dt) {
    for (let i = skids.length - 1; i >= 0; i--) { skids[i].life -= dt; if (skids[i].life <= 0) skids.splice(i, 1); }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life >= s.max) sparks.splice(i, 1);
    }
    for (const car of cars) {
      if (car.health < 45) {
        car.smokeAcc += dt * (car.health < 22 ? 31 : 16);
        while (car.smokeAcc >= 1) {
          car.smokeAcc -= 1;
          smokes.push({ x: car.x + (rand() - 0.5) * 12, y: car.y + (rand() - 0.5) * 8,
            vx: 7 + rand() * 9, vy: -(38 + rand() * 72), r: 9.5, life: 0, max: 1.6 + rand() * 1.0 });
        }
      }
    }
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i]; s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      s.r = 9.5 + (s.life / s.max) * 36;
      if (s.life >= s.max) smokes.splice(i, 1);
    }
    if (smokes.length > 320) smokes.splice(0, smokes.length - 320);
  }
  function drawGroundEffects(ctx) {
    ctx.fillStyle = '#22222a';
    for (const s of skids) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
      ctx.globalAlpha = Math.min(0.55, s.life / 6 * 0.55);
      ctx.fillRect(-7, -2.4, 14, 4.8); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function drawAirEffects(ctx) {
    for (const s of smokes) {
      const f = s.life / s.max;
      const grey = Math.round(42 + f * 120);
      ctx.fillStyle = `rgba(${grey},${grey},${grey + 8},${(1 - f) * 0.62})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const s of sparks) {
      ctx.fillStyle = `rgba(255,${170 + Math.floor(rand() * 60)},60,${1 - s.life / s.max})`;
      ctx.fillRect(s.x - 1.6, s.y - 1.6, 3.2, 3.2);
    }
  }

  // ---- painting ---------------------------------------------------------------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawCar(ctx, car, t) {
    ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(20,16,10,0.35)';
    ctx.beginPath(); ctx.ellipse(3, 5, car.l * 0.52, car.w * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    // headlight wash on the road ahead
    const grad = ctx.createLinearGradient(car.l / 2, 0, car.l / 2 + 74, 0);
    grad.addColorStop(0, 'rgba(255,226,150,0.20)'); grad.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(car.l / 2, -8); ctx.lineTo(car.l / 2 + 74, -21); ctx.lineTo(car.l / 2 + 74, 21); ctx.lineTo(car.l / 2, 8);
    ctx.closePath(); ctx.fill();
    const police = car.model === 1;
    ctx.fillStyle = police ? '#ececf0' : car.color;
    roundRect(ctx, -car.l / 2, -car.w / 2, car.l, car.w, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.6; ctx.stroke();
    if (police) {
      ctx.fillStyle = '#23232c';
      roundRect(ctx, -car.l * 0.05, -car.w / 2 + 1, car.l * 0.3, car.w - 2, 4); ctx.fill();
      const phase = Math.floor(t * 2.4) % 2;
      ctx.fillStyle = phase ? '#ff4040' : '#4060ff';
      roundRect(ctx, -6, -car.w / 2 + 3, 12, 5, 2); ctx.fill();
      ctx.fillStyle = phase ? '#4060ff' : '#ff4040';
      roundRect(ctx, -6, car.w / 2 - 8, 12, 5, 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(20,26,38,0.85)';
      roundRect(ctx, -car.l * 0.16, -car.w * 0.36, car.l * 0.4, car.w * 0.72, 5); ctx.fill();
      ctx.fillStyle = 'rgba(150,200,235,0.75)';
      roundRect(ctx, car.l * 0.26, -car.w * 0.34, car.l * 0.1, car.w * 0.68, 3); ctx.fill();
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(car.l / 2 - 2, -car.w / 2 + 3, 3, 5); ctx.fillRect(car.l / 2 - 2, car.w / 2 - 8, 3, 5);
    ctx.fillStyle = '#ff5040';
    ctx.fillRect(-car.l / 2 - 1, -car.w / 2 + 3, 3, 5); ctx.fillRect(-car.l / 2 - 1, car.w / 2 - 8, 3, 5);
    if (car.health < 62) {   // scorch and dents as the hull gives up
      ctx.fillStyle = `rgba(24,20,18,${car.health < 30 ? 0.55 : 0.3})`;
      ctx.beginPath(); ctx.arc(car.l * 0.3, -car.w * 0.2, 6 + (62 - car.health) * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-car.l * 0.28, car.w * 0.24, 4 + (62 - car.health) * 0.08, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function draw(ctx, t) { for (const car of cars) drawCar(ctx, car, t); }

  return { MODELS, cars, makeCar, removeCar, spawnTraffic, spawnParked, laneV, laneH,
    startRoute, integrate, damage, drivePlayer, updateTraffic,
    sparkBurst, laySkid, updateEffects, drawGroundEffects, drawAirEffects, drawCar, draw };
})();

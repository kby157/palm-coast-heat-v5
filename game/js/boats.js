// boats.js — the Palm Coast Pier fleet. Three boats ride at moorings in
// the open water by the pier; this module owns their sailing physics
// (thrust, rudder, drag), their foam wakes, and every stroke that draws
// a hull. Nothing else in the game paints a boat.

const Boats = (() => {
  const FLEET = [
    { name: 'Skimmer', color: '#e8e3d8', top: 215, accel: 150 },
    { name: 'Marlin',  color: '#c95d4a', top: 245, accel: 175 },
    { name: 'Drifter', color: '#3f7fbf', top: 190, accel: 135 },
  ];
  const boats = [];
  const wake = [];   // {x,y,r,life,max} foam blobs astern of a moving boat

  function spawnBoats() {
    const spots = [
      { x: World.WATER_X + 70, y: World.PIER_Y - 215, a: Math.PI / 2 },
      { x: World.WATER_X + 105, y: World.PIER_Y - 105, a: -Math.PI / 2 },
      { x: World.WATER_X + 165, y: World.PIER_Y + 165, a: Math.PI / 2 },
    ];
    FLEET.forEach((f, i) => {
      boats.push({ name: f.name, color: f.color, top: f.top, accel: f.accel,
        x: spots[i].x, y: spots[i].y, angle: spots[i].a, vx: 0, vy: 0, speed: 0, wakeAcc: 0 });
    });
  }

  function nearestBoat(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const b of boats) {
      const d = Math.hypot(b.x - pos.x, b.y - pos.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function hitsPier(x, y) {
    return Math.abs(y - World.PIER_Y) < 24 && x > World.BEACH_X - 8 && x < World.PIER_END_X + 16;
  }

  // Where Jax steps off: the pier deck when alongside it, else the waterline.
  function shorePoint(boat) {
    if (Math.abs(boat.y - World.PIER_Y) < 130 && boat.x < World.PIER_END_X + 30)
      return { x: World.clamp(boat.x, World.BEACH_X + 6, World.PIER_END_X), y: World.PIER_Y };
    return { x: World.BEACH_X + 10, y: World.clamp(boat.y, 40, World.H - 40) };
  }

  function driveBoat(boat, input, dt) {
    const fx = Math.cos(boat.angle), fy = Math.sin(boat.angle);
    let fwd = boat.vx * fx + boat.vy * fy;
    if (input.up) fwd += boat.accel * dt;
    if (input.down) fwd -= boat.accel * 0.6 * dt;
    fwd -= fwd * Math.min(1, 0.55 * dt);
    fwd = World.clamp(fwd, -boat.top * 0.35, boat.top);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (steer && Math.abs(fwd) > 14)
      boat.angle += steer * 0.85 * dt * Math.min(1, Math.abs(fwd) / 90) * (fwd < 0 ? -1 : 1);
    const nfx = Math.cos(boat.angle), nfy = Math.sin(boat.angle);
    boat.vx = nfx * fwd; boat.vy = nfy * fwd;
    const nx = boat.x + boat.vx * dt, ny = boat.y + boat.vy * dt;
    if (!hitsPier(nx, ny) && nx > World.WATER_X - 14) { boat.x = nx; boat.y = ny; }
    else { boat.vx *= 0.4; boat.vy *= 0.4; }
    boat.y = World.clamp(boat.y, 30, World.H - 30);
    boat.x = World.clamp(boat.x, World.WATER_X - 14, World.W - 26);
    boat.speed = Math.hypot(boat.vx, boat.vy);
    if (boat.speed > 42) {
      boat.wakeAcc += dt * 11;
      while (boat.wakeAcc >= 1) {
        boat.wakeAcc -= 1;
        wake.push({ x: boat.x - nfx * 26 + (Math.random() - 0.5) * 8,
          y: boat.y - nfy * 26 + (Math.random() - 0.5) * 8, r: 5, life: 0, max: 2.2 });
      }
    }
    if (wake.length > 300) wake.splice(0, wake.length - 300);
  }

  function seedWake(boat, blobs) {
    const fx = Math.cos(boat.angle), fy = Math.sin(boat.angle);
    for (let i = 0; i < blobs; i++)
      wake.push({ x: boat.x - fx * (26 + i * 13), y: boat.y - fy * (26 + i * 13),
        r: 5 + i * 0.7, life: i * 0.09, max: 2.2 });
  }

  function updateWake(dt) {
    for (let i = wake.length - 1; i >= 0; i--) {
      const w = wake[i]; w.life += dt; w.r += dt * 7;
      if (w.life >= w.max) wake.splice(i, 1);
    }
  }
  function drawWake(ctx) {
    for (const w of wake) {
      ctx.fillStyle = `rgba(235,248,255,${(1 - w.life / w.max) * 0.5})`;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBoatHull(ctx, boat) {
    ctx.save(); ctx.translate(boat.x, boat.y); ctx.rotate(boat.angle);
    ctx.fillStyle = 'rgba(15,30,50,0.35)';
    ctx.beginPath(); ctx.ellipse(3, 5, 28, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.moveTo(28, 0); ctx.quadraticCurveTo(18, -10.5, -6, -10.5);
    ctx.lineTo(-24, -7); ctx.quadraticCurveTo(-27, 0, -24, 7);
    ctx.lineTo(-6, 10.5); ctx.quadraticCurveTo(18, 10.5, 28, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-16, -6.5, 22, 13);
    ctx.fillStyle = 'rgba(28,40,58,0.9)';
    ctx.fillRect(0, -5, 8, 10);
    ctx.fillStyle = '#23232c';
    ctx.fillRect(-29, -4, 6, 8);
    ctx.restore();
  }
  function draw(ctx) {
    drawWake(ctx);
    for (const b of boats) drawBoatHull(ctx, b);
  }

  return { FLEET, boats, spawnBoats, nearestBoat, shorePoint, hitsPier,
    driveBoat, seedWake, updateWake, drawWake, drawBoatHull, draw };
})();

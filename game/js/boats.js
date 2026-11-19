// boats.js — the pier fleet: three moored boats in open water, lazy water
// physics, foam wakes. This module owns every pixel of boat drawing.
const Boats = (() => {
  const FLEET = [
    { name: 'Skimmer', color: '#e8e3d8', top: 215, accel: 150 },
    { name: 'Marlin', color: '#c95d4a', top: 245, accel: 175 },
    { name: 'Drifter', color: '#3f7fbf', top: 190, accel: 135 },
  ];
  const boats = [];
  const wake = [];   // {x, y, r, life, max}
  const rand = mulberry32(90250);

  function makeBoat(fleetIdx, x, y, angle) {
    const f = FLEET[fleetIdx];
    const boat = {
      fleet: fleetIdx, name: f.name, color: f.color, top: f.top, accel: f.accel,
      x, y, angle, vx: 0, vy: 0, w: 30, l: 62, wakeAcc: 0,
    };
    boats.push(boat);
    return boat;
  }

  function spawnBoats() {
    // moored in open water just off the pier, close enough to board from it
    makeBoat(0, World.WATER_X + 70, World.PIER_Y - 52, Math.PI / 2 + 0.5);
    makeBoat(1, World.WATER_X + 135, World.PIER_Y + 50, Math.PI / 2 - 0.4);
    makeBoat(2, World.WATER_X + 30, World.PIER_Y + 6, Math.PI / 2 + 0.2);
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
    return x > World.BEACH_X - 8 && x < World.PIER_END_X + 6 &&
      Math.abs(y - World.PIER_Y) < 30;
  }

  // Where Jax steps ashore when leaving this boat.
  function shorePoint(boat) {
    if (Math.abs(boat.y - World.PIER_Y) < 120 && boat.x < World.PIER_END_X + 40) {
      return { x: World.clamp(boat.x - 26, World.BEACH_X + 8, World.PIER_END_X - 8), y: World.PIER_Y, pier: true };
    }
    return { x: World.WATER_X - 26, y: World.clamp(boat.y, 60, World.H - 60), pier: false };
  }

  function driveBoat(boat, input, dt) {
    const fx = Math.cos(boat.angle), fy = Math.sin(boat.angle);
    let fwd = boat.vx * fx + boat.vy * fy;
    if (input.up) fwd += boat.accel * dt;
    if (input.down) fwd -= boat.accel * 0.55 * dt;
    fwd -= fwd * 0.55 * dt;
    fwd = World.clamp(fwd, -boat.top * 0.3, boat.top);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (Math.abs(fwd) > 6) boat.angle += steer * 0.62 * dt * Math.sign(fwd);
    const nfx = Math.cos(boat.angle), nfy = Math.sin(boat.angle);
    boat.vx = nfx * fwd; boat.vy = nfy * fwd;
    const nx = boat.x + boat.vx * dt, ny = boat.y + boat.vy * dt;
    if ((World.inWater(nx, ny) || World.onPier(nx, ny)) && !hitsPier(nx, ny) && nx < World.W - 24) {
      boat.x = nx; boat.y = World.clamp(ny, 30, World.H - 30);
    } else {
      boat.vx *= 0.4; boat.vy *= 0.4;
    }
    // foam off the stern while she moves
    const sp = Math.hypot(boat.vx, boat.vy);
    if (sp > 26) {
      boat.wakeAcc += dt;
      while (boat.wakeAcc > 0.05) {
        boat.wakeAcc -= 0.05;
        wake.push({
          x: boat.x - Math.cos(boat.angle) * boat.l * 0.5 + (rand() * 10 - 5),
          y: boat.y - Math.sin(boat.angle) * boat.l * 0.5 + (rand() * 10 - 5),
          r: 5, life: 0, max: 1.5 + rand() * 0.9,
        });
      }
    }
    if (wake.length > 260) wake.splice(0, wake.length - 260);
  }

  // Pre-lays a foam trail behind a boat (used when a scene opens mid-run).
  function seedWake(boat, blobs) {
    for (let i = 1; i <= blobs; i++) {
      wake.push({
        x: boat.x - Math.cos(boat.angle) * (boat.l * 0.5 + i * 17),
        y: boat.y - Math.sin(boat.angle) * (boat.l * 0.5 + i * 17),
        r: 5 + i * 0.55, life: i * 0.09, max: 2.4,
      });
    }
  }

  function updateWake(dt) {
    for (let i = wake.length - 1; i >= 0; i--) {
      const w = wake[i];
      w.life += dt; w.r += dt * 7;
      if (w.life >= w.max) wake.splice(i, 1);
    }
  }

  function drawWake(ctx) {
    for (const w of wake) {
      const f = w.life / w.max;
      ctx.fillStyle = `rgba(240,250,252,${0.5 * (1 - f)})`;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 7); ctx.fill();
    }
  }

  function drawBoatHull(ctx, boat) {
    ctx.save(); ctx.translate(boat.x, boat.y);
    ctx.fillStyle = 'rgba(10,30,50,0.30)';
    ctx.beginPath(); ctx.ellipse(5, 8, boat.l * 0.52, boat.w * 0.58, boat.angle, 0, 7); ctx.fill();
    ctx.rotate(boat.angle);
    // hull: pointed bow, square stern
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.moveTo(boat.l * 0.52, 0);
    ctx.lineTo(boat.l * 0.18, -boat.w * 0.5);
    ctx.lineTo(-boat.l * 0.5, -boat.w * 0.5);
    ctx.lineTo(-boat.l * 0.5, boat.w * 0.5);
    ctx.lineTo(boat.l * 0.18, boat.w * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(10,20,30,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    // deck + windshield + outboard
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(-boat.l * 0.34, -boat.w * 0.3, boat.l * 0.52, boat.w * 0.6);
    ctx.fillStyle = '#274b63';
    ctx.fillRect(boat.l * 0.02, -boat.w * 0.32, boat.l * 0.16, boat.w * 0.64);
    ctx.fillStyle = '#2b2e33';
    ctx.fillRect(-boat.l * 0.58, -5, boat.l * 0.1, 10);
    ctx.restore();
  }

  function draw(ctx) { for (const b of boats) drawBoatHull(ctx, b); }

  return {
    FLEET, boats, spawnBoats, nearestBoat, shorePoint, hitsPier,
    driveBoat, seedWake, updateWake, drawWake, drawBoatHull, draw,
  };
})();

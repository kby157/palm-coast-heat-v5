// people.js — the population of Palm Coast: 34 pedestrians who stroll
// the pavements, scatter from trouble and go down when they're hurt, and
// Jax Marlowe's own body when he's on foot — walking, punching, aiming.

const PEOPLE_DRAW_SCALE = 1.4;

const People = (() => {
  const rand = mulberry32(4451);
  const SHIRTS = ['#d87f4a', '#4a90d8', '#7bc47f', '#d84a6a', '#e8e3d8', '#8a6fb8', '#3fbfae', '#c2a24d'];
  const SKINS = ['#f0c8a0', '#c98d64', '#8a5a34', '#6e4525', '#ffd9b3'];
  const HAIRS = ['#2b2118', '#4a3220', '#151312', '#7a5a34', '#a03b2e', '#c2b280'];
  const peds = [];
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  function makePed(x, y) {
    return { x, y, angle: rand() * Math.PI * 2, tx: x, ty: y,
      shirt: pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIRS),
      down: 0, hp: 30, wait: rand() * 2, flee: 0 };
  }
  function spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const b = World.buildings[Math.floor(rand() * World.buildings.length)];
      const spot = World.doorstep(b);
      peds.push(makePed(spot.x + (rand() - 0.5) * 60, spot.y + (rand() - 0.5) * 60));
    }
  }
  function spawnAt(x, y) {   // a driver yanked out of his seat, mid-panic
    const p = makePed(x, y);
    p.flee = 2.2; p.tx = x + (rand() - 0.5) * 300; p.ty = y + (rand() - 0.5) * 300;
    peds.push(p);
    return p;
  }

  function wanderTarget(p) {
    for (let tries = 0; tries < 6; tries++) {
      const x = p.x + (rand() - 0.5) * 520, y = p.y + (rand() - 0.5) * 520;
      if (x < 30 || y < 30 || x > World.BEACH_X + 16 || y > World.H - 30) continue;
      if (World.buildingAt(x, y)) continue;
      p.tx = x; p.ty = y; return;
    }
  }

  function update(dt, threat) {
    for (const p of peds) {
      if (p.down > 0) { p.down -= dt; if (p.down <= 0) p.hp = 30; continue; }
      let speed = 62;
      const dxT = threat.x - p.x, dyT = threat.y - p.y;
      const hot = threat.hot && dxT * dxT + dyT * dyT < 195 * 195;
      if (hot || p.flee > 0) {
        if (hot) { p.tx = p.x - dxT; p.ty = p.y - dyT; }
        p.flee = Math.max(0, p.flee - dt);
        speed = 208;
      } else if (p.wait > 0) {
        p.wait -= dt; continue;
      }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d < 9) { if (!hot) { p.wait = 0.8 + rand() * 3; wanderTarget(p); } continue; }
      p.angle = Math.atan2(dy, dx);
      let nx = p.x + Math.cos(p.angle) * speed * dt;
      let ny = p.y + Math.sin(p.angle) * speed * dt;
      if (World.inWater(nx, ny) && !World.onPier(nx, ny)) { nx = p.x; ny = p.y; p.wait = 0.4; }
      p.x = nx; p.y = ny;
      World.collideCircle(p, 9);
    }
  }

  function scatterFrom(x, y, radius) {
    for (const p of peds) {
      const dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy < radius * radius && p.down <= 0) {
        p.flee = 1.4; p.tx = p.x + dx * 2.2; p.ty = p.y + dy * 2.2;
      }
    }
  }
  function downPed(p) { p.down = 18; p.hp = 0; }
  function hitPed(p, dmg) {
    if (p.down > 0) return;
    p.hp -= dmg;
    if (p.hp <= 0) downPed(p);
    else { p.flee = 1.6; p.tx = p.x + (rand() - 0.5) * 400; p.ty = p.y + (rand() - 0.5) * 400; }
  }

  function drawPerson(ctx, x, y, angle, shirt, skin, down, hair) {
    const s = PEOPLE_DRAW_SCALE;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(25,25,20,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, 9 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (down) {
      ctx.rotate(angle);
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.ellipse(0, 0, 10.5 * s, 5.6 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(11.5 * s, 0, 4.4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(12.3 * s, 0, 3.4 * s, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.arc(0, 0, 7.4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 7.4 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(0, 0, 4.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(-0.8 * s, -0.8 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin;   // nose tick toward facing
      ctx.beginPath(); ctx.arc(Math.cos(angle) * 4.6 * s, Math.sin(angle) * 4.6 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function draw(ctx) {
    for (const p of peds) drawPerson(ctx, p.x, p.y, p.angle, p.shirt, p.skin, p.down > 0, p.hair);
  }

  return { peds, spawnPeds, spawnAt, update, scatterFrom, downPed, hitPed, drawPerson, draw };
})();

// Jax himself, on foot. game.js moves him through move() and draws him
// through draw(); his colours never change — dark jacket, always.
const PlayerBody = {
  x: 400, y: 460, angle: -Math.PI / 2, punchAnim: 0,
  shirt: '#274156', skin: '#c98d64', hair: '#191410',
  move(input, dt) {
    const mag = Math.hypot(input.x, input.y);
    if (mag > 0.01) {
      const nx = input.x / mag, ny = input.y / mag;
      this.angle = Math.atan2(ny, nx);
      const px = this.x + nx * 178 * dt, py = this.y + ny * 178 * dt;
      if (!(World.inWater(px, py) && !World.onPier(px, py))) { this.x = px; this.y = py; }
      World.collideCircle(this, 10);
    }
  },
  update(dt) { if (this.punchAnim > 0) this.punchAnim = Math.max(0, this.punchAnim - dt); },
  fist() { return { x: this.x + Math.cos(this.angle) * 21, y: this.y + Math.sin(this.angle) * 21 }; },
  draw(ctx) {
    People.drawPerson(ctx, this.x, this.y, this.angle, this.shirt, this.skin, false, this.hair);
    if (this.punchAnim > 0) {
      const f = this.fist();
      ctx.strokeStyle = '#c98d64'; ctx.lineWidth = 4.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(f.x, f.y); ctx.stroke();
      ctx.fillStyle = '#e8b98d';
      ctx.beginPath(); ctx.arc(f.x, f.y, 3.6, 0, Math.PI * 2); ctx.fill();
    }
  },
};

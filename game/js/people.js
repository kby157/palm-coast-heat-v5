// people.js — the citizens of Palm Coast and Jax's own body. Figures are drawn
// at 1.4x with head, hair, shoulders and a soft shadow so they read as people
// from the sky, never as tokens.
const PEOPLE_DRAW_SCALE = 1.4;

const People = (() => {
  const rand = mulberry32(4451);
  const SHIRTS = ['#d87f4a', '#4a90d8', '#7bc47f', '#d84a6a', '#e8e3d8', '#8a6fb8', '#3fbfae', '#c2a24d'];
  const SKINS = ['#e8b88a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#6d4226'];
  const HAIR = ['#2b2118', '#4a3220', '#151312', '#7a5a34', '#a03b2e', '#c2b280'];
  const peds = [];
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  function makePed(x, y) {
    const ped = {
      x, y, angle: rand() * Math.PI * 2, tx: x, ty: y,
      shirt: pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIR),
      hp: 40, down: false, panic: 0, wait: rand() * 2, speed: 46 + rand() * 22,
    };
    peds.push(ped);
    return ped;
  }

  function spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const b = World.buildings[Math.floor(rand() * World.buildings.length)];
      const d = World.doorstep(b);
      makePed(d.x + (rand() * 36 - 18), d.y + (rand() * 36 - 18));
    }
  }

  function addPed(x, y) { return makePed(x, y); }

  function wanderTarget(p) {
    const b = World.buildings[Math.floor(rand() * World.buildings.length)];
    const d = World.doorstep(b);
    if (Math.hypot(d.x - p.x, d.y - p.y) > 420) return; // keep strolls local
    p.tx = d.x + (rand() * 30 - 15); p.ty = d.y + (rand() * 30 - 15);
  }

  function scatterFrom(x, y, radius) {
    for (const p of peds) {
      if (p.down) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius) { p.panic = Math.max(p.panic, 1.6); p.fleeX = x; p.fleeY = y; }
    }
  }

  function hurt(ped, dmg) {
    ped.hp -= dmg;
    if (ped.hp <= 0 && !ped.down) { ped.down = true; ped.panic = 0; }
    else if (!ped.down) { ped.panic = Math.max(ped.panic, 1.2); ped.fleeX = ped.x + (rand() * 80 - 40); ped.fleeY = ped.y + (rand() * 80 - 40); }
  }

  function update(dt, threat) {
    for (const p of peds) {
      if (p.down) continue;
      if (threat && threat.hot) {
        const d = Math.hypot(p.x - threat.x, p.y - threat.y);
        if (d < 175) { p.panic = Math.max(p.panic, 0.7); p.fleeX = threat.x; p.fleeY = threat.y; }
      }
      let mvx = 0, mvy = 0, sp = p.speed;
      if (p.panic > 0) {
        p.panic -= dt;
        const dx = p.x - (p.fleeX ?? p.x), dy = p.y - (p.fleeY ?? p.y);
        const d = Math.hypot(dx, dy) || 1;
        mvx = (dx / d) * 158; mvy = (dy / d) * 158; sp = 158;
      } else {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        if (d < 9) {
          p.wait -= dt;
          if (p.wait <= 0) { wanderTarget(p); p.wait = 1 + rand() * 3; }
        } else { mvx = (dx / d) * sp; mvy = (dy / d) * sp; }
      }
      if (mvx || mvy) {
        p.angle = Math.atan2(mvy, mvx);
        p.x += mvx * dt; p.y += mvy * dt;
        if (p.x > World.BEACH_X - 14) p.x = World.BEACH_X - 14; // nobody swims
        World.collideCircle(p, 9);
      }
    }
  }

  function drawPerson(ctx, x, y, angle, shirt, skin, down, hair) {
    const s = PEOPLE_DRAW_SCALE;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(15,20,10,0.30)';
    ctx.beginPath(); ctx.ellipse(3, 5, 11 * s * 0.62, 6 * s * 0.62, 0, 0, 7); ctx.fill();
    ctx.rotate(angle);
    if (down) {
      // sprawled: long body, head at one end, arms out
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.ellipse(0, 0, 13 * s * 0.72, 6.4 * s * 0.72, 0, 0, 7); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(12.4 * s * 0.72, 0, 4.4 * s * 0.72, 0, 7); ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(12.4 * s * 0.72, 0, 4.4 * s * 0.72, Math.PI * 0.6, Math.PI * 1.9); ctx.fill();
      ctx.strokeStyle = shirt; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(-3, -11); ctx.moveTo(2, 4); ctx.lineTo(-4, 10); ctx.stroke();
    } else {
      // shoulders + torso, head with a hair cap turned toward facing
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.ellipse(0, 0, 7.6 * s, 8.6 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath(); ctx.ellipse(-2.4 * s, 0, 4.6 * s, 6.4 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(1.2 * s, 0, 4.5 * s, 0, 7); ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(0.6 * s, 0, 4.5 * s, Math.PI * 0.45, Math.PI * 1.75); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(5.6 * s, 0, 1.5 * s, 0, 7); ctx.fill(); // nose tick
    }
    ctx.restore();
  }

  function drawPeds(ctx) {
    for (const p of peds) drawPerson(ctx, p.x, p.y, p.angle, p.shirt, p.skin, p.down, p.hair);
  }

  return { peds, spawnPeds, addPed, scatterFrom, hurt, update, drawPerson, drawPeds };
})();

// Jax himself: a body the game steers when he is out of a vehicle.
const PlayerBody = {
  x: 200, y: 200, angle: 0, punchAnim: 0, shirt: '#2fa39a', skin: '#c98d5f', hair: '#2b2118',
  move(input, dt) {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (mx || my) {
      const d = Math.hypot(mx, my);
      this.x += (mx / d) * 178 * dt;
      this.y += (my / d) * 178 * dt;
      if (this.x > World.BEACH_X - 12 && !World.onPier(this.x, this.y)) this.x = World.BEACH_X - 12;
      World.collideCircle(this, 10);
    }
    if (this.punchAnim > 0) this.punchAnim -= dt;
  },
  fist() {
    const reach = this.punchAnim > 0.08 ? 25 : 17;
    return { x: this.x + Math.cos(this.angle) * reach, y: this.y + Math.sin(this.angle) * reach };
  },
  draw(ctx) {
    People.drawPerson(ctx, this.x, this.y, this.angle, this.shirt, this.skin, false, this.hair);
    if (this.punchAnim > 0) {
      const f = this.fist();
      ctx.fillStyle = this.skin;
      ctx.beginPath(); ctx.arc(f.x, f.y, 4.6, 0, 7); ctx.fill();
    }
    // a thin gold ring so the player is never lost in a crowd
    ctx.strokeStyle = 'rgba(255,205,60,0.65)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, 15, 0, 7); ctx.stroke();
  },
};

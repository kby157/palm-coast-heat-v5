// helicopter.js — AIR-1, the police helicopter. At four stars it joins
// the hunt, hovering offset from the player so its searchlight pool sits
// squarely on him — and while that light holds, the heat on the ground
// barely cools.

const Helicopter = (() => {
  const state = { active: false, x: 1500, y: 900, angle: 0, rotor: 0, lightX: 0, lightY: 0, t: 0 };
  const isActive = () => state.active;

  function update(dt, player, stars) {
    state.t += dt;
    state.active = stars >= 4 || (state.active && stars >= 3.4);
    if (!state.active) return;
    state.lightX = player.x; state.lightY = player.y;   // the pool never leaves the player
    const orbit = state.t * 0.4;
    const tx = player.x + Math.cos(orbit) * 118, ty = player.y + Math.sin(orbit) * 118 - 30;
    const dx = tx - state.x, dy = ty - state.y, d = Math.hypot(dx, dy);
    if (d > 4) {
      const step = Math.min(d, 265 * dt);
      state.x += (dx / d) * step; state.y += (dy / d) * step;
      state.angle = Math.atan2(dy, dx);
    }
    state.rotor += dt * 42;
  }

  function draw(ctx, t) {
    if (!state.active) return;
    const { x, y, lightX, lightY } = state;
    // ground shadow, trailing behind the airframe
    ctx.fillStyle = 'rgba(15,20,30,0.28)';
    ctx.beginPath(); ctx.ellipse(x + 34, y + 52, 40, 15, 0.2, 0, Math.PI * 2); ctx.fill();
    // searchlight: cone from the lamp down to the pool on the player
    const pool = ctx.createRadialGradient(lightX, lightY, 8, lightX, lightY, 128);
    pool.addColorStop(0, 'rgba(255,242,190,0.34)'); pool.addColorStop(1, 'rgba(255,242,190,0)');
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.arc(lightX, lightY, 128, 0, Math.PI * 2); ctx.fill();
    const cone = ctx.createLinearGradient(x, y, lightX, lightY);
    cone.addColorStop(0, 'rgba(255,242,190,0.20)'); cone.addColorStop(1, 'rgba(255,242,190,0.03)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 6); ctx.lineTo(lightX - 60, lightY + 40); ctx.lineTo(lightX + 60, lightY + 40); ctx.lineTo(x + 8, y + 6);
    ctx.closePath(); ctx.fill();
    // airframe
    ctx.save(); ctx.translate(x, y); ctx.rotate(state.angle);
    ctx.strokeStyle = 'rgba(20,24,32,0.9)'; ctx.lineWidth = 5;   // tail boom
    ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-58, 0); ctx.stroke();
    ctx.fillStyle = '#39445a';
    ctx.fillRect(-62, -9, 6, 18);
    ctx.fillStyle = '#2c3542';                                    // fuselage, 1.3x hull
    ctx.beginPath(); ctx.ellipse(0, 0, 32, 14.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,205,240,0.9)';
    ctx.beginPath(); ctx.ellipse(17, 0, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e8ec';
    ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PD', -8, 0.5);
    ctx.strokeStyle = 'rgba(230,236,245,0.55)'; ctx.lineWidth = 2;  // tail rotor
    const tr = state.rotor * 2.2;
    ctx.beginPath();
    ctx.moveTo(-59, Math.sin(tr) * 8); ctx.lineTo(-59, -Math.sin(tr) * 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(15,18,24,0.85)'; ctx.lineWidth = 3.4;   // main rotor
    const ra = state.rotor;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ra) * 47, Math.sin(ra) * 47 * 0.28);
    ctx.lineTo(-Math.cos(ra) * 47, -Math.sin(ra) * 47 * 0.28);
    ctx.stroke();
    if (Math.floor(t * 2) % 2) {   // beacon
      ctx.fillStyle = '#ff4040';
      ctx.beginPath(); ctx.arc(-2, -13, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  return { state, isActive, update, draw };
})();

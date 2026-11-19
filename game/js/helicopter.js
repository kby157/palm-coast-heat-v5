// helicopter.js — AIR-1, the PCPD helicopter. Arrives at four stars, hangs
// off the player's shoulder and keeps its searchlight pool centred on him,
// which is why hiding stops working while it watches.
const Helicopter = (() => {
  const state = {
    active: false, x: 0, y: 0, angle: 0, t: 0,
    px: 0, py: 0,   // the player position the lamp is locked onto
  };

  const isActive = () => state.active;

  function update(dt, player, starsNow) {
    state.t += dt;
    state.px = player.x; state.py = player.y;
    if (starsNow >= 4) {
      if (!state.active) { state.active = true; state.x = player.x - 700; state.y = player.y - 520; }
      // hover offset: up-sun and to the left, lamp thrown onto the player
      const sway = Math.sin(state.t * 0.6) * 26;
      const tx = player.x - 118 + sway, ty = player.y - 96 + Math.cos(state.t * 0.45) * 18;
      const dx = tx - state.x, dy = ty - state.y, d = Math.hypot(dx, dy);
      const step = Math.min(d, 305 * dt);
      if (d > 1) { state.x += (dx / d) * step; state.y += (dy / d) * step; }
      state.angle = Math.atan2(player.y - state.y, player.x - state.x);
    } else if (state.active) {
      // called off: climb away to the north-west and vanish
      state.x -= 330 * dt; state.y -= 260 * dt;
      if (Math.hypot(state.x - player.x, state.y - player.y) > 1250) state.active = false;
    }
  }

  function drawShadow(ctx) {
    if (!state.active) return;
    ctx.fillStyle = 'rgba(12,14,20,0.20)';
    ctx.beginPath(); ctx.ellipse(state.x + 30, state.y + 40, 52, 20, state.angle, 0, 7); ctx.fill();
  }

  function drawSearchlight(ctx) {
    if (!state.active) return;
    // cone from the lamp to a warm pool centred exactly on the player
    const g = ctx.createRadialGradient(state.px, state.py, 8, state.px, state.py, 128);
    g.addColorStop(0, 'rgba(255,238,190,0.42)');
    g.addColorStop(0.75, 'rgba(255,226,160,0.20)');
    g.addColorStop(1, 'rgba(255,226,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(state.px, state.py, 128, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.10)';
    ctx.beginPath();
    ctx.moveTo(state.x, state.y);
    ctx.lineTo(state.px - 74, state.py + 40);
    ctx.lineTo(state.px + 74, state.py + 40);
    ctx.closePath(); ctx.fill();
  }

  function drawHelicopter(ctx, t) {
    if (!state.active) return;
    ctx.save(); ctx.translate(state.x, state.y); ctx.rotate(state.angle);
    // tail boom + fin
    ctx.fillStyle = '#dfe3e6';
    ctx.fillRect(-88, -4.5, 62, 9);
    ctx.fillStyle = '#2c4d7d';
    ctx.beginPath(); ctx.moveTo(-88, -13); ctx.lineTo(-76, 0); ctx.lineTo(-88, 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c8402f'; ctx.fillRect(-90, -2, 7, 4);
    // fuselage: a wide, unmistakable ellipse, nose to the right
    ctx.fillStyle = '#eef0f2';
    ctx.beginPath(); ctx.ellipse(0, 0, 43, 17.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(20,30,50,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2c4d7d';
    ctx.beginPath(); ctx.ellipse(2, 0, 40, 6.4, 0, 0, 7); ctx.fill();   // cheatline stripe
    // cockpit bubble
    ctx.fillStyle = '#18242f';
    ctx.beginPath(); ctx.ellipse(29, 0, 13.5, 11.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(170,215,240,0.55)';
    ctx.beginPath(); ctx.ellipse(33, -3, 7, 5.4, -0.4, 0, 7); ctx.fill();
    // skids
    ctx.strokeStyle = '#3a3f45'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-26, -21); ctx.lineTo(30, -21); ctx.moveTo(-26, 21); ctx.lineTo(30, 21);
    ctx.moveTo(-8, -14); ctx.lineTo(-8, -21); ctx.moveTo(14, -14); ctx.lineTo(14, -21);
    ctx.moveTo(-8, 14); ctx.lineTo(-8, 21); ctx.moveTo(14, 14); ctx.lineTo(14, 21);
    ctx.stroke();
    ctx.fillStyle = '#18242f'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('PD', -8, 3.5);
    ctx.restore();
    // rotor disc above everything: translucent disc + blurred blade sweep
    ctx.save(); ctx.translate(state.x, state.y);
    ctx.fillStyle = 'rgba(210,220,228,0.13)';
    ctx.beginPath(); ctx.arc(0, 0, 54, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(230,238,244,0.30)'; ctx.lineWidth = 3;
    const ra = t * 31;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ra) * -52, Math.sin(ra) * -52); ctx.lineTo(Math.cos(ra) * 52, Math.sin(ra) * 52);
    ctx.moveTo(Math.cos(ra + Math.PI / 2) * -52, Math.sin(ra + Math.PI / 2) * -52);
    ctx.lineTo(Math.cos(ra + Math.PI / 2) * 52, Math.sin(ra + Math.PI / 2) * 52);
    ctx.stroke();
    ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
    ctx.restore();
  }

  function draw(ctx, t) { drawHelicopter(ctx, t); }

  return { state, isActive, update, drawShadow, drawSearchlight, drawHelicopter, draw };
})();

// hud.js — every piece of chrome on the screen: cash panel, stars, weapon
// strip, speedometer, PCPD response panel, dialogue card, location card,
// bust meter and the minimap. game.js hands over one snapshot per frame;
// nothing here reaches back into game state.
const Hud = (() => {
  const el = {};
  const cache = {};
  let mini = null, slotsBuilt = false;

  function grab() {
    if (el.cash) return;
    for (const id of ['cash', 'healthfill', 'vehicle', 'stars', 'objective', 'weapons', 'radio',
      'progress', 'respect', 'bustwrap', 'bustfill', 'prompt', 'speed', 'speed-num', 'speed-name',
      'police', 'location', 'dialogue', 'dlg-name', 'dlg-line', 'dlg-port', 'minimap', 'hud-weapon-line']) {
      el[id] = document.getElementById(id);
    }
    if (el.minimap) mini = el.minimap.getContext('2d');
  }
  function set(id, text) {
    if (cache[id] === text) return;
    cache[id] = text;
    if (el[id]) el[id].textContent = text;
  }
  function setHTML(id, html) {
    if (cache['h:' + id] === html) return;
    cache['h:' + id] = html;
    if (el[id]) el[id].innerHTML = html;
  }

  const GIVER_COLORS = { 'Marlo': '#3f7fbf', 'Vera': '#7a4fa3', 'Dee': '#c22f6d', 'Salty': '#2fa39a', 'Mr. Lark': '#8a6fb8', 'Dispatch': '#5d7a8a' };

  function buildSlots() {
    if (slotsBuilt || !el.weapons) return;
    slotsBuilt = true;
    el.weapons.innerHTML = Weapons.ORDER.map((key, i) => {
      const d = Weapons.DEFS[key];
      return `<div class="wslot" id="wslot-${key}"><div class="wkey">${i + 1}</div>` +
        `<div class="wname">${d.name}</div><div class="wsub" id="wsub-${key}"></div></div>`;
    }).join('');
    for (const key of Weapons.ORDER) { el['slot-' + key] = document.getElementById('wslot-' + key); el['sub-' + key] = document.getElementById('wsub-' + key); }
  }

  function update(snap) {
    grab(); buildSlots();
    set('cash', '$' + snap.cash);
    set('progress', snap.progress);
    set('respect', snap.respectText);
    set('vehicle', snap.vehicleText);
    set('radio', snap.radioText || '');
    if (el.healthfill) el.healthfill.style.width = Math.max(0, Math.min(100, snap.health)) + '%';
    if (el.healthfill) el.healthfill.style.background = snap.health < 30 ? '#e0483c' : 'linear-gradient(90deg,#e06428,#f2a03c)';
    setHTML('stars', '★'.repeat(snap.stars) + '<span class="dim">' + '★'.repeat(5 - snap.stars) + '</span>');
    // objective line with a ticking clock when the step is timed
    let obj = snap.objective.text;
    if (snap.objective.time != null) {
      const s = Math.max(0, Math.ceil(snap.objective.time));
      obj += ` ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    set('objective', obj);
    set('prompt', snap.prompt || '');
    if (el.prompt) el.prompt.style.opacity = snap.prompt ? '1' : '0';
    // weapon strip
    for (const key of Weapons.ORDER) {
      const d = Weapons.DEFS[key], a = Weapons.state.ammo[key], owned = Weapons.state.owned[key];
      const slot = el['slot-' + key];
      if (slot) {
        const cls = 'wslot' + (key === Weapons.state.current ? ' current' : '') + (owned ? '' : ' locked');
        if (cache['cls:' + key] !== cls) { cache['cls:' + key] = cls; slot.className = cls; }
      }
      set('sub-' + key, owned ? `${a.mag} / ${a.res}` : '$' + d.price);
    }
    set('hud-weapon-line', snap.onFoot ? Weapons.hudText() : '');
    // speedometer
    if (el.speed) {
      const show = snap.speedKmh != null;
      if (cache.speedShow !== show) { cache.speedShow = show; el.speed.style.opacity = show ? '1' : '0'; }
      if (show) { set('speed-num', String(Math.round(snap.speedKmh))); set('speed-name', snap.speedName || ''); }
    }
    // police response panel
    if (el.police) {
      if (snap.stars > 0 && snap.units.length) {
        const rows = snap.units.map((u) =>
          `<div class="urow"><span class="ulabel">${u.label}</span><span class="urole">${u.role}</span><span class="udist">${u.dist} m</span></div>`).join('');
        setHTML('police', `<div class="phead">PCPD RESPONSE</div>` + rows);
        el.police.style.opacity = '1';
      } else el.police.style.opacity = '0';
    }
    // bust meter
    if (el.bustwrap) {
      const show = snap.bust > 0.02;
      if (cache.bustShow !== show) { cache.bustShow = show; el.bustwrap.style.opacity = show ? '1' : '0'; }
      if (el.bustfill) el.bustfill.style.width = (snap.bust * 100) + '%';
    }
    // location + dialogue cards
    set('location', snap.location || '');
    if (el.location) el.location.style.opacity = snap.location ? '1' : '0';
    if (el.dialogue) {
      const d = snap.dialogue;
      if (d) {
        el.dialogue.style.opacity = '1';
        set('dlg-name', d.name.toUpperCase());
        set('dlg-line', d.line);
        set('dlg-port', d.name.trim()[0].toUpperCase());
        if (el['dlg-port']) el['dlg-port'].style.background = GIVER_COLORS[d.name] || '#b5524a';
      } else el.dialogue.style.opacity = '0';
    }
  }

  function minimap(snap) {
    grab();
    if (!mini) return;
    const c = mini, MW = 220, MH = 165, sx = MW / World.W, sy = MH / World.H;
    c.fillStyle = '#2c4630'; c.fillRect(0, 0, MW, MH);
    c.fillStyle = '#256a94'; c.fillRect(World.WATER_X * sx, 0, (World.W - World.WATER_X) * sx, MH);
    c.fillStyle = '#d9bd85'; c.fillRect(World.BEACH_X * sx, 0, (World.WATER_X - World.BEACH_X) * sx, MH);
    c.strokeStyle = '#7d7d84'; c.lineWidth = 3;
    c.beginPath();
    for (const a of World.AVENUES) { c.moveTo(a * sx, 0); c.lineTo(a * sx, MH); }
    for (const s of World.STREETS) { c.moveTo(0, s * sy); c.lineTo(MW, s * sy); }
    c.stroke();
    c.fillStyle = 'rgba(20,26,20,0.5)';
    for (const b of World.buildings) c.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    c.strokeStyle = '#a87f52'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(World.BEACH_X * sx, World.PIER_Y * sy); c.lineTo(World.PIER_END_X * sx, World.PIER_Y * sy); c.stroke();
    // robbery rings still worth hitting
    c.fillStyle = '#ffc528';
    for (const s of snap.shops) c.fillRect(s.x * sx - 2, s.y * sy - 2, 4, 4);
    // boats
    c.fillStyle = '#eef2f4';
    for (const b of snap.boats) c.fillRect(b.x * sx - 2, b.y * sy - 2, 4, 4);
    // police: flashing red/blue dots
    const phase = Math.floor(snap.t * 3) % 2;
    for (const u of snap.cruisers) {
      c.fillStyle = phase ? '#ff5040' : '#5d8dff';
      c.beginPath(); c.arc(u.x * sx, u.y * sy, 3, 0, 7); c.fill();
    }
    if (snap.heli) {
      c.fillStyle = '#ffd60a';
      c.save(); c.translate(snap.heli.x * sx, snap.heli.y * sy); c.rotate(Math.PI / 4);
      c.fillRect(-3.4, -3.4, 6.8, 6.8); c.restore();
    }
    // mission marker: a pulsing gold ring
    if (snap.objective.x != null) {
      const r = 5 + Math.sin(snap.t * 4) * 1.6;
      c.strokeStyle = '#ffc528'; c.lineWidth = 2;
      c.beginPath(); c.arc(snap.objective.x * sx, snap.objective.y * sy, r, 0, 7); c.stroke();
    }
    // the player: a white arrow that turns with him
    c.save();
    c.translate(snap.player.x * sx, snap.player.y * sy); c.rotate(snap.player.angle);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(6, 0); c.lineTo(-4.4, -3.8); c.lineTo(-4.4, 3.8); c.closePath(); c.fill();
    c.restore();
  }

  return { update, minimap };
})();

// hud.js — the whole instrument panel. This module owns every HUD DOM
// node and the minimap canvas: game.js hands it one snapshot object per
// frame and it writes only what changed. It also owns the banner screen
// and the timed dialogue / location cards.

const Hud = (() => {
  const el = (id) => document.getElementById(id);
  const N = {
    cash: el('cash'), healthfill: el('healthfill'), vehicle: el('vehicle'),
    stars: el('stars'), objective: el('objective'), weapon: el('weapon'),
    weapons: document.querySelector('#weapons .slots'), radio: el('radio'), progress: el('progress'),
    respect: el('respect'), bustwrap: el('bustwrap'), bustfill: el('bustfill'),
    prompt: el('prompt'), speed: el('speed'), speedNum: el('speed-num'), speedName: el('speed-name'),
    police: el('police'), policeRows: document.querySelector('#police .prows'), location: el('location'),
    dialogue: el('dialogue'), dlgName: el('dlg-name'), dlgLine: el('dlg-line'), dlgFace: el('dlg-face'),
    banner: el('banner-screen'), bannerTitle: el('banner-title'), bannerSub: el('banner-sub'),
    mute: el('mute'),
  };
  const mini = el('minimap').getContext('2d');
  const cache = {};
  function setText(node, key, str) {
    if (cache[key] !== str) { cache[key] = str; node.textContent = str; }
  }
  function setHTML(node, key, str) {
    if (cache[key] !== str) { cache[key] = str; node.innerHTML = str; }
  }
  function setShow(node, key, on) {
    const v = on ? 'on' : 'off';
    if (cache[key] !== v) { cache[key] = v; node.classList.toggle('on', on); }
  }

  let bannerUntil = -1, locationUntil = -1, lastLocation = '';

  function banner(title, sub, bad) {
    N.bannerTitle.textContent = title;
    N.bannerSub.textContent = sub || '';
    N.banner.classList.toggle('bad', !!bad);
    N.banner.classList.add('on');
    bannerUntil = performance.now() / 1000 + 2.6;
  }

  const ROLE_TONES = { PURSUING: '#ffb347', RAMMING: '#ff5d5d', SEARCHING: '#9fb7c9',
    ROADBLOCK: '#ff8c42', SPOTLIGHT: '#ffe066' };
  const FACE_TONES = ['#c95d4a', '#3f7fbf', '#53a08a', '#c2a24d', '#8a6fb8', '#d84a6a'];

  function fmtTime(sec) {
    if (sec === null || sec === undefined) return '';
    const s = Math.ceil(sec);
    return ' ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function update(snap) {
    const tNow = performance.now() / 1000;
    setText(N.cash, 'cash', '$' + snap.cash);
    const hp = Math.max(0, Math.round(snap.health));
    if (cache.hp !== hp) { cache.hp = hp; N.healthfill.style.width = hp + '%'; }
    setText(N.vehicle, 'vehicle', snap.vehicleLine);
    setText(N.stars, 'stars', '★'.repeat(snap.stars) + '☆'.repeat(5 - snap.stars));
    N.stars.style.opacity = snap.stars ? '1' : '0.35';
    setText(N.objective, 'objective', snap.objectiveText + fmtTime(snap.objectiveTime));
    setText(N.weapon, 'weapon', snap.weaponText || '');
    setText(N.radio, 'radio', snap.radioText || '');
    setText(N.progress, 'progress', snap.progressText);
    setText(N.respect, 'respect', snap.respectText);

    // weapon strip: three slots, owned / current / locked
    const ws = snap.weaponsState;
    const strip = Weapons.defs.map((d) => {
      const a = ws.ammo[d.id];
      const owned = ws.owned[d.id];
      const cls = !owned ? 'slot locked' : (ws.current === d.id ? 'slot current' : 'slot');
      const foot = owned ? a.mag + ' / ' + a.reserve : '$' + d.price;
      return `<div class="${cls}"><span class="wkey">${d.key}</span><span class="wname">${d.name}</span><span class="wammo">${foot}</span></div>`;
    }).join('');
    setHTML(N.weapons, 'strip', strip);

    // bust bar
    setShow(N.bustwrap, 'bust', snap.bust > 0.01);
    if (snap.bust > 0.01) N.bustfill.style.width = Math.round(snap.bust * 100) + '%';

    setText(N.prompt, 'prompt', snap.promptText || '');
    setShow(N.prompt, 'promptOn', !!snap.promptText);

    // speedometer
    setShow(N.speed, 'speedOn', snap.speedKmh !== null && snap.speedKmh !== undefined);
    if (snap.speedKmh !== null && snap.speedKmh !== undefined) {
      setText(N.speedNum, 'speedNum', String(snap.speedKmh));
      setText(N.speedName, 'speedName', snap.speedName || '');
    }

    // police response panel
    const units = snap.stars > 0 ? (snap.policeUnits || []) : [];
    setShow(N.police, 'policeOn', units.length > 0);
    if (units.length) {
      const rows = units.slice(0, 4).map((u) =>
        `<div class="prow"><span class="plabel">${u.label}</span><span class="prole" style="color:${ROLE_TONES[u.role] || '#fff'}">${u.role}</span><span class="pdist">${u.dist} m</span></div>`).join('');
      setHTML(N.policeRows, 'policeRows', rows);
    }

    // location card: names where you are; it re-announces on change and
    // then stays up as a quiet area label
    if (snap.locationName && snap.locationName !== lastLocation) {
      lastLocation = snap.locationName;
      locationUntil = tNow + 3;
      setText(N.location, 'location', snap.locationName);
    }
    setShow(N.location, 'locationOn', !!lastLocation);

    // dialogue card: driven by the snapshot's own clock (game time)
    const dlg = snap.dialogue;
    const dlgOn = !!(dlg && snap.time < dlg.until);
    setShow(N.dialogue, 'dlgOn', dlgOn);
    if (dlgOn) {
      setText(N.dlgName, 'dlgName', dlg.giver);
      setText(N.dlgLine, 'dlgLine', dlg.line);
      let h = 0;
      for (const ch of dlg.giver) h = (h * 31 + ch.charCodeAt(0)) % 997;
      N.dlgFace.textContent = dlg.giver.replace('Mr. ', '').charAt(0);
      N.dlgFace.style.background = FACE_TONES[h % FACE_TONES.length];
    }

    // banner lifetime
    if (bannerUntil > 0 && tNow > bannerUntil) {
      N.banner.classList.remove('on');
      bannerUntil = -1;
    }
    setText(N.mute, 'mute', 'Sound: ' + (AudioSys.isMuted() ? 'off' : 'on'));
  }

  // ---- minimap ---------------------------------------------------------------
  function minimap(snap) {
    const c = mini, MW = 220, MH = 165;
    const sx = MW / World.W, sy = MH / World.H;
    c.fillStyle = '#2f6a99'; c.fillRect(0, 0, MW, MH);                       // water
    c.fillStyle = '#51703f'; c.fillRect(0, 0, World.BEACH_X * sx, MH);       // land
    c.fillStyle = '#d9c184'; c.fillRect(World.BEACH_X * sx, 0, (World.WATER_X - World.BEACH_X) * sx, MH); // sand
    c.fillStyle = '#5d5d66';                                                 // lots
    for (const l of World.lots) c.fillRect(l.x * sx, l.y * sy, l.w * sx, l.h * sy);
    c.fillStyle = '#42563a';                                                 // building blocks
    for (const b of World.buildings) c.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    c.strokeStyle = '#8f8f99'; c.lineWidth = 2.4;                            // roads, mid-grey
    for (const a of World.AVENUES) { c.beginPath(); c.moveTo(a * sx, 0); c.lineTo(a * sx, MH); c.stroke(); }
    for (const s of World.STREETS) { c.beginPath(); c.moveTo(0, s * sy); c.lineTo(World.BEACH_X * sx, s * sy); c.stroke(); }
    c.strokeStyle = '#8a6844'; c.lineWidth = 2;                              // pier
    c.beginPath(); c.moveTo(World.BEACH_X * sx, World.PIER_Y * sy); c.lineTo(World.PIER_END_X * sx, World.PIER_Y * sy); c.stroke();
    c.fillStyle = '#ffc840';                                                 // robbery shops
    for (const p of snap.shops) c.fillRect(p.x * sx - 2, p.y * sy - 2, 4, 4);
    c.fillStyle = '#ffffff';                                                 // boats
    for (const b of snap.boats) c.fillRect(b.x * sx - 2, b.y * sy - 2, 4, 4);
    const blink = Math.floor(snap.time * 2.4) % 2 === 0;
    c.fillStyle = blink ? '#5f8dff' : '#bcd2ff';                             // police blips
    for (const car of snap.cruisers) { c.beginPath(); c.arc(car.x * sx, car.y * sy, 2.6, 0, Math.PI * 2); c.fill(); }
    for (const b of snap.roadblocks) { c.fillRect(b.x * sx - 2.4, b.y * sy - 2.4, 4.8, 4.8); }
    if (snap.heli && snap.heli.active) {                                     // AIR-1 diamond
      c.save(); c.translate(snap.heli.x * sx, snap.heli.y * sy); c.rotate(Math.PI / 4);
      c.fillStyle = '#ffe066'; c.fillRect(-3, -3, 6, 6); c.restore();
    }
    if (snap.objective && snap.objective.x !== null && snap.objective.x !== undefined) {
      const ox = snap.objective.x * sx, oy = snap.objective.y * sy;
      const pulse = 4.6 + Math.sin(snap.time * 4) * 1.3;
      c.strokeStyle = '#ffc840'; c.lineWidth = 2;
      c.beginPath(); c.arc(ox, oy, pulse, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffc840'; c.fillRect(ox - 1.4, oy - 1.4, 2.8, 2.8);
    }
    // player arrow
    c.save(); c.translate(snap.px * sx, snap.py * sy); c.rotate(snap.pangle);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(6, 0); c.lineTo(-4.4, -3.8); c.lineTo(-4.4, 3.8); c.closePath(); c.fill();
    c.restore();
  }

  return { update, minimap, banner };
})();

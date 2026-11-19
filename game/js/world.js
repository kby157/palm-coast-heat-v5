// world.js — Palm Coast itself: the street grid, the named buildings and
// parking lots between the roads, the beach and the pier, and every brush
// stroke that paints them. Layout is generated once from a seeded RNG so
// the city is identical on every load. Rendering is layered — terrain,
// then buildings, then props, then water — and World.draw() calls the
// layers in that order.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const World = (() => {
  const W = 3200, H = 2400;
  const ROAD_HALF = 60;
  const AVENUES = [280, 820, 1360, 1900, 2440];   // north-south road centres
  const STREETS = [320, 880, 1440, 2000];          // east-west road centres
  const BEACH_X = 2740;                            // sand starts here
  const WATER_X = 2950;                            // open water starts here
  const PIER_Y = 1240;                             // the pier crosses the water here
  const PIER_END_X = 3140;                         // ...and ends out at sea

  const rand = mulberry32(20261119);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- city plan -------------------------------------------------------
  // Blocks are the rectangles left between the roads. Each block holds one
  // named building (inset, with a pavement ring) or a parking lot.
  const colX = [[16, 204], [356, 744], [896, 1284], [1436, 1824], [1976, 2364], [2516, 2724]];
  const rowY = [[16, 244], [396, 804], [956, 1364], [1516, 1924], [2076, 2384]];
  const PLAN = [
    ['Vista Offices', 'Hotel Miramar', 'Palm Mall', 'Azure Condos', 'Palm Coast PD', 'Palm Court 1'],
    ["Marlo's Diner", 'Harbor Chandlery', 'The Breakers Hotel', 'Kelvin Motors', 'Seabreeze School', null],
    ['Sunset Bakery', 'Tidal Records', 'Neptune Gym', 'Casa Azul Flats', 'The Salty Anchor', 'Marina Parking'],
    ['Gilded Flamingo', 'Palm Coast Library', null, 'Hotel Sol', 'Dockside Warehouse', null],
    ['Oceanview Clinic', 'Coco Loco Club', 'Port Authority', null, null, null],
  ];
  const ROOF_TONES = ['#c96f4a', '#b5524a', '#d9a05a', '#8a6fb8', '#4a7fb5', '#53a08a',
    '#c2a24d', '#a85f7d', '#5d8a99', '#cf8452', '#7d9b76', '#b56a41'];
  const SIGN_TONES = ['#ffd60a', '#ff5d8f', '#37e0c8', '#ffb347', '#e8f4ff', '#ff7847'];

  const buildings = [];   // {x,y,w,h,name,roof,sign,furn:[{dx,dy,w,h,kind}]}
  const lots = [];        // {x,y,w,h,stalls}
  let toneIdx = 0;
  for (let r = 0; r < rowY.length; r++) {
    for (let c = 0; c < colX.length; c++) {
      const [x0, x1] = colX[c], [y0, y1] = rowY[r];
      const name = PLAN[r][c];
      if (name) {
        const b = { x: x0 + 26, y: y0 + 26, w: (x1 - x0) - 52, h: (y1 - y0) - 52, name,
          roof: ROOF_TONES[toneIdx++ % ROOF_TONES.length],
          sign: SIGN_TONES[Math.floor(rand() * SIGN_TONES.length)], furn: [] };
        const pieces = 3 + Math.floor(rand() * 4);
        for (let i = 0; i < pieces; i++) {
          b.furn.push({ dx: 14 + rand() * (b.w - 60), dy: 14 + rand() * (b.h - 50),
            w: 22 + rand() * 30, h: 16 + rand() * 22, kind: rand() < 0.3 ? 'tank' : 'box' });
        }
        buildings.push(b);
      } else {
        const lot = { x: x0 + 10, y: y0 + 10, w: (x1 - x0) - 20, h: (y1 - y0) - 20, stalls: [] };
        for (let sx = lot.x + 18; sx < lot.x + lot.w - 30; sx += 34) lot.stalls.push(sx);
        lots.push(lot);
      }
    }
  }

  // Street dressing: palms and lamps along the roads, umbrellas on the sand.
  const palms = [], lamps = [], umbrellas = [];
  for (const ax of AVENUES) for (let y = 60; y < H - 40; y += 168 + rand() * 60) {
    palms.push({ x: ax - ROAD_HALF - 13, y: y + rand() * 30 });
    if (rand() < 0.6) palms.push({ x: ax + ROAD_HALF + 13, y: y + 90 + rand() * 30 });
  }
  for (const sy of STREETS) for (let x = 120; x < BEACH_X - 40; x += 300 + rand() * 60)
    lamps.push({ x: x + rand() * 30, y: sy - ROAD_HALF - 10 });
  for (const ax of AVENUES) for (const sy of STREETS) {
    lamps.push({ x: ax - ROAD_HALF - 10, y: sy - ROAD_HALF - 10 });
    lamps.push({ x: ax + ROAD_HALF + 10, y: sy + ROAD_HALF + 10 });
  }
  for (let i = 0; i < 26; i++)
    umbrellas.push({ x: BEACH_X + 34 + rand() * (WATER_X - BEACH_X - 70),
      y: 60 + rand() * (H - 120), tone: SIGN_TONES[Math.floor(rand() * SIGN_TONES.length)] });
  for (let i = 0; i < 12; i++)
    palms.push({ x: BEACH_X + 26 + rand() * 130, y: 60 + rand() * (H - 120) });

  // ---- geometry queries --------------------------------------------------
  function buildingNamed(name) { return buildings.find((b) => b.name === name) || null; }

  function doorstep(b) {
    if (!b) return { x: 400, y: 420 };
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const spots = [
      { x: cx, y: b.y + b.h + 17 }, { x: cx, y: b.y - 17 },
      { x: b.x - 17, y: cy }, { x: b.x + b.w + 17, y: cy },
    ];
    let best = spots[0], bestScore = Infinity;
    for (const s of spots) {
      let d = Infinity;
      for (const a of AVENUES) d = Math.min(d, Math.abs(s.x - a));
      for (const st of STREETS) d = Math.min(d, Math.abs(s.y - st));
      if (d < bestScore) { bestScore = d; best = s; }
    }
    return { x: clamp(best.x, 20, W - 20), y: clamp(best.y, 20, H - 20) };
  }

  function onRoad(x, y) {
    if (x > BEACH_X + 30) return false;
    for (const a of AVENUES) if (Math.abs(x - a) < ROAD_HALF) return true;
    for (const s of STREETS) if (Math.abs(y - s) < ROAD_HALF) return true;
    return false;
  }
  function onPier(x, y) { return Math.abs(y - PIER_Y) <= 17 && x >= BEACH_X - 6 && x <= PIER_END_X; }
  function inWater(x, y) { return x >= WATER_X && !onPier(x, y); }

  function buildingAt(x, y) {
    for (const b of buildings)
      if (x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2) return b;
    return null;
  }

  // Push a circle out of every building it overlaps; returns the deepest
  // penetration resolved (0 when nothing was touched).
  function collideCircle(p, r) {
    let depth = 0;
    for (const b of buildings) {
      const nx = clamp(p.x, b.x, b.x + b.w), ny = clamp(p.y, b.y, b.y + b.h);
      let dx = p.x - nx, dy = p.y - ny;
      let d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;
      if (d2 < 0.0001) { // centre inside the rect: leave by the shortest side
        const left = p.x - b.x, right = b.x + b.w - p.x, top = p.y - b.y, bot = b.y + b.h - p.y;
        const m = Math.min(left, right, top, bot);
        if (m === left) p.x = b.x - r; else if (m === right) p.x = b.x + b.w + r;
        else if (m === top) p.y = b.y - r; else p.y = b.y + b.h + r;
        depth = Math.max(depth, r);
        continue;
      }
      const d = Math.sqrt(d2), push = r - d;
      p.x += (dx / d) * push; p.y += (dy / d) * push;
      depth = Math.max(depth, push);
    }
    p.x = clamp(p.x, r, W - r); p.y = clamp(p.y, r, H - r);
    return depth;
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
    const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
    const b = clamp(Math.round((n & 255) * f), 0, 255);
    return `rgb(${r},${g},${b})`;
  }
  const inView = (view, x, y, pad) => x > view.x0 - pad && x < view.x1 + pad && y > view.y0 - pad && y < view.y1 + pad;

  // ---- paint layers --------------------------------------------------------
  function drawTerrain(ctx, view) {
    ctx.fillStyle = '#75975a';
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    // mow stripes for a little life on the grass
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (let x = Math.floor(view.x0 / 130) * 130; x < view.x1; x += 260) ctx.fillRect(x, view.y0, 130, view.y1 - view.y0);
    // beach sand
    ctx.fillStyle = '#ecd39a';
    ctx.fillRect(BEACH_X, view.y0, WATER_X - BEACH_X, view.y1 - view.y0);
    ctx.fillStyle = 'rgba(190,150,80,0.25)';
    ctx.fillRect(BEACH_X, view.y0, 7, view.y1 - view.y0);
    // pavements then asphalt for every road
    for (const a of AVENUES) {
      ctx.fillStyle = '#b3a78d'; ctx.fillRect(a - ROAD_HALF - 13, view.y0, (ROAD_HALF + 13) * 2, view.y1 - view.y0);
      ctx.fillStyle = '#494952'; ctx.fillRect(a - ROAD_HALF, view.y0, ROAD_HALF * 2, view.y1 - view.y0);
    }
    for (const s of STREETS) {
      ctx.fillStyle = '#b3a78d'; ctx.fillRect(view.x0, s - ROAD_HALF - 13, BEACH_X + 30 - view.x0, (ROAD_HALF + 13) * 2);
      ctx.fillStyle = '#494952'; ctx.fillRect(view.x0, s - ROAD_HALF, BEACH_X + 30 - view.x0, ROAD_HALF * 2);
    }
    // centre dashes
    ctx.fillStyle = '#e8c85a';
    for (const a of AVENUES) for (let y = Math.floor(view.y0 / 64) * 64; y < view.y1; y += 64) ctx.fillRect(a - 3, y, 6, 34);
    for (const s of STREETS) for (let x = Math.floor(view.x0 / 64) * 64; x < Math.min(view.x1, BEACH_X + 30); x += 64) ctx.fillRect(x, s - 3, 34, 6);
    // zebra crossings at intersections
    ctx.fillStyle = 'rgba(240,240,235,0.75)';
    for (const a of AVENUES) for (const s of STREETS) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(a - ROAD_HALF - 4, s + i * 22 - 6, 10, 12);
        ctx.fillRect(a + ROAD_HALF - 6, s + i * 22 - 6, 10, 12);
        ctx.fillRect(a + i * 22 - 6, s - ROAD_HALF - 4, 12, 10);
        ctx.fillRect(a + i * 22 - 6, s + ROAD_HALF - 6, 12, 10);
      }
    }
  }

  function drawBuildings(ctx, view) {
    for (const lot of lots) {
      if (!inView(view, lot.x + lot.w / 2, lot.y + lot.h / 2, Math.max(lot.w, lot.h))) continue;
      ctx.fillStyle = '#5d5d66'; ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      for (const sx of lot.stalls) { ctx.beginPath(); ctx.moveTo(sx, lot.y + 12); ctx.lineTo(sx, lot.y + lot.h - 12); ctx.stroke(); }
    }
    for (const b of buildings) {
      if (!inView(view, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
      // drop shadow, parapet, roof field
      ctx.fillStyle = 'rgba(30,20,10,0.30)'; ctx.fillRect(b.x + 9, b.y + 12, b.w, b.h);
      ctx.fillStyle = shade(b.roof, 0.72); ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
      ctx.fillStyle = b.roof; ctx.fillRect(b.x, b.y, b.w, b.h);
      // window dots catching the low sun
      ctx.fillStyle = 'rgba(255,236,170,0.5)';
      for (let wx = b.x + 16; wx < b.x + b.w - 10; wx += 26)
        for (let wy = b.y + 16; wy < b.y + b.h - 10; wy += 26) ctx.fillRect(wx, wy, 7, 7);
      // roof furniture
      for (const f of b.furn) {
        ctx.fillStyle = f.kind === 'tank' ? '#8b93a0' : shade(b.roof, 0.8);
        ctx.fillRect(b.x + f.dx, b.y + f.dy, f.w, f.h);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(b.x + f.dx, b.y + f.dy + f.h - 4, f.w, 4);
      }
      // lit sign board along the top edge
      ctx.font = '700 15px system-ui, sans-serif';
      const tw = Math.min(ctx.measureText(b.name.toUpperCase()).width + 18, b.w - 8);
      ctx.fillStyle = 'rgba(16,14,20,0.88)';
      ctx.fillRect(b.x + (b.w - tw) / 2, b.y + 5, tw, 22);
      ctx.fillStyle = b.sign; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + 16.5, tw - 10);
    }
  }

  function drawProps(ctx, view, t) {
    for (const p of palms) {
      if (!inView(view, p.x, p.y, 40)) continue;
      ctx.fillStyle = 'rgba(30,40,20,0.25)';
      ctx.beginPath(); ctx.ellipse(p.x + 9, p.y + 11, 15, 6, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y + 8); ctx.lineTo(p.x, p.y - 6); ctx.stroke();
      ctx.strokeStyle = '#3e8e4f'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.sin(t * 0.7 + p.x) * 0.05;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 6);
        ctx.quadraticCurveTo(p.x + Math.cos(a) * 11, p.y - 12, p.x + Math.cos(a) * 17, p.y - 5 + Math.abs(Math.sin(a)) * 5);
        ctx.stroke();
      }
    }
    for (const l of lamps) {
      if (!inView(view, l.x, l.y, 30)) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 26);
      g.addColorStop(0, 'rgba(255,214,130,0.55)'); g.addColorStop(1, 'rgba(255,214,130,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(l.x, l.y, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    for (const u of umbrellas) {
      if (!inView(view, u.x, u.y, 30)) continue;
      ctx.fillStyle = 'rgba(120,90,40,0.3)'; ctx.beginPath(); ctx.ellipse(u.x + 4, u.y + 5, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = u.tone; ctx.beginPath(); ctx.arc(u.x, u.y, 11, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#8a6a45'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x, u.y + 8); ctx.stroke();
    }
  }

  function drawWater(ctx, view, t) {
    const grad = ctx.createLinearGradient(WATER_X, 0, W, 0);
    grad.addColorStop(0, '#3d7ca8'); grad.addColorStop(0.35, '#2f6a99'); grad.addColorStop(1, '#1f4d78');
    ctx.fillStyle = grad;
    ctx.fillRect(WATER_X, view.y0, W - WATER_X, view.y1 - view.y0);
    // sun glitter lane
    ctx.fillStyle = 'rgba(255,214,140,0.20)';
    ctx.fillRect(WATER_X + 64, view.y0, 44, view.y1 - view.y0);
    ctx.fillStyle = 'rgba(255,230,170,0.35)';
    for (let y = Math.floor(view.y0 / 46) * 46; y < view.y1; y += 46) {
      const wob = Math.sin(t * 1.4 + y * 0.05) * 9;
      ctx.fillRect(WATER_X + 78 + wob, y + ((y / 46) % 2) * 12, 20, 3);
    }
    // drifting wave strokes
    ctx.strokeStyle = 'rgba(220,240,255,0.35)'; ctx.lineWidth = 2;
    for (let y = Math.floor(view.y0 / 92) * 92; y < view.y1; y += 92)
      for (let x = WATER_X + 30 + ((y / 92) % 3) * 60; x < view.x1; x += 190) {
        const bob = Math.sin(t * 0.9 + x * 0.02 + y) * 4;
        ctx.beginPath(); ctx.arc(x + bob, y, 13, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      }
    // the pier: deck, posts, bollards, lit sign
    ctx.fillStyle = 'rgba(20,30,50,0.35)'; ctx.fillRect(BEACH_X, PIER_Y - 12, PIER_END_X - BEACH_X + 26, 34);
    ctx.fillStyle = '#8a6844'; ctx.fillRect(BEACH_X, PIER_Y - 15, PIER_END_X - BEACH_X + 20, 30);
    ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.lineWidth = 2;
    for (let x = BEACH_X + 8; x < PIER_END_X + 16; x += 26) { ctx.beginPath(); ctx.moveTo(x, PIER_Y - 15); ctx.lineTo(x, PIER_Y + 15); ctx.stroke(); }
    ctx.fillStyle = '#5d452a';
    for (let x = BEACH_X + 16; x < PIER_END_X; x += 52) { ctx.fillRect(x, PIER_Y - 21, 7, 7); ctx.fillRect(x, PIER_Y + 14, 7, 7); }
    ctx.fillStyle = 'rgba(16,14,20,0.9)'; ctx.fillRect(BEACH_X + 6, PIER_Y - 44, 168, 24);
    ctx.fillStyle = '#37e0c8'; ctx.font = '700 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PALM COAST PIER', BEACH_X + 90, PIER_Y - 31.5);
  }

  function draw(ctx, view, t) {
    drawTerrain(ctx, view);
    drawBuildings(ctx, view);
    drawProps(ctx, view, t);
    drawWater(ctx, view, t);
    // golden-hour grade over the whole scene
    ctx.fillStyle = 'rgba(255,150,60,0.055)';
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    const cx = (view.x0 + view.x1) / 2, cy = (view.y0 + view.y1) / 2;
    const rad = Math.max(view.x1 - view.x0, view.y1 - view.y0) * 0.72;
    const vg = ctx.createRadialGradient(cx, cy, rad * 0.45, cx, cy, rad);
    vg.addColorStop(0, 'rgba(40,16,60,0)'); vg.addColorStop(1, 'rgba(40,16,60,0.20)');
    ctx.fillStyle = vg; ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  }

  return { W, H, ROAD_HALF: ROAD_HALF, AVENUES, STREETS, WATER_X, BEACH_X, PIER_Y, PIER_END_X,
    buildings, lots, buildingNamed, doorstep, clamp, onRoad, inWater, onPier, collideCircle, buildingAt, draw };
})();

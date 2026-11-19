// world.js — Palm Coast itself: city generation and every layer of its rendering.
// Loaded first because it also defines mulberry32, the seeded RNG the whole
// game shares so the city is identical on every visit.
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
  const W = 3200, H = 2400, ROAD_HALF = 60;
  const AVENUES = [280, 820, 1360, 1900, 2440];   // vertical road centres (x)
  const STREETS = [320, 880, 1440, 2000];        // horizontal road centres (y)
  const BEACH_X = 2740;                          // sand starts here
  const WATER_X = 2950;                          // open water starts here
  const PIER_Y = 1240;                           // the pier crosses the water here
  const PIER_END_X = 3140;                       // ...and ends out at sea

  const rand = mulberry32(20261119);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  // ---- city plan -----------------------------------------------------------
  // Blocks live in the rectangles the road grid leaves behind.
  const colEdges = [0, AVENUES[0] - ROAD_HALF, AVENUES[0] + ROAD_HALF, AVENUES[1] - ROAD_HALF,
    AVENUES[1] + ROAD_HALF, AVENUES[2] - ROAD_HALF, AVENUES[2] + ROAD_HALF, AVENUES[3] - ROAD_HALF,
    AVENUES[3] + ROAD_HALF, AVENUES[4] - ROAD_HALF, AVENUES[4] + ROAD_HALF, BEACH_X];
  const rowEdges = [0, STREETS[0] - ROAD_HALF, STREETS[0] + ROAD_HALF, STREETS[1] - ROAD_HALF,
    STREETS[1] + ROAD_HALF, STREETS[2] - ROAD_HALF, STREETS[2] + ROAD_HALF, STREETS[3] - ROAD_HALF,
    STREETS[3] + ROAD_HALF, H];
  const blocks = [];
  for (let c = 0; c < 6; c++) for (let r = 0; r < 5; r++) {
    blocks.push({
      x: colEdges[c * 2] + 14, y: rowEdges[r * 2] + 14,
      w: colEdges[c * 2 + 1] - colEdges[c * 2] - 28,
      h: rowEdges[r * 2 + 1] - rowEdges[r * 2] - 28, col: c, row: r,
    });
  }

  const ROOF_TONES = ['#b5524a', '#c96f4a', '#8a6fb8', '#4a7fb5', '#53a08a', '#c2a24d',
    '#a85f7d', '#5d8a5a', '#bf7a3c', '#6a7fb0', '#96684f', '#7a9a8c'];
  const SIGN_TONES = ['#ffd60a', '#ff5d8f', '#37e0c8', '#ffb347', '#e8f4ff', '#ff7847'];
  // The named places the rest of the game looks up, in assignment order.
  const NAMED = ["Marlo's Diner", 'Palm Mall', 'Marina Parking', 'Dockside Warehouse',
    'Hotel Sol', 'Casa Azul Flats', 'Harbor Chandlery', 'Sunset Bakery', 'Tidal Records',
    'Gilded Flamingo', 'Palm Coast Library', 'Neptune Gym', 'Port Authority', 'Kelvin Motors',
    'Hotel Miramar', 'Seabreeze School', 'The Salty Anchor', 'Vista Offices', 'Coco Loco Club',
    'The Breakers Hotel', 'Azure Condos', 'Palm Court 1', 'Palm Coast PD', 'Oceanview Clinic'];
  const FILLER = ['Coral Suites', 'Flamingo Court', 'Sail Lofts', 'Marina Walk', 'Vista Del Mar',
    'Ocean Breeze Inn', 'The Palms Hotel', 'Coral Court', 'Sunset Terrace', 'Harbor View Flats'];

  const buildings = [];
  blocks.forEach((blk, i) => {
    const name = i < NAMED.length ? NAMED[i] : FILLER[(i - NAMED.length) % FILLER.length];
    const isLot = name === 'Marina Parking';
    const roof = pick(ROOF_TONES);
    const furniture = [];
    const nF = 3 + Math.floor((blk.w * blk.h) / 52000) + Math.floor(rand() * 3);
    for (let k = 0; k < nF; k++) {
      furniture.push({
        dx: 18 + rand() * Math.max(20, blk.w - 90), dy: 18 + rand() * Math.max(20, blk.h - 90),
        w: 22 + rand() * 42, h: 18 + rand() * 34,
        kind: pick(['ac', 'ac', 'vent', 'skylight', 'tank', 'pool']),
      });
    }
    buildings.push({
      x: blk.x, y: blk.y, w: blk.w, h: blk.h, name, lot: isLot,
      roof, roofDark: shade(roof, 0.78), rim: shade(roof, 1.22),
      sign: pick(SIGN_TONES), furniture,
      trim: pick(['#e8dcc8', '#d8e4ea', '#efe0b8', '#e6d2c0']),
    });
  });

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
    const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
    const b = clamp(Math.round((n & 255) * f), 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function buildingNamed(name) { return buildings.find((b) => b.name === name) || null; }
  function buildingAt(x, y) {
    return buildings.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  }
  // A sidewalk point just outside the building, preferring the south face.
  function doorstep(b) {
    if (!b) return { x: 200, y: 200 };
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const tries = [
      { x: cx, y: b.y + b.h + 16 }, { x: cx, y: b.y - 16 },
      { x: b.x + b.w + 16, y: cy }, { x: b.x - 16, y: cy },
      { x: cx, y: b.y + b.h + 34 }, { x: b.x + b.w + 34, y: cy },
    ];
    for (const p of tries) {
      if (p.x > 24 && p.x < BEACH_X - 10 && p.y > 24 && p.y < H - 24 && !buildingAt(p.x, p.y)) return p;
    }
    return { x: cx, y: b.y + b.h + 16 };
  }

  const onRoad = (x, y) =>
    AVENUES.some((a) => Math.abs(x - a) < ROAD_HALF) || STREETS.some((s) => Math.abs(y - s) < ROAD_HALF);
  const inWater = (x, y) => x >= WATER_X;
  const onPier = (x, y) => Math.abs(y - PIER_Y) <= 16 && x >= BEACH_X - 6 && x <= PIER_END_X;

  function collideCircle(p, r) {
    p.x = clamp(p.x, 16, W - 16); p.y = clamp(p.y, 16, H - 16);
    for (const b of buildings) {
      if (b.lot) continue;
      const nx = clamp(p.x, b.x, b.x + b.w), ny = clamp(p.y, b.y, b.y + b.h);
      const dx = p.x - nx, dy = p.y - ny, d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2); p.x = nx + (dx / d) * r; p.y = ny + (dy / d) * r;
      } else {
        // centre inside the rect: leave by the shortest face
        const left = p.x - b.x, right = b.x + b.w - p.x, top = p.y - b.y, bot = b.y + b.h - p.y;
        const m = Math.min(left, right, top, bot);
        if (m === left) p.x = b.x - r; else if (m === right) p.x = b.x + b.w + r;
        else if (m === top) p.y = b.y - r; else p.y = b.y + b.h + r;
      }
    }
    return p;
  }

  // ---- static decoration, decided once ------------------------------------
  const palms = [], lamps = [], beachKit = [], grassSpecks = [];
  for (const a of AVENUES) for (let y = 90; y < H - 60; y += 235) {
    if (rand() < 0.8) palms.push({ x: a - ROAD_HALF - 13, y: y + rand() * 50, s: 0.85 + rand() * 0.4 });
    if (rand() < 0.5) lamps.push({ x: a + ROAD_HALF + 9, y: y + 110 + rand() * 40 });
  }
  for (const s of STREETS) for (let x = 120; x < BEACH_X - 80; x += 260) {
    if (rand() < 0.7) palms.push({ x: x + rand() * 46, y: s + ROAD_HALF + 13, s: 0.85 + rand() * 0.4 });
    if (rand() < 0.45) lamps.push({ x: x + 120, y: s - ROAD_HALF - 9 });
  }
  for (let i = 0; i < 26; i++) palms.push({ x: BEACH_X + 26 + rand() * 150, y: 60 + rand() * (H - 120), s: 0.9 + rand() * 0.5 });
  for (let i = 0; i < 30; i++) beachKit.push({ x: BEACH_X + 30 + rand() * 160, y: 60 + rand() * (H - 120), c: pick(SIGN_TONES), kind: rand() < 0.55 ? 'umbrella' : 'towel' });
  for (let i = 0; i < 260; i++) grassSpecks.push({ x: rand() * BEACH_X, y: rand() * H, r: 2 + rand() * 5 });

  // ---- rendering, in layers ------------------------------------------------
  function view(cam) {
    return { l: cam.x - cam.hw, r: cam.x + cam.hw, t: cam.y - cam.hh, b: cam.y + cam.hh };
  }
  const seen = (v, x, y, m) => x > v.l - m && x < v.r + m && y > v.t - m && y < v.b + m;

  function drawTerrain(ctx, cam, t) {
    const v = view(cam);
    ctx.fillStyle = '#55803f';                       // city grass
    ctx.fillRect(v.l, v.t, v.r - v.l, v.b - v.t);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (const g of grassSpecks) if (seen(v, g.x, g.y, 8)) ctx.fillRect(g.x, g.y, g.r, g.r);
    // beach sand
    ctx.fillStyle = '#e3c98f';
    ctx.fillRect(BEACH_X, v.t, WATER_X - BEACH_X, v.b - v.t);
    ctx.fillStyle = 'rgba(160,120,60,0.18)';
    for (let y = 40; y < H; y += 90) ctx.fillRect(BEACH_X, y, WATER_X - BEACH_X, 3);
    // roads
    ctx.fillStyle = '#3d3d42';
    for (const a of AVENUES) ctx.fillRect(a - ROAD_HALF, v.t, ROAD_HALF * 2, v.b - v.t);
    for (const s of STREETS) ctx.fillRect(v.l, s - ROAD_HALF, v.r - v.l, ROAD_HALF * 2);
    // sidewalks
    ctx.fillStyle = '#8f8c84';
    for (const a of AVENUES) { ctx.fillRect(a - ROAD_HALF - 7, v.t, 7, v.b - v.t); ctx.fillRect(a + ROAD_HALF, v.t, 7, v.b - v.t); }
    for (const s of STREETS) { ctx.fillRect(v.l, s - ROAD_HALF - 7, v.r - v.l, 7); ctx.fillRect(v.l, s + ROAD_HALF, v.r - v.l, 7); }
    // lane dashes
    ctx.fillStyle = '#e8c33c';
    for (const a of AVENUES) for (let y = Math.floor(v.t / 64) * 64; y < v.b; y += 64) ctx.fillRect(a - 2, y, 4, 34);
    for (const s of STREETS) for (let x = Math.floor(v.l / 64) * 64; x < v.r; x += 64) ctx.fillRect(x, s - 2, 34, 4);
    // zebra crossings at every junction
    ctx.fillStyle = 'rgba(240,240,235,0.75)';
    for (const a of AVENUES) for (const s of STREETS) {
      if (!seen(v, a, s, 130)) continue;
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(a - ROAD_HALF - 4, s + k * 22 - 6, 8, 13);
        ctx.fillRect(a + ROAD_HALF - 4, s + k * 22 - 6, 8, 13);
        ctx.fillRect(a + k * 22 - 6, s - ROAD_HALF - 4, 13, 8);
        ctx.fillRect(a + k * 22 - 6, s + ROAD_HALF - 4, 13, 8);
      }
    }
  }

  function drawWater(ctx, cam, t) {
    const v = view(cam);
    const grad = ctx.createLinearGradient(WATER_X, 0, W + 260, 0);
    grad.addColorStop(0, '#2f7ea6'); grad.addColorStop(0.45, '#256a94'); grad.addColorStop(1, '#17456b');
    ctx.fillStyle = grad;
    ctx.fillRect(WATER_X, v.t, Math.max(0, v.r - WATER_X), v.b - v.t);
    if (v.r > W) { ctx.fillStyle = '#17456b'; ctx.fillRect(W, v.t, v.r - W, v.b - v.t); }
    // sun-glitter lane
    ctx.fillStyle = 'rgba(255,214,120,0.20)';
    for (let y = Math.floor(v.t / 46) * 46; y < v.b; y += 46) {
      const wob = Math.sin(t * 1.7 + y * 0.05) * 9;
      ctx.fillRect(WATER_X + 118 + wob, y, 66, 5);
    }
    // wave strokes
    ctx.strokeStyle = 'rgba(220,240,250,0.35)'; ctx.lineWidth = 2.4; ctx.beginPath();
    for (let gx = WATER_X + 36; gx < Math.min(v.r, W); gx += 118) {
      for (let gy = Math.floor(v.t / 118) * 118; gy < v.b; gy += 118) {
        const ox = Math.sin(t * 0.9 + gy * 0.11 + gx) * 6;
        ctx.moveTo(gx + ox - 15, gy + 30); ctx.quadraticCurveTo(gx + ox, gy + 20, gx + ox + 15, gy + 30);
      }
    }
    ctx.stroke();
    // the pier: planks, bollards, lit sign
    const pw = PIER_END_X - BEACH_X;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(BEACH_X, PIER_Y - 13 + 7, pw, 26);
    ctx.fillStyle = '#8a6844'; ctx.fillRect(BEACH_X, PIER_Y - 13, pw, 26);
    ctx.strokeStyle = 'rgba(60,38,18,0.55)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = BEACH_X + 16; x < PIER_END_X; x += 26) { ctx.moveTo(x, PIER_Y - 13); ctx.lineTo(x, PIER_Y + 13); }
    ctx.stroke();
    ctx.fillStyle = '#5d4429';
    for (let x = BEACH_X + 12; x < PIER_END_X; x += 52) {
      ctx.beginPath(); ctx.arc(x, PIER_Y - 16, 4.4, 0, 7); ctx.arc(x, PIER_Y + 16, 4.4, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#20242e';
    const sw = 168; ctx.fillRect(BEACH_X + 26, PIER_Y - 44, sw, 24);
    ctx.fillStyle = '#37e0c8'; ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PALM COAST PIER', BEACH_X + 26 + sw / 2, PIER_Y - 31);
  }

  function drawBuildings(ctx, cam, t) {
    const v = view(cam);
    for (const b of buildings) {
      if (!seen(v, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
      ctx.fillStyle = 'rgba(20,16,10,0.30)';                       // long dusk shadow
      ctx.fillRect(b.x + 13, b.y + 16, b.w, b.h);
      if (b.lot) {
        ctx.fillStyle = '#4a4a50'; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(240,240,235,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = b.x + 26; x < b.x + b.w - 8; x += 34) { ctx.moveTo(x, b.y + 12); ctx.lineTo(x, b.y + 44); }
        for (let y = b.y + 62; y < b.y + b.h - 8; y += 52) { ctx.moveTo(b.x + 12, y); ctx.lineTo(b.x + b.w - 12, y); }
        ctx.stroke();
      } else {
        ctx.fillStyle = b.roof; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = b.roofDark; ctx.fillRect(b.x + 13, b.y + 13, b.w - 26, b.h - 26);
        ctx.fillStyle = b.roof; ctx.fillRect(b.x + 26, b.y + 26, b.w - 52, b.h - 52);
        ctx.strokeStyle = b.rim; ctx.lineWidth = 5; ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
        for (const f of b.furniture) {
          const fx = b.x + f.dx, fy = b.y + f.dy;
          if (f.kind === 'ac') {
            ctx.fillStyle = '#9aa0a4'; ctx.fillRect(fx, fy, f.w, f.h);
            ctx.fillStyle = '#787e82'; ctx.fillRect(fx, fy, f.w, 5);
          } else if (f.kind === 'vent') {
            ctx.fillStyle = '#6d7276'; ctx.beginPath(); ctx.arc(fx + f.w / 2, fy + f.h / 2, f.w / 3, 0, 7); ctx.fill();
            ctx.fillStyle = '#565b5e'; ctx.beginPath(); ctx.arc(fx + f.w / 2, fy + f.h / 2, f.w / 6, 0, 7); ctx.fill();
          } else if (f.kind === 'pool') {
            ctx.fillStyle = '#7fc4d8'; ctx.fillRect(fx, fy, f.w + 14, f.h + 8);
            ctx.fillStyle = '#a8dcea'; ctx.fillRect(fx + 4, fy + 4, f.w + 6, f.h);
          } else if (f.kind === 'skylight') {
            ctx.fillStyle = '#bfe0ea'; ctx.fillRect(fx, fy, f.w, f.h);
            ctx.strokeStyle = '#7d99a4'; ctx.lineWidth = 2; ctx.strokeRect(fx, fy, f.w, f.h);
          } else {
            ctx.fillStyle = '#8a5c38'; ctx.beginPath(); ctx.arc(fx + f.w / 2, fy + f.h / 2, f.w / 2, 0, 7); ctx.fill();
            ctx.fillStyle = '#6d4525'; ctx.beginPath(); ctx.moveTo(fx, fy + f.h / 2); ctx.lineTo(fx + f.w / 2, fy - 7); ctx.lineTo(fx + f.w, fy + f.h / 2); ctx.fill();
          }
        }
      }
      // lit sign chip on the street edge, name in readable letters
      ctx.font = 'bold 13px system-ui, sans-serif';
      const tw = Math.min(ctx.measureText(b.name.toUpperCase()).width + 18, b.w - 8);
      const sx = b.x + (b.w - tw) / 2, sy = b.y + b.h - 21;
      ctx.fillStyle = 'rgba(16,18,24,0.88)'; ctx.fillRect(sx, sy, tw, 19);
      ctx.fillStyle = b.sign; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, sy + 10, b.w - 16);
    }
  }

  function drawProps(ctx, cam, t) {
    const v = view(cam);
    for (const p of palms) {
      if (!seen(v, p.x, p.y, 60)) continue;
      ctx.fillStyle = 'rgba(20,30,10,0.28)';
      ctx.beginPath(); ctx.ellipse(p.x + 11, p.y + 13, 15 * p.s, 6 * p.s, 0.5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 3.4 * p.s;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + 3, p.y - 7, p.x + 6, p.y - 11); ctx.stroke();
      ctx.strokeStyle = '#3f7d33'; ctx.lineWidth = 2.6 * p.s; ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.4;
        ctx.moveTo(p.x + 6, p.y - 11);
        ctx.quadraticCurveTo(p.x + 6 + Math.cos(a) * 11 * p.s, p.y - 11 + Math.sin(a) * 6 * p.s - 3,
          p.x + 6 + Math.cos(a) * 17 * p.s, p.y - 11 + Math.sin(a) * 10 * p.s + 3);
      }
      ctx.stroke();
    }
    for (const l of lamps) {
      if (!seen(v, l.x, l.y, 60)) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 30);
      g.addColorStop(0, 'rgba(255,196,90,0.5)'); g.addColorStop(1, 'rgba(255,196,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, 30, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.arc(l.x, l.y, 3.2, 0, 7); ctx.fill();
    }
    for (const bk of beachKit) {
      if (!seen(v, bk.x, bk.y, 40)) continue;
      if (bk.kind === 'umbrella') {
        ctx.fillStyle = 'rgba(120,90,40,0.3)'; ctx.beginPath(); ctx.ellipse(bk.x + 5, bk.y + 6, 13, 6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = bk.c; ctx.beginPath(); ctx.arc(bk.x, bk.y, 12, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bk.x, bk.y); ctx.lineTo(bk.x + 2, bk.y + 8); ctx.stroke();
      } else {
        ctx.fillStyle = bk.c; ctx.fillRect(bk.x - 9, bk.y - 5, 18, 10);
      }
    }
  }

  function draw(ctx, cam, t) {
    drawTerrain(ctx, cam, t);
    drawWater(ctx, cam, t);
    drawBuildings(ctx, cam, t);
    drawProps(ctx, cam, t);
    // golden-hour grade: warm heart, dusky violet edges
    const v = view(cam);
    const g = ctx.createRadialGradient(cam.x, cam.y, Math.min(cam.hw, cam.hh) * 0.35,
      cam.x, cam.y, Math.max(cam.hw, cam.hh) * 1.25);
    g.addColorStop(0, 'rgba(255,170,80,0.07)');
    g.addColorStop(0.7, 'rgba(120,60,90,0.05)');
    g.addColorStop(1, 'rgba(38,20,66,0.26)');
    ctx.fillStyle = g; ctx.fillRect(v.l, v.t, v.r - v.l, v.b - v.t);
  }

  return {
    W, H, AVENUES, STREETS, WATER_X, BEACH_X, PIER_Y, PIER_END_X,
    buildings, buildingNamed, buildingAt, doorstep,
    clamp, onRoad, inWater, onPier, collideCircle, draw,
  };
})();

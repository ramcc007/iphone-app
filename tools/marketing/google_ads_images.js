// Google Ads image assets for NumFall (run from the repo root: FONT=design/icon/Fredoka.woff2 node tools/marketing/google_ads_images.js).
// Writes design/marketing/google-ads/<concept>-<shape>.jpg at Google's recommended sizes:
// landscape 1200x628, square 1200x1200, portrait 1200x1500.
// Each concept gives the viewer a small task (find the number, beat the clock, compare levels).
// Policy-minded: real game boards and rules, no fake buttons, no borders or collages, no unprovable claims.
const { chromium } = require('playwright'); const fs = require('fs');
const font = fs.readFileSync(process.env.FONT).toString('base64');

// Tile colours match the game (prototype/web/index.html TILE).
const COL = { 1: ['#FF6B7A', '#FF97A2', '#C94656'], 2: ['#FFB547', '#FFCF85', '#C9862A'], 3: ['#F5E663', '#FAF29A', '#BFB244'],
  4: ['#6EE7A8', '#A0F2C6', '#3FB27A'], 5: ['#4FC3F7', '#8ADAFB', '#2E8DB8'], 6: ['#9D8CFF', '#BDB2FF', '#6F5ED1'],
  7: ['#FF8AD8', '#FFB3E6', '#C25CA6'], 8: ['#2DD4BF', '#7EE6D7', '#1E9E8E'], 9: ['#C0C7D6', '#DDE1EA', '#8A91A3'],
  G: ['#2A2F45', '#353B57', '#1D2134'] };

const tile = (v, s, kind, extra = '') => {
  const box = `width:${s}px;height:${s}px;border-radius:${s * 0.27}px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:${s * 0.58}px;line-height:1;flex:none;${extra}`;
  if (kind === 'empty') return `<div style="${box};border:${Math.max(1, s * 0.03)}px dashed rgba(255,255,255,.14);background:#1A1E2E"></div>`;
  if (kind === 'q') return `<div style="${box};border:${s * 0.06}px solid #FFE45C;color:#FFE45C;font-weight:700;background:rgba(255,228,92,.12);box-shadow:0 0 ${s * 0.5}px rgba(255,228,92,.75),inset 0 0 ${s * 0.3}px rgba(255,228,92,.35)">?</div>`;
  const [c, l, e] = kind === 'given' ? COL.G : COL[v] || COL[2];
  return `<div style="${box};background:linear-gradient(180deg,${l},${c} 60%);color:${kind === 'given' ? '#E6E9F2' : '#13161F'};font-weight:${kind === 'given' ? 500 : 600};box-shadow:inset 0 ${s * 0.04}px 0 rgba(255,255,255,${kind === 'given' ? .07 : .45}),0 ${s * 0.07}px 0 ${e}">${v}</div>`;
};

// cells[r][c] = [value, kind]; kind: 'player' | 'given' | 'empty' | 'q'
function board(cells, s, bw, bh) {
  const n = cells.length, g = s * 0.12, bg = s * 0.14, pad = s * 0.2;
  let rows = '';
  for (let r = 0; r < n; r++) {
    let row = '';
    for (let c = 0; c < n; c++) row += `<div style="margin-left:${c === 0 ? 0 : g + (c % bw === 0 ? bg : 0)}px">${tile(cells[r][c][0], s, cells[r][c][1])}</div>`;
    rows += `<div style="display:flex;margin-top:${r === 0 ? 0 : g + (r % bh === 0 ? bg : 0)}px">${row}</div>`;
  }
  return `<div style="padding:${pad}px;border-radius:${s * 0.45}px;background:#151826;box-shadow:0 ${s * 0.5}px ${s * 1.4}px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06);display:inline-block">${rows}</div>`;
}
const boardW = (n, s, bw) => n * s + (n - 1) * s * 0.12 + (n / bw - 1) * s * 0.14 + 2 * s * 0.2;

// Gravity: column c holds numbers in its bottom heights[c] rows.
function cellsFrom(sol, heights, opts = {}) {
  const n = sol.length;
  return sol.map((row, r) => row.map((v, c) => {
    const key = `${r},${c}`;
    if (opts.q && opts.q.includes(key)) return ['?', 'q'];
    if (r < n - heights[c]) return ['', 'empty'];
    return [v, opts.given && opts.given.includes(key) ? 'given' : 'player'];
  }));
}

// --- Puzzles (all valid: each row, column and box holds each number once) ---
const SOL4 = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]];
const SOL6 = [[1, 2, 3, 4, 5, 6], [4, 5, 6, 1, 2, 3], [2, 3, 1, 5, 6, 4], [5, 6, 4, 2, 3, 1], [3, 1, 2, 6, 4, 5], [6, 4, 5, 3, 1, 2]];
const SOL9 = [...Array(9)].map((_, r) => [...Array(9)].map((_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1));
// Concept A: the ? in row 2 must be 4 (its row already has 3, 1 and 2).
const findIt = cellsFrom(SOL4, [3, 2, 4, 3], { q: ['1,1'], given: ['2,0', '3,2', '0,2'] });
// Concept B: two glowing gaps, a red clock.
const clock = cellsFrom(SOL6, [6, 5, 6, 4, 6, 5], { q: ['0,1', '1,3'], given: ['5,0', '3,2', '4,4', '2,5', '5,3'] });
// Concept C: level 1 vs level 100.
const easy = cellsFrom(SOL4, [4, 4, 3, 4], { q: ['1,2'], given: ['3,0', '2,3'] });
const hard = cellsFrom(SOL9, [8, 6, 9, 5, 8, 7, 6, 8, 7], { q: ['2,1', '3,3'], given: ['8,0', '7,2', '6,4', '8,5', '5,6', '7,7', '8,8', '4,4', '6,0', '8,3'] });

const brand = (k) => `<div style="display:flex;align-items:center;gap:${k * 0.35}px">
  <div style="position:relative;width:${k * 1.1}px;height:${k * 1.1}px;flex:none">
    <div style="position:absolute;left:${k * 0.57}px;top:0">${tile('', k * 0.5, 'player', `background:linear-gradient(180deg,#FFCF85,#FFB547 60%);box-shadow:none`)}</div>
    <div style="position:absolute;left:0;top:${k * 0.57}px">${tile('', k * 0.5, 'player', `background:linear-gradient(180deg,#8ADAFB,#4FC3F7 60%);box-shadow:none`)}</div>
    <div style="position:absolute;left:${k * 0.57}px;top:${k * 0.57}px">${tile('', k * 0.5, 'given', 'box-shadow:none')}</div>
  </div>
  <div style="line-height:1"><div style="font-size:${k}px;font-weight:600;color:#fff">NumFall</div>
  <div style="font-size:${k * 0.42}px;color:#C9C4F2;margin-top:${k * 0.12}px">iPhone &amp; iPad</div></div></div>`;

const arrow = (w, rot, flip) => `<svg width="${w}" height="${w * 0.7}" viewBox="0 0 100 70" style="transform:rotate(${rot}deg)${flip ? ' scaleX(-1)' : ''};filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))">
  <path d="M6 12 C 40 2, 78 14, 86 52" fill="none" stroke="#FFE45C" stroke-width="7" stroke-linecap="round"/>
  <path d="M70 44 L 87 58 L 95 37" fill="none" stroke="#FFE45C" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const timer = (k) => `<div style="display:inline-flex;align-items:center;gap:${k * 0.25}px;padding:${k * 0.12}px ${k * 0.42}px ${k * 0.12}px ${k * 0.3}px;border-radius:${k}px;background:linear-gradient(180deg,#FF6B7A,#E23C52);box-shadow:0 ${k * 0.1}px 0 #A3283A,0 0 ${k * 0.9}px rgba(255,80,100,.7);color:#fff">
  <svg width="${k * 0.72}" height="${k * 0.72}" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8.5" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M12 13V8.5M9.5 2.5h5" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>
  <span style="font-size:${k}px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1">0:03</span></div>`;

const hl = (t) => t.replace(/\[(.+?)\]/g, '<span style="color:#FFE45C">$1</span>');

function page(w, h, body, glow = '#6B5CF0') {
  // Soft confetti tiles in the background (deterministic).
  const R = i => { const x = Math.sin(i * 91.7 + 13.1) * 43758.5; return x - Math.floor(x); };
  let deco = '';
  for (let i = 0; i < 14; i++) {
    const sz = 22 + R(i + 3) * 30, x = R(i) * w, y = R(i + 40) * h;
    deco += `<div style="position:absolute;left:${x - sz / 2}px;top:${y - sz / 2}px;opacity:.22;filter:blur(1.5px);transform:rotate(${(R(i + 9) - .5) * 50}deg)">${tile('', sz, 'player', `background:${COL[1 + i % 9][0]};box-shadow:none`)}</div>`;
  }
  return `<html><head><style>@font-face{font-family:F;font-weight:300 700;src:url(data:font/woff2;base64,${font})}
  body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:F;position:relative;color:#fff;
  background:radial-gradient(${Math.max(w, h) * 0.55}px at 50% 52%,${glow}88 0%,transparent 70%),radial-gradient(${w * 0.6}px at 10% 0%,#3B2A8C 0%,transparent 70%),linear-gradient(160deg,#1E1650,#0D0B22)}
  .h{font-weight:700;line-height:1.02;letter-spacing:-0.01em;text-shadow:0 4px 18px rgba(0,0,0,.45)}</style></head>
  <body>${deco}${body}</body></html>`;
}

// ---- Concepts: each returns HTML for a given shape ----
const abs = (x, y, inner, extra = '') => `<div style="position:absolute;left:${x}px;top:${y}px;${extra}">${inner}</div>`;
const centreX = (w, bwPx) => (w - bwPx) / 2;

const concepts = {
  'find-the-number'(w, h, shape) {
    const head = hl('Which number<br>goes [here?]');
    if (shape === 'landscape') {
      const s = 44, bW = boardW(4, s, 2);
      return page(w, h, abs(46, (h - bW) / 2, board(findIt, s, 2, 2))
        + abs(330, 62, `<div class="h" style="font-size:44px">${head}</div>`) + abs(330, 220, brand(34)));
    }
    const s = shape === 'square' ? 62 : 70, bW = boardW(4, s, 2), top = shape === 'square' ? 196 : 250;
    return page(w, h, abs(40, 38, `<div class="h" style="font-size:${shape === 'square' ? 58 : 64}px">${head}</div>`)
      + abs(centreX(w, bW), top, board(findIt, s, 2, 2)) + abs(shape === 'square' ? 88 : 78, top + (shape === 'square' ? 28 : 18), arrow(150, 0))
      + abs(40, h - 82, brand(40)));
  },
  'beat-the-clock'(w, h, shape) {
    const head = hl('2 gaps. [3 seconds.]<br>Go!');
    if (shape === 'landscape') {
      const s = 30, bW = boardW(6, s, 3);
      return page(w, h, abs(46, (h - bW) / 2 - 4, board(clock, s, 3, 2)) + abs(316, 50, timer(46))
        + abs(316, 128, `<div class="h" style="font-size:36px">${head}</div>`) + abs(316, 240, brand(30)), '#E23C52');
    }
    const s = shape === 'square' ? 40 : 50, bW = boardW(6, s, 3), top = shape === 'square' ? 224 : 290;
    return page(w, h, abs(40, 40, timer(shape === 'square' ? 54 : 60))
      + abs(40, shape === 'square' ? 120 : 136, `<div class="h" style="font-size:${shape === 'square' ? 46 : 52}px">${head}</div>`)
      + abs(centreX(w, bW), top, board(clock, s, 3, 2)) + abs(40, h - (shape === 'square' ? 64 : 66), brand(shape === 'square' ? 30 : 36)), '#E23C52');
  },
  'level-1-vs-100'(w, h, shape) {
    const label = (t, k, c) => `<div style="text-align:center;font-size:${k}px;font-weight:700;color:${c};margin-top:${k * 0.4}px">${t}</div>`;
    const pair = (s4, s9, k) => `<div style="display:flex;align-items:flex-end;gap:${k * 1.2}px">
      <div>${board(easy, s4, 2, 2)}${label('Level 1', k, '#6EE7A8')}</div>
      <div>${board(hard, s9, 3, 3)}${label('Level 100', k, '#FF6B7A')}</div></div>`;
    if (shape === 'landscape') {
      return page(w, h, abs(40, 30, `<div class="h" style="font-size:34px">${hl('It starts [easy…]')}</div>`)
        + abs(40, 88, pair(26, 16.5, 17)) + abs(w - 196, 34, brand(26)));
    }
    const sq = shape === 'square';
    return page(w, h, abs(40, 40, `<div class="h" style="font-size:${sq ? 56 : 62}px">${hl('It starts<br>[easy…]')}</div>`)
      + abs(40, sq ? 220 : 280, pair(sq ? 38 : 40, sq ? 24 : 26, sq ? 22 : 24)) + abs(40, h - (sq ? 70 : 80), brand(sq ? 34 : 40)));
  },
};

const shapes = { landscape: [600, 314], square: [600, 600], portrait: [600, 750] };
(async () => {
  const dir = 'design/marketing/google-ads';
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch();
  const only = process.argv[2];
  for (const [name, fn] of Object.entries(concepts)) for (const [shape, [w, h]] of Object.entries(shapes)) {
    if (only && !name.startsWith(only)) continue;
    const pg = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage();
    await pg.setContent(fn(w, h, shape)); await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: `${dir}/${name}-${shape}-${w * 2}x${h * 2}.jpg`, type: 'jpeg', quality: 92 });
  }
  await b.close();
})();

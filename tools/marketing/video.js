// Short vertical videos (1080x1920, 30 fps, MP4) for TikTok, Instagram Reels and YouTube Shorts.
// They replay real NumFall levels with the real rule (a number falls to the lowest empty cell in its column)
// in the app's own colours, tiles and font. No sound: add music in the TikTok/Instagram editor.
// Run from the repo root: NODE_PATH=$(npm root -g) FONT=design/icon/Fredoka.woff2 node tools/marketing/video.js [name]
// Output: design/marketing/video-<name>.mp4
const { chromium } = require('playwright');
const fs = require('fs');
const { spawn } = require('child_process');
global.window = {};
require('../../prototype/web/levels.js');
const LEVELS = {};
for (const b of window.NUMFALL_BOARDS) for (const l of b.levels) LEVELS[l.id] = l;
const font = fs.readFileSync(process.env.FONT).toString('base64');
const FPS = 30, W = 540, H = 960;   // CSS pixels; rendered at 2x

// ---- Timelines -------------------------------------------------------------------------------
// Steps: { at, drop: [col, value] } for a drop (wrong when value is not the solution there),
// { at, caption }, { at, label }, { at, level: id, prefill: n } to switch board, { at, ghost: true }, { at, stars: 3 }, { at, end: true }.
// Times are seconds. Drops land in the lowest empty cell of their column, exactly like the game.
function solveOrder(level, filled) {
  // Every gap, column by column from the bottom up: a valid order under gravity.
  const n = level.size, g = level.givens.map(r => r.slice()), out = [];
  for (const [r, c] of filled || []) g[r][c] = level.solution[r][c];
  let more = true;
  while (more) {
    more = false;
    for (let c = 0; c < n; c++) {
      let r = n - 1; while (r >= 0 && g[r][c]) r--;
      if (r >= 0) { out.push([r, c, level.solution[r][c]]); g[r][c] = level.solution[r][c]; more = true; }
    }
  }
  return out;
}

function gravityVideo() {
  const L = LEVELS['quick-003'], moves = solveOrder(L), s = [];
  s.push({ at: 0, level: L.id, timer: L.timeLimit }, { at: 0, caption: 'This puzzle has <b>gravity</b>.' });
  let t = 1.4;
  s.push({ at: t, drop: [moves[0][1], moves[0][2]] }); t += 1.0;
  s.push({ at: t, drop: [moves[1][1], moves[1][2]] }); t += 1.1;
  // A wrong drop: a number that doesn't belong in that column's lowest gap.
  const [wr, wc, wv] = moves[2], wrong = ((wv % 4) + 1);
  s.push({ at: t, caption: 'One <b>wrong</b> drop…' }); t += 0.5;
  s.push({ at: t, drop: [wc, wrong] }); t += 1.6;
  s.push({ at: t, caption: '…costs a heart.' }); t += 1.2;
  s.push({ at: t, caption: 'Think <b>one move</b> ahead.' }); t += 0.4;
  for (let i = 2; i < moves.length; i++) { s.push({ at: t, drop: [moves[i][1], moves[i][2]] }); t += 0.75; }
  t += 0.4; s.push({ at: t, stars: 2, caption: 'Solved!' }); t += 1.8;
  s.push({ at: t, end: true });
  return { steps: s, duration: t + 2.6 };
}

function thirtySecondsVideo() {
  const L = LEVELS['quick-005'], moves = solveOrder(L), s = [];
  s.push({ at: 0, level: L.id, timer: L.timeLimit }, { at: 0, caption: 'You have <b>28 seconds</b>.<br>Go!' });
  let t = 1.2;
  for (let i = 0; i < moves.length - 1; i++) { s.push({ at: t, drop: [moves[i][1], moves[i][2]] }); t += 1.15; }
  t += 0.3; s.push({ at: t, ghost: true, caption: 'Which number<br>goes <b>last</b>?' }); t += 2.6;
  s.push({ at: t, caption: 'Comment your answer' }); t += 1.6;
  s.push({ at: t, end: true });
  return { steps: s, duration: t + 2.6 };
}

function boardsVideo() {
  const s = [];
  let t = 0;
  const part = (id, label, keep, gap) => {
    const L = LEVELS[id], all = solveOrder(L), pre = all.slice(0, all.length - keep).map(m => [m[0], m[1]]), moves = all.slice(all.length - keep);
    s.push({ at: t, level: id, prefill: pre, timer: null }, { at: t, label });
    t += 0.5;
    for (const m of moves) { s.push({ at: t, drop: [m[1], m[2]] }); t += gap; }
    t += 0.35; s.push({ at: t, stars: 3 }); t += 0.9;
  };
  s.push({ at: 0, caption: 'Easy…' });
  part('quick-010', 'Quick 4×4', 4, 0.42);
  s.push({ at: t, caption: 'Harder…' });
  part('classic-050', 'Classic 6×6', 6, 0.36);
  s.push({ at: t, caption: '<b>Master</b>' });
  part('master-050', 'Master 9×9', 9, 0.3);
  s.push({ at: t, caption: 'How far would<br>you get?' }); t += 1.4;
  s.push({ at: t, end: true });
  return { steps: s, duration: t + 2.6 };
}

const VIDEOS = { gravity: gravityVideo, 'thirty-seconds': thirtySecondsVideo, boards: boardsVideo };

// ---- Page ------------------------------------------------------------------------------------
const PAGE = `<html><head><style>
@font-face{font-family:F;font-weight:300 700;src:url(data:font/woff2;base64,${font})}
*{box-sizing:border-box}
body{margin:0;width:${W}px;height:${H}px;overflow:hidden;font-family:F;color:#F5F6FA;position:relative;
background:radial-gradient(420px 620px at 50% 55%,#302B72 0%,transparent 72%),linear-gradient(170deg,#1A1A3A,#13161F 55%,#0F1118)}
#cap{position:absolute;left:30px;right:30px;top:150px;text-align:center;font-size:40px;font-weight:600;line-height:1.15;letter-spacing:-.01em;text-shadow:0 3px 18px rgba(0,0,0,.45)}
#cap b{color:#F5E663;font-weight:700}
#label{position:absolute;left:0;right:0;text-align:center;font-size:22px;font-weight:600;color:#B3A8FF;letter-spacing:.06em;text-transform:uppercase}
#hud{position:absolute;display:flex;justify-content:space-between;align-items:center}
.pill{display:flex;align-items:center;gap:6px;background:#272C3D;border-radius:99px;padding:6px 14px;font-size:20px;font-weight:600}
.hearts{display:flex;gap:4px}
#board{position:absolute;border-radius:22px;background:#161926;box-shadow:0 18px 50px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05)}
.t{position:absolute;display:flex;align-items:center;justify-content:center;line-height:1}
#end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:rgba(13,15,22,.94);opacity:0}
#end .name{font-size:76px;font-weight:600;letter-spacing:-.01em}
#end .line{font-size:28px;color:#D7DBE8}
#end .small{font-size:20px;color:#A3A9BF;letter-spacing:.06em}
#stars{position:absolute;left:0;right:0;text-align:center}
</style></head><body><div id="cap"></div><div id="label"></div><div id="hud"></div><div id="board"></div><div id="tiles"></div><div id="stars"></div><div id="end"></div></body></html>`;

// Runs inside the page: draws one frame for time t.
function frame(arg) {
  const { t, video, levels } = arg;
  const COL = {1:['#FF6B7A','#FF97A2','#C94656'],2:['#FFB547','#FFCF85','#C9862A'],3:['#F5E663','#FAF29A','#BFB244'],
    4:['#6EE7A8','#A0F2C6','#3FB27A'],5:['#4FC3F7','#8ADAFB','#2E8DB8'],6:['#9D8CFF','#BDB2FF','#6F5ED1'],
    7:['#FF8AD8','#FFB3E6','#C25CA6'],8:['#2DD4BF','#7EE6D7','#1E9E8E'],9:['#C0C7D6','#DDE1EA','#8A91A3'],
    G:['#2A3045','#363D57','#1C2030'],R:['#FF6B7A','#FF97A2','#C94656']};
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const steps = video.steps;
  // Replay the timeline up to t.
  let level = null, grid = null, caption = '', capAt = 0, label = '', labelAt = -9, timer = null, timerAt = 0, hearts = 3;
  let flying = [], stars = 0, starsAt = 0, ghost = false, endAt = null, wrongs = [];
  const landing = (c) => { let r = level.size - 1; while (r >= 0 && grid[r][c]) r--; return r; };
  for (const st of steps) {
    if (st.at > t) break;
    if (st.level) {
      level = levels[st.level]; grid = level.givens.map(r => r.map(v => v ? { v, given: true } : null));
      for (const [r, c] of st.prefill || []) grid[r][c] = { v: level.solution[r][c], given: false };
      flying = []; stars = 0; ghost = false; hearts = 3; timer = st.timer; timerAt = st.at;
    }
    if (st.caption !== undefined) { if (st.caption !== caption) { caption = st.caption || ''; capAt = st.at; } }
    if (st.label) { label = st.label; labelAt = st.at; }
    if (st.ghost) ghost = true;
    if (st.stars) { stars = st.stars; starsAt = st.at; }
    if (st.end) endAt = st.at;
    if (st.drop) {
      const [c, v] = st.drop, r = landing(c);
      const right = level.solution[r][c] === v;
      const dur = 0.16 + 0.045 * (r + 2);
      if (right) { grid[r][c] = { v, given: false, at: st.at, dur }; }
      else { wrongs.push({ r, c, v, at: st.at, dur }); if (st.at + dur <= t) hearts--; }
    }
  }
  // Layout.
  const n = level.size, br = level.boxRows, bc = level.boxCols;
  const s = n === 4 ? 92 : n === 6 ? 64 : 44, g = s * 0.1, bg = s * 0.14, pad = s * 0.2;
  const bw = n * s + (n - 1) * g + (n / bc - 1) * bg + 2 * pad, bh = n * s + (n - 1) * g + (n / br - 1) * bg + 2 * pad;
  const bx = (540 - bw) / 2, by = 370;
  const cx = c => bx + pad + c * (s + g) + Math.floor(c / bc) * bg, cy = r => by + pad + r * (s + g) + Math.floor(r / br) * bg;
  const tile = (v, x, y, kind, extra = '') => {
    const rad = s * 0.27;
    const box = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:${rad}px;font-size:${s * 0.56}px;${extra};`;
    if (kind === 'empty') return `<div class="t" style="${box}border:1.5px dashed rgba(255,255,255,.13);background:#1D2131"></div>`;
    if (kind === 'ghost') return `<div class="t" style="${box}border:${Math.max(2, s * .04)}px dashed #F5E663;color:#F5E663;font-weight:600">?</div>`;
    const [c0, l, e] = COL[kind === 'given' ? 'G' : kind === 'wrong' ? 'R' : v];
    const gv = kind === 'given';
    return `<div class="t" style="${box}background:linear-gradient(180deg,${l},${c0} 60%);color:${gv ? '#E6E9F2' : '#13161F'};font-weight:${gv ? 500 : 600};box-shadow:inset 0 ${s * .035}px 0 rgba(255,255,255,${gv ? .07 : .42}),0 ${s * .065}px 0 ${e}${gv ? '' : `,0 ${s * .15}px ${s * .3}px rgba(0,0,0,.35)`}">${v}</div>`;
  };
  let html = '';
  let lastEmpty = null;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const cell = grid[r][c];
    if (!cell || (cell.at !== undefined && t < cell.at + cell.dur)) { html += tile('', cx(c), cy(r), 'empty'); lastEmpty = [r, c]; continue; }
    // Landed: small squash right after landing.
    let extra = '';
    if (cell.at !== undefined) { const k = (t - cell.at - cell.dur) / 0.14; if (k < 1) extra = `transform:scale(${1 + 0.08 * Math.sin(k * Math.PI)},${1 - 0.08 * Math.sin(k * Math.PI)});transform-origin:50% 100%`; }
    html += tile(cell.v, cx(c), cy(r), cell.given ? 'given' : 'player', extra);
  }
  if (ghost && lastEmpty) { const [r, c] = lastEmpty; const p = 0.6 + 0.4 * Math.sin(t * 6); html += tile('', cx(c), cy(r), 'ghost', `opacity:${p}`); }
  // Falling tiles (right and wrong).
  const falls = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const cell = grid[r][c]; if (cell && cell.at !== undefined && t >= cell.at && t < cell.at + cell.dur) falls.push({ r, c, v: cell.v, at: cell.at, dur: cell.dur, ok: true }); }
  for (const w of wrongs) if (t >= w.at && t < w.at + w.dur + 0.9) falls.push({ ...w, ok: false });
  for (const f of falls) {
    const y0 = by - s * 1.6, y1 = cy(f.r), k = ease((t - f.at) / f.dur), y = y0 + (y1 - y0) * k * k;
    if (f.ok || t < f.at + f.dur) {
      html += `<div style="position:absolute;left:${cx(f.c) + s * .22}px;top:${y - s * 1.1}px;width:${s * .56}px;height:${s * 1.15}px;border-radius:${s * .28}px;background:linear-gradient(180deg,transparent,${COL[f.v][0]}55)"></div>`;
      html += tile(f.v, cx(f.c), y, 'player');
    } else {
      const k2 = (t - f.at - f.dur) / 0.9, shake = Math.sin(k2 * 40) * Math.max(0, 0.6 - k2) * s * 0.2;
      html += tile(f.v, cx(f.c) + shake, y1, 'wrong', `opacity:${1 - Math.max(0, k2 - 0.7) / 0.3};outline:${s * .06}px solid #FFFFFF;outline-offset:${s * .05}px;filter:drop-shadow(0 0 ${s * .25}px #FF6B7A)`);
    }
  }
  document.getElementById('board').style.cssText = `left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px`;
  document.getElementById('tiles').innerHTML = html;
  // HUD: timer and hearts.
  const heart = (on) => `<svg width="22" height="20" viewBox="0 0 24 22"><path d="M12 21s-9-5.6-9-12A5 5 0 0 1 12 6a5 5 0 0 1 9 3c0 6.4-9 12-9 12z" fill="${on ? '#FF6B7A' : '#3A4058'}"/></svg>`;
  const hud = document.getElementById('hud');
  hud.style.cssText = `left:${bx}px;top:${by - 52}px;width:${bw}px`;
  if (timer) {
    const left = Math.max(0, Math.ceil(timer - (t - timerAt)));
    hud.innerHTML = `<div class="pill"><svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" fill="none" stroke="#D7DBE8" stroke-width="2.5"/><path d="M12 9v4l3 2M9 2h6" stroke="#D7DBE8" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>0:${String(left).padStart(2, '0')}</div><div class="pill hearts">${heart(hearts > 0)}${heart(hearts > 1)}${heart(hearts > 2)}</div>`;
  } else hud.innerHTML = '';
  // Caption and label fade in.
  const capEl = document.getElementById('cap');
  capEl.innerHTML = caption; const ck = ease((t - capAt) / 0.25);
  capEl.style.opacity = ck; capEl.style.transform = `translateY(${(1 - ck) * 14}px)`;
  const labEl = document.getElementById('label');
  labEl.textContent = label; labEl.style.top = (by + bh + 34) + 'px'; labEl.style.opacity = ease((t - labelAt) / 0.25);
  // Stars.
  const stEl = document.getElementById('stars');
  stEl.style.top = (by + bh + 70) + 'px';
  if (stars) {
    let sh = '';
    for (let i = 0; i < 3; i++) {
      const k = ease((t - starsAt - i * 0.15) / 0.3), on = i < stars;
      sh += `<svg width="56" height="56" viewBox="0 0 24 24" style="margin:0 6px;transform:scale(${0.4 + 0.6 * k});opacity:${k}"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="${on ? '#FFB547' : '#3A4058'}"/></svg>`;
    }
    stEl.innerHTML = sh;
  } else stEl.innerHTML = '';
  // End card.
  const end = document.getElementById('end');
  if (endAt !== null && t >= endAt) {
    end.style.opacity = ease((t - endAt) / 0.35);
    const m = 46, mg = 8;
    const mt = (v, x, y, k) => { const [c0, l, e] = COL[k]; return `<div class="t" style="left:${x}px;top:${y}px;width:${m}px;height:${m}px;border-radius:${m * .27}px;font-size:${m * .56}px;background:linear-gradient(180deg,${l},${c0} 60%);color:${k === 'G' ? '#E6E9F2' : '#13161F'};font-weight:600;box-shadow:inset 0 2px 0 rgba(255,255,255,.4),0 3px 0 ${e}">${v}</div>`; };
    end.innerHTML = `<div style="position:relative;width:${2 * m + mg}px;height:${2 * m + mg}px">${mt(4, m + mg, 0, 2)}${mt(1, 0, m + mg, 5)}${mt(3, m + mg, m + mg, 'G')}</div>
      <div class="name">NumFall</div><div class="line">Search <b style="color:#F5E663">NumFall</b> on the App Store</div><div class="small">IPHONE · IPAD · NO ADS</div>`;
  } else end.style.opacity = 0;
}

(async () => {
  const which = process.argv[2] ? [process.argv[2]] : Object.keys(VIDEOS);
  fs.mkdirSync('design/marketing', { recursive: true });
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage();
  await page.setContent(PAGE); await page.evaluate(() => document.fonts.ready);
  if (process.env.FRAME) {   // debug: one still frame, e.g. FRAME=4.6 node video.js gravity
    const video = VIDEOS[which[0]]();
    await page.evaluate(frame, { t: Number(process.env.FRAME), video, levels: LEVELS });
    await page.screenshot({ path: `design/marketing/frame-${which[0]}-${process.env.FRAME}.png` });
    await browser.close(); return;
  }
  for (const name of which) {
    const video = VIDEOS[name]();
    const out = `design/marketing/video-${name}.mp4`;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const frames = Math.round(video.duration * FPS);
    for (let i = 0; i < frames; i++) {
      await page.evaluate(frame, { t: i / FPS, video, levels: LEVELS });
      const png = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log(`${out}: ${video.duration.toFixed(1)} s, ${frames} frames`);
  }
  await browser.close();
})();

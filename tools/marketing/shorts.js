// NumFall short videos, v2: fast, voiced, built on 2025-26 short-form patterns
// (fail hook in the first seconds, tension cues, a "guess first" loop, satisfying rising progress, word captions).
// Every board, drop, timer and heart follows the real game rules on real levels (stores and TikTok reject ads that
// show gameplay the app doesn't have).
// Run from the repo root:
//   NODE_PATH=$(npm root -g) FONT=design/icon/Fredoka.woff2 PY=/path/to/venv/bin/python KOKORO_DIR=/path/to/models \
//   node tools/marketing/shorts.js [name]
// Output: design/marketing/short-<name>.mp4 (1080x1920, 30 fps, AAC audio)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
global.window = {};
require('../../prototype/web/levels.js');
const LEVELS = {};
for (const b of window.NUMFALL_BOARDS) for (const l of b.levels) LEVELS[l.id] = l;
const font = fs.readFileSync(process.env.FONT).toString('base64');
const PY = process.env.PY || 'python3';
const CACHE = path.join(process.env.TMPDIR || '/tmp', 'numfall-vo');
fs.mkdirSync(CACHE, { recursive: true });
const FPS = 30, W = 540, H = 960;

// ---- Voice -------------------------------------------------------------------------------------
function voice(text, who = 'af_heart', speed = 1.08) {
  const key = crypto.createHash('sha1').update(who + speed + text).digest('hex').slice(0, 12);
  const file = path.join(CACHE, key + '.wav');
  if (!fs.existsSync(file)) execFileSync(PY, [path.join(__dirname, 'say.py'), who, String(speed), file, text], { stdio: 'ignore' });
  const d = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
  return { file, dur: d };
}

// ---- Timeline builder ---------------------------------------------------------------------------
class TL {
  constructor() { this.steps = []; this.events = []; this.vo = []; this.t = 0; }
  at(t) { this.t = t; return this; }
  wait(d) { this.t += d; return this; }
  add(o) { this.steps.push({ at: this.t, ...o }); return this; }
  sfx(name, extra = {}) { this.events.push({ at: this.t, name, ...extra }); return this; }
  // Speak a line and show it as a word-by-word caption. Returns the line's length in seconds.
  say(text, who, speed, opts = {}) {
    const v = voice(text.replace(/<\/?b>/g, ''), who, speed);
    this.vo.push({ at: this.t, file: v.file });
    this.add({ caption: text, capDur: v.dur + 0.25, ...opts });
    return v.dur;
  }
}

function solveOrder(level, filled) {
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
// A level with all but `keep` gaps already filled (a game in progress).
function midGame(id, keep) {
  const L = LEVELS[id], all = solveOrder(L);
  return { id, pre: all.slice(0, all.length - keep).map(m => [m[0], m[1]]), moves: all.slice(all.length - keep) };
}
// A value that conflicts in that row or column: a genuinely wrong drop.
function wrongValue(L, grid, r, c) {
  const n = L.size, used = new Set();
  for (let i = 0; i < n; i++) { if (grid[r][i]) used.add(grid[r][i]); if (grid[i][c]) used.add(grid[i][c]); }
  for (let v = 1; v <= n; v++) if (v !== L.solution[r][c] && used.has(v)) return v;
  return (L.solution[r][c] % n) + 1;
}
function gridAfter(L, pre) {
  const g = L.givens.map(r => r.slice());
  for (const [r, c] of pre) g[r][c] = L.solution[r][c];
  return g;
}

let combo = 0;
function drop(tl, c, v, L) { tl.add({ drop: [c, v] }); tl.sfx('drop', { step: combo++ }); }
function endCard(tl, who, speed, line = 'Search <b>NumFall</b> on the App Store.') {
  tl.add({ end: true }).sfx('whoosh');
  tl.wait(0.15);
  const d = tl.say(line, who, speed, { capStyle: 'end' });
  tl.wait(Math.max(d + 0.5, 2.2));
  return tl;
}

// ---- The videos ---------------------------------------------------------------------------------
const VIDEOS = {
  // "Hard to stop": the clock jumps from 11:58 PM to 2 AM while levels keep falling.
  'one-more-level'() {
    const tl = new TL(), who = 'af_heart', sp = 1.12; combo = 0;
    const levels = ['quick-012', 'quick-013', 'quick-014', 'quick-015', 'quick-016', 'quick-017'];
    const clocks = ['11:58 PM', '12:21 AM', '12:47 AM', '1:12 AM', '1:39 AM', '2:04 AM'];
    tl.add({ music: true });
    levels.forEach((id, i) => {
      const m = midGame(id, 3);
      tl.add({ level: id, prefill: m.pre, counter: 'LEVEL ' + (12 + i), clock: clocks[i], zoomTo: 1 + i * 0.02 });
      if (i > 0) tl.sfx('whoosh', { gain: 0.6 });
      if (i === 0) { const d = tl.say('POV: you said <b>"one more level"</b>', who, sp, { capStyle: 'hook' }); tl.wait(0.3); }
      if (i === 2) tl.say('Okay. <b>One more.</b>', who, sp);
      if (i === 4) tl.say('Just <b>one</b> more…', who, sp);
      tl.wait(0.25);
      for (const [r, c, v] of m.moves) { drop(tl, c, v); tl.wait(i === 0 ? 0.42 : 0.3); }
      tl.wait(0.15).add({ burst: 'small', pop: ['Nice!', 'Great!', 'Smooth!', 'On fire!', 'Unstoppable!', 'Legend!'][i] }).sfx('chime', { root: i, gain: 0.7 });
      tl.wait(i === 0 ? 0.9 : 0.55);
    });
    tl.add({ shake: 1 }).sfx('boom', { gain: 0.6 });
    const d = tl.say('Wait… why is it <b>2 AM?!</b>', who, 1.05, { capStyle: 'hook' });
    tl.wait(d + 0.3);
    return endCard(tl, who, sp, '<b>NumFall</b>. Hard to put down.');
  },

  // Tension: real timer, red pulse and heartbeat under five seconds, last drop at 0:01.
  clutch() {
    const tl = new TL(), who = 'af_bella', sp = 1.1; combo = 0;
    const m = midGame('quick-021', 3);
    tl.add({ music: 'tense', level: m.id, prefill: m.pre, timer: 7.4, counter: 'LEVEL 21', zoomTo: 1.0 });
    const d = tl.say('<b>Three</b> gaps. <b>Seven</b> seconds.', who, sp, { capStyle: 'hook' });
    // ticks and heartbeats on whole seconds of the game clock
    for (let s = 0; s < 7; s++) tl.events.push({ at: 0.4 + s, name: s >= 2 ? 'heart' : 'tick' });
    tl.at(2.3).add({ zoomTo: 1.08, zoomDur: 4.5 });
    drop(tl, m.moves[0][1], m.moves[0][2]);
    tl.at(3.0).say('Come on…', who, 1.0);
    tl.at(4.3); drop(tl, m.moves[1][1], m.moves[1][2]);
    tl.at(5.2).say('Come on, come on…', who, 1.2);
    tl.at(6.75); drop(tl, m.moves[2][1], m.moves[2][2]);
    tl.wait(0.25).add({ burst: 'big', pop: 'CLUTCH!', shake: 0.6, stopTimer: true, zoomTo: 1.0, zoomDur: 0.3 }).sfx('boom').sfx('chime', { root: 5 });
    tl.wait(0.2).say('<b>YES!</b> One second left!', who, 1.1, { capStyle: 'hook' });
    tl.wait(1.9).add({ stars: 3 });
    tl.wait(0.9);
    return endCard(tl, who, sp, '<b>NumFall</b>. Beat the clock.');
  },

  // Guess first: viewers try to spot the number, countdown, reveal, then the 9x9 tease.
  'guess-the-number'() {
    const tl = new TL(), who = 'af_heart', sp = 1.1; combo = 0;
    const m = midGame('classic-030', 2), L = LEVELS[m.id];
    const [gr, gc, gv] = m.moves[0];
    tl.add({ music: true, level: m.id, prefill: m.pre, timer: 54, counter: 'LEVEL 30', focus: [gr, gc], zoomTo: 1.12, zoomDur: 0.6 });
    tl.add({ ghostAt: [gr, gc] });
    const d = tl.say('Only <b>ONE</b> number fits here.', who, sp, { capStyle: 'hook' });
    tl.wait(d + 0.1);
    tl.say('Can you see it?', who, sp); tl.wait(1.3);
    for (const n of [3, 2, 1]) { tl.add({ countdown: n }).sfx('beep'); tl.wait(0.62); }
    tl.add({ ghostAt: null, zoomTo: 1.0, zoomDur: 0.3 });
    drop(tl, gc, gv);
    tl.wait(0.25).add({ burst: 'small', pop: `It's a ${gv}!` }).sfx('beep', { high: true }).sfx('chime', { root: 2, gain: 0.7 });
    tl.say(`It's a <b>${gv}</b>! Every row, column and box needs each number once.`, who, 1.18);
    tl.wait(3.5);
    drop(tl, m.moves[1][1], m.moves[1][2]); tl.wait(0.4);
    const big = midGame('master-060', 10);
    tl.add({ level: big.id, prefill: big.pre, timer: null, counter: 'MASTER 9×9', focus: null, zoomTo: 1.0 }).sfx('whoosh');
    tl.say('Too easy? Try the <b>nine by nine.</b>', who, sp, { capStyle: 'hook' });
    tl.wait(0.4);
    for (const [r, c, v] of big.moves) { drop(tl, c, v); tl.wait(0.17); }
    tl.wait(0.2).add({ burst: 'big', pop: 'Genius!' }).sfx('chime', { root: 7 });
    tl.wait(1.1);
    return endCard(tl, who, sp, 'Comment how fast you got it. <b>NumFall</b> is on the App Store.');
  },

  // Fail hook: three wrong drops, out of hearts, then a perfect round two.
  'i-thought-this-was-easy'() {
    const tl = new TL(), who = 'am_michael', sp = 1.08; combo = 0;
    const m = midGame('classic-012', 6), L = LEVELS[m.id];
    tl.add({ music: true, level: m.id, prefill: m.pre, timer: 41, counter: 'LEVEL 12' });
    const d = tl.say('I thought this game was <b>easy</b>…', who, sp, { capStyle: 'hook' });
    // three genuinely wrong drops into the first playable gap
    const g = gridAfter(L, m.pre), [r0, c0] = m.moves[0];
    const wv = wrongValue(L, g, r0, c0);
    tl.at(0.9); drop(tl, c0, wv); tl.add({ shake: 0.8 });
    tl.at(d + 0.4).say('It was <b>not.</b>', who, 1.0, { capStyle: 'hook' });
    tl.at(d + 0.8); drop(tl, c0, wv === L.size ? 1 : wrongValue(L, g, r0, c0)); tl.add({ shake: 0.8 });
    tl.wait(0.7); drop(tl, c0, wv); tl.add({ shake: 1 });
    tl.wait(0.5).add({ banner: 'OUT OF HEARTS' }).sfx('boom', { gain: 0.7 });
    tl.wait(1.2);
    combo = 0;
    tl.add({ level: m.id, prefill: m.pre, timer: 41, banner: null, counter: 'ROUND 2' }).sfx('whoosh');
    tl.say('Okay. <b>Round two.</b>', who, sp, { capStyle: 'hook' });
    tl.wait(1.2);
    for (const [r, c, v] of m.moves) { drop(tl, c, v); tl.wait(0.32); }
    tl.wait(0.1).add({ burst: 'big', pop: 'PERFECT!', stars: 3 }).sfx('chime', { root: 4 });
    tl.wait(0.3).say('Think <b>one move ahead.</b>', who, sp);
    tl.wait(2.0);
    return endCard(tl, who, sp);
  },

  // "Beat the timer": the viewer races a giant countdown; last drop at 1 second; no voice; loops.
  'beat-the-timer'() {
    const tl = new TL(); combo = 0;
    const m = midGame('quick-024', 3);
    tl.add({ music: 'tense', level: m.id, prefill: m.pre, timer: null, noHud: true, ghosts: m.moves.map(x => [x[0], x[1]]), counter: 'LEVEL 24' });
    tl.add({ caption: 'Solve it before the timer hits <b>0</b> 👇', capDur: 2.6, capStyle: 'hook' });
    tl.add({ bigTimer: 6, zoomTo: 1.08, zoomDur: 5.6 });
    for (let s2 = 0; s2 < 6; s2++) tl.events.push({ at: s2 + 0.02, name: s2 >= 3 ? 'heart' : 'tick' });
    tl.at(3.0).add({ vignette: true });
    tl.at(4.0); drop(tl, m.moves[0][1], m.moves[0][2]);
    tl.at(4.7); drop(tl, m.moves[1][1], m.moves[1][2]);
    tl.at(5.55); drop(tl, m.moves[2][1], m.moves[2][2]);
    tl.at(5.75).add({ stopBig: true, vignette: false, ghosts: [], burst: 'big', pop: 'CLUTCH!', shake: 0.8, zoomTo: 1.0, zoomDur: 0.3 }).sfx('boom').sfx('chime', { root: 5 });
    tl.at(6.0).add({ hideBig: true, caption: 'Did you beat me? 👀', capDur: 2.2, capStyle: 'hook' });
    tl.at(8.1).add({ end: true }).sfx('whoosh');
    tl.at(9.9);
    return tl;
  },

  // "Spot the mistake": a drop that breaks the rule freezes on screen; countdown; red rings reveal the clash.
  'spot-the-mistake'() {
    const tl = new TL(), who = 'af_heart', sp = 1.12; combo = 0;
    const m = midGame('classic-018', 4), L = LEVELS[m.id];
    const g = gridAfter(L, m.pre);
    for (const [r, c, v] of m.moves.slice(0, 2)) g[r][c] = v;
    const [wr, wc] = m.moves[2];
    // A wrong value that clashes with a number already in the same column (easy to see).
    let wv = null, clash = null;
    for (let r = 0; r < L.size && !wv; r++) if (r !== wr && g[r][wc] && g[r][wc] !== L.solution[wr][wc]) { wv = g[r][wc]; clash = [r, wc]; }
    tl.add({ music: true, level: m.id, prefill: m.pre, timer: 52, counter: 'LEVEL 18' });
    tl.say('One of these drops breaks the rules. <b>Spot it?</b>', who, sp, { capStyle: 'hook' });
    tl.at(0.7); drop(tl, m.moves[0][1], m.moves[0][2]);
    tl.at(1.4); drop(tl, m.moves[1][1], m.moves[1][2]);
    tl.at(2.1).add({ drop: [wc, wv], hold: true }).sfx('drop', { step: combo++ });
    tl.at(3.4).add({ caption: 'Pause and look 👀', capDur: 2.0, capStyle: 'hook', focus: [wr, wc], zoomTo: 1.12, zoomDur: 0.5 });
    for (const n2 of [3, 2, 1]) { tl.add({ countdown: n2 }).sfx('beep'); tl.wait(0.62); }
    tl.add({ reveal: true, rings: [clash, [wr, wc]], shake: 0.7 }).sfx('wrong');
    const d = tl.say(`There! Two <b>${wv}s</b> in the same column.`, who, sp, { capStyle: 'hook' });
    tl.wait(d + 0.3);
    tl.add({ fix: true, rings: null, focus: null, zoomTo: 1.0, zoomDur: 0.3, burst: 'small', pop: `It's a ${L.solution[wr][wc]}!` }).sfx('chime', { root: 3 });
    tl.wait(0.3);
    const d2 = tl.say('Did you get it? Tell me in the comments!', who, sp);
    tl.wait(d2 + 0.2);
    return endCard(tl, who, sp);
  },

  // Sound on: a 9x9 board fills with a rising scale.
  'satisfying-sound'() {
    const tl = new TL(), who = 'af_heart', sp = 1.05; combo = 0;
    const m = midGame('master-080', 15);
    tl.add({ music: 'chill', level: m.id, prefill: m.pre, counter: 'MASTER 9×9', zoomTo: 1.04 });
    tl.add({ caption: 'Turn your <b>sound on</b> for this one', capDur: 2.4, capStyle: 'hook' });
    tl.wait(0.9);
    for (const [r, c, v] of m.moves) { drop(tl, c, v); tl.wait(0.42); }
    tl.wait(0.1).add({ burst: 'big', pop: 'So satisfying', stars: 3, zoomTo: 1.0, zoomDur: 0.4 }).sfx('chime', { root: 9 });
    tl.wait(0.4).say('Which board would you pick? Four, six, or <b>nine</b>?', who, sp);
    tl.wait(2.7);
    return endCard(tl, who, sp);
  },
};

// ---- Page --------------------------------------------------------------------------------------
const PAGE = `<html><head><style>
@font-face{font-family:F;font-weight:300 700;src:url(data:font/woff2;base64,${font})}
*{box-sizing:border-box}
body{margin:0;width:${W}px;height:${H}px;overflow:hidden;font-family:F;color:#F5F6FA;position:relative;background:#13161F}
#bg{position:absolute;inset:-40px;background:radial-gradient(460px 640px at 50% 55%,#33287a 0%,transparent 70%),linear-gradient(170deg,#1A1A3A,#13161F 55%,#0F1118)}
#drift,#stage,#fx,#ui{position:absolute;inset:0}
#cap{position:absolute;left:24px;right:24px;text-align:center;font-weight:700;line-height:1.08;letter-spacing:-.01em;
  -webkit-text-stroke:7px #0B0D14;paint-order:stroke fill;color:#fff}
#cap span{display:inline-block;margin:0 .12em}
#cap .on{color:#F5E663}
#cap b{color:#F5E663}
.chip{position:absolute;display:flex;align-items:center;gap:7px;background:rgba(39,44,61,.92);border-radius:99px;padding:7px 15px;font-size:20px;font-weight:600}
.t{position:absolute;display:flex;align-items:center;justify-content:center;line-height:1}
#flash{position:absolute;inset:0;pointer-events:none}
#pop{position:absolute;left:0;right:0;text-align:center;font-weight:700;-webkit-text-stroke:9px #0B0D14;paint-order:stroke fill}
#banner{position:absolute;left:0;right:0;text-align:center;font-size:44px;font-weight:700;color:#fff;background:#E5485A;padding:14px 0;letter-spacing:.04em}
#count{position:absolute;left:0;right:0;text-align:center;font-weight:700;color:#fff;-webkit-text-stroke:10px #0B0D14;paint-order:stroke fill}
#end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(12,14,22,.95)}
#end .name{font-size:84px;font-weight:700;letter-spacing:-.01em}
#end .line{font-size:27px;color:#D7DBE8}
#end .badge{margin-top:10px;display:flex;align-items:center;gap:10px;background:#fff;color:#0B0D14;border-radius:16px;padding:12px 22px;font-size:24px;font-weight:700}
#end .small{font-size:19px;color:#A3A9BF;letter-spacing:.08em}
</style></head><body><div id="bg"></div><div id="drift"></div><div id="stage"></div><div id="fx"></div><div id="flash"></div><div id="ui"></div></body></html>`;

function frame(arg) {
  const { t, video, levels } = arg, W = 540, H = 960;
  const COL = {1:['#FF6B7A','#FF97A2','#C94656'],2:['#FFB547','#FFCF85','#C9862A'],3:['#F5E663','#FAF29A','#BFB244'],
    4:['#6EE7A8','#A0F2C6','#3FB27A'],5:['#4FC3F7','#8ADAFB','#2E8DB8'],6:['#9D8CFF','#BDB2FF','#6F5ED1'],
    7:['#FF8AD8','#FFB3E6','#C25CA6'],8:['#2DD4BF','#7EE6D7','#1E9E8E'],9:['#C0C7D6','#DDE1EA','#8A91A3'],
    G:['#2A3045','#363D57','#1C2030'],R:['#FF6B7A','#FF97A2','#C94656']};
  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
  const backOut = x => { x = clamp(x); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  // ---- Replay state up to t
  let level = null, grid = null, hearts = 3, timer = null, timerAt = 0, timerStop = null, counter = '', clock = '';
  let caption = null, capAt = 0, capDur = 0, capStyle = '', pop = null, popAt = -9, burst = null, burstAt = -9, shakeAt = -9, shakeAmp = 0;
  let zoom = 1, zoomFrom = 1, zoomTo = 1, zoomAt = 0, zoomDur = 0.35, focus = null, ghostAt = null, countdown = null, countAt = -9;
  let banner = null, bannerAt = -9, stars = 0, starsAt = -9, endAt = null, wrongs = [], levelAt = 0;
  let ghosts = [], rings = null, ringsAt = -9, big = null, bigAt = 0, bigStop = null, vignette = false, vigAt = 0, noHud = false, revealAt = null;
  const landing = c => { let r = level.size - 1; while (r >= 0 && grid[r][c]) r--; return r; };
  for (const st of video.steps) {
    if (st.at > t) break;
    if (st.level) {
      level = levels[st.level]; levelAt = st.at;
      grid = level.givens.map(r => r.map(v => v ? { v, given: true } : null));
      for (const [r, c] of st.prefill || []) grid[r][c] = { v: level.solution[r][c] };
      hearts = 3; wrongs = []; stars = 0; ghostAt = null; ghosts = []; rings = null; revealAt = null; noHud = !!st.noHud;
      if ('timer' in st) { timer = st.timer; timerAt = st.at; timerStop = null; }
    }
    if (st.counter !== undefined) counter = st.counter;
    if (st.clock !== undefined) clock = st.clock;
    if (st.caption !== undefined) { caption = st.caption; capAt = st.at; capDur = st.capDur || 2; capStyle = st.capStyle || ''; }
    if (st.pop) { pop = st.pop; popAt = st.at; }
    if (st.burst) { burst = st.burst; burstAt = st.at; }
    if (st.shake) { shakeAt = st.at; shakeAmp = st.shake; }
    if (st.zoomTo !== undefined) { zoomFrom = zoom; zoomTo = st.zoomTo; zoomAt = st.at; zoomDur = st.zoomDur || 0.35; }
    if (st.focus !== undefined) focus = st.focus;
    if (st.ghostAt !== undefined) ghostAt = st.ghostAt;
    if (st.ghosts) ghosts = st.ghosts;
    if (st.rings !== undefined) { rings = st.rings; ringsAt = st.at; }
    if (st.bigTimer) { big = st.bigTimer; bigAt = st.at; bigStop = null; }
    if (st.stopBig) bigStop = st.at;
    if (st.hideBig) big = null;
    if (st.vignette !== undefined) { vignette = st.vignette; vigAt = st.at; }
    if (st.reveal) revealAt = st.at;
    if (st.fix) for (const row of grid) for (const cell of row) if (cell && cell.hold) { const [rr, cc] = cell.pos; cell.v = level.solution[rr][cc]; cell.hold = false; cell.fixedAt = st.at; }
    if (st.countdown) { countdown = st.countdown; countAt = st.at; }
    if (st.banner !== undefined) { banner = st.banner; bannerAt = st.at; }
    if (st.stars) { stars = st.stars; starsAt = st.at; }
    if (st.stopTimer) timerStop = st.at;
    if (st.end) endAt = st.at;
    if (st.drop) {
      const [c, v] = st.drop, r = landing(c), dur = 0.12 + 0.03 * (r + 2);
      if (st.hold) grid[r][c] = { v, at: st.at, dur, hold: true, pos: [r, c] };
      else if (level.solution[r][c] === v) grid[r][c] = { v, at: st.at, dur };
      else { wrongs.push({ r, c, v, at: st.at, dur }); if (st.at + dur <= t) hearts = Math.max(0, hearts - 1); }
    }
    // Zoom value at this point (for chained tweens).
    zoom = zoomFrom + (zoomTo - zoomFrom) * easeOut((st.at - zoomAt) / zoomDur);
  }
  zoom = zoomFrom + (zoomTo - zoomFrom) * easeOut((t - zoomAt) / zoomDur);
  // ---- Layout
  const n = level.size, br = level.boxRows, bc = level.boxCols;
  const s = n === 4 ? 88 : n === 6 ? 62 : 44, g = s * 0.1, bg = s * 0.14, pad = s * 0.2;
  const bw = n * s + (n - 1) * g + (n / bc - 1) * bg + 2 * pad, bh = n * s + (n - 1) * g + (n / br - 1) * bg + 2 * pad;
  const bx = (W - bw) / 2, by = 335;
  const cx = c => bx + pad + c * (s + g) + Math.floor(c / bc) * bg, cy = r => by + pad + r * (s + g) + Math.floor(r / br) * bg;
  const tile = (v, x, y, kind, extra = '') => {
    const rad = s * 0.27;
    const box = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:${rad}px;font-size:${s * 0.56}px;${extra};`;
    if (kind === 'empty') return `<div class="t" style="${box}border:1.5px dashed rgba(255,255,255,.13);background:#1D2131"></div>`;
    if (kind === 'ghost') return `<div class="t" style="${box}border:${Math.max(3, s * .05)}px solid #F5E663;color:#F5E663;font-weight:700;background:rgba(245,230,99,.12);box-shadow:0 0 ${s * .4}px rgba(245,230,99,.6)">?</div>`;
    const [c0, l, e] = COL[kind === 'given' ? 'G' : kind === 'wrong' ? 'R' : v];
    const gv = kind === 'given';
    return `<div class="t" style="${box}background:linear-gradient(180deg,${l},${c0} 60%);color:${gv ? '#E6E9F2' : '#13161F'};font-weight:${gv ? 500 : 700};box-shadow:inset 0 ${s * .035}px 0 rgba(255,255,255,${gv ? .07 : .42}),0 ${s * .065}px 0 ${e}${gv ? '' : `,0 ${s * .15}px ${s * .3}px rgba(0,0,0,.35)`}">${v}</div>`;
  };
  // ---- Board
  let html = `<div style="position:absolute;left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;border-radius:${s * .4}px;background:#161926;box-shadow:0 22px 60px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05)"></div>`;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const cell = grid[r][c];
    if (!cell || (cell.at !== undefined && t < cell.at + cell.dur)) { html += tile('', cx(c), cy(r), 'empty'); continue; }
    let extra = '';
    if (cell.at !== undefined) {
      const k = (t - cell.at - cell.dur) / 0.16;
      if (k < 1) extra = `transform:scale(${1 + 0.12 * Math.sin(k * Math.PI)},${1 - 0.1 * Math.sin(k * Math.PI)});transform-origin:50% 100%`;
      const glow = clamp(1 - (t - cell.at - cell.dur) / 0.4);
      if (glow > 0) extra += `;filter:brightness(${1 + glow * 0.5})`;
    }
    if (cell.hold && revealAt !== null && t >= revealAt) {
      const k2 = t - revealAt, sh = Math.sin(k2 * 44) * Math.max(0, 0.5 - k2) * s * 0.2;
      html += tile(cell.v, cx(c) + sh, cy(r), 'wrong', `outline:${s * .06}px solid #fff;outline-offset:${s * .05}px;filter:drop-shadow(0 0 ${s * .3}px #FF6B7A)`);
    } else {
      if (cell.fixedAt !== undefined && t - cell.fixedAt < 0.4) extra = `transform:scale(${1 + 0.25 * Math.sin(clamp((t - cell.fixedAt) / 0.4) * Math.PI)});filter:brightness(1.4)`;
      html += tile(cell.v, cx(c), cy(r), cell.given ? 'given' : 'player', extra);
    }
  }
  for (const [gr, gc] of ghosts) if (!grid[gr][gc]) { const p = 0.75 + 0.25 * Math.sin(t * 7 + gr + gc); html += tile('', cx(gc), cy(gr), 'ghost', `transform:scale(${0.96 + 0.06 * p})`); }
  if (rings) for (const [rr, rc] of rings) {
    const k = backOut((t - ringsAt) / 0.3), pul = 1 + 0.06 * Math.sin(t * 9);
    html += `<div style="position:absolute;left:${cx(rc) - s * .14}px;top:${cy(rr) - s * .14}px;width:${s * 1.28}px;height:${s * 1.28}px;border-radius:50%;border:${Math.max(4, s * .09)}px solid #FF4D5E;box-shadow:0 0 ${s * .5}px rgba(255,77,94,.8);transform:scale(${Math.max(0, k) * pul});box-sizing:border-box"></div>`;
  }
  if (ghostAt) { const p = 0.75 + 0.25 * Math.sin(t * 7); html += tile('', cx(ghostAt[1]), cy(ghostAt[0]), 'ghost', `transform:scale(${0.96 + 0.06 * p})`); }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const cell = grid[r][c];
    if (cell && cell.at !== undefined && t >= cell.at && t < cell.at + cell.dur) {
      const k = clamp((t - cell.at) / cell.dur), y0 = by - s * 1.35, y = y0 + (cy(r) - y0) * k * k;
      html += `<div style="position:absolute;left:${cx(c) + s * .2}px;top:${y - s * 1.3}px;width:${s * .6}px;height:${s * 1.35}px;border-radius:${s * .3}px;background:linear-gradient(180deg,transparent,${COL[cell.v][0]}77)"></div>` + tile(cell.v, cx(c), y, 'player');
    }
  }
  for (const w of wrongs) {
    if (t < w.at) continue;
    const y1 = cy(w.r);
    if (t < w.at + w.dur) { const k = clamp((t - w.at) / w.dur), y0 = by - s * 1.35; html += tile(w.v, cx(w.c), y0 + (y1 - y0) * k * k, 'player'); }
    else if (t < w.at + w.dur + 0.75) {
      const k2 = (t - w.at - w.dur) / 0.75, sh = Math.sin(k2 * 44) * Math.max(0, 0.6 - k2) * s * 0.22;
      html += tile(w.v, cx(w.c) + sh, y1, 'wrong', `opacity:${1 - Math.max(0, k2 - 0.7) / 0.3};outline:${s * .06}px solid #fff;outline-offset:${s * .05}px;filter:drop-shadow(0 0 ${s * .3}px #FF6B7A)`);
    }
  }
  // HUD above the board
  const heart = on => `<svg width="24" height="22" viewBox="0 0 24 22"><path d="M12 21s-9-5.6-9-12A5 5 0 0 1 12 6a5 5 0 0 1 9 3c0 6.4-9 12-9 12z" fill="${on ? '#FF6B7A' : '#3A4058'}"/></svg>`;
  let hud = '';
  if (timer !== null && !noHud) {
    const now = timerStop !== null ? Math.min(t, timerStop) : t;
    const left = Math.max(0, timer - (now - timerAt)), secs = Math.ceil(left), red = left <= 5;
    const pulse = red && timerStop === null ? 1 + 0.12 * Math.pow(Math.max(0, Math.cos((left % 1) * Math.PI * 2)), 6) : 1;
    hud += `<div class="chip" style="left:${bx}px;top:${by - 60}px;transform:scale(${pulse});transform-origin:0 50%;background:${red ? '#E5485A' : 'rgba(39,44,61,.92)'}"><svg width="19" height="19" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M12 9v4l3 2M9 2h6" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>0:${String(secs).padStart(2, '0')}</div>`;
  }
  if (!noHud) hud += `<div class="chip" style="right:${bx}px;top:${by - 60}px;gap:4px">${heart(hearts > 0)}${heart(hearts > 1)}${heart(hearts > 2)}</div>`;
  if (counter) hud += `<div style="position:absolute;left:0;right:0;top:${by + bh + 22}px;text-align:center;font-size:22px;font-weight:700;color:#B3A8FF;letter-spacing:.1em">${counter}</div>`;
  if (stars) {
    let sh = '';
    for (let i = 0; i < 3; i++) { const k = backOut((t - starsAt - i * 0.12) / 0.3); sh += `<svg width="58" height="58" viewBox="0 0 24 24" style="margin:0 6px;transform:scale(${Math.max(0, k)});opacity:${clamp(k * 2)}"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="${i < stars ? '#FFB547' : '#3A4058'}"/></svg>`; }
    hud += `<div style="position:absolute;left:0;right:0;top:${by + bh + 56}px;text-align:center">${sh}</div>`;
  }
  // Camera: zoom towards the focus cell (or the board centre), plus shake.
  const fxp = focus ? cx(focus[1]) + s / 2 : W / 2, fyp = focus ? cy(focus[0]) + s / 2 : by + bh / 2;
  const sk = t - shakeAt < 0.35 ? (1 - (t - shakeAt) / 0.35) * shakeAmp * 14 : 0;
  const sx = sk * Math.sin(t * 90), sy = sk * Math.cos(t * 77);
  const stage = document.getElementById('stage');
  stage.style.transform = `translate(${sx}px,${sy}px) scale(${zoom})`;
  stage.style.transformOrigin = `${fxp}px ${fyp}px`;
  stage.innerHTML = html + hud;
  // Background drifting tiles (slow, like the app).
  let drift = '';
  for (let i = 0; i < 9; i++) {
    const v = 1 + (i % 6), x = rnd(i) * W, sp = 18 + rnd(i + 9) * 22, y = ((rnd(i + 3) * (H + 200) + t * sp) % (H + 200)) - 100, sz = 26 + rnd(i + 5) * 26;
    drift += `<div class="t" style="left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;border-radius:${sz * .27}px;background:${COL[v][0]};opacity:.10;filter:blur(1.5px);transform:rotate(${(rnd(i + 7) - .5) * 30}deg)"></div>`;
  }
  document.getElementById('drift').innerHTML = drift;
  // Burst of falling tiles (gravity confetti).
  let fx = '';
  if (burst && t - burstAt < 2.2) {
    const k = t - burstAt, count = burst === 'big' ? 46 : 18, ox = W / 2, oy = by + bh * 0.45;
    for (let i = 0; i < count; i++) {
      const a = rnd(i + 20) * Math.PI * 2, v0 = (burst === 'big' ? 520 : 360) * (0.45 + rnd(i + 40)), vx = Math.cos(a) * v0, vy = Math.sin(a) * v0 - 260;
      const x = ox + vx * k, y = oy + vy * k + 0.5 * 1100 * k * k, sz = 12 + rnd(i + 60) * 18, col = COL[1 + (i % 8)][0];
      fx += `<div style="position:absolute;left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;border-radius:${sz * .27}px;background:${col};transform:rotate(${k * 400 * (rnd(i) - .5)}deg);opacity:${clamp(2.2 - k)}"></div>`;
    }
  }
  document.getElementById('fx').innerHTML = fx;
  // Red flash on wrong drops, white flash on big moments.
  let flash = '';
  for (const w of wrongs) { const k = t - w.at - w.dur; if (k >= 0 && k < 0.35) flash = `box-shadow:inset 0 0 160px rgba(255,60,80,${0.7 * (1 - k / 0.35)})`; }
  if (burst === 'big' && t - burstAt >= 0 && t - burstAt < 0.18) flash = `background:rgba(255,255,255,${0.35 * (1 - (t - burstAt) / 0.18)})`;
  if (vignette && !flash) { const left = big ? big - (t - bigAt) : 1; const beat = Math.pow(Math.max(0, Math.cos(((left % 1) + 1) * Math.PI * 2)), 4); flash = `box-shadow:inset 0 0 ${120 + 80 * beat}px rgba(255,40,60,${0.35 + 0.35 * beat})`; }
  document.getElementById('flash').style.cssText = flash;
  // ---- UI layer: captions, pop, countdown, banner, clock, end card
  let ui = '';
  if (clock) ui += `<div class="chip" style="left:50%;top:52px;transform:translateX(-50%);font-size:22px"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="#B3A8FF"/></svg>${clock}</div>`;
  if (big !== null) {
    const now = bigStop !== null ? Math.min(t, bigStop) : t, left = Math.max(0, big - (now - bigAt)), secs = Math.ceil(left), red = left <= 3;
    const beat = bigStop === null ? Math.pow(Math.max(0, Math.cos((left % 1) * Math.PI * 2)), 6) : 0;
    ui += `<div style="position:absolute;left:0;right:0;top:${by - 116}px;text-align:center;font-size:${104 * (1 + 0.14 * beat)}px;font-weight:700;line-height:1;color:${red ? '#FF5468' : '#fff'};-webkit-text-stroke:8px #0B0D14;paint-order:stroke fill;font-variant-numeric:tabular-nums">0:0${secs}</div>`;
  }
  if (pop && t - popAt < 1.1) {
    const k = t - popAt, sc = backOut(k / 0.25) * (1 + 0.04 * Math.sin(k * 12)), op = clamp((1.1 - k) / 0.25);
    ui += `<div id="pop" style="top:${by + bh * 0.5 - 50}px;font-size:${pop.length > 9 ? 62 : 76}px;color:#F5E663;transform:scale(${sc}) rotate(-6deg);opacity:${op}">${pop}</div>`;
  }
  if (countdown && t - countAt < 0.6) {
    const k = t - countAt;
    ui += `<div id="count" style="top:${by - 10}px;font-size:${190 * (1.3 - 0.3 * easeOut(k / 0.2))}px;opacity:${clamp((0.6 - k) / 0.2)}">${countdown}</div>`;
  }
  if (banner) { const k = easeOut((t - bannerAt) / 0.25); ui += `<div id="banner" style="top:${by + bh / 2 - 40}px;transform:scaleX(${k})">${banner}</div>`; }
  if (endAt !== null && t >= endAt) {
    const k = easeOut((t - endAt) / 0.3), m = 56, mg = 9;
    const mt = (v, x, y, kk, d) => { const [c0, l, e] = COL[kk]; const kk2 = backOut((t - endAt - d) / 0.35); return `<div class="t" style="left:${x}px;top:${y - (1 - clamp(kk2)) * 60}px;width:${m}px;height:${m}px;border-radius:${m * .27}px;font-size:${m * .56}px;background:linear-gradient(180deg,${l},${c0} 60%);color:${kk === 'G' ? '#E6E9F2' : '#13161F'};font-weight:700;box-shadow:inset 0 2px 0 rgba(255,255,255,.4),0 4px 0 ${e};opacity:${clamp(kk2 * 3)}">${v}</div>`; };
    ui += `<div id="end" style="opacity:${k}"><div style="position:relative;width:${2 * m + mg}px;height:${2 * m + mg}px">${mt(4, m + mg, 0, 2, 0.1)}${mt(1, 0, m + mg, 5, 0.2)}${mt(3, m + mg, m + mg, 'G', 0.3)}</div>
      <div class="name">NumFall</div><div class="line">The number puzzle with gravity</div>
      <div class="badge"><svg width="22" height="26" viewBox="0 0 24 28"><path d="M19.6 14.9c0-3 2.5-4.5 2.6-4.6-1.4-2.1-3.6-2.4-4.4-2.4-1.9-.2-3.6 1.1-4.6 1.1s-2.4-1.1-4-1c-2 0-3.9 1.2-5 3-2.1 3.7-.5 9.2 1.5 12.2 1 1.5 2.2 3.1 3.8 3 1.5-.1 2.1-1 3.9-1s2.4 1 4 1c1.7 0 2.7-1.5 3.7-3 1.2-1.7 1.6-3.3 1.7-3.4-.1 0-3.2-1.2-3.2-4.9zM16.6 5.9c.8-1 1.4-2.4 1.2-3.8-1.2.1-2.6.8-3.5 1.8-.8.9-1.4 2.3-1.3 3.7 1.4.1 2.7-.7 3.6-1.7z" fill="#0B0D14"/></svg>Search “NumFall” on the App Store</div>
      <div class="small">IPHONE · IPAD · NO ADS</div></div>`;
  }
  if (caption && t - capAt < capDur) {
    const k = t - capAt, big = capStyle === 'hook';
    const words = caption.split(/\s+/);
    // Highlight the word being spoken (words spread over the line by length).
    const lens = words.map(w => w.replace(/<[^>]+>/g, '').length + 2), tot = lens.reduce((a, b) => a + b, 0);
    let acc = 0, cur = -1; const talk = Math.max(0.5, capDur - 0.25);
    for (let i = 0; i < words.length; i++) { if (k >= (acc / tot) * talk) cur = i; acc += lens[i]; }
    const sc = backOut(k / 0.22);
    const spans = words.map((w, i) => `<span class="${i === cur && !big ? 'on' : ''}">${w}</span>`).join(' ');
    const size = big ? 52 : 44;
    ui += `<div id="cap" style="top:${endAt !== null && t >= endAt ? 760 : big ? 108 : 118}px;font-size:${size}px;transform:scale(${sc});opacity:${clamp(k / 0.08)}">${spans}</div>`;
  }
  document.getElementById('ui').innerHTML = ui;
}

(async () => {
  const which = process.argv[2] ? [process.argv[2]] : Object.keys(VIDEOS);
  fs.mkdirSync('design/marketing', { recursive: true });
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage();
  await page.setContent(PAGE); await page.evaluate(() => document.fonts.ready);
  for (const name of which) {
    const tl = VIDEOS[name]();
    const duration = tl.t + 0.2;
    const video = { steps: tl.steps.sort((a, b) => a.at - b.at) };
    if (process.env.FRAME) {
      for (const f of process.env.FRAME.split(',')) {
        await page.evaluate(frame, { t: Number(f), video, levels: LEVELS });
        await page.screenshot({ path: `design/marketing/frame-${name}-${f}.png` });
      }
      continue;
    }
    // Soundtrack
    const musicStep = tl.steps.find(s => s.music);
    const mood = musicStep && typeof musicStep.music === 'string' ? musicStep.music : 'drive';
    const spec = { duration, music: { bpm: mood === 'chill' ? 96 : mood === 'tense' ? 132 : 124, mood }, events: tl.events.filter(e => e.at < duration), vo: tl.vo };
    const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'short-'));
    fs.writeFileSync(path.join(tmp, 'events.json'), JSON.stringify(spec));
    execFileSync(PY, [path.join(__dirname, 'audio.py'), path.join(tmp, 'events.json'), path.join(tmp, 'mix.wav')], { stdio: 'inherit' });
    // Frames → video with audio
    const out = `design/marketing/short-${name}.mp4`;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', path.join(tmp, 'mix.wav'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const frames = Math.round(duration * FPS);
    for (let i = 0; i < frames; i++) {
      await page.evaluate(frame, { t: i / FPS, video, levels: LEVELS });
      const img = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log(`${out}: ${duration.toFixed(1)} s`);
  }
  await browser.close();
})();

// Fail-safe tests for the web prototype engine (prototype/web/engine.js) on the real level set (levels/levels.json).
// Run: node tools/failsafe/engine.test.js
const path = require('path');
const D = require(path.join(__dirname, '../../prototype/web/engine.js'));
const BOARDS = require(path.join(__dirname, '../../levels/levels.json')).boards;
const LEVELS = [].concat(...BOARDS.map((b) => b.levels));
const board = (id) => BOARDS.find((b) => b.id === id).levels;
const C12 = board('classic')[11];          // a mid-size 6x6 level used by the rule tests
let pass = 0, fail = 0;
function t(name, fn) { let r; try { r = fn(); } catch (e) { r = 'threw ' + e.message; } if (r === true) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, '->', r); } }
const solveByHints = (g) => { let guard = 0, fallback = 0; while (g.status === 'play' && guard++ < 400) { const h = D.hint(g); if (!h) return 'no hint'; if (/needs a/.test(h.reason)) fallback++; const res = D.drop(g, h.c, h.v); if (res.kind !== 'placed') return 'hint move was ' + res.kind; } return { status: g.status, fallback }; };
const wrongFor = (g, c) => { const r = D.landing(g, c); return g.level.solution[r][c] % g.n + 1; };
const firstOpen = (g) => { for (let c = 0; c < g.n; c++) if (D.landing(g, c) >= 0) return c; return -1; };

t('Three boards in order: Quick 4x4 x30, Classic 6x6 x100, Master 9x9 x100, matching the engine', () => {
  const got = BOARDS.map((b) => [b.id, b.size, b.levels.length].join(':')).join(' ');
  const want = D.BOARD_ORDER.map((id) => [id, D.BOARDS[id].size, D.BOARDS[id].levels].join(':')).join(' ');
  return got === want && want === 'quick:4:30 classic:6:100 master:9:100' ? true : got + ' vs ' + want;
});
t('All 230 levels can be solved by following hints, using logic only (no "just trust me" hints)', () => {
  const bad = [];
  for (const L of LEVELS) { const g = D.newGame(L); const r = solveByHints(g); if (typeof r === 'string' || r.status !== 'won' || r.fallback) bad.push(L.id + ':' + JSON.stringify(r)); }
  return bad.length ? bad.join(' ') : true;
});
t('Time limits match each board\'s table for every level', () => { const bad = LEVELS.filter((L) => L.timeLimit !== D.timeLimit(L.board, L.number)).map((L) => L.id); return bad.length ? 'levels ' + bad : true; });
t('Time table: same for each block of 5 levels, then +5s, on every board', () => {
  const bad = [];
  for (const id of D.BOARD_ORDER) { const b = D.BOARDS[id]; for (let lv = 2; lv <= b.levels; lv++) { const d = D.timeLimit(id, lv) - D.timeLimit(id, lv - 1); const want = (lv - 1) % 5 === 0 ? b.step : 0; if (d !== want || b.step !== 5) bad.push(id + lv); } }
  const firsts = D.BOARD_ORDER.map((id) => D.timeLimit(id, 1)).join(',');
  return bad.length ? bad.join(' ') : firsts === '30,75,240' ? true : firsts;
});
t('Each board gets harder: more gaps and less time per gap from its first chapter to its last', () => {
  const bad = [];
  for (const b of BOARDS) {
    const avg = (ls, f) => ls.reduce((a, L) => a + f(L), 0) / ls.length;
    const first = b.levels.slice(0, 10), last = b.levels.slice(-10);
    if (!(avg(last, (L) => L.gaps) > avg(first, (L) => L.gaps))) bad.push(b.id + ' gaps');
    if (!(avg(last, (L) => L.difficulty) > avg(first, (L) => L.difficulty))) bad.push(b.id + ' difficulty');
  }
  return bad.length ? bad.join(' ') : true;
});
t("Time's up at 0s locks the board; clock never goes negative", () => {
  const g = D.newGame(C12); for (let i = 0; i < g.level.timeLimit - 1; i++) D.tick(g); const still = g.status === 'play'; const fired = D.tick(g); D.tick(g, 50);
  const c = firstOpen(g); const res = D.drop(g, c, g.level.solution[D.landing(g, c)][c]);
  return still && fired && g.status === 'timeup' && g.timeLeft === 0 && res.kind === 'inactive' && D.hint(g) === null ? true : g.status;
});
t('Clock stops after a win and after losing', () => {
  const g = D.newGame(LEVELS[0]); solveByHints(g); const t1 = g.timeLeft; D.tick(g, 5);
  const h = D.newGame(LEVELS[0]); for (let i = 0; i < 3; i++) D.drop(h, firstOpen(h), wrongFor(h, firstOpen(h))); const t2 = h.timeLeft; D.tick(h, 5);
  return g.timeLeft === t1 && h.status === 'lost' && h.timeLeft === t2 ? true : 'win ' + g.timeLeft + '/' + t1 + ' lost ' + h.status;
});
t('Wrong drop: costs a heart, board unchanged, explains why', () => {
  const g = D.newGame(C12); const before = JSON.stringify(g.grid); const c = firstOpen(g); const res = D.drop(g, c, wrongFor(g, c));
  return res.kind === 'wrong' && g.hearts === 2 && JSON.stringify(g.grid) === before && ['row', 'column', 'box', 'deadend'].includes(res.why) ? true : JSON.stringify(res);
});
t('Hearts never below 0; nothing can be dropped after losing', () => {
  const g = D.newGame(C12); for (let i = 0; i < 6; i++) { const c = firstOpen(g); D.drop(g, c, wrongFor(g, c)); }
  return g.hearts === 0 && g.status === 'lost' ? true : g.hearts;
});
t('+1 heart continue works once per attempt only', () => {
  const g = D.newGame(C12); const kill = () => { for (let i = 0; i < 3 && g.status === 'play'; i++) { const c = firstOpen(g); D.drop(g, c, wrongFor(g, c)); } };
  kill(); const a = D.continueWithHeart(g); const playing = g.status === 'play' && g.hearts === 1; kill(); const b = D.continueWithHeart(g);
  return a && playing && !b && g.status === 'lost' ? true : [a, playing, b, g.status].join();
});
t('Undo cannot farm Sparks (each row/column/box pays once)', () => {
  const g = D.newGame(C12); let farmed = null, guard = 0;
  while (farmed === null && g.status === 'play' && guard++ < 50) {
    const h = D.hint(g); const before = g.lineSparks; const res = D.drop(g, h.c, h.v);
    if (res.gain > 0 && g.status === 'play') { const after = g.lineSparks; D.undo(g); D.drop(g, h.c, h.v); farmed = g.lineSparks === after ? true : 'paid again: ' + before + '->' + after + '->' + g.lineSparks; }
  }
  return farmed === null ? 'no completing drop found' : farmed;
});
t('Only 3 free undos', () => { const g = D.newGame(C12); let n = 0; for (let i = 0; i < 6; i++) { const h = D.hint(g); D.drop(g, h.c, h.v); if (D.undo(g)) n++; } return n === 3 ? true : n; });
t('Full column refused without losing a heart', () => {
  const L = board('classic').find((x) => x.givens.some((_, c) => x.givens.every((row) => row[c])));
  if (!L) return 'no Classic level starts with a full column';
  const g = D.newGame(L); const fullCol = [...Array(g.n).keys()].find((c) => D.landing(g, c) < 0);
  const res = D.drop(g, fullCol, 1); return res.kind === 'full' && g.hearts === 3 ? true : res.kind;
});
t('Stars: 3 = no mistakes and >= 25% time left; 2 = no mistakes but slow; 1 = mistakes', () => {
  const L = C12; const lim = L.timeLimit;
  const a = D.newGame(L); D.tick(a, lim - Math.ceil(lim * 0.25)); solveByHints(a);
  const b = D.newGame(L); D.tick(b, lim - Math.ceil(lim * 0.25) + 1); solveByHints(b);
  const c = D.newGame(L); const k = firstOpen(c); D.drop(c, k, wrongFor(c, k)); solveByHints(c);
  return D.result(a).stars === 3 && D.result(b).stars === 2 && D.result(c).stars === 1 ? true : [D.result(a).stars, D.result(b).stars, D.result(c).stars].join();
});
t('Economy: a strong player (no mistakes, 3/5/7s per gap on 4x4/6x6/9x9) earns 25-50 Sparks on 4x4, 40-70 on 6x6, 50-90 on 9x9, so a 400 skip = 5-16 levels', () => {
  const bad = [], pace = { 4: 3, 6: 5, 9: 7 }, range = { 4: [25, 50], 6: [40, 70], 9: [50, 90] };
  for (const L of LEVELS) { const g = D.newGame(L); D.tick(g, L.gaps * pace[L.size]); solveByHints(g); const e = D.result(g).earned; const [lo, hi] = range[L.size]; if (g.status !== 'won' || e < lo || e > hi) bad.push(L.id + '=' + e); }
  return bad.length ? bad.join(' ') : true;
});
t('Untimed mode (tutorial) never times out', () => { const g = D.newGame(LEVELS[0], { timed: false }); const fired = D.tick(g, 9999); return !fired && g.status === 'play' ? true : g.status; });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;

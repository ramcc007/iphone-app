// Fail-safe tests for the web prototype engine (prototype/web/engine.js) on the real level set (levels/levels.json).
// Run: node tools/failsafe/engine.test.js
const path = require('path');
const D = require(path.join(__dirname, '../../prototype/web/engine.js'));
const LEVELS = require(path.join(__dirname, '../../levels/levels.json')).levels;
let pass = 0, fail = 0;
function t(name, fn) { let r; try { r = fn(); } catch (e) { r = 'threw ' + e.message; } if (r === true) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, '->', r); } }
const solveByHints = (g) => { let guard = 0, fallback = 0; while (g.status === 'play' && guard++ < 200) { const h = D.hint(g); if (!h) return 'no hint'; if (/needs a/.test(h.reason)) fallback++; const res = D.drop(g, h.c, h.v); if (res.kind !== 'placed') return 'hint move was ' + res.kind; } return { status: g.status, fallback }; };
const wrongFor = (g, c) => { const r = D.landing(g, c); return g.level.solution[r][c] % g.n + 1; };
const firstOpen = (g) => { for (let c = 0; c < g.n; c++) if (D.landing(g, c) >= 0) return c; return -1; };

t('All 20 levels can be solved by following hints, using logic only (no "just trust me" hints)', () => {
  const bad = [];
  for (const L of LEVELS) { const g = D.newGame(L); const r = solveByHints(g); if (typeof r === 'string' || r.status !== 'won' || r.fallback) bad.push(L.number + ':' + JSON.stringify(r)); }
  return bad.length ? bad.join(' ') : true;
});
t('Time limits match the approved table for every level', () => { const bad = LEVELS.filter((L) => L.timeLimit !== D.timeLimit(L.number)).map((L) => L.number); return bad.length ? 'levels ' + bad : true; });
t("Time's up at 0s locks the board; clock never goes negative", () => {
  const g = D.newGame(LEVELS[11]); for (let i = 0; i < g.level.timeLimit - 1; i++) D.tick(g); const still = g.status === 'play'; const fired = D.tick(g); D.tick(g, 50);
  const c = firstOpen(g); const res = D.drop(g, c, g.level.solution[D.landing(g, c)][c]);
  return still && fired && g.status === 'timeup' && g.timeLeft === 0 && res.kind === 'inactive' && D.hint(g) === null ? true : g.status;
});
t('Clock stops after a win and after losing', () => {
  const g = D.newGame(LEVELS[0]); solveByHints(g); const t1 = g.timeLeft; D.tick(g, 5);
  const h = D.newGame(LEVELS[0]); for (let i = 0; i < 3; i++) D.drop(h, firstOpen(h), wrongFor(h, firstOpen(h))); const t2 = h.timeLeft; D.tick(h, 5);
  return g.timeLeft === t1 && h.status === 'lost' && h.timeLeft === t2 ? true : 'win ' + g.timeLeft + '/' + t1 + ' lost ' + h.status;
});
t('Wrong drop: costs a heart, board unchanged, explains why', () => {
  const g = D.newGame(LEVELS[11]); const before = JSON.stringify(g.grid); const c = firstOpen(g); const res = D.drop(g, c, wrongFor(g, c));
  return res.kind === 'wrong' && g.hearts === 2 && JSON.stringify(g.grid) === before && ['row', 'column', 'box', 'deadend'].includes(res.why) ? true : JSON.stringify(res);
});
t('Hearts never below 0; nothing can be dropped after losing', () => {
  const g = D.newGame(LEVELS[11]); for (let i = 0; i < 6; i++) { const c = firstOpen(g); D.drop(g, c, wrongFor(g, c)); }
  return g.hearts === 0 && g.status === 'lost' ? true : g.hearts;
});
t('+1 heart continue works once per attempt only', () => {
  const g = D.newGame(LEVELS[11]); const kill = () => { for (let i = 0; i < 3 && g.status === 'play'; i++) { const c = firstOpen(g); D.drop(g, c, wrongFor(g, c)); } };
  kill(); const a = D.continueWithHeart(g); const playing = g.status === 'play' && g.hearts === 1; kill(); const b = D.continueWithHeart(g);
  return a && playing && !b && g.status === 'lost' ? true : [a, playing, b, g.status].join();
});
t('Undo cannot farm Sparks (each row/column/box pays once)', () => {
  const g = D.newGame(LEVELS[11]); let farmed = null, guard = 0;
  while (farmed === null && g.status === 'play' && guard++ < 50) {
    const h = D.hint(g); const before = g.lineSparks; const res = D.drop(g, h.c, h.v);
    if (res.gain > 0 && g.status === 'play') { const after = g.lineSparks; D.undo(g); D.drop(g, h.c, h.v); farmed = g.lineSparks === after ? true : 'paid again: ' + before + '->' + after + '->' + g.lineSparks; }
  }
  return farmed === null ? 'no completing drop found' : farmed;
});
t('Only 3 free undos', () => { const g = D.newGame(LEVELS[11]); let n = 0; for (let i = 0; i < 6; i++) { const h = D.hint(g); D.drop(g, h.c, h.v); if (D.undo(g)) n++; } return n === 3 ? true : n; });
t('Full column refused without losing a heart', () => {
  const g = D.newGame(LEVELS[11]); const fullCol = [...Array(g.n).keys()].find((c) => D.landing(g, c) < 0);
  if (fullCol === undefined) return 'no full column in this level';
  const res = D.drop(g, fullCol, 1); return res.kind === 'full' && g.hearts === 3 ? true : res.kind;
});
t('Stars: 3 = no mistakes and >= 25% time left; 2 = no mistakes but slow; 1 = mistakes', () => {
  const L = LEVELS[11]; const lim = L.timeLimit;
  const a = D.newGame(L); D.tick(a, lim - Math.ceil(lim * 0.25)); solveByHints(a);
  const b = D.newGame(L); D.tick(b, lim - Math.ceil(lim * 0.25) + 1); solveByHints(b);
  const c = D.newGame(L); const k = firstOpen(c); D.drop(c, k, wrongFor(c, k)); solveByHints(c);
  return D.result(a).stars === 3 && D.result(b).stars === 2 && D.result(c).stars === 1 ? true : [D.result(a).stars, D.result(b).stars, D.result(c).stars].join();
});
t('Economy: a strong player (4s per gap, no mistakes) earns 30-50 Sparks on 4x4 and 45-70 on 6x6, so a 400 skip = 7-10 levels', () => {
  const bad = [];
  for (const L of LEVELS) { const g = D.newGame(L); D.tick(g, L.gaps * 4); solveByHints(g); const e = D.result(g).earned; const [lo, hi] = L.size === 4 ? [30, 50] : [45, 70]; if (e < lo || e > hi) bad.push(L.number + '=' + e); }
  return bad.length ? bad.join(' ') : true;
});
t('Untimed mode (tutorial) never times out', () => { const g = D.newGame(LEVELS[0], { timed: false }); const fired = D.tick(g, 9999); return !fired && g.status === 'play' ? true : g.status; });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;

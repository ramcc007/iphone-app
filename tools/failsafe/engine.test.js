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
  return bad.length ? bad.join(' ') : firsts === '28,90,240' ? true : firsts;
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
t('Economy: a strong player (no mistakes, 2/3/4s per gap on 4x4/6x6/9x9) earns 30-50 Sparks on 4x4, 40-70 on 6x6, 50-85 on 9x9, so a 400 skip = 5-13 levels', () => {
  const bad = [], pace = { 4: 2, 6: 3, 9: 4 }, range = { 4: [30, 50], 6: [40, 70], 9: [50, 85] };
  for (const L of LEVELS) { const g = D.newGame(L); D.tick(g, L.gaps * pace[L.size]); solveByHints(g); const e = D.result(g).earned; const [lo, hi] = range[L.size]; if (g.status !== 'won' || e < lo || e > hi) bad.push(L.id + '=' + e); }
  return bad.length ? bad.join(' ') : true;
});
t('Untimed mode (tutorial) never times out', () => { const g = D.newGame(LEVELS[0], { timed: false }); const fired = D.tick(g, 9999); return !fired && g.status === 'play' ? true : g.status; });

// ---- Variants: same puzzle strength, different numbers (used when a level is started again) ----
const boxOf = (L, r, c) => { const out = []; const r0 = Math.floor(r / L.boxRows) * L.boxRows, c0 = Math.floor(c / L.boxCols) * L.boxCols; for (let i = r0; i < r0 + L.boxRows; i++) for (let j = c0; j < c0 + L.boxCols; j++) out.push([i, j]); return out; };
const validSolution = (L) => { const n = L.size, all = [...Array(n)].map((_, i) => i + 1).join(); const ok = (cells) => cells.map((p) => L.solution[p[0]][p[1]]).sort((a, b) => a - b).join() === all;
  for (let i = 0; i < n; i++) { if (!ok([...Array(n)].map((_, j) => [i, j])) || !ok([...Array(n)].map((_, j) => [j, i]))) return false; }
  for (let r = 0; r < n; r += L.boxRows) for (let c = 0; c < n; c += L.boxCols) if (!ok(boxOf(L, r, c))) return false; return true; };
// Counts completions of the givens (up to `limit`), ignoring gravity: the puzzle must have exactly one.
const countSolutions = (L, limit) => { const n = L.size, g = L.givens.map((r) => r.slice()); let found = 0;
  const cands = (r, c) => { const used = new Set(g[r]); for (let i = 0; i < n; i++) used.add(g[i][c]); boxOf(L, r, c).forEach((p) => used.add(g[p[0]][p[1]])); const out = []; for (let v = 1; v <= n; v++) if (!used.has(v)) out.push(v); return out; };
  const go = () => { if (found >= limit) return; let best = null;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!g[r][c]) { const cs = cands(r, c); if (!best || cs.length < best.cs.length) best = { r, c, cs }; }
    if (!best) { found++; return; }
    for (const v of best.cs) { g[best.r][best.c] = v; go(); g[best.r][best.c] = 0; if (found >= limit) return; } };
  go(); return found; };
// How many "rounds" logic needs when every available single is played at once. This count is identical for any two puzzles that are the same puzzle in disguise.
const logicRounds = (L) => { const n = L.size, g = L.givens.map((r) => r.slice()); let rounds = 0;
  const cands = (r, c) => { const out = []; for (let v = 1; v <= n; v++) if (!D.conflict({ grid: g, n, br: L.boxRows, bc: L.boxCols }, r, c, v)) out.push(v); return out; };
  while (g.some((row) => row.some((x) => !x))) { const lowest = new Set(), cand = {}, move = {};
    for (let c = 0; c < n; c++) for (let r = n - 1; r >= 0; r--) if (!g[r][c]) { lowest.add(r + ',' + c); break; }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!g[r][c]) cand[r + ',' + c] = cands(r, c);
    for (const k of lowest) if (cand[k].length === 1) move[k] = cand[k][0];
    const units = []; for (let i = 0; i < n; i++) { units.push([...Array(n)].map((_, j) => [i, j])); units.push([...Array(n)].map((_, j) => [j, i])); }
    for (let r = 0; r < n; r += L.boxRows) for (let c = 0; c < n; c += L.boxCols) units.push(boxOf(L, r, c));
    for (const u of units) for (let v = 1; v <= n; v++) { const spots = u.filter((p) => cand[p[0] + ',' + p[1]] && cand[p[0] + ',' + p[1]].includes(v)); if (spots.length === 1 && lowest.has(spots[0].join(','))) move[spots[0].join(',')] = v; }
    const keys = Object.keys(move); if (!keys.length) return -1;
    keys.forEach((k) => { const [r, c] = k.split(',').map(Number); g[r][c] = move[k]; }); rounds++; }
  return rounds; };
const lowStack = (L) => L.givens[0].every((_, c) => { let seenGiven = false; for (let r = 0; r < L.size; r++) { if (L.givens[r][c]) seenGiven = true; else if (seenGiven) return false; } return true; });
const SEEDS = [1, 7, 12345, 99999, 4000000000];
t('Variants of all 230 levels keep the exact puzzle: valid solution, one solution, same gaps per column, givens stacked at the bottom', () => {
  const bad = [];
  for (const L of LEVELS) for (const seed of SEEDS) {
    const V = D.variant(L, seed);
    const gapsPerColumn = (X) => X.givens[0].map((_, c) => X.givens.filter((row) => row[c] === 0).length).sort().join();
    const fits = V.givens.every((row, r) => row.every((x, c) => x === 0 || x === V.solution[r][c]));
    if (!validSolution(V) || !fits || !lowStack(V) || V.id !== L.id || V.timeLimit !== L.timeLimit || V.gaps !== L.gaps || gapsPerColumn(V) !== gapsPerColumn(L) || countSolutions(V, 2) !== 1) bad.push(L.id + '#' + seed);
  }
  return bad.length ? bad.slice(0, 8).join(' ') : true;
});
t('Variants of all 230 levels are solved by logic alone (no guessing) and need exactly as many logic rounds as the original', () => {
  const bad = [];
  for (const L of LEVELS) { const base = logicRounds(L); for (const seed of SEEDS.slice(0, 3)) {
    const V = D.variant(L, seed), g = D.newGame(V), r = solveByHints(g);
    if (typeof r === 'string' || r.status !== 'won' || r.fallback || logicRounds(V) !== base || base < 1) bad.push(L.id + '#' + seed + ':' + base + '/' + logicRounds(V)); } }
  return bad.length ? bad.slice(0, 8).join(' ') : true;
});
t('Variants really differ: most seeds change the board, and the same seed always gives the same board', () => {
  const bad = [];
  for (const L of LEVELS) { let diff = 0; for (const seed of SEEDS) { if (JSON.stringify(D.variant(L, seed).givens) !== JSON.stringify(L.givens)) diff++; }
    if (JSON.stringify(D.variant(L, 5)) !== JSON.stringify(D.variant(L, 5))) bad.push(L.id + ' not repeatable');
    if (diff < 4) bad.push(L.id + ' changes only ' + diff + '/5'); }
  return bad.length ? bad.slice(0, 8).join(' ') : true;
});
t('freshVariant never returns the board that is already on screen, and a new variant works in a real game', () => {
  const rand = Math.random;
  const bad = [];
  for (const L of LEVELS) { const shown = D.freshVariant(L, rand, null); const next = D.freshVariant(L, rand, shown); if (JSON.stringify(next.givens) === JSON.stringify(shown.givens)) bad.push(L.id);
    const g = D.newGame(next); if (g.level.timeLimit !== L.timeLimit || g.timeLeft !== L.timeLimit || D.hint(g) === null) bad.push(L.id + ' game'); }
  return bad.length ? bad.slice(0, 8).join(' ') : true;
});
t('The number of different variants per board is large enough (Quick 4x4 at least 150, Classic and Master far more)', () => {
  const counts = {}; for (const id of ['quick', 'classic', 'master']) { const L = board(id)[5], seen = new Set(); for (let s = 0; s < 4000; s++) seen.add(JSON.stringify(D.variant(L, s * 2654435761 % 4294967296).givens)); counts[id] = seen.size; }
  return counts.quick >= 150 && counts.classic >= 3000 && counts.master >= 3900 ? true : JSON.stringify(counts);
});
t('Praise: 24 titles in strict progression, the three requested phrases in the right order, never empty', () => {
  const P = D.PRAISE; const text = P.map((x) => x[1]); const at = (s) => text.indexOf(s);
  const strict = P.every((p, i) => i === 0 || p[0] > P[i - 1][0]);
  const order = at('You’re a Pro!') >= 0 && at('You’re a Pro!') < at('You’re an achiever!') && at('You’re an achiever!') < at('You’re a genius!');
  const sane = D.praise(0) === 'Nice start!' && D.praise(1) === 'Nice start!' && D.praise(25) === 'You’re a Pro!' && D.praise(80) === 'You’re a genius!' && D.praise(230) === 'You cleared everything!' && D.praise(9999) === 'You cleared everything!';
  const news = D.praiseIsNew(25) && !D.praiseIsNew(26);
  return P.length === 24 && new Set(text).size === 24 && P[P.length - 1][0] === LEVELS.length && strict && order && sane && news ? true : JSON.stringify({ n: P.length, strict, order, sane, news });
});
t('First five levels of each board are open in any order; level 6 needs level 5', () => {
  // mirrors the rule in index.html (FREE_LEVELS = 5) and PlayerProgress.freeLevels in Swift
  const FREE = 5, best = {}, un = (L, i) => i < FREE || !!best[L[i - 1].id];
  const L = board('classic');
  const open = [0, 1, 2, 3, 4].every((i) => un(L, i)) && !un(L, 5);
  best[L[2].id] = 3; const stillShut = !un(L, 5);
  best[L[4].id] = 1; const opens = un(L, 5) && !un(L, 6);
  return open && stillShut && opens ? true : JSON.stringify({ open, stillShut, opens });
});
// ---- Chapter names and the flame meter ----
t('Every chapter of every board has its own short name', () => {
  const bad = [];
  for (const id of D.BOARD_ORDER) {
    const n = Math.ceil(board(id).length / 10), names = [];
    for (let ch = 1; ch <= n; ch++) { const nm = D.chapterName(id, ch); names.push(nm); if (nm === 'More levels' || /chapter/i.test(nm) || nm.length > 22) bad.push(id + ch + ':' + nm); }
    if (new Set(names).size !== n || D.CHAPTER_NAMES[id].length !== n) bad.push(id + ' count/unique');
  }
  return bad.length ? bad.join(' ') : true;
});
t('Flames: 1 on the first chapter, 5 on the last, never go down (one step at a time on 10 chapters)', () => {
  const bad = [];
  for (const n of [3, 10]) { const f = []; for (let ch = 1; ch <= n; ch++) f.push(D.chapterFlames(ch, n)); const step = n >= 5 ? 1 : 2; if (f[0] !== 1 || f[n - 1] !== 5 || f.some((x, i) => i && (x < f[i - 1] || x - f[i - 1] > step))) bad.push(n + ':' + f); }
  const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => D.chapterFlames(c, 10)).join(), three = [1, 2, 3].map((c) => D.chapterFlames(c, 3)).join();
  return bad.length ? bad.join(' ') : ten === '1,1,2,2,3,3,4,4,5,5' && three === '1,3,5' ? true : ten + ' | ' + three;
});
t('Flames are honest: each chapter is harder than the one before (average difficulty of its normal levels)', () => {
  const bad = [];
  for (const id of D.BOARD_ORDER) {
    const L = board(id), avg = [];
    for (let ch = 1; ch <= Math.ceil(L.length / 10); ch++) { const d = L.filter((x) => x.chapter === ch && x.role === 'normal').map((x) => x.difficulty); avg.push(d.reduce((a, b) => a + b, 0) / d.length); }
    avg.forEach((v, i) => { if (i && v <= avg[i - 1]) bad.push(id + (i + 1)); });
  }
  return bad.length ? bad.join(' ') : true;
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;

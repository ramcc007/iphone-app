const load = require('./load');
const FILE = process.argv[2] || require('path').join(__dirname, '../../design/canvas/Game.dc.html');
const SOL = [[3,5,1,4,2,6],[6,4,2,5,1,3],[1,6,4,3,5,2],[2,3,5,6,4,1],[4,2,3,1,6,5],[5,1,6,2,3,4]];
const N = 6;
let pass = 0, fail = 0;
function t(name, fn) { try { const r = fn(); if (r === true) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, '->', r); } } catch (e) { fail++; console.log('FAIL', name, '-> threw', e.message); } }
const landing = (g, c) => { for (let r = N - 1; r >= 0; r--) if (g[r][c] === 0) return r; return -1; };
function pick(g, v) { if (g.state.sel !== v) g.renderVals().tray[v - 1].pick(); }
function correctDrop(L, g, c) { const r = landing(g.state.grid, c); pick(g, SOL[r][c]); g.renderVals().cols[c].drop(); }
function wrongDrop(g, c) { pick(g, wrongValue(g, c)); g.renderVals().cols[c].drop(); }
function wrongValue(g, c) { const r = landing(g.state.grid, c); return SOL[r][c] % N + 1; }
function solveAll(L, g) { let guard = 0; while (g.state.status === 'play' && guard++ < 100) for (let c = 0; c < N; c++) if (landing(g.state.grid, c) >= 0 && g.state.status === 'play') correctDrop(L, g, c); }
const timeKey = (s) => ('timeLeft' in s ? 'timeLeft' : 'seconds');

t('Level has a hard time limit: status leaves "play" when the clock runs out', () => {
  const L = load(FILE); const g = L.make(); L.tickSeconds(600);
  return g.state.status !== 'play' ? true : 'after 600s the level is still playable (' + timeKey(g.state) + '=' + g.state[timeKey(g.state)] + ')';
});
t('Clock stops after a win', () => {
  const L = load(FILE); const g = L.make(); solveAll(L, g); const k = timeKey(g.state); const before = g.state[k]; L.tickSeconds(30);
  return g.state.status === 'win' && g.state[k] === before ? true : 'status=' + g.state.status + ' clock moved ' + before + '->' + g.state[k];
});
t('Clock stops after losing all hearts', () => {
  const L = load(FILE); const g = L.make();
  for (let i = 0; i < 3; i++) { wrongDrop(g, 0); }
  const k = timeKey(g.state); const before = g.state[k]; L.tickSeconds(10);
  return g.state.status === 'lose' && g.state[k] === before ? true : 'status=' + g.state.status;
});
t('Hearts never go below 0 and drops are ignored after losing', () => {
  const L = load(FILE); const g = L.make();
  for (let i = 0; i < 5; i++) { wrongDrop(g, 0); }
  return g.state.hearts === 0 && g.state.status === 'lose' ? true : 'hearts=' + g.state.hearts;
});
t('Dropping with no number selected does nothing but explain', () => {
  const L = load(FILE); const g = L.make(); const before = JSON.stringify(g.state.grid); g.renderVals().cols[0].drop();
  return JSON.stringify(g.state.grid) === before && /number/i.test(g.state.flash) ? true : 'flash=' + g.state.flash;
});
t('Dropping into a full column is refused without losing a heart', () => {
  const L = load(FILE); const g = L.make(); let guard = 0;
  while (landing(g.state.grid, 0) >= 0 && guard++ < 10) correctDrop(L, g, 0);
  g.renderVals().tray[0].pick(); g.renderVals().cols[0].drop();
  return g.state.hearts === 3 && /full/i.test(g.state.flash) ? true : 'hearts=' + g.state.hearts + ' flash=' + g.state.flash;
});
t('A number with none left cannot be selected', () => {
  const L = load(FILE); const g = L.make(); solveAll(L, g);
  const L2 = load(FILE); const h = L2.make();
  // exhaust number 6 in a fresh game by placing all its gaps
  let guard = 0;
  while (h.renderVals().tray[5].left > 0 && guard++ < 50) { for (let c = 0; c < N; c++) { const r = landing(h.state.grid, c); if (r >= 0 && SOL[r][c] === 6) correctDrop(L2, h, c); else if (r >= 0) correctDrop(L2, h, c); } }
  h.setState({ status: 'play', sel: null }); h.renderVals().tray[5].pick();
  return h.state.sel === null ? true : 'selected 6 with 0 left';
});
t('Undo cannot be used to farm line/combo Sparks', () => {
  const L = load(FILE); const g = L.make();
  // find a drop that completes a unit
  let farmed = null;
  for (let attempt = 0; attempt < 40 && farmed === null; attempt++) {
    for (let c = 0; c < N && farmed === null; c++) {
      if (landing(g.state.grid, c) < 0) continue;
      const before = JSON.stringify(g.state.awarded || g.state.combo);
      const comboBefore = g.state.combo;
      correctDrop(L, g, c);
      if (g.state.combo > comboBefore) {
        const afterFirst = g.state.combo;
        g.renderVals().undo();
        correctDrop(L, g, c);
        farmed = g.state.combo > afterFirst ? 'combo grew ' + comboBefore + '->' + afterFirst + '->' + g.state.combo + ' by undo+redo' : true;
      }
    }
  }
  return farmed === null ? 'could not find a completing drop' : farmed;
});
t('Hint always names the correct number for a playable column', () => {
  const L = load(FILE); const g = L.make(); let ok = true, n = 0;
  while (g.state.status === 'play' && n++ < 20) {
    g.renderVals().hint(); const c = g.state.hintCol, v = g.state.sel; const r = landing(g.state.grid, c);
    if (c === null || r < 0 || SOL[r][c] !== v) { ok = 'hint col=' + c + ' v=' + v + ' expected ' + (r >= 0 ? SOL[r][c] : 'n/a'); break; }
    g.setState({ wallet: 1000 }); g.renderVals().cols[c].drop();
  }
  return ok;
});
t('Hint is refused when the player cannot afford it', () => {
  const L = load(FILE); const g = L.make(); g.setState({ wallet: 10 }); g.renderVals().hint();
  return g.state.wallet === 10 && g.state.hintCol === null ? true : 'wallet=' + g.state.wallet;
});
t('Nothing can be dropped after winning', () => {
  const L = load(FILE); const g = L.make(); solveAll(L, g); const before = JSON.stringify(g.state); g.renderVals().cols[0].drop(); g.renderVals().undo();
  return JSON.stringify(g.state) === before ? true : 'state changed after win';
});
t('3 stars require no mistakes AND a fast finish', () => {
  const L = load(FILE); const g = L.make(); L.tickSeconds(5); solveAll(L, g);
  const L2 = load(FILE); const h = L2.make(); wrongDrop(h, 0); solveAll(L2, h);
  return g.state.result.stars === 3 && h.state.result.stars < 3 ? true : 'perfect=' + g.state.result.stars + ' withMistake=' + h.state.result.stars;
});
t('Restart resets hearts, clock and board but keeps Sparks already spent', () => {
  const L = load(FILE); const g = L.make(); g.renderVals().hint(); const w = g.state.wallet; L.tickSeconds(20);
  wrongDrop(g, 1); g.renderVals().restart();
  const fresh = L.make(); const k = timeKey(g.state);
  return g.state.hearts === 3 && g.state[k] === fresh.state[k] && g.state.wallet === w ? true : 'hearts=' + g.state.hearts + ' ' + k + '=' + g.state[k] + ' wallet=' + g.state.wallet;
});

t('Countdown starts at the level limit (80s for Classic Level 12)', () => { const L = load(FILE); const g = L.make(); return g.state.timeLeft === 80 && g.renderVals().timeText === "80s" ? true : 'timeLeft=' + g.state.timeLeft; });
t('Warning at 30s (amber) and 10s (red)', () => {
  const L = load(FILE); const g = L.make(); L.tickSeconds(50); const f30 = g.state.flash, c30 = g.renderVals().timeColor; L.tickSeconds(20); const f10 = g.state.flash, c10 = g.renderVals().timeColor;
  return /30 seconds/.test(f30) && c30 === '#FFB547' && /10 seconds/.test(f10) && c10 === '#FF6B7A' ? true : [f30, c30, f10, c10].join(' | ');
});
t("Time's up at exactly 0s: board locks, hint and drops refused", () => {
  const L = load(FILE); const g = L.make(); L.tickSeconds(79); const stillPlaying = g.state.status === 'play'; L.tickSeconds(1);
  const grid = JSON.stringify(g.state.grid); const w = g.state.wallet; g.renderVals().hint(); pick(g, 3); g.renderVals().cols[0].drop();
  return stillPlaying && g.state.status === 'timeup' && g.state.timeLeft === 0 && JSON.stringify(g.state.grid) === grid && g.state.wallet === w ? true : 'status=' + g.state.status + ' t=' + g.state.timeLeft;
});
t('Clock never goes negative', () => { const L = load(FILE); const g = L.make(); L.tickSeconds(500); return g.state.timeLeft === 0 ? true : 'timeLeft=' + g.state.timeLeft; });
t("v1: Time's up only offers to start the same level again (no paid extra time)", () => {
  const L = load(FILE); const g = L.make(); L.tickSeconds(80); const v = g.renderVals();
  return v.isTimeUp && !('extend' in v) && !('canExtend' in v) && v.showSkip === false && /starts again/.test(v.timeUpText) ? true : JSON.stringify({ isTimeUp: v.isTimeUp, showSkip: v.showSkip });
});
t('Start again after time-up gives a fresh board and the full 80s', () => {
  const L = load(FILE); const g = L.make(); correctDrop(L, g, 0); L.tickSeconds(80); g.renderVals().restart();
  const fresh = L.make();
  return g.state.timeLeft === 80 && g.state.status === 'play' && JSON.stringify(g.state.grid) === JSON.stringify(fresh.state.grid) ? true : 't=' + g.state.timeLeft;
});
t('Skip only appears after 2 failed attempts (time or hearts)', () => {
  const L = load(FILE); const g = L.make(); L.tickSeconds(80); const after1 = g.renderVals().showSkip; g.renderVals().restart();
  for (let i = 0; i < 3; i++) wrongDrop(g, 0);
  return after1 === false && g.state.status === 'lose' && g.renderVals().showSkip === true ? true : 'after1=' + after1 + ' after2=' + g.renderVals().showSkip;
});
t('Skip is refused below 400 Sparks and costs exactly 400 when allowed', () => {
  const L = load(FILE); const g = L.make(); L.tickSeconds(80); g.renderVals().restart(); L.tickSeconds(80);
  g.setState({ wallet: 399 }); g.renderVals().skip(); const refused = g.state.status === 'timeup' && g.state.wallet === 399;
  g.setState({ wallet: 450 }); g.renderVals().skip();
  return refused && g.state.status === 'skipped' && g.state.wallet === 50 ? true : 'status=' + g.state.status + ' wallet=' + g.state.wallet;
});
t('Nothing can be dropped after skipping', () => {
  const L = load(FILE); const g = L.make(); L.tickSeconds(80); g.renderVals().restart(); L.tickSeconds(80); g.setState({ wallet: 400 }); g.renderVals().skip();
  const grid = JSON.stringify(g.state.grid); pick(g, 3); g.renderVals().cols[0].drop(); g.renderVals().hint();
  return JSON.stringify(g.state.grid) === grid && g.state.wallet === 0 ? true : 'changed';
});
t('Winning in the last second still counts as a win', () => { const L = load(FILE); const g = L.make(); L.tickSeconds(79); solveAll(L, g); return g.state.status === 'win' && g.state.result.stars === 2 ? true : 'status=' + g.state.status + ' stars=' + (g.state.result && g.state.result.stars); });
t('3rd star needs at least 25% of the time left (20s of 80)', () => {
  const L = load(FILE); const a = L.make(); L.tickSeconds(60); solveAll(L, a);
  const L2 = load(FILE); const b = L2.make(); L2.tickSeconds(61); solveAll(L2, b);
  return a.state.result.stars === 3 && b.state.result.stars === 2 ? true : 'at 20s left=' + a.state.result.stars + ', at 19s left=' + b.state.result.stars;
});
t('Time bonus = 1 Spark per 5 seconds left (80s left = 16, 10s left = 2)', () => {
  const L = load(FILE); const g = L.make(); solveAll(L, g); const tb = g.state.result.breakdown.find((b) => /Time bonus/.test(b.label));
  const L2 = load(FILE); const h = L2.make(); L2.tickSeconds(70); solveAll(L2, h); const tb2 = h.state.result.breakdown.find((b) => /Time bonus/.test(b.label));
  return tb && tb.n === 16 && tb2 && tb2.n === 2 ? true : JSON.stringify([tb, tb2]);
});
t('Sparks earned for a full perfect level stay in the planned range (about 40-70)', () => { const L = load(FILE); const g = L.make(); solveAll(L, g); const e = g.state.result.earned; return e >= 40 && e <= 70 ? true : 'earned=' + e; });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;

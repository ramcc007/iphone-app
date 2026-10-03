const load = require('./load');
const L = load(process.argv[2] || require('path').join(__dirname, '../../design/canvas/Tutorial.dc.html'));
const S = [[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]];
let pass = 0, fail = 0;
function t(name, fn) { const r = fn(); if (r === true) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, '->', r); } }
const landing = (g, c) => { for (let r = 3; r >= 0; r--) if (g[r][c] === 0) return r; return -1; };
const pick = (g, v) => { if (g.state.sel !== v) g.renderVals().tray[v - 1].pick(); };
const drop = (g, c, v) => { pick(g, v); g.renderVals().cols[c].drop(); };
const solve = (g) => { let k = 0; while (g.state.status === 'play' && k++ < 20) for (let c = 0; c < 4; c++) { const r = landing(g.state.grid, c); if (r >= 0 && g.state.status === 'play') drop(g, c, S[r][c]); } };
t('Lesson 1 follows the guided steps and completes', () => { const g = L.make(); drop(g, 1, 2); drop(g, 3, 4); return g.state.status === 'win' ? true : g.state.status; });
t('Lesson 1-2 mistakes never cost hearts', () => { const g = L.make(); drop(g, 1, 4); drop(g, 1, 4); drop(g, 1, 4); return g.state.hearts === 3 && g.state.status === 'play' ? true : 'hearts=' + g.state.hearts; });
t('Lesson 2 explains the "4 falls to the lower gap" trap', () => { const g = L.make(); g.renderVals().nextLesson(); drop(g, 3, 4); return /LOWER gap/.test(g.state.flash) ? true : g.state.flash; });
t('Lesson 2 completes in the guided order', () => { const g = L.make(); g.renderVals().nextLesson(); drop(g, 3, 2); drop(g, 3, 4); drop(g, 2, 3); return g.state.status === 'win' ? true : g.state.status; });
t('Lesson 3 loses after 3 wrong drops, and Try again resets it', () => { const g = L.make(); g.renderVals().nextLesson(); g.renderVals().nextLesson(); for (let i = 0; i < 3; i++) drop(g, 0, 4); const lost = g.state.status === 'lose'; g.renderVals().restart(); return lost && g.state.hearts === 3 && g.state.status === 'play' ? true : 'lost=' + lost + ' hearts=' + g.state.hearts; });
t('Lesson 3 can be completed', () => { const g = L.make(); g.renderVals().nextLesson(); g.renderVals().nextLesson(); solve(g); return g.state.status === 'win' && g.renderVals().isFinal ? true : g.state.status; });
t('Tutorial has no timer (no pressure while learning)', () => { const g = L.make(); return !('seconds' in g.state) && !('timeLeft' in g.state) ? true : 'tutorial has a clock'; });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;

/* Numfall game engine (web prototype). Pure game rules, no UI.
 * The same rules will be ported to Swift for the iPhone/iPad app.
 * Works in the browser (window.Numfall) and in Node (module.exports) so tests can run it. */
(function (root) {
  'use strict';

  // The three boards, all open from the start; each is its own path of levels (docs/GAME_PLAN.md §2).
  // Seconds per level: the same for each block of 5 levels, then +5s.
  // Must match tools/levelgen/validate.py (BOARDS) and ios/NumfallCore Level.swift (Board).
  const BOARDS = {
    quick:   { name: 'Quick',   size: 4, levels: 30,  start: 28,  step: 5 },
    classic: { name: 'Classic', size: 6, levels: 100, start: 90,  step: 5 },
    master:  { name: 'Master',  size: 9, levels: 100, start: 240, step: 5 }
  };
  const BOARD_ORDER = ['quick', 'classic', 'master'];

  function timeLimit(board, level) {
    var b = BOARDS[board];
    return b.start + b.step * Math.floor((level - 1) / 5);
  }

  const LINE_SPARKS = 1;          // each row, column or box completed (once per attempt)
  const COMBO_BONUS = { 2: 1, 3: 5 }; // Double = 3 total, Triple = 8 total
  const UNDOS_FREE = 3;
  const HEARTS = 3;

  function newGame(level, opts) {
    opts = opts || {};
    return {
      level: level,
      n: level.size, br: level.boxRows, bc: level.boxCols,
      grid: level.givens.map(function (r) { return r.slice(); }),
      placed: level.givens.map(function (r) { return r.map(function () { return false; }); }),
      hearts: HEARTS,
      timed: opts.timed !== false,
      timeLeft: level.timeLimit,
      status: 'play',             // play | won | lost | timeup
      undosLeft: UNDOS_FREE,
      history: [],
      awarded: [],
      lineSparks: 0,
      mistakes: 0,
      heartBought: false
    };
  }

  function landing(g, c) {
    for (var r = g.n - 1; r >= 0; r--) if (g.grid[r][c] === 0) return r;
    return -1;
  }

  function left(g, v) {
    var used = 0;
    g.grid.forEach(function (row) { row.forEach(function (x) { if (x === v) used++; }); });
    return g.n - used;
  }

  function boxCells(g, r, c) {
    var r0 = Math.floor(r / g.br) * g.br, c0 = Math.floor(c / g.bc) * g.bc, out = [];
    for (var i = r0; i < r0 + g.br; i++) for (var j = c0; j < c0 + g.bc; j++) out.push([i, j]);
    return out;
  }

  function conflict(g, r, c, v) {
    if (g.grid[r].indexOf(v) >= 0) return 'row';
    for (var i = 0; i < g.n; i++) if (g.grid[i][c] === v) return 'column';
    var bx = boxCells(g, r, c);
    for (var k = 0; k < bx.length; k++) if (g.grid[bx[k][0]][bx[k][1]] === v) return 'box';
    return null;
  }

  function drop(g, c, v) {
    if (g.status !== 'play') return { kind: 'inactive' };
    if (!v || left(g, v) === 0) return { kind: 'nonumber' };
    var r = landing(g, c);
    if (r < 0) return { kind: 'full', c: c };
    if (g.level.solution[r][c] !== v) {
      g.hearts = Math.max(0, g.hearts - 1);
      g.mistakes++;
      if (g.hearts === 0) g.status = 'lost';
      return { kind: 'wrong', r: r, c: c, v: v, why: conflict(g, r, c, v) || 'deadend', lost: g.status === 'lost' };
    }
    g.grid[r][c] = v;
    g.placed[r][c] = true;
    g.history.push({ r: r, c: c });
    var units = [], keys = [];
    if (g.grid[r].every(function (x) { return x; })) { units.push(g.grid[r].map(function (_, j) { return [r, j]; })); keys.push('r' + r); }
    if (g.grid.every(function (row) { return row[c]; })) { units.push(g.grid.map(function (_, i) { return [i, c]; })); keys.push('c' + c); }
    var bx = boxCells(g, r, c);
    if (bx.every(function (p) { return g.grid[p[0]][p[1]]; })) { units.push(bx); keys.push('b' + Math.floor(r / g.br) + Math.floor(c / g.bc)); }
    // Each row, column and box pays once per attempt, so undo + redo cannot farm Sparks.
    var fresh = keys.filter(function (k) { return g.awarded.indexOf(k) < 0; });
    var gain = fresh.length * LINE_SPARKS;
    var combo = units.length === 3 ? 'triple' : units.length === 2 ? 'double' : units.length === 1 ? 'line' : null;
    if (fresh.length >= 2) gain += COMBO_BONUS[fresh.length] || 0;
    g.awarded = g.awarded.concat(fresh);
    g.lineSparks += gain;
    var won = g.grid.every(function (row) { return row.every(function (x) { return x; }); });
    if (won) g.status = 'won';
    return { kind: 'placed', r: r, c: c, v: v, units: units, combo: combo, gain: gain, won: won };
  }

  // Advance the countdown. Returns true when this tick ran the clock out.
  function tick(g, secs) {
    if (g.status !== 'play' || !g.timed) return false;
    g.timeLeft = Math.max(0, g.timeLeft - (secs || 1));
    if (g.timeLeft === 0) { g.status = 'timeup'; return true; }
    return false;
  }

  function undo(g) {
    if (g.status !== 'play' || !g.history.length || g.undosLeft <= 0) return false;
    var last = g.history.pop();
    g.grid[last.r][last.c] = 0;
    g.placed[last.r][last.c] = false;
    g.undosLeft--;
    return true;
  }

  // +1 heart after losing all hearts: once per attempt (the caller charges the Sparks).
  function continueWithHeart(g) {
    if (g.status !== 'lost' || g.heartBought) return false;
    g.heartBought = true;
    g.hearts = 1;
    g.status = 'play';
    return true;
  }

  // Next logical move on a playable (lowest) gap, with a plain-English reason.
  function hint(g) {
    if (g.status !== 'play') return null;
    var n = g.n, cand = {}, lowest = {};
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (g.grid[r][c] === 0) {
      var s = [];
      for (var v = 1; v <= n; v++) if (!conflict(g, r, c, v)) s.push(v);
      cand[r + ',' + c] = s;
    }
    for (c = 0; c < n; c++) { var lr = landing(g, c); if (lr >= 0) lowest[lr + ',' + c] = true; }
    var key;
    for (key in lowest) if (cand[key].length === 1) {
      var p = key.split(',').map(Number);
      return { r: p[0], c: p[1], v: cand[key][0], reason: 'Only ' + cand[key][0] + ' fits here. Its row, column and box already have every other number.' };
    }
    var units = [];
    for (r = 0; r < n; r++) units.push({ name: 'row', cells: g.grid.map(function (_, j) { return [r, j]; }) });
    for (c = 0; c < n; c++) units.push({ name: 'column', cells: g.grid.map(function (_, i) { return [i, c]; }) });
    for (var R = 0; R < n; R += g.br) for (var C = 0; C < n; C += g.bc) units.push({ name: 'box', cells: boxCells(g, R, C) });
    for (var u = 0; u < units.length; u++) for (v = 1; v <= n; v++) {
      var spots = units[u].cells.filter(function (p) { var k = p[0] + ',' + p[1]; return cand[k] && cand[k].indexOf(v) >= 0; });
      if (spots.length === 1 && lowest[spots[0][0] + ',' + spots[0][1]]) {
        return { r: spots[0][0], c: spots[0][1], v: v, reason: v + ' has nowhere else to go in this ' + units[u].name + '.' };
      }
    }
    for (c = 0; c < n; c++) { r = landing(g, c); if (r >= 0) return { r: r, c: c, v: g.level.solution[r][c], reason: 'This gap needs a ' + g.level.solution[r][c] + '.' }; }
    return null;
  }

  function result(g) {
    if (g.status !== 'won') return null;
    var noMistakes = g.mistakes === 0;
    var limit = g.level.timeLimit;
    var fast = !g.timed || g.timeLeft >= Math.ceil(limit * 0.25);
    var stars = 1 + (noMistakes ? 1 : 0) + (noMistakes && fast ? 1 : 0);
    var timeBonus = g.timed ? Math.min(20, Math.floor(g.timeLeft / 5)) : 0;
    var breakdown = [{ label: 'Level cleared', n: 10 }];
    if (g.lineSparks) breakdown.push({ label: 'Rows, columns & boxes', n: g.lineSparks });
    if (noMistakes) breakdown.push({ label: 'No mistakes', n: 10 });
    if (timeBonus) breakdown.push({ label: 'Time bonus (' + g.timeLeft + 's left)', n: timeBonus });
    return { stars: stars, breakdown: breakdown, earned: breakdown.reduce(function (a, b) { return a + b.n; }, 0) };
  }

  // ---- Same puzzle strength, different numbers ("variants") ----
  // Used when a player starts a level again, so the board cannot be memorised. Two changes keep the puzzle exactly as hard:
  //   1. Relabel the digits (every 3 becomes a 5, and so on). Every rule treats the numbers alike.
  //   2. Shuffle whole columns: swap columns inside a box-wide group, and swap the groups. Each column keeps its own stack, so
  //      the gravity order, the gaps per column, the box rules and the unique solution all stay the same.
  // Rows are never moved (the givens are stacked at the bottom of each column, and moving rows would break that).
  function seeded(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  function variant(level, seed) {
    var rand = seeded(seed), n = level.size, bc = level.boxCols, groups = n / bc;
    var digit = [0].concat(shuffled(Array.apply(null, Array(n)).map(function (_, i) { return i + 1; }), rand));   // digit[v] = new number for v
    var order = shuffled(Array.apply(null, Array(groups)).map(function (_, i) { return i; }), rand);
    var cols = [];
    order.forEach(function (gi) {
      shuffled(Array.apply(null, Array(bc)).map(function (_, i) { return gi * bc + i; }), rand).forEach(function (c) { cols.push(c); });
    });
    var remap = function (grid) { return grid.map(function (row) { return cols.map(function (c) { return row[c] ? digit[row[c]] : 0; }); }); };
    var copy = {};
    for (var k in level) copy[k] = level[k];
    copy.givens = remap(level.givens);
    copy.solution = remap(level.solution);
    return copy;
  }

  // A variant that really looks different from the board on screen (a rare repeat is re-rolled).
  function freshVariant(level, rand, avoid) {
    for (var tries = 0; tries < 8; tries++) {
      var v = variant(level, Math.floor(rand() * 4294967296));
      if (!avoid || JSON.stringify(v.givens) !== JSON.stringify(avoid.givens)) return v;
    }
    return variant(level, Math.floor(rand() * 4294967296));
  }

  // ---- Praise for clearing a level, in progression (mirrors ios/NumfallCore Praise.swift) ----
  var PRAISE = [[1, 'Nice start!'], [2, 'You’re getting it!'], [3, 'Smooth drop!'], [5, 'You’re on a roll!'], [8, 'Sharp thinking!'], [10, 'Double digits!'],
    [13, 'You’re a natural!'], [16, 'Smooth moves!'], [20, 'Brilliant!'], [25, 'You’re a Pro!'], [30, 'Puzzle power!'], [35, 'Razor sharp!'],
    [40, 'Unstoppable!'], [45, 'You’re an achiever!'], [50, 'Half a hundred!'], [60, 'Mastermind at work!'], [70, 'Number ninja!'],
    [80, 'You’re a genius!'], [90, 'Absolute legend!'], [100, 'Centurion!'], [125, 'Grandmaster!'], [150, 'Beyond brilliant!'],
    [190, 'Hall of fame!'], [230, 'You cleared everything!']];
  function praise(cleared) { var t = PRAISE[0][1]; PRAISE.forEach(function (p) { if (p[0] <= cleared) t = p[1]; }); return t; }
  function praiseIsNew(cleared) { return PRAISE.some(function (p) { return p[0] === cleared; }); }

  // ---- Chapter names and the 1-5 flame meter (mirrors ios/NumfallCore Chapters.swift) ----
  var CHAPTER_NAMES = {
    quick: ['Quick Start', 'Picking Up Pace', 'Lightning Round'],
    classic: ['First Drops', 'Finding Your Feet', 'Picking Up Speed', 'Steady Hands', 'Sharp Eyes', 'Clever Moves', 'Cool Under Pressure', 'Pattern Hunters', 'Razor Focus', 'Grand Finale'],
    master: ['Base Camp', 'Rising Ground', 'The Long Climb', 'Thin Air', 'Sharp Ridge', 'Above the Clouds', 'Storm Front', 'Sky High', 'Final Ascent', 'The Summit']
  };
  var MAX_FLAMES = 5;
  function chapterName(board, chapter) { var l = CHAPTER_NAMES[board] || []; return l[chapter - 1] || 'More levels'; }
  // First chapter of a board = 1 flame, last = 5, steady steps between (10 chapters: 1,1,2,2,3,3,4,4,5,5).
  function chapterFlames(chapter, count) {
    if (count <= 1) return 1;
    var pos = Math.min(Math.max(chapter, 1), count) - 1;
    return 1 + Math.floor((8 * pos + (count - 1)) / (2 * (count - 1)));
  }

  var api = { chapterName: chapterName, chapterFlames: chapterFlames, CHAPTER_NAMES: CHAPTER_NAMES, MAX_FLAMES: MAX_FLAMES, praise: praise, praiseIsNew: praiseIsNew, PRAISE: PRAISE, variant: variant, freshVariant: freshVariant, BOARDS: BOARDS, BOARD_ORDER: BOARD_ORDER, timeLimit: timeLimit, newGame: newGame, landing: landing, left: left, drop: drop, tick: tick, undo: undo,
    continueWithHeart: continueWithHeart, hint: hint, result: result, conflict: conflict, HEARTS: HEARTS, UNDOS_FREE: UNDOS_FREE };
  root.Numfall = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

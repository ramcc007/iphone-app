/* Dropku game engine (web prototype). Pure game rules, no UI.
 * The same rules will be ported to Swift for the iPhone/iPad app.
 * Works in the browser (window.Dropku) and in Node (module.exports) so tests can run it. */
(function (root) {
  'use strict';

  // The three boards, all open from the start; each is its own path of levels (docs/GAME_PLAN.md §2).
  // Seconds per level: the same for each block of 5 levels, then +5s.
  // Must match tools/levelgen/validate.py (BOARDS) and ios/DropkuCore Level.swift (Board).
  const BOARDS = {
    quick:   { name: 'Quick',   size: 4, levels: 30,  start: 20,  step: 5 },
    classic: { name: 'Classic', size: 6, levels: 100, start: 55,  step: 5 },
    master:  { name: 'Master',  size: 9, levels: 100, start: 180, step: 5 }
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

  var api = { BOARDS: BOARDS, BOARD_ORDER: BOARD_ORDER, timeLimit: timeLimit, newGame: newGame, landing: landing, left: left, drop: drop, tick: tick, undo: undo,
    continueWithHeart: continueWithHeart, hint: hint, result: result, conflict: conflict, HEARTS: HEARTS, UNDOS_FREE: UNDOS_FREE };
  root.Dropku = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

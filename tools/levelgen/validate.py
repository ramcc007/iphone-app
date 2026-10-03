"""Fail-safe validator for Dropku levels.

Every level must pass ALL checks before it can ship:
  1. givens match the stored solution and the solution is a valid Sudoku
  2. givens are bottom-stacked (every column is a stack, gaps only at the top)
  3. exactly one solution (otherwise a correct player move could be judged "wrong")
  4. solvable by logic while respecting gravity (only the lowest gap per column is playable)
  5. the time limit leaves a sane number of seconds per gap
Run: python3 tools/levelgen/validate.py
"""
import sys

def boxes(n):
    return {4: (2, 2), 6: (2, 3), 9: (3, 3)}[n]

def ok(g, n, r, c, v):
    br, bc = boxes(n)
    if any(g[r][j] == v for j in range(n)) or any(g[i][c] == v for i in range(n)):
        return False
    r0, c0 = r // br * br, c // bc * bc
    return all(g[i][j] != v for i in range(r0, r0 + br) for j in range(c0, c0 + bc))

def count_solutions(g, n, limit=2):
    """Count solutions up to `limit`. Always branches on the gap with the fewest candidates,
    which keeps 9x9 boards with an empty top band fast."""
    best = None
    for r in range(n):
        for c in range(n):
            if g[r][c] == 0:
                vals = [v for v in range(1, n + 1) if ok(g, n, r, c, v)]
                if best is None or len(vals) < len(best[2]):
                    best = (r, c, vals)
                    if len(vals) <= 1:
                        break
        if best and len(best[2]) <= 1:
            break
    if best is None:
        return 1
    r, c, vals = best
    total = 0
    for v in vals:
        g[r][c] = v
        total += count_solutions(g, n, limit - total)
        g[r][c] = 0
        if total >= limit:
            break
    return total

def units(n):
    br, bc = boxes(n)
    rows = [[(r, c) for c in range(n)] for r in range(n)]
    cols = [[(r, c) for r in range(n)] for c in range(n)]
    bxs = [[(r, c) for r in range(R, R + br) for c in range(C, C + bc)] for R in range(0, n, br) for C in range(0, n, bc)]
    return rows + cols + bxs

def playable_deductions(g, n):
    """Logical moves a player can make right now: (row, col, value) for lowest gaps that are
    a naked single (only one number fits) or a hidden single (the only place for a number in
    some row, column or box, counting every gap in that unit)."""
    cand = {(r, c): {v for v in range(1, n + 1) if ok(g, n, r, c, v)} for r in range(n) for c in range(n) if g[r][c] == 0}
    lowest = {}
    for c in range(n):
        rs = [r for r in range(n) if g[r][c] == 0]
        if rs:
            lowest[(max(rs), c)] = True
    moves = {}
    for cell in lowest:
        if len(cand[cell]) == 1:
            moves[cell] = next(iter(cand[cell]))
    for unit in units(n):
        for v in range(1, n + 1):
            spots = [cell for cell in unit if cell in cand and v in cand[cell]]
            if len(spots) == 1 and spots[0] in lowest:
                moves[spots[0]] = v
    return [(r, c, v) for (r, c), v in moves.items()]

def gravity_solvable(g, n):
    """Solvable by logic (naked and hidden singles) placing only on the lowest gap of each column."""
    g = [row[:] for row in g]
    while True:
        moves = playable_deductions(g, n)
        if not moves:
            break
        r, c, v = moves[0]
        g[r][c] = v
    return all(all(row) for row in g)

def valid_solution(s, n):
    for r in range(n):
        for c in range(n):
            v = s[r][c]; s[r][c] = 0
            good = ok(s, n, r, c, v); s[r][c] = v
            if not good:
                return False
    return True

def validate(name, sol, giv, time_limit=None, min_secs_per_gap=6):
    n = len(sol); errors = []
    if not valid_solution([row[:] for row in sol], n):
        errors.append('solution is not a valid Sudoku')
    for r in range(n):
        for c in range(n):
            if giv[r][c] and giv[r][c] != sol[r][c]:
                errors.append(f'given at r{r}c{c} does not match solution')
    for c in range(n):
        col = [giv[r][c] for r in range(n)]
        seen_filled = False
        for v in col:
            if v: seen_filled = True
            elif seen_filled:
                errors.append(f'column {c + 1} has a gap under a given (unreachable)'); break
    if count_solutions([row[:] for row in giv], n) != 1:
        errors.append('puzzle does not have exactly one solution')
    if not gravity_solvable(giv, n):
        errors.append('not solvable by logic under gravity')
    gaps = sum(1 for row in giv for v in row if v == 0)
    if time_limit is not None and time_limit / max(gaps, 1) < min_secs_per_gap:
        errors.append(f'time limit {time_limit}s is only {time_limit / gaps:.1f}s per gap (min {min_secs_per_gap})')
    status = 'PASS' if not errors else 'FAIL'
    extra = f', {time_limit}s = {time_limit / gaps:.1f}s/gap' if time_limit else ''
    print(f'{status} {name}: {n}x{n}, {gaps} gaps{extra}' + ''.join('\n   - ' + e for e in errors))
    return not errors

# The three boards, all open from the start. Each board is its own path of levels.
# Time limit per level (seconds): the same for each block of 5 levels, then +step.
# Must match prototype/web/engine.js (BOARDS) and ios/DropkuCore Level.swift (Board, TimeTable).
BOARDS = {
    'quick':   {'name': 'Quick',   'size': 4, 'boxRows': 2, 'boxCols': 2, 'levels': 30,  'start': 30,  'step': 5,  'minSecsPerGap': 4},
    'classic': {'name': 'Classic', 'size': 6, 'boxRows': 2, 'boxCols': 3, 'levels': 100, 'start': 75,  'step': 5,  'minSecsPerGap': 5},
    'master':  {'name': 'Master',  'size': 9, 'boxRows': 3, 'boxCols': 3, 'levels': 100, 'start': 240, 'step': 5,  'minSecsPerGap': 6},
}
BOARD_ORDER = ['quick', 'classic', 'master']

def time_limit(board, level):
    b = BOARDS[board]
    return b['start'] + b['step'] * ((level - 1) // 5)

def check_level_file(path):
    """Every level on every board, plus file-level checks. Returns a list of pass/fail booleans."""
    import json
    data = json.load(open(path))
    results = []
    if [b['id'] for b in data['boards']] != BOARD_ORDER:
        print(f"FAIL boards are {[b['id'] for b in data['boards']]}, expected {BOARD_ORDER}")
        results.append(False)
    ids, grids = set(), set()
    for board in data['boards']:
        spec = BOARDS[board['id']]
        print(f"\n{board['name']} ({board['id']}): {len(board['levels'])} levels, {spec['size']}x{spec['size']}")
        for key in ('name', 'size', 'boxRows', 'boxCols'):
            if board[key] != spec[key]:
                print(f"FAIL board {board['id']} {key} is {board[key]}, expected {spec[key]}"); results.append(False)
        if len(board['levels']) != spec['levels']:
            print(f"FAIL board {board['id']} has {len(board['levels'])} levels, expected {spec['levels']}"); results.append(False)
        for i, L in enumerate(board['levels']):
            problems = []
            expect_id = f"{board['id']}-{i + 1:03d}"
            if L['id'] != expect_id: problems.append(f"id is {L['id']}, expected {expect_id}")
            if L['id'] in ids: problems.append('duplicate id')
            if json.dumps(L['givens']) in grids: problems.append('duplicate board')
            if L['board'] != board['id']: problems.append('level is filed under the wrong board')
            if L['number'] != i + 1: problems.append('levels out of order')
            if (L['size'], L['boxRows'], L['boxCols']) != (spec['size'], spec['boxRows'], spec['boxCols']): problems.append('wrong grid size for this board')
            if L['chapter'] != i // 10 + 1: problems.append('wrong chapter')
            role = 'milestone' if L['number'] % 10 == 0 else 'breather' if L['number'] % 10 == 6 else 'normal'
            if L['role'] != role: problems.append(f"role is {L['role']}, expected {role}")
            tl = time_limit(board['id'], L['number'])
            if L['timeLimit'] != tl: problems.append(f"time limit {L['timeLimit']}s does not match the table ({tl}s)")
            gaps = sum(1 for row in L['givens'] for v in row if v == 0)
            if L['gaps'] != gaps: problems.append('gap count is wrong')
            ids.add(L['id']); grids.add(json.dumps(L['givens']))
            good = validate(f"{board['name']:<7} {L['number']:>3} {L['id']}", L['solution'], L['givens'], L['timeLimit'], spec['minSecsPerGap']) and not problems
            for p_ in problems: print('   - ' + p_)
            results.append(good)
    return results

if __name__ == '__main__':
    S4 = [[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]]
    def without(cells): return [[0 if (r, c) in cells else S4[r][c] for c in range(4)] for r in range(4)]
    S6 = [[3,5,1,4,2,6],[6,4,2,5,1,3],[1,6,4,3,5,2],[2,3,5,6,4,1],[4,2,3,1,6,5],[5,1,6,2,3,4]]
    G6 = [[0,0,0,0,0,0],[6,0,2,5,0,0],[1,0,4,3,0,0],[2,3,5,6,0,0],[4,2,3,1,0,5],[5,1,6,2,0,4]]
    results = [
        validate('Tutorial lesson 1', S4, without({(0,1),(0,3)})),
        validate('Tutorial lesson 2', S4, without({(0,3),(1,3),(0,2)})),
        validate('Tutorial lesson 3', S4, without({(0,0),(1,0),(0,2),(0,3),(1,3)})),
        validate('6x6 canvas board', S6, G6, time_limit('classic', 12), BOARDS['classic']['minSecsPerGap']),
        validate('Demo step 2 board', S4, without({(0,2),(1,2)})),
        validate('Demo step 3 board', S4, without({(0,3),(1,3)})),
    ]
    print('\nTime limit tables (same for each block of 5 levels):')
    for bid in BOARD_ORDER:
        b = BOARDS[bid]
        steps = [time_limit(bid, lv) for lv in range(1, b['levels'] + 1, 5)]
        print(f"  {b['name']:<7} {b['size']}x{b['size']}  levels 1-{b['levels']}: {steps[0]}s -> {steps[-1]}s (+{b['step']}s every 5 levels)")
    # The shipped level file.
    import os
    lf = os.path.join(os.path.dirname(__file__), '..', '..', 'levels', 'levels.json')
    if os.path.exists(lf):
        results += check_level_file(lf)
    else:
        print('FAIL levels/levels.json is missing'); results.append(False)

    # Self-check: the validator must reject each of these deliberately broken levels.
    print('\nSelf-check (each of these must be rejected):')
    broken = [
        ('gap under a given', S4, [[1,0,3,4],[3,4,1,2],[0,1,4,3],[4,3,2,1]], None),
        ('two solutions', S4, [[0,2,0,4],[0,4,0,2],[2,1,4,3],[4,3,2,1]], None),
        ('given does not match solution', S4, [[0,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,2]], None),
        ('time limit too short', S4, [[0,0,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]], 5),
    ]
    rejected = [not validate('  [broken] ' + name, sol, giv, tl) for name, sol, giv, tl in broken]
    print(f'Self-check: {sum(rejected)}/{len(broken)} broken levels rejected')
    passed = sum(1 for r in results if r)
    print(f'\n{passed}/{len(results)} checks passed')
    sys.exit(0 if all(results) and all(rejected) else 1)

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
    for r in range(n):
        for c in range(n):
            if g[r][c] == 0:
                total = 0
                for v in range(1, n + 1):
                    if ok(g, n, r, c, v):
                        g[r][c] = v
                        total += count_solutions(g, n, limit - total)
                        g[r][c] = 0
                        if total >= limit:
                            return total
                return total
    return 1

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

# Time limit per level (seconds). Same for each block of 5 levels, rising with difficulty.
def time_limit(level):
    if level <= 10:                       # 4x4
        return 60 if level <= 5 else 75
    if level <= 70:                       # 6x6: 150s, then +10s every 5 levels
        return 150 + 10 * ((level - 11) // 5)
    if level < 100:                       # 9x9: 360s, then +15s every 5 levels
        return 360 + 15 * ((level - 71) // 5)
    return 480                            # level 100 finale

if __name__ == '__main__':
    S4 = [[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]]
    def without(cells): return [[0 if (r, c) in cells else S4[r][c] for c in range(4)] for r in range(4)]
    S6 = [[3,5,1,4,2,6],[6,4,2,5,1,3],[1,6,4,3,5,2],[2,3,5,6,4,1],[4,2,3,1,6,5],[5,1,6,2,3,4]]
    G6 = [[0,0,0,0,0,0],[6,0,2,5,0,0],[1,0,4,3,0,0],[2,3,5,6,0,0],[4,2,3,1,0,5],[5,1,6,2,0,4]]
    results = [
        validate('Tutorial lesson 1', S4, without({(0,1),(0,3)})),
        validate('Tutorial lesson 2', S4, without({(0,3),(1,3),(0,2)})),
        validate('Tutorial lesson 3', S4, without({(0,0),(1,0),(0,2),(0,3),(1,3)})),
        validate('Level 12 (canvas)', S6, G6, time_limit(12)),
        validate('Demo step 2 board', S4, without({(0,2),(1,2)})),
        validate('Demo step 3 board', S4, without({(0,3),(1,3)})),
    ]
    print('\nTime limit table:')
    for start in list(range(1, 100, 5)):
        end = min(start + 4, 99)
        print(f'  Levels {start:>3}-{end:<3} {time_limit(start)}s')
    print(f'  Level  100     {time_limit(100)}s')
    # The shipped level file: every level, plus file-level checks.
    import json, os
    lf = os.path.join(os.path.dirname(__file__), '..', '..', 'levels', 'levels.json')
    if os.path.exists(lf):
        data = json.load(open(lf))
        print(f'\nlevels/levels.json ({len(data["levels"])} levels):')
        ids, boards = set(), set()
        for i, L in enumerate(data['levels']):
            problems = []
            if L['id'] in ids: problems.append('duplicate id')
            if json.dumps(L['givens']) in boards: problems.append('duplicate board')
            if L['number'] != i + 1: problems.append('levels out of order')
            if L['timeLimit'] != time_limit(L['number']): problems.append(f"time limit {L['timeLimit']}s does not match the table ({time_limit(L['number'])}s)")
            ids.add(L['id']); boards.add(json.dumps(L['givens']))
            good = validate(f"Level {L['number']:>3} {L['id']}", L['solution'], L['givens'], L['timeLimit']) and not problems
            for p_ in problems: print('   - ' + p_)
            results.append(good)

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
    sys.exit(0 if all(results) and all(rejected) else 1)

"""Build the Dropku level set (chapters 1-2: levels 1-20) as levels/levels.json.

Deterministic: the same seed always produces the same levels, so the file can be rebuilt and diffed.
Every level must pass validate.validate() (unique solution, bottom-stacked givens,
solvable by logic under gravity, enough seconds per gap) or the build fails.

Difficulty score: we replay the gravity-aware solver (naked + hidden singles on the lowest gaps) and, at each step, count how many
playable gaps can be deduced right now. Few options per step = harder to spot the next move.
    difficulty = sum over steps of (1 / options) + 0.15 * gaps
Run: python3 tools/levelgen/build_levels.py
"""
import json, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from gen import rand_solution
from validate import ok, count_solutions, gravity_solvable, playable_deductions, validate, time_limit

def solve_stats(giv, n):
    g = [row[:] for row in giv]; score = 0.0; steps = 0
    while True:
        options = playable_deductions(g, n)
        if not options:
            break
        score += 1.0 / len(options); steps += 1
        r, c, v = options[0]; g[r][c] = v
    return score, steps

def candidate(n, gaps, rng):
    for _ in range(40000):
        s = rand_solution(n)
        heights = [n] * n; e = gaps
        while e > 0:
            c = rng.randrange(n)
            if heights[c] > 1:            # keep at least one given per column so every column has a floor
                heights[c] -= 1; e -= 1
        g = [[s[r][c] if r >= n - heights[c] else 0 for c in range(n)] for r in range(n)]
        if count_solutions([row[:] for row in g], n) != 1 or not gravity_solvable(g, n):
            continue
        score, _ = solve_stats(g, n)
        return s, g, round(score + 0.15 * gaps, 2)
    raise RuntimeError(f'no level found for {n}x{n} with {gaps} gaps')

# (level, size, gaps range, role) — breather at x6, milestone at x0
PLAN = []
for lv in range(1, 21):
    size = 4 if lv <= 10 else 6
    role = 'milestone' if lv % 10 == 0 else 'breather' if lv % 10 == 6 else 'normal'
    PLAN.append((lv, size, role))

def gap_range(lv, size, role):
    if size == 4:
        base = {1: (3, 3), 2: (3, 4), 3: (4, 4), 4: (4, 5), 5: (5, 5), 6: (4, 5), 7: (6, 6), 8: (6, 7), 9: (7, 7), 10: (7, 8)}
        return base[lv]
    # Bottom-stacked givens cap uniqueness at about 17 gaps on 6x6 (and 8 on 4x4), so difficulty also comes from the score below.
    base = {11: (10, 11), 12: (11, 12), 13: (12, 12), 14: (12, 13), 15: (13, 14), 16: (11, 12), 17: (14, 14), 18: (14, 15), 19: (15, 16), 20: (16, 17)}
    return base[lv]

def main(seed=2026):
    rng = random.Random(seed); random.seed(seed)
    levels = []; seen = set(); prev = 0.0
    for lv, size, role in PLAN:
        lo, hi = gap_range(lv, size, role)
        if lv == 11:
            prev = 0.0                             # first 6x6 level: start the curve again, easy
        pool = []
        for _ in range(14):
            s, g, d = candidate(size, rng.randint(lo, hi), rng)
            if json.dumps(g) not in seen:
                pool.append((d, s, g))
        pool.sort(key=lambda x: x[0])
        if role == 'breather':
            d, s, g = pool[0]                      # noticeably easier, a breather
        else:
            harder = [p for p in pool if p[0] > prev]
            if role == 'milestone':
                d, s, g = harder[-1] if harder else pool[-1]   # the chapter's hardest
            else:
                d, s, g = harder[0] if harder else pool[-1]    # the next small step up
            prev = d
        seen.add(json.dumps(g))
        gaps = sum(1 for row in g for v in row if v == 0)
        levels.append({
            'id': f'c{1 if lv <= 10 else 2}-l{lv:03d}', 'number': lv, 'chapter': 1 if lv <= 10 else 2,
            'role': role, 'size': size, 'boxRows': 2, 'boxCols': 2 if size == 4 else 3,
            'timeLimit': time_limit(lv), 'gaps': gaps, 'difficulty': d,
            'givens': g, 'solution': s
        })
    # final gate: every level must validate
    ok_all = all(validate(f"Level {L['number']:>3} ({L['role']})", L['solution'], L['givens'], L['timeLimit']) for L in levels)
    if not ok_all:
        sys.exit('build failed: a level did not validate')
    out = os.path.join(os.path.dirname(__file__), '..', '..', 'levels', 'levels.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w') as f:
        json.dump({'version': 1, 'seed': seed, 'levels': levels}, f, indent=1)
    print(f'\nwrote {len(levels)} levels to levels/levels.json')
    for L in levels:
        print(f"  {L['number']:>3}  {L['size']}x{L['size']}  gaps {L['gaps']:>2}  time {L['timeLimit']:>3}s  difficulty {L['difficulty']:>5}  {L['role']}")

if __name__ == '__main__':
    main()

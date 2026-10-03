"""Build the Dropku level set: three boards, each its own path of levels, as levels/levels.json.

  Quick    4x4   30 levels
  Classic  6x6  100 levels
  Master   9x9  100 levels

Deterministic: the same seed always produces the same levels, so the file can be rebuilt and diffed.
Every level must pass validate.validate() (unique solution, bottom-stacked givens,
solvable by logic under gravity, enough seconds per gap) or the build fails.

How levels are made (tools/levelgen/dig.py): a random full grid, then gaps are dug from the tops of
columns one cell at a time, keeping only boards that logic can still finish under gravity.

Difficulty score (dig.difficulty): replay the gravity solver and, at each step, count how many gaps
can be deduced right now. Few options per step = harder to spot the next move.
    difficulty = sum over steps of (1 / options) + 0.15 * gaps + 0.5 * steps that need a hidden single

Ordering on each board: gaps rise steadily from the first level to the last, and normal levels follow
a straight difficulty ramp, never getting easier. Every chapter of 10 has an easier breather at x6
and its hardest level, with a milestone chest, at x0.
Run: python3 tools/levelgen/build_levels.py [pool-cache.json]
"""
import json, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from dig import make_level, difficulty
from validate import validate, time_limit, BOARDS, BOARD_ORDER

# Gaps on the first and last level of each board. Digging rarely gets past 9 gaps on 4x4,
# 21 on 6x6 and 41 on 9x9 while staying solvable by logic under gravity.
GAPS = {'quick': (5, 9), 'classic': (12, 20), 'master': (28, 40)}
MAX_GAPS = {'quick': 9, 'classic': 21, 'master': 41}
POOL_PER_GAP = {'quick': 60, 'classic': 60, 'master': 40}

def role_of(number):
    return 'milestone' if number % 10 == 0 else 'breather' if number % 10 == 6 else 'normal'

def target_gaps(board, number, role):
    lo, hi = GAPS[board]
    total = BOARDS[board]['levels']
    g = round(lo + (hi - lo) * (number - 1) / (total - 1))
    if role == 'breather':
        g -= 1 if board == 'quick' else 2
    if role == 'milestone':
        g += 1
    cap = min(MAX_GAPS[board], time_limit(board, number) // BOARDS[board]['minSecsPerGap'])
    return max(lo - 1, min(g, cap))

def build_pool(board, rng):
    """Candidate boards for every gap count this board needs: {gaps: [(difficulty, solution, givens)]}."""
    size = BOARDS[board]['size']
    needed = sorted({target_gaps(board, lv, role_of(lv)) for lv in range(1, BOARDS[board]['levels'] + 1)})
    pool = {}
    for gaps in needed:
        found, tries = [], 0
        while len(found) < POOL_PER_GAP[board] and tries < POOL_PER_GAP[board] * 60:
            tries += 1
            sol, giv = make_level(size, gaps, rng)
            if sum(1 for row in giv for v in row if v == 0) == gaps:
                found.append((difficulty(giv, size), sol, giv))
        if not found:
            raise RuntimeError(f'no {board} board with {gaps} gaps')
        found.sort(key=lambda x: x[0])
        pool[gaps] = found
        print(f'  {board}: {len(found)} boards with {gaps} gaps (difficulty {found[0][0]}-{found[-1][0]}, {tries} tries)', flush=True)
    return pool

def build_board(board, pool, seen):
    """Choose each level's board from the candidate pool.
    Normal levels follow a straight difficulty ramp from the easy end of the first pool to the hard end
    of the last, never getting easier, using their target gap count or one either side.
    Breathers come from the easy end of their pool; milestones are the hardest board left in theirs."""
    spec = BOARDS[board]
    plan = [(n, role_of(n), target_gaps(board, n, role_of(n))) for n in range(1, spec['levels'] + 1)]
    normal = [n for n, role, gaps in plan if role == 'normal']
    first, last = pool[plan[0][2]], pool[[g for n, r, g in plan if r == 'normal'][-1]]
    start_d, end_d = first[len(first) // 5][0], last[len(last) * 3 // 4][0]
    ramp = {n: start_d + (end_d - start_d) * i / (len(normal) - 1) for i, n in enumerate(normal)}
    fresh = lambda cands: [c for c in cands if json.dumps(c[1][2]) not in seen]
    levels = []; floor = 0.0
    for number, role, gaps in plan:
        if role == 'normal':
            cap = min(MAX_GAPS[board], time_limit(board, number) // spec['minSecsPerGap'])
            cands = fresh([(g, c) for g in (gaps - 1, gaps, gaps + 1) if g in pool and g <= cap for c in pool[g]])
            up = [x for x in cands if x[1][0] >= floor]
            aim = max(ramp[number], floor)
            g, (d, sol, giv) = min(up, key=lambda x: (abs(x[1][0] - aim), abs(x[0] - gaps))) if up else max(cands, key=lambda x: x[1][0])
            floor = d
        else:
            cands = [c for c in pool[gaps] if json.dumps(c[2]) not in seen]
            d, sol, giv = cands[len(cands) // 5] if role == 'breather' else cands[-1]
            g = gaps
        seen.add(json.dumps(giv))
        levels.append({
            'id': f'{board}-{number:03d}', 'board': board, 'number': number, 'chapter': (number - 1) // 10 + 1,
            'role': role, 'size': spec['size'], 'boxRows': spec['boxRows'], 'boxCols': spec['boxCols'],
            'timeLimit': time_limit(board, number), 'gaps': g, 'difficulty': d,
            'givens': giv, 'solution': sol
        })
    return {'id': board, 'name': spec['name'], 'size': spec['size'], 'boxRows': spec['boxRows'],
            'boxCols': spec['boxCols'], 'levels': levels}

def dump(data):
    """JSON with one level per line, so the file stays readable and diffs stay small."""
    out = ['{"version": %d, "seed": %d, "boards": [' % (data['version'], data['seed'])]
    for bi, b in enumerate(data['boards']):
        meta = {k: v for k, v in b.items() if k != 'levels'}
        out.append(json.dumps(meta)[:-1] + ', "levels": [')
        for li, L in enumerate(b['levels']):
            out.append(json.dumps(L, separators=(',', ':')) + (',' if li < len(b['levels']) - 1 else ''))
        out.append(']}' + (',' if bi < len(data['boards']) - 1 else ''))
    out.append(']}')
    return '\n'.join(out) + '\n'

def main(seed=2026, cache=None):
    """cache: optional path to keep the generated candidate boards, so re-ordering levels doesn't
    regenerate them (the 9x9 pool takes about 10 minutes). Same seed = same pools either way."""
    pools = None
    if cache and os.path.exists(cache):
        raw = json.load(open(cache))
        if raw.get('seed') == seed and raw.get('poolPerGap') == POOL_PER_GAP and raw.get('gaps') == {k: list(v) for k, v in GAPS.items()}:
            pools = {b: {int(g): [tuple(c) for c in cs] for g, cs in p.items()} for b, p in raw['pools'].items()}
    if pools is None:
        rng = random.Random(seed)
        pools = {board: build_pool(board, rng) for board in BOARD_ORDER}
        if cache:
            json.dump({'seed': seed, 'poolPerGap': POOL_PER_GAP, 'gaps': {k: list(v) for k, v in GAPS.items()}, 'pools': pools}, open(cache, 'w'))
    seen = set()
    data = {'version': 2, 'seed': seed, 'boards': []}
    for board in BOARD_ORDER:
        data['boards'].append(build_board(board, pools[board], seen))
    ok_all = True
    for b in data['boards']:
        for L in b['levels']:
            ok_all &= validate(f"{b['name']:<7} {L['number']:>3} ({L['role']})", L['solution'], L['givens'],
                               L['timeLimit'], BOARDS[b['id']]['minSecsPerGap'])
    if not ok_all:
        sys.exit('build failed: a level did not validate')
    text = dump(data)
    json.loads(text)                                                  # must round-trip
    root = os.path.join(os.path.dirname(__file__), '..', '..')
    for rel in ('levels/levels.json', 'ios/DropkuCore/Sources/DropkuCore/Resources/levels.json'):
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            f.write(text)
    with open(os.path.join(root, 'prototype', 'web', 'levels.js'), 'w') as f:
        f.write('/* Generated by tools/levelgen/build_levels.py from levels/levels.json. Do not edit by hand. */\n')
        f.write('window.DROPKU_BOARDS = ' + json.dumps(data['boards'], separators=(',', ':')) + ';\n')
    print('\nwrote levels/levels.json, prototype/web/levels.js and the iOS app bundle copy')
    for b in data['boards']:
        print(f"\n{b['name']} ({b['size']}x{b['size']})")
        for L in b['levels']:
            print(f"  {L['number']:>3}  gaps {L['gaps']:>2}  time {L['timeLimit']:>3}s  {L['timeLimit'] / L['gaps']:>4.1f}s/gap  difficulty {L['difficulty']:>5}  {L['role']}")

if __name__ == '__main__':
    main(cache=sys.argv[1] if len(sys.argv) > 1 else None)

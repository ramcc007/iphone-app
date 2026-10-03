"""Dig-holes level generator for every board size (4x4, 6x6, 9x9).

Start from a truly random full grid, then remove the top given of a random column, one cell at a
time. A removal is kept only if the board is still solvable by logic under gravity (naked and
hidden singles, placing only on the lowest gap of each column). Singles are sound deductions, so
a board that logic can finish has exactly one solution; validate.py still checks that separately.

Random gap placement almost never gives a unique 9x9 board (0 of 200 at 42 gaps); digging
one cell at a time keeps every board valid by construction.
"""
import random
from gen import random_solution
from validate import gravity_solvable, playable_deductions

def solve_stats(giv, n):
    """Replay the gravity solver. Returns (score, steps, hidden_only, single_option):
    hidden_only = steps where no lowest gap is a naked single (you must spot a hidden single),
    single_option = steps where exactly one move can be deduced."""
    g = [row[:] for row in giv]
    score = 0.0; steps = hidden_only = single = 0
    while True:
        moves = playable_deductions(g, n)
        if not moves:
            break
        naked = [m for m in moves if naked_single(g, n, m[0], m[1])]
        score += 1.0 / len(moves); steps += 1
        if not naked: hidden_only += 1
        if len(moves) == 1: single += 1
        r, c, v = (naked or moves)[0]
        g[r][c] = v
    return score, steps, hidden_only, single

def naked_single(g, n, r, c):
    from validate import ok
    return sum(1 for v in range(1, n + 1) if ok(g, n, r, c, v)) == 1

def difficulty(giv, n):
    """Higher = harder. Few deducible moves per step, steps that need a hidden single, and more gaps."""
    score, steps, hidden_only, _ = solve_stats(giv, n)
    gaps = sum(1 for row in giv for v in row if v == 0)
    return round(score + 0.15 * gaps + 0.5 * hidden_only, 2)

def dig(sol, n, target, rng, floor=1):
    """Remove up to `target` cells from the tops of columns, keeping the board logic-solvable under gravity.
    `floor` givens always stay at the bottom of every column. Returns the givens grid."""
    g = [row[:] for row in sol]
    height = [n] * n                    # givens left in each column
    open_cols = [c for c in range(n)]
    gaps = 0
    while gaps < target and open_cols:
        c = rng.choice(open_cols)
        if height[c] <= floor:
            open_cols.remove(c); continue
        r = n - height[c]                # top given of this column
        v = g[r][c]; g[r][c] = 0
        if gravity_solvable(g, n):
            height[c] -= 1; gaps += 1
        else:
            g[r][c] = v                  # this column cannot go lower without breaking logic
            open_cols.remove(c)
    return g

def make_level(n, target, rng, floor=1):
    sol = random_solution(n, rng)
    giv = dig(sol, n, target, rng, floor)
    return sol, giv

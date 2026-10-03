# Dropku level generator prototype: builds a random Sudoku solution, keeps bottom-stacked
# givens, and accepts the level only if it has exactly one solution and can be solved by
# logic while respecting gravity (only the lowest gap of each column is playable).

import random, itertools
def boxes(n):
    return (2,2) if n==4 else (2,3)   # box rows, box cols
def rand_solution(n):
    br,bc=boxes(n)
    # base pattern then shuffle
    base=lambda r,c:(bc*(r%br)+r//br+c)%n
    rows=[g*br+r for g in random.sample(range(n//br),n//br) for r in random.sample(range(br),br)]
    cols=[g*bc+c for g in random.sample(range(n//bc),n//bc) for c in random.sample(range(bc),bc)]
    nums=random.sample(range(1,n+1),n)
    return [[nums[base(r,c)] for c in cols] for r in rows]
def ok(g,n,r,c,v):
    br,bc=boxes(n)
    if any(g[r][j]==v for j in range(n)): return False
    if any(g[i][c]==v for i in range(n)): return False
    r0,c0=r//br*br,c//bc*bc
    return all(g[i][j]!=v for i in range(r0,r0+br) for j in range(c0,c0+bc))
def count(g,n,lim=2):
    for r in range(n):
        for c in range(n):
            if g[r][c]==0:
                t=0
                for v in range(1,n+1):
                    if ok(g,n,r,c,v):
                        g[r][c]=v; t+=count(g,n,lim-t); g[r][c]=0
                        if t>=lim: return t
                return t
    return 1
def singles_solvable(g,n):
    # gravity-aware: only the lowest empty cell of each column is playable; place when exactly one candidate (naked single)
    g=[row[:] for row in g]; steps=0
    while True:
        moved=False
        for c in range(n):
            rs=[r for r in range(n) if g[r][c]==0]
            if not rs: continue
            r=max(rs)
            cand=[v for v in range(1,n+1) if ok(g,n,r,c,v)]
            if len(cand)==1: g[r][c]=cand[0]; moved=True; steps+=1
        if not moved: break
    return all(all(x for x in row) for row in g), steps
def make(n, empties, tries=4000):
    for _ in range(tries):
        s=rand_solution(n)
        # choose column heights summing to n*n-empties
        heights=[n]*n; e=empties
        while e>0:
            c=random.randrange(n)
            if heights[c]>0: heights[c]-=1; e-=1
        g=[[s[r][c] if r>=n-heights[c] else 0 for c in range(n)] for r in range(n)]
        if count([row[:] for row in g],n)!=1: continue
        solv,steps=singles_solvable(g,n)
        if not solv: continue
        return s,g
random.seed(11)
s,g=make(6,16)
print("SOL",s); print("GIV",g)

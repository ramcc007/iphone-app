// Publish dates for a batch, in the owner's time zone.
//   backdate: random dates in the last N days, at most 3 on one date (counting posts already there).
//   schedule: random times in the next N days, 9 am to 9 pm local, at most 2 a day and at least 4 hours
//             apart, counting posts already scheduled.

// Minutes the zone is ahead of UTC at a given instant.
export function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(at)
    .reduce<Record<string, string>>((o, p) => ((o[p.type] = p.value), o), {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

export function localDate(tz: string, at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

// The UTC instant of a local wall-clock time.
export function localToUtc(tz: string, date: string, minutesOfDay: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, minutesOfDay));
  const off = tzOffsetMinutes(tz, new Date(guess.getTime() - tzOffsetMinutes(tz, guess) * 60000));
  return new Date(guess.getTime() - off * 60000);
}

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export type Rand = () => number;

export function backdateSlots(count: number, days: number, tz: string, now: Date, existing: string[], rand: Rand = Math.random): Date[] {
  if (days < 1) throw new Error('Pick at least 1 day to backdate over.');
  const today = localDate(tz, now);
  const perDay = new Map<string, number>();
  for (const iso of existing) {
    const d = localDate(tz, new Date(iso));
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const dates = Array.from({ length: days }, (_, i) => addDays(today, -(i + 1)));
  const free = dates.reduce((n, d) => n + Math.max(0, 3 - (perDay.get(d) ?? 0)), 0);
  if (free < count) throw new Error(`Only ${free} backdate slots left in the last ${days} days (at most 3 a day). Pick more days or fewer topics.`);
  const out: Date[] = [];
  while (out.length < count) {
    const d = dates[Math.floor(rand() * dates.length)];
    if ((perDay.get(d) ?? 0) >= 3) continue;
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
    out.push(localToUtc(tz, d, 9 * 60 + Math.floor(rand() * 12 * 60)));
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

const FOUR_HOURS = 4 * 3600_000;

export function scheduleSlots(count: number, days: number, tz: string, now: Date, existing: string[], rand: Rand = Math.random): Date[] {
  if (days < 1) throw new Error('Pick at least 1 day to schedule over.');
  const today = localDate(tz, now);
  const taken = existing.map(iso => new Date(iso)).filter(d => d.getTime() > now.getTime() - FOUR_HOURS);
  // Every quarter hour from 9:00 to 21:00 local, today (if still ahead, with 30 minutes' room) to day N.
  const candidates: Date[] = [];
  for (let i = 0; i <= days; i++) {
    const d = addDays(today, i);
    for (let m = 9 * 60; m <= 21 * 60; m += 15) {
      const t = localToUtc(tz, d, m);
      if (t.getTime() > now.getTime() + 30 * 60_000 && t.getTime() <= now.getTime() + days * 86400_000 + 86400_000) candidates.push(t);
    }
  }
  const ok = (t: Date, chosen: Date[]) => {
    const all = [...taken, ...chosen];
    if (all.some(x => Math.abs(x.getTime() - t.getTime()) < FOUR_HOURS)) return false;
    const day = localDate(tz, t);
    return all.filter(x => localDate(tz, x) === day).length < 2;
  };
  // Random picks; if the window fills up before every topic has a slot, say so instead of breaking the rules.
  for (let attempt = 0; attempt < 40; attempt++) {
    const pool = [...candidates].sort(() => rand() - 0.5);
    const chosen: Date[] = [];
    for (const t of pool) {
      if (chosen.length >= count) break;
      if (ok(t, chosen)) chosen.push(t);
    }
    if (chosen.length >= count) return chosen.sort((a, b) => a.getTime() - b.getTime());
  }
  throw new Error(`The next ${days} days don't have room for ${count} more posts (at most 2 a day, 4 hours apart, 9 am to 9 pm). Pick more days or fewer topics.`);
}

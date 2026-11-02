// Small grammar slips added in code after writing, at the chosen density. Grammar only, never spelling.
// Never in headings, FAQ questions, quotes, links or numbers, and never in the article's first sentence
// (often the one that defines the topic). Repeatable per article (seeded).
import type { Block, Faq, SlipLevel } from './types';

type Rule = { kind: string; apply: (s: string) => string | null };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const RULES: Rule[] = [
  {
    kind: 'dropped "the"',
    apply: s => {
      const m = s.match(/\b([Tt])he (grid|board|puzzle|timer|game|row|column|tray|app|level|rule|clock)\b(?! (?:is|was|has))/);
      if (!m || m.index === undefined || m.index === 0) return null;
      return s.slice(0, m.index) + (m[1] === 'T' ? cap(m[2]) : m[2]) + s.slice(m.index + m[0].length);
    },
  },
  { kind: '"a few" to "few"', apply: s => (/\b a few\b/.test(s) ? s.replace(/ a few\b/, ' few') : null) },
  { kind: '"fewer" to "less"', apply: s => (/\bfewer\b/.test(s) ? s.replace(/\bfewer\b/, 'less') : null) },
  { kind: 'comma dropped before "but"', apply: s => (/, but /.test(s) && s.split(/\s+/).length > 14 ? s.replace(/, but /, ' but ') : null) },
  { kind: 'comma dropped before "and"', apply: s => (/, and /.test(s) && s.split(/\s+/).length > 16 ? s.replace(/, and /, ' and ') : null) },
  { kind: '"until" to "till"', apply: s => (/\buntil\b/.test(s) ? s.replace(/\buntil\b/, 'till') : null) },
  { kind: '"there are" to "there\'s"', apply: s => (/\b([Tt])here are (many|several|some|more|two|three|a few)\b/.test(s) ? s.replace(/\b([Tt])here are\b/, "$1here's") : null) },
  { kind: '"each of them" agreement', apply: s => (/\beach of (?:them|these) (?:is|has)\b/.test(s) ? s.replace(/\beach of (them|these) (is|has)\b/, (_m, w, v) => `each of ${w} ${v === 'is' ? 'are' : 'have'}`) : null) },
  { kind: '"who" to "that" for people', apply: s => (/\b(players|solvers|beginners|kids|people) who\b/.test(s) ? s.replace(/\b(players|solvers|beginners|kids|people) who\b/, '$1 that') : null) },
  { kind: '"most Xs" to "most of Xs"', apply: s => (/\b([Mm])ost (players|solvers|beginners|puzzles|levels|people)\b/.test(s) ? s.replace(/\b([Mm])ost (players|solvers|beginners|puzzles|levels|people)\b/, '$1ost of $2') : null) },
  { kind: '"different from" to "different than"', apply: s => (/\bdifferent from\b/.test(s) ? s.replace(/\bdifferent from\b/, 'different than') : null) },
  { kind: '"try to" to "try and"', apply: s => (/\btry to (\w+)\b/.test(s) ? s.replace(/\btry to\b/, 'try and') : null) },
  { kind: '"whether" to "if"', apply: s => (/\bwhether\b(?! or not)/.test(s) ? s.replace(/\bwhether\b/, 'if') : null) },
];

function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const split = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-Z"])/);
// Quotes, links, numbers-heavy sentences and the NumFall App Store sentence stay as written.
const unsafe = (s: string) => /["\[\]()]|https?:|\d/.test(s);

export function addSlips(body: Block[], faq: Faq[], seed: string, level: SlipLevel): { body: Block[]; faq: Faq[]; count: number } {
  if (level === 'off') return { body, faq, count: 0 };
  const b = body.map(x => (x.type === 'ul' || x.type === 'ol' ? { ...x, items: [...x.items] } : { ...x }));
  const f = faq.map(x => ({ ...x }));
  const firstP = b.findIndex(x => x.type === 'p');
  type Spot = { get: () => string; set: (v: string) => void; skipFirst: boolean; key: string };
  const spots: Spot[] = [];
  b.forEach((x, i) => {
    if (x.type === 'p') spots.push({ get: () => (b[i] as { text: string }).text, set: v => ((b[i] as { text: string }).text = v), skipFirst: i === firstP, key: `b${i}` });
  });
  f.forEach((_x, i) => spots.push({ get: () => f[i].a, set: v => (f[i].a = v), skipFirst: false, key: `f${i}` }));
  const totalWords = spots.reduce((n, s) => n + s.get().split(/\s+/).length, 0);
  const target = level === 'heavy' ? Math.ceil(totalWords / 60) : Math.floor(totalWords / 150);
  const rand = rng(seed);
  const order = spots.map((s, i) => ({ s, r: rand(), i })).sort((a, z) => a.r - z.r);
  const kinds = new Map<string, number>();
  let count = 0;
  for (const { s } of order) {
    if (count >= target) break;
    const parts = split(s.get());
    const idx = parts.map((_p, j) => j).filter(j => !(s.skipFirst && j === 0)).sort(() => rand() - 0.5);
    for (const j of idx) {
      if (unsafe(parts[j])) continue;
      const rules = RULES.filter(r => (kinds.get(r.kind) ?? 0) < (level === 'heavy' ? 4 : 2)).sort(() => rand() - 0.5);
      const hit = rules.map(r => ({ r, out: r.apply(parts[j]) })).find(x => x.out && x.out !== parts[j]);
      if (!hit) continue;
      parts[j] = hit.out!;
      s.set(parts.join(' '));
      kinds.set(hit.r.kind, (kinds.get(hit.r.kind) ?? 0) + 1);
      count++;
      break; // at most one per paragraph
    }
  }
  return { body: b, faq: f, count };
}

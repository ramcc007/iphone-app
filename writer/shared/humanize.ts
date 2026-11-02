// The humanizer's offline parts: which pieces get rewritten, how a rewrite is cleaned, and the fact
// guard that keeps the original when a number or name changes or goes missing.
import type { Block, Faq, HumanizeUnit } from './types';
import { isNonEnglish } from './clean';

const wc = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
// Short lines and anything with a link stay as written; FAQ questions stay as people type them.
const usable = (t: string) => wc(t) >= 8 && !t.includes('](');

export function humanizeUnits(body: Block[], faq: Faq[]): HumanizeUnit[] {
  const out: HumanizeUnit[] = [];
  body.forEach((b, i) => {
    if (b.type === 'p' && usable(b.text)) out.push({ path: `body.${i}`, original: b.text, state: 'pending' });
    if (b.type === 'ul' || b.type === 'ol') b.items.forEach((it, j) => usable(it) && out.push({ path: `body.${i}.${j}`, original: it, state: 'pending' }));
  });
  faq.forEach((f, i) => usable(f.a) && out.push({ path: `faq.${i}`, original: f.a, state: 'pending' }));
  return out;
}

export function applyUnits(body: Block[], faq: Faq[], units: HumanizeUnit[]): { body: Block[]; faq: Faq[] } {
  const b = body.map(x => (x.type === 'ul' || x.type === 'ol' ? { ...x, items: [...x.items] } : { ...x }));
  const f = faq.map(x => ({ ...x }));
  for (const u of units) {
    if (u.state !== 'done' || !u.text) continue;
    const [where, a, c] = u.path.split('.');
    const i = Number(a);
    if (where === 'faq') {
      if (f[i]) f[i].a = u.text;
      continue;
    }
    const blk = b[i];
    if (!blk) continue;
    if (c === undefined && blk.type === 'p') blk.text = u.text;
    else if (c !== undefined && (blk.type === 'ul' || blk.type === 'ol') && blk.items[Number(c)] !== undefined) blk.items[Number(c)] = u.text;
  }
  return { body: b, faq: f };
}

// Small models sometimes add "Here is the rewritten paragraph:", wrap the answer in quotes or add a note.
export function cleanRewrite(raw: string, original: string): string {
  let t = raw.trim();
  t = t.replace(/^(?:(?:sure|okay|ok)[,!.]?\s*)?(?:here(?:'s| is)|below is)[^\n:]*:\s*/i, '');
  t = t.replace(/^(?:rewritten|rewrite|paraphrased?|revised)[^\n:]*:\s*/i, '');
  const paras = t.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  t = paras.filter(p => !/^(?:note|i (?:have|kept|changed|rewrote))\b/i.test(p)).join(' ');
  if (!/^"/.test(original)) t = t.replace(/^["“]([\s\S]*)["”]$/, '$1');
  return t.replace(/\s*\n\s*/g, ' ').replace(/\*\*/g, '').replace(/(\d)\s+%/g, '$1%').replace(/\s{2,}/g, ' ').trim();
}

const normPct = (t: string) => t.replace(/(\d)\s*(?:percent|per cent)\b/gi, '$1%').replace(/(\d)\s+%/g, '$1%');
const NUM_WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' };
const figures = (t: string) => (normPct(t).replace(/[×x](?=\d)/g, ' ').match(/\d[\d,]*(?:\.\d+)?%?/g) ?? []).map(n => n.replace(/,/g, ''));

// Names a rewrite must keep: acronyms and capitalised words that don't start a sentence.
export function protectedWords(t: string): string[] {
  const out = new Set<string>();
  for (const s of t.split(/(?<=[.!?])\s+/)) {
    (s.match(/[A-Za-z][A-Za-z'.&-]*/g) ?? []).forEach((w, i) => {
      const bare = w.replace(/['.]+$/, '').replace(/'s$/, '');
      if (/^[A-Z]{2,}s?$/.test(bare)) out.add(bare.replace(/s$/, ''));
      else if (i > 0 && /^[A-Z][a-z]/.test(bare) && bare !== 'I') out.add(bare);
      else if (/^i[A-Z]/.test(bare)) out.add(bare); // iPhone, iPad, iCloud
    });
  }
  return [...out];
}

const quotes = (t: string) => [...t.matchAll(/"([^"]+)"/g)].map(m => m[1].trim()).filter(q => wc(q) >= 3);

// Why a rewrite must be rejected, or null when every fact survived.
export function factProblem(original: string, candidate: string): string | null {
  if (!candidate.trim()) return 'empty rewrite';
  if (isNonEnglish(candidate)) return 'not in English';
  if (/\((?:keep exactly|do not translate|translation|translator)/i.test(candidate) || /\btranslat(?:ed|ion) note\b/i.test(candidate)) return 'carries a translation note';
  const o = figures(original);
  const c = figures(candidate.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, w => NUM_WORDS[w.toLowerCase()]));
  for (const n of o) if (!c.includes(n)) return `number ${n} is missing`;
  for (const n of c) if (!o.includes(n) && !(Number(n) <= 10 && !n.endsWith('%'))) return `new number ${n}`;
  for (const q of quotes(original)) if (!candidate.includes(q)) return 'a quote changed';
  for (const w of protectedWords(original)) if (!new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(candidate)) return `"${w}" is missing`;
  const r = wc(candidate) / Math.max(1, wc(original));
  if (r < 0.6 || r > 1.8) return 'length changed too much';
  return null;
}

// Share of the rewrite's word pairs found in the original; above 0.8 it barely changed.
export function sameness(original: string, candidate: string): number {
  const pairs = (t: string) => {
    const w = t.toLowerCase().match(/[a-z0-9%]+/g) ?? [];
    return w.slice(1).map((x, i) => `${w[i]} ${x}`);
  };
  const o = new Set(pairs(original));
  const c = pairs(candidate);
  return c.length ? c.filter(p => o.has(p)).length / c.length : 1;
}

import type { Block, Faq } from './types';

export const words = (s: string) => (s.match(/\S+/g) ?? []).length;

export function stripLinks(s: string): string {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

export function bodyWords(body: Block[]): number {
  return body.reduce((n, b) => n + (b.type === 'ul' || b.type === 'ol' ? b.items.reduce((m, i) => m + words(stripLinks(i)), 0) : words(stripLinks(b.text))), 0);
}

// What a reader sees, in page order, as plain text. This is what GPTZero scans.
export function plainText(title: string, body: Block[], faq: Faq[]): string {
  const parts = [title];
  for (const b of body) parts.push(b.type === 'ul' || b.type === 'ol' ? b.items.map(stripLinks).join('\n') : stripLinks(b.text));
  for (const f of faq) parts.push(`${f.q}\n${stripLinks(f.a)}`);
  return parts.join('\n\n');
}

const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|Inc|Ltd|Co|No|approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.$/i;

export function sentences(text: string): string[] {
  const out: string[] = [];
  for (const chunk of text.split(/\n+/)) {
    const t = chunk.trim();
    if (!t) continue;
    let buf = '';
    for (const piece of t.split(/(?<=[.!?])["')]?\s+(?=["'(]?[A-Z0-9])/)) {
      buf = buf ? `${buf} ${piece}` : piece;
      if (ABBREV.test(buf.trim())) continue;
      out.push(buf.trim());
      buf = '';
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SLUG_STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'your', 'you', 'how', 'why', 'what', 'is', 'are', 'it', 'its', 'do', 'does']);

// 3 to 6 lowercase hyphenated words. Drops filler words first when the plan's slug runs long.
export function cleanSlug(raw: string, fallback: string): string {
  let parts = slugify(raw || fallback).split('-').filter(Boolean);
  if (parts.length > 6) {
    const kept = parts.filter(p => !SLUG_STOP.has(p));
    parts = (kept.length >= 3 ? kept : parts).slice(0, 6);
  }
  if (parts.length < 3) {
    const extra = slugify(fallback).split('-').filter(p => p && !parts.includes(p));
    parts = [...parts, ...extra].slice(0, Math.max(3, parts.length));
  }
  while (parts.length < 3) parts.push(['guide', 'tips', 'puzzles'][parts.length] ?? 'guide');
  return parts.slice(0, 6).join('-');
}

export function readingMinutes(n: number): number {
  return Math.max(1, Math.round(n / 230));
}

// Sentence case: first letter capital, the rest as written unless a word is Title Cased for no reason.
export function sentenceCase(h: string): string {
  const ws = h.trim().split(/\s+/);
  return ws
    .map((w, i) => {
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1);
      if (/^[A-Z][a-z]+$/.test(w) && !KEEP_CAPS.has(w)) return w.toLowerCase();
      return w;
    })
    .join(' ');
}
const KEEP_CAPS = new Set(['NumFall', 'Daily', 'Drop', 'Sparks', 'Game', 'Center', 'iCloud', 'VoiceOver', 'Dynamic', 'Type', 'Reduce', 'Motion', 'Quick', 'Classic', 'Master', 'Apple', 'iPhone', 'iPad', 'Mac', 'App', 'Store', 'English', 'American', 'British', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Latin', 'Euler', 'Frontiers', 'Psychology', 'I']);

// The "shape" of a title: the title with the topic words taken out. Two titles with the same shape
// ("How to X: 7 tips for beginners") read as a template.
export function titleShape(title: string, topic: string): string {
  const topicWords = new Set(slugify(topic).split('-').filter(w => w.length > 2));
  return slugify(title)
    .split('-')
    .map(w => (topicWords.has(w) ? '_' : /^\d+$/.test(w) ? '#' : w))
    .filter((w, i, a) => !(w === '_' && a[i - 1] === '_'))
    .join(' ');
}

export function normHeading(h: string): string {
  return slugify(h).replace(/-/g, ' ');
}

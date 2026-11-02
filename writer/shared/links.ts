// Internal links use phrases already in the text: [phrase](/blog/slug), first match in a paragraph or
// list item, never in a heading, never inside an existing link, at most one link per paragraph.
import type { Block } from './types';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function insertLink(body: Block[], anchor: string, href: string): Block[] | null {
  const a = anchor.trim();
  if (a.split(/\s+/).length < 2 || a.length > 80) return null;
  const re = new RegExp(`(^|[^\\w\\[])(${esc(a)})(?![\\w\\]])`, 'i');
  const linked = (t: string) => /\]\(/.test(t);
  for (let i = 0; i < body.length; i++) {
    const b = body[i];
    if (b.type === 'p') {
      if (linked(b.text) || i === body.findIndex(x => x.type === 'p')) continue; // not in the opening paragraph
      const m = b.text.match(re);
      if (!m) continue;
      const out = [...body];
      out[i] = { type: 'p', text: b.text.replace(re, `$1[$2](${href})`) };
      return out;
    }
    if (b.type === 'ul' || b.type === 'ol') {
      const j = b.items.findIndex(it => !linked(it) && re.test(it));
      if (j === -1) continue;
      const items = [...b.items];
      items[j] = items[j].replace(re, `$1[$2](${href})`);
      const out = [...body];
      out[i] = { ...b, items };
      return out;
    }
  }
  return null;
}

export const linkTargets = (text: string) => [...text.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]);

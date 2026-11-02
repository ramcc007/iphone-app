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

// Bare web addresses become proper links with readable words:
//   "on the App Store at https://apps.apple.com/..." -> "on [the App Store](https://apps.apple.com/...)"
//   any other App Store address                    -> "[NumFall on the App Store](...)"
//   numfall.store addresses                         -> "[numfall.store](...)" (or the page's path)
//   other sites                                     -> "[example.org](...)"
// Text already inside a markdown link is left alone.
const BARE_URL = /https?:\/\/[^\s<>"')\]]+/g;
export function linkifyBare(t: string): string {
  if (!/https?:\/\//.test(t)) return t;
  const parts = t.split(/(\[[^\]]+\]\([^)]+\))/);
  return parts
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // an existing markdown link
      let out = '';
      let last = 0;
      for (const m of seg.matchAll(BARE_URL)) {
        let url = m[0];
        const trail = url.match(/[.,;:!?]+$/)?.[0] ?? '';
        if (trail) url = url.slice(0, -trail.length);
        let before = seg.slice(last, m.index);
        let host = '';
        try {
          host = new URL(url).host.replace(/^www\./, '');
        } catch {
          out += before + m[0];
          last = (m.index ?? 0) + m[0].length;
          continue;
        }
        let link: string;
        if (host === 'apps.apple.com') {
          const lead = before.match(/\b(the App Store)\s*(?:at|here|via|on|:)?\s*:?\s*$/i);
          if (lead) {
            before = before.slice(0, before.length - lead[0].length);
            link = `[${lead[1]}](${url})`;
            if (before && !/\s$/.test(before)) before += ' ';
          } else link = `[NumFall on the App Store](${url})`;
        } else if (host === 'numfall.store') {
          const path = new URL(url).pathname.replace(/\/$/, '');
          link = `[${path && path !== '' ? `numfall.store${path}` : 'numfall.store'}](${url})`;
        } else link = `[${host}](${url})`;
        out += before + link + trail;
        last = (m.index ?? 0) + m[0].length;
      }
      return out + seg.slice(last);
    })
    .join('');
}

// For HTML already on the site: bare addresses in text (not inside tags or links) become links.
export function linkifyHtml(html: string): string {
  return html.replace(/(<a\b[\s\S]*?<\/a>)|(<[^>]+>)|([^<]+)/g, (m, a, tag, text) => {
    if (a || tag || !text || !/https?:\/\//.test(text)) return m;
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 $2').replace(BARE_URL, (u: string) => {
      const trail = u.match(/[.,;:!?]+$/)?.[0] ?? '';
      const url = (trail ? u.slice(0, -trail.length) : u).replace(/&amp;/g, '&');
      let label = url;
      try {
        const h = new URL(url).host.replace(/^www\./, '');
        label = h === 'apps.apple.com' ? 'NumFall on the App Store' : h;
      } catch {
        return u;
      }
      const ext = !/^https:\/\/www\.numfall\.store/.test(url);
      return `<a href="${url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"${ext ? ' rel="noopener" target="_blank"' : ''}>${label}</a>${trail}`;
    });
  });
}

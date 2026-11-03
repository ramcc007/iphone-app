// Article blocks to the HTML stored in public.posts.html. The page adds the app cards, FAQ and extras.
import type { Block } from './types';
import { linkifyBare } from './links';

export const escapeHtml = (s: string | null | undefined) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Allowed link targets: our own /blog/<slug>, the home page, and the App Store link.
const SAFE_HREF = /^(?:\/blog\/[a-z0-9-]+|\/|https:\/\/www\.numfall\.store\/[a-z0-9/-]*|https:\/\/apps\.apple\.com\/[A-Za-z0-9/?=&._%-]+)$/;

export function inline(t: string): string {
  let out = '';
  let last = 0;
  for (const m of t.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    out += escapeHtml(t.slice(last, m.index));
    const href = m[2];
    if (SAFE_HREF.test(href)) {
      const ext = href.startsWith('https://apps.apple.com');
      out += `<a href="${escapeHtml(href)}"${ext ? ' rel="noopener" target="_blank"' : ''}>${escapeHtml(m[1])}</a>`;
    } else out += escapeHtml(m[1]);
    last = (m.index ?? 0) + m[0].length;
  }
  return out + escapeHtml(t.slice(last));
}

export const headingId = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export const APP_CARD_MARK = '<!--app-card-->';

export function blocksToHtml(body: Block[]): string {
  const h2s = body.map((b, i) => (b.type === 'h2' ? i : -1)).filter(i => i >= 0);
  // The mid-article app card goes before the middle heading (or after the 3rd paragraph if there are few headings).
  const mid = h2s.length >= 2 ? h2s[Math.floor(h2s.length / 2)] : Math.min(body.length, 3);
  return body
    .map((b, i) => {
      const pre = i === mid ? APP_CARD_MARK + '\n' : '';
      if (b.type === 'h2') return `${pre}<h2 id="${headingId(b.text)}">${escapeHtml(b.text)}</h2>`;
      if (b.type === 'p') return `${pre}<p>${inline(linkifyBare(b.text))}</p>`;
      const tag = b.type;
      return `${pre}<${tag}>${b.items.map(it => `<li>${inline(linkifyBare(it))}</li>`).join('')}</${tag}>`;
    })
    .join('\n');
}

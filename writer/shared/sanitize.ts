// HTML from the blog editor is cleaned before it is saved: only simple text tags survive, links keep only a
// safe href, and everything else (scripts, styles, event handlers, images, iframes) is dropped.
const ALLOWED = new Set(['p', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'a']);
const VOID = new Set(['hr', 'br']);
const RENAME: Record<string, string> = { b: 'strong', i: 'em' };
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math|head|title)\b[\s\S]*?<\/\1\s*>/gi;
const SAFE_HREF = /^(?:https?:\/\/[^\s"'<>]+|\/[a-z0-9/_?=&.#-]*|mailto:[^\s"'<>]+)$/i;

const escapeText = (t: string) => t.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sanitizeHtml(input: string): string {
  let html = input.replace(DROP_WITH_CONTENT, '');
  // Keep only the app-card marker comment; drop every other comment.
  html = html.replace(/<!--([\s\S]*?)-->/g, (_m, c: string) => (c.trim() === 'app-card' ? '\u0000APPCARD\u0000' : ''));
  const out: string[] = [];
  const open: string[] = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)|(<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) {
      out.push(escapeText(m[3]));
      continue;
    }
    if (m[4]) {
      out.push('&lt;');
      continue;
    }
    const raw = m[0];
    const tag0 = m[1].toLowerCase();
    const tag = RENAME[tag0] ?? tag0;
    if (!ALLOWED.has(tag0)) continue;
    if (raw.startsWith('</')) {
      const i = open.lastIndexOf(tag);
      if (i === -1) continue;
      while (open.length > i) out.push(`</${open.pop()}>`);
      continue;
    }
    if (VOID.has(tag)) {
      out.push(`<${tag}>`);
      continue;
    }
    if (tag === 'a') {
      const href = (m[2].match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i) ?? [])[2] ?? (m[2].match(/\bhref\s*=\s*'([^']*)'/i) ?? [])[1] ?? '';
      const h = href.replace(/&amp;/g, '&').trim();
      if (!SAFE_HREF.test(h)) {
        open.push('__skip_a');
        continue;
      }
      const ext = /^https?:/i.test(h) && !/^https:\/\/www\.numfall\.store/i.test(h);
      out.push(`<a href="${h.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"${ext ? ' rel="noopener" target="_blank"' : ''}>`);
      open.push('a');
      continue;
    }
    out.push(`<${tag}>`);
    open.push(tag);
  }
  while (open.length) {
    const t = open.pop()!;
    if (t !== '__skip_a') out.push(`</${t}>`);
  }
  return out
    .join('')
    .replace(/<\/__skip_a>/g, '')
    .replace(/\u0000APPCARD\u0000/g, '<!--app-card-->')
    .replace(/<p>\s*(?:<br>)?\s*<\/p>/g, '')
    .trim();
}

export function htmlText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

export function htmlHeadings(html: string): string[] {
  return [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(x => htmlText(x[1])).filter(Boolean);
}

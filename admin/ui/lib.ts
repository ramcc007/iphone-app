// Small helpers shared by the numfall.store admin screens: API calls, escaping, dates in the site's time zone.

export class ApiError extends Error {
  constructor(public status: number, message: string, public data: Record<string, unknown> = {}) {
    super(message);
  }
}

// Every call goes to /api/admin/*; the server checks the admin cookie on each one.
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(`/api/admin/${path}`, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : {},
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await r.json()) as Record<string, unknown>;
  } catch {}
  if (!r.ok) {
    if (r.status === 401 && path !== 'login') window.dispatchEvent(new CustomEvent('admin:signed-out'));
    throw new ApiError(r.status, String(data.error ?? `Request failed (${r.status}).`), data);
  }
  return data as T;
}

export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll(sel)] as T[];

export function fmtDate(iso: string | undefined, tz: string, withTime = true): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(new Date(iso));
}

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function relative(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '';
  const s = (Date.parse(iso) - now) / 1000;
  const a = Math.abs(s);
  if (a < 60) return s >= 0 ? 'in a moment' : 'just now';
  if (a < 3600) return RTF.format(Math.round(s / 60), 'minute');
  if (a < 86400) return RTF.format(Math.round(s / 3600), 'hour');
  if (a < 86400 * 45) return RTF.format(Math.round(s / 86400), 'day');
  if (a < 86400 * 365) return RTF.format(Math.round(s / (86400 * 30)), 'month');
  return RTF.format(Math.round(s / (86400 * 365)), 'year');
}

// <input type="datetime-local"> values are shown in the site's time zone, stored as UTC.
export function utcToLocalInput(iso: string, tz: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function localInputToUtc(v: string, tz: string): string {
  const [d, t] = v.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = (t ?? '00:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (shown - guess)).toISOString();
}

export function toast(msg: string, bad = false): void {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast show${bad ? ' bad' : ''}`;
  clearTimeout((t as unknown as { _h?: number })._h);
  (t as unknown as { _h?: number })._h = window.setTimeout(() => t!.classList.remove('show'), bad ? 7000 : 3500);
}

// Inline icons (no icon font, nothing loaded from elsewhere).
const svg = (d: string) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const ICON = {
  view: svg('M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'),
  preview: svg('M3 3h18v14H3z M8 21h8 M12 17v4 M9 10l2 2 4-4'),
  edit: svg('M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'),
  trash: svg('M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14 M10 11v6 M14 11v6'),
  publish: svg('M5 12l5 5L20 7'),
  plus: svg('M12 5v14 M5 12h14'),
  out: svg('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3'),
};

// Admin dashboard: traffic snapshot from GA4 (Today / Yesterday / Last 7 days / Last 30 days) plus shortcuts.
// Each range is fetched once per page visit and kept; every panel follows the selected range.
import { api, ApiError, esc, $, $$ } from './lib';

type RangeKey = 'today' | 'yesterday' | '7d' | '30d';
interface Snapshot {
  range: RangeKey;
  label: string;
  tiles: { activeUsers: number; newUsers: number; sessions: number; pageViews: number; avgSessionSeconds: number };
  topPages: { path: string; title: string; views: number }[];
  devices: { device: string; users: number }[];
  locations: { city: string; country: string; users: number }[];
}
const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7d' },
  { key: '30d', label: 'Last 30d' },
];
const cache = new Map<RangeKey, Promise<Snapshot>>();
const n = (x: number) => x.toLocaleString('en-US');
const dur = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;

export const WRITER_URL = 'https://numfall-writer.vercel.app';

export function renderDashboard(el: HTMLElement): void {
  let range: RangeKey = (sessionStorage.getItem('nf-range') as RangeKey) || '7d';
  el.innerHTML = `
<div class="list-head"><div><h1>Dashboard</h1><p class="summary">Traffic on numfall.store from Google Analytics. Your own visits are not counted on this device.</p></div></div>
<div class="seg" role="group" aria-label="Date range">${RANGES.map(r => `<button type="button" data-range="${r.key}">${r.label}</button>`).join('')}</div>
<div id="snap" aria-live="polite"></div>
<section class="panel shortcuts"><h2>Shortcuts</h2><div class="sc-grid">
<a class="sc" href="/admin/blog" data-nav><strong>Manage blog</strong><span>All posts, drafts and scheduled posts</span></a>
<a class="sc" href="/admin/blog/new" data-nav><strong>New post</strong><span>Write and publish an article</span></a>
<a class="sc" href="/admin/blog?status=scheduled" data-nav><strong>Scheduled posts</strong><span>Publish one early</span></a>
<a class="sc" href="${WRITER_URL}" target="_blank" rel="noopener"><strong>Article writer ↗</strong><span>The generation tool (its own site)</span></a>
</div></section>`;
  const show = async () => {
    sessionStorage.setItem('nf-range', range);
    $$<HTMLButtonElement>('[data-range]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.range === range)));
    const box = $('#snap', el);
    box.innerHTML = '<p class="muted">Loading traffic…</p>';
    if (!cache.has(range)) cache.set(range, api<Snapshot>(`analytics?range=${range}`));
    try {
      const s = await cache.get(range)!;
      if (s.range !== range) return;
      const list = (title: string, rows: string[], empty: string) => `<section class="panel"><h2>${title}</h2>${rows.length ? `<ol class="rank">${rows.join('')}</ol>` : `<p class="muted small">${empty}</p>`}</section>`;
      box.innerHTML = `
<div class="tiles">
<div class="tile"><span>Active users</span><strong>${n(s.tiles.activeUsers)}</strong></div>
<div class="tile"><span>New users</span><strong>${n(s.tiles.newUsers)}</strong></div>
<div class="tile"><span>Sessions</span><strong>${n(s.tiles.sessions)}</strong></div>
<div class="tile"><span>Page views</span><strong>${n(s.tiles.pageViews)}</strong></div>
<div class="tile"><span>Avg session</span><strong>${dur(s.tiles.avgSessionSeconds)}</strong></div>
</div>
<div class="lists">
${list('Top pages', s.topPages.map(p => `<li><a href="${esc(p.path)}" target="_blank" rel="noopener" title="${esc(p.title)}">${esc(p.path)}</a><b>${n(p.views)}</b></li>`), 'No page views in this range.')}
${list('Devices', s.devices.map(d => `<li><span>${esc(d.device ? d.device[0].toUpperCase() + d.device.slice(1) : 'Unknown')}</span><b>${n(d.users)}</b></li>`), 'No visitors in this range.')}
${list('Top locations', s.locations.map(l => `<li><span>${esc([l.city === '(not set)' ? '' : l.city, l.country].filter(Boolean).join(', ') || 'Unknown')}</span><b>${n(l.users)}</b></li>`), 'No visitors in this range.')}
</div>`;
    } catch (e) {
      cache.delete(range);
      const err = e as ApiError;
      box.innerHTML = err.status === 501
        ? `<section class="panel notice"><h2>Connect Google Analytics</h2><p>Add these environment variables in Vercel (numfall-site → Settings → Environment Variables), then redeploy:</p><ul>${((err.data.missing as string[]) ?? []).map(m => `<li><code>${esc(m)}</code></li>`).join('')}</ul><p class="small muted">Then give the service account's email Viewer access in GA4 → Admin → Property access management.</p></section>`
        : `<section class="panel notice"><p>${esc(err.message)}</p><button type="button" class="ghost" id="retry">Try again</button></section>`;
      $('#retry', el)?.addEventListener('click', show);
    }
  };
  $$<HTMLButtonElement>('[data-range]', el).forEach(b => b.addEventListener('click', () => ((range = b.dataset.range as RangeKey), show())));
  void show();
}

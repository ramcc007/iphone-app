// ContentAdminList: one list screen for any content type, driven by a config (blog posts today; others can reuse it).
// Tabs with counts, search, category filter and sort - all kept in the URL, so a view can be bookmarked and Back works.
// Table from 1024 px, cards below; "Last modified" hidden under 1280 px. Icon buttons have tooltips and aria-labels.
import { ICON, esc, fmtDate, relative, toast } from './lib';

export type Status = 'draft' | 'scheduled' | 'published';
export interface ListRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: Status;
  live: boolean;
  publishAt: string;
  updatedAt: string;
  createdAt?: string;
}
export interface ContentListConfig<R> {
  title: string; // "Blog posts"
  noun: string; // "post"
  newHref: string;
  load(): Promise<{ rows: R[]; timeZone: string }>;
  toRow(r: R): ListRow;
  publicPath(r: ListRow): string; // "/blog/<slug>"
  editHref(r: ListRow): string;
  remove(r: ListRow): Promise<void>;
  publishNow?(r: ListRow): Promise<string>; // only offered on scheduled rows
}

const TABS: { key: '' | Status; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'draft', label: 'Drafts' },
];
const SORTS = { newest: 'Publish date (newest)', oldest: 'Publish date (oldest)', modified: 'Recently modified', az: 'Title A-Z' } as const;
type SortKey = keyof typeof SORTS;

export async function renderContentList<R>(el: HTMLElement, cfg: ContentListConfig<R>, navigate: (href: string, replace?: boolean) => void): Promise<void> {
  el.innerHTML = `<p class="muted">Loading ${esc(cfg.title.toLowerCase())}…</p>`;
  const { rows: raw, timeZone: tz } = await cfg.load();
  const all = raw.map(cfg.toRow);
  const draw = () => {
    const q = new URLSearchParams(location.search);
    const tab = (q.get('status') ?? '') as '' | Status;
    const search = (q.get('q') ?? '').trim().toLowerCase();
    const cat = q.get('cat') ?? '';
    const sort = (q.get('sort') ?? 'newest') as SortKey;
    const counts = { '': all.length, published: 0, scheduled: 0, draft: 0 } as Record<string, number>;
    for (const r of all) counts[r.status]++;
    const next = all.filter(r => r.status === 'scheduled' && !r.live).sort((a, b) => a.publishAt.localeCompare(b.publishAt))[0];
    const cats = [...new Set(all.map(r => r.category).filter(Boolean))].sort();
    let shown = all.filter(r => (!tab || r.status === tab) && (!cat || r.category === cat) && (!search || [r.title, r.slug, cfg.publicPath(r), r.category].some(v => v.toLowerCase().includes(search))));
    shown = shown.sort((a, b) =>
      sort === 'oldest' ? a.publishAt.localeCompare(b.publishAt) : sort === 'modified' ? b.updatedAt.localeCompare(a.updatedAt) : sort === 'az' ? a.title.localeCompare(b.title) : b.publishAt.localeCompare(a.publishAt),
    );
    const badge = (r: ListRow) => `<span class="badge ${r.status}">${r.status === 'published' ? 'Published' : r.status === 'scheduled' ? (r.live ? 'Live' : 'Scheduled') : 'Draft'}</span>`;
    const when = (r: ListRow) => (r.status === 'draft' ? '<span class="muted">Not scheduled</span>' : `${esc(fmtDate(r.publishAt, tz))}<br><span class="muted">${esc(relative(r.publishAt))}</span>`);
    const actions = (r: ListRow) => {
      const live = r.live || r.status === 'published';
      const label = (x: string) => `${x}: ${r.title}`;
      return `<div class="acts">
<a class="icon-btn" href="${esc(cfg.publicPath(r))}" target="_blank" rel="noopener" title="${live ? 'View live' : 'Preview'}" aria-label="${esc(label(live ? 'View live' : 'Preview'))}">${live ? ICON.view : ICON.preview}</a>
<a class="icon-btn" href="${esc(cfg.editHref(r))}" data-nav title="Edit" aria-label="${esc(label('Edit'))}">${ICON.edit}</a>
${cfg.publishNow && r.status === 'scheduled' && !r.live ? `<button type="button" class="icon-btn go" data-publish="${esc(r.id)}" title="Publish now" aria-label="${esc(label('Publish now'))}">${ICON.publish}</button>` : ''}
<button type="button" class="icon-btn danger" data-delete="${esc(r.id)}" title="Delete" aria-label="${esc(label('Delete'))}">${ICON.trash}</button></div>`;
    };
    el.innerHTML = `
<div class="list-head"><div><h1>${esc(cfg.title)}</h1>
<p class="summary">${counts.published} published · ${counts.scheduled} scheduled · ${counts.draft} drafts${next ? ` · next goes live <strong>${esc(fmtDate(next.publishAt, tz))}</strong> (${esc(relative(next.publishAt))})` : ''}</p></div>
<a class="btn" href="${esc(cfg.newHref)}" data-nav>${ICON.plus}<span>New ${esc(cfg.noun)}</span></a></div>
<div class="tabs" role="tablist" aria-label="Status">${TABS.map(t => `<button type="button" role="tab" aria-selected="${t.key === tab}" data-tab="${t.key}">${t.label} <span class="count">${counts[t.key]}</span></button>`).join('')}</div>
<div class="filters">
<label class="grow"><span class="sr">Search</span><input type="search" id="q" placeholder="Search title, URL or category" value="${esc(q.get('q') ?? '')}"></label>
<label><span class="sr">Category</span><select id="cat"><option value="">All categories</option>${cats.map(c => `<option${c === cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
<label><span class="sr">Sort</span><select id="sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
</div>
${shown.length ? `<table class="clist"><thead><tr><th scope="col">Title</th><th scope="col">Status</th><th scope="col">Publish date</th><th scope="col" class="mod">Last modified</th><th scope="col">Created</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>
${shown.map(r => `<tr><td class="t"><a href="${esc(cfg.editHref(r))}" data-nav><strong>${esc(r.title)}</strong></a><div class="muted small">${esc(r.category)} · <span class="url">${esc(cfg.publicPath(r))}</span></div></td>
<td>${badge(r)}</td><td class="small">${when(r)}</td><td class="small mod">${esc(fmtDate(r.updatedAt, tz))}</td><td class="small">${esc(fmtDate(r.createdAt, tz, false))}</td><td>${actions(r)}</td></tr>`).join('')}
</tbody></table>
<ul class="ccards">${shown.map(r => `<li class="ccard"><div class="ccard-top">${badge(r)}<span class="muted small">${esc(r.category)}</span></div>
<a href="${esc(cfg.editHref(r))}" data-nav class="ccard-title">${esc(r.title)}</a><div class="muted small url">${esc(cfg.publicPath(r))}</div>
<div class="small ccard-dates"><span>${r.status === 'draft' ? 'Not scheduled' : `${esc(fmtDate(r.publishAt, tz))} · ${esc(relative(r.publishAt))}`}</span><span class="muted">Created ${esc(fmtDate(r.createdAt, tz, false))}</span></div>
${actions(r)}</li>`).join('')}</ul>` : `<p class="empty">No ${esc(cfg.noun)}s match.${search || cat || tab ? ' <a href="?" data-clear>Clear filters</a>' : ''}</p>`}`;

    const setQ = (k: string, v: string, replace = false) => {
      const p = new URLSearchParams(location.search);
      if (v) p.set(k, v);
      else p.delete(k);
      navigate(`${location.pathname}${p.toString() ? `?${p}` : ''}`, replace);
    };
    el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.addEventListener('click', () => setQ('status', b.dataset.tab ?? '')));
    let timer = 0;
    el.querySelector<HTMLInputElement>('#q')!.addEventListener('input', e => {
      clearTimeout(timer);
      const v = (e.target as HTMLInputElement).value.trim();
      timer = window.setTimeout(() => setQ('q', v, true), 300);
    });
    el.querySelector<HTMLSelectElement>('#cat')!.addEventListener('change', e => setQ('cat', (e.target as HTMLSelectElement).value));
    el.querySelector<HTMLSelectElement>('#sort')!.addEventListener('change', e => setQ('sort', (e.target as HTMLSelectElement).value === 'newest' ? '' : (e.target as HTMLSelectElement).value));
    el.querySelector('[data-clear]')?.addEventListener('click', e => (e.preventDefault(), navigate(location.pathname)));
    el.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach(b =>
      b.addEventListener('click', async () => {
        const r = all.find(x => x.id === b.dataset.delete)!;
        if (!confirm(`Delete "${r.title}" permanently? ${r.live ? 'It comes off the site at once. ' : ''}This cannot be undone.`)) return;
        b.disabled = true;
        try {
          await cfg.remove(r);
          all.splice(all.indexOf(r), 1);
          toast('Deleted.');
          draw();
        } catch (err) {
          toast((err as Error).message, true);
          b.disabled = false;
        }
      }),
    );
    el.querySelectorAll<HTMLButtonElement>('[data-publish]').forEach(b =>
      b.addEventListener('click', async () => {
        const r = all.find(x => x.id === b.dataset.publish)!;
        if (!confirm(`Publish "${r.title}" now? It goes live immediately and its date changes to now instead of ${fmtDate(r.publishAt, tz)}.`)) return;
        b.disabled = true;
        try {
          toast(await cfg.publishNow!(r));
          await renderContentList(el, cfg, navigate);
        } catch (err) {
          toast((err as Error).message, true);
          b.disabled = false;
        }
      }),
    );
    // Keep focus in the search box while typing (the list redraws under it).
    const qi = el.querySelector<HTMLInputElement>('#q')!;
    if (document.activeElement === document.body && q.get('q')) {
      qi.focus();
      qi.setSelectionRange(qi.value.length, qi.value.length);
    }
  };
  draw();
  (el as unknown as { _redraw?: () => void })._redraw = draw;
}

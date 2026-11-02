// NumFall Writer admin page (/admin). Plain TypeScript, bundled by esbuild into site/dist/admin/app.js.
import type { Article, Settings } from '../shared/types';
import { LENGTHS } from '../shared/settings';
import { blocksToHtml, escapeHtml as esc } from '../shared/render';

type Row = { id: string; batch_id: string | null; status: string; stopped: boolean; publish_at: string | null; created_at: string; lease_until: string | null; summary?: Article['summary'] };

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const app = $('#app');
const OWNER = `tab-${Math.random().toString(36).slice(2, 10)}`;
let settings: Settings | null = null;

async function api<T>(action: string, body?: Record<string, unknown>, query: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams({ action, ...query }).toString();
  const r = await fetch(`/api/writer?${q}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, owner: OWNER, ...body }) } : {});
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
  return j;
}

const money = (n: number) => `$${(n ?? 0).toFixed(n < 0.1 ? 4 : 2)}`;
const when = (iso?: string | null, tz = settings?.timeZone ?? 'Asia/Kolkata') =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const toast = (msg: string, bad = false) => {
  const t = document.createElement('div');
  t.className = `toast${bad ? ' bad' : ''}`;
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 5000);
};

function nav(active: string): string {
  const links = [['#/', 'Articles'], ['#/new', 'New batch'], ['#/settings', 'Settings'], ['#/usage', 'Usage']];
  return `<header class="bar"><strong>NumFall Writer</strong><nav>${links.map(([h, l]) => `<a href="${h}"${active === h ? ' class="on"' : ''}>${l}</a>`).join('')}<a href="/blog" target="_blank">Blog ↗</a><button id="logout" class="link">Sign out</button></nav></header>`;
}

function bindNav(): void {
  $('#logout')?.addEventListener('click', async () => {
    await api('logout', {});
    location.reload();
  });
}

// ---------- login ----------
function login(): void {
  app.innerHTML = `<form class="card login"><h1>NumFall Writer</h1><label>Password <input type="password" name="pw" autocomplete="current-password" required></label><button>Sign in</button><p class="err"></p></form>`;
  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('login', { password: ($('input') as HTMLInputElement).value });
      route();
    } catch (err) {
      $('.err').textContent = (err as Error).message;
    }
  });
}

// ---------- articles ----------
const STATUS: Record<string, string> = { queued: 'Waiting', generating: 'Writing', checking: 'Checking', publishing: 'Posting', ready: 'Ready', scheduled: 'Scheduled', published: 'Live', failed: 'Stopped' };

async function list(): Promise<void> {
  const { articles, humanizerPaused } = await api<{ articles: Row[]; humanizerPaused: Record<string, number> }>('list');
  const paused = Object.entries(humanizerPaused ?? {}).filter(([, t]) => t > Date.now());
  const spend = articles.reduce((n, a) => n + (a.summary?.costUsd ?? 0), 0);
  app.innerHTML = `${nav('#/')}<main>
${paused.length ? `<p class="note">${paused.map(([p, t]) => `${p === 'groq' ? 'Groq' : 'OpenRouter'} reached its daily limit and is paused until ${when(new Date(t).toISOString())}.`).join(' ')} ${paused.length >= 2 ? 'Articles carry on without the humanizer until one comes back.' : 'The other provider is used meanwhile, if it has a key.'}</p>` : ''}
<p class="muted">${articles.length} articles · ${money(spend)} spent on these · the background job keeps working when this page is closed.</p>
<table class="list"><thead><tr><th>Article</th><th>Status</th><th>Human</th><th>Goes live</th><th>Cost</th></tr></thead><tbody>
${articles
  .map(a => {
    const s = a.summary;
    return `<tr data-id="${a.id}"><td><a href="#/a/${a.id}">${esc(s?.title ?? a.id)}</a><div class="muted small">${esc(s?.author ?? '')}${a.batch_id ? ` · batch ${a.batch_id}` : ''}</div></td>
<td><span class="pill ${a.status}">${STATUS[a.status] ?? a.status}</span><div class="muted small">${esc(s?.step ?? '')}</div>${s?.error ? `<div class="err small">${esc(s.error.slice(0, 140))}</div>` : ''}</td>
<td>${s?.human ?? s?.human === 0 ? `${s.human}%` : ''}</td><td class="small">${when(a.publish_at)}</td><td class="small">${money(s?.costUsd ?? 0)}</td></tr>`;
  })
  .join('')}
</tbody></table>${articles.length ? '' : '<p>No articles yet. Start a <a href="#/new">new batch</a>.</p>'}</main>`;
  bindNav();
}

// ---------- new batch ----------
function newBatch(): void {
  const s = settings!;
  app.innerHTML = `${nav('#/new')}<main><form class="card">
<h1>New batch</h1>
<label>Topics, one per line (up to 50)<textarea name="topics" rows="10" required placeholder="How to solve a 6×6 logic grid without guessing"></textarea></label>
<div class="row">
<label>Length <select name="length">${Object.entries(LENGTHS).map(([k, v]) => `<option value="${k}"${k === s.defaultLength ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
<label>Author <select name="author"><option value="random">Random from the list</option>${s.authors.map(a => `<option>${esc(a)}</option>`).join('')}</select></label>
</div>
<fieldset><legend>Publish dates</legend>
<label class="radio"><input type="radio" name="mode" value="manual"> I post each one myself</label>
<label class="radio"><input type="radio" name="mode" value="schedule" checked> Schedule: random times in the next <input type="number" name="sdays" value="14" min="1" max="365" class="num"> days, 9 am to 9 pm (${esc(s.timeZone)}), at most 2 a day, 4 hours apart</label>
<label class="radio"><input type="radio" name="mode" value="backdate"> Backdate: random dates in the last <input type="number" name="bdays" value="30" min="1" max="3650" class="num"> days, at most 3 a date, each written as of its own date</label>
</fieldset>
<p class="muted small">Batch articles always get one GPTZero scan and one rewrite, then post themselves into their slot${s.autoPostBatches ? '' : ' (automatic posting is off in Settings, so they wait for you)'}.</p>
<button>Start writing</button><p class="err"></p></form></main>`;
  bindNav();
  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const mode = String(f.get('mode'));
    const btn = $('form button') as HTMLButtonElement;
    btn.disabled = true;
    try {
      const r = await api<{ created: { id: string }[] }>('batch', {
        topics: String(f.get('topics')).split('\n'),
        length: f.get('length'),
        author: f.get('author'),
        mode,
        days: Number(f.get(mode === 'backdate' ? 'bdays' : 'sdays')),
      });
      toast(`${r.created.length} article(s) queued. They are written one after another.`);
      location.hash = '#/';
    } catch (err) {
      $('.err').textContent = (err as Error).message;
      btn.disabled = false;
    }
  });
}

// ---------- one article ----------
function md(a: Article): string {
  return a.body.map(b => (b.type === 'h2' ? `## ${b.text}` : b.type === 'p' ? b.text : b.items.map(i => `- ${i}`).join('\n'))).join('\n\n');
}

async function one(id: string): Promise<void> {
  const a = await api<Article>('get', undefined, { id });
  const sc = a.scan;
  const done = a.stage === 'done';
  app.innerHTML = `${nav('')}<main class="detail">
<p><a href="#/">← Articles</a></p>
<h1>${esc(a.title ?? a.options.topic)}</h1>
<p class="muted">${esc(a.options.author)} · ${STATUS[a.status] ?? a.status} · ${esc(a.step)} · ${money(a.usage.costUsd)}${a.options.publishAt ? ` · goes live ${when(a.options.publishAt)}` : ''}${a.slug && ['scheduled', 'published'].includes(a.status) ? ` · <a href="/blog/${a.slug}" target="_blank">View on site ↗</a>` : ''}</p>
${a.error ? `<p class="err">${esc(a.error)}</p>` : ''}
<div class="actions">
${!done && !a.stopped ? '<button data-do="run">Run next steps here</button><button data-do="stop" class="ghost">Stop</button>' : ''}
${a.stopped || a.status === 'failed' ? '<button data-do="retry">Retry</button>' : ''}
${done && a.status === 'ready' ? '<button data-do="post">Post now</button><input type="datetime-local" id="at"><button data-do="schedule" class="ghost">Schedule</button>' : ''}
${['scheduled', 'published'].includes(a.status) ? '<button data-do="unpublish" class="ghost">Take off the site</button>' : ''}
${done ? '<button data-do="edit" class="ghost">Edit text</button>' : ''}
<button data-do="delete" class="danger">Delete</button>
</div>
<section class="grid2">
<div class="card"><h2>Checks</h2>
<p>GPTZero: ${sc ? `<strong>${sc.human}% human</strong> (${sc.ai}% AI, ${sc.mixed}% mixed), ${sc.flagged.length} sentences flagged, ${sc.words} words` : 'not scanned yet'}${a.rescan ? ` · rescan ${a.rescan.human}% human` : ''}</p>
<p>Rewritten after the scan: ${a.rewritten ?? 0} sentences · grammar slips: ${a.slips ?? 0}</p>
<p>Humanizer: ${a.humanize ? (a.humanize.skipped ? esc(`skipped (${a.humanize.skipped})`) : `${a.humanize.via?.length ? `via ${esc(a.humanize.via.join(' + '))}: ` : ''}${a.humanize.units.filter(u => u.state === 'done').length} rewritten, ${a.humanize.units.filter(u => u.state === 'kept').length} kept, ${a.humanize.units.filter(u => u.state === 'reverted').length} put back by the meaning check`) : 'not run yet'}</p>
<p>Internal links: ${a.links?.length ? a.links.map(l => `<code>${esc(l.anchor)}</code> → /blog/${esc(l.slug)}`).join(', ') : 'none'}</p>
${a.cleanReport?.removed.length ? `<details><summary>Taken out before posting (${a.cleanReport.removed.length})</summary><ul>${a.cleanReport.removed.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>` : ''}
</div>
<div class="card"><h2>Plan</h2><p class="small">Slug: <code>${esc(a.slug ?? '')}</code><br>Meta (${(a.description ?? '').length}/155): ${esc(a.description ?? '')}<br>Category: ${esc(a.plan?.category ?? '')}<br>Angle: ${esc(a.plan?.angle ?? '')}<br>Persona: ${esc(a.plan?.persona ?? '')}</p>
<details><summary>Research (${a.research?.facts.length ?? 0} facts${a.research && !a.research.webChecked ? ', web search not used' : ''})</summary><ol class="small">${(a.research?.facts ?? []).map(f => `<li>${esc(f.fact)} <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source)}</a>, ${esc(f.date)}</li>`).join('')}</ol></details>
</div></section>
<article class="card preview"><h1>${esc(a.title ?? '')}</h1>${blocksToHtml(a.body).replace('<!--app-card-->', '<div class="appcard-mark">[app card]</div>')}
${a.faq.length ? `<h2>FAQ</h2>${a.faq.map(f => `<p><strong>${esc(f.q)}</strong><br>${esc(f.a)}</p>`).join('')}` : ''}</article>
<dialog id="editor"><form method="dialog" class="card"><h2>Edit</h2><label>Title (${(a.title ?? '').length}/60)<input name="title" value="${esc(a.title ?? '')}" maxlength="60"></label><label>Meta description<textarea name="description" rows="2" maxlength="155">${esc(a.description ?? '')}</textarea></label><label>Article (## for headings, - for list items)<textarea name="markdown" rows="20">${esc(md(a))}</textarea></label><div class="actions"><button value="save">Save</button><button value="cancel" class="ghost">Cancel</button></div></form></dialog>
</main>`;
  bindNav();
  app.querySelectorAll<HTMLButtonElement>('[data-do]').forEach(b =>
    b.addEventListener('click', async () => {
      const act = b.dataset.do!;
      try {
        if (act === 'delete' && !confirm('Delete this article? If it is on the site, it is taken off.')) return;
        if (act === 'edit') {
          const d = $('#editor') as HTMLDialogElement;
          d.showModal();
          d.addEventListener('close', async () => {
            if (d.returnValue !== 'save') return;
            const f = new FormData($('form', d) as HTMLFormElement);
            await api('edit', { id, title: f.get('title'), description: f.get('description'), markdown: f.get('markdown') });
            toast('Saved. Post it again to update the live page.');
            one(id);
          }, { once: true });
          return;
        }
        b.disabled = true;
        if (act === 'run') {
          b.textContent = 'Working… (up to 4 minutes)';
          await api('run', { id });
        } else if (act === 'schedule') {
          const v = ($('#at') as HTMLInputElement).value;
          if (!v) throw new Error('Pick a date and time first.');
          await api('post', { id, when: localInputToUtc(v, settings!.timeZone) });
        } else if (act === 'post') await api('post', { id, when: 'now' });
        else await api(act, { id });
        if (act === 'delete') location.hash = '#/';
        else one(id);
      } catch (err) {
        toast((err as Error).message, true);
        b.disabled = false;
      }
    }),
  );
}

// A datetime-local value in the owner's time zone, as UTC ISO.
function localInputToUtc(v: string, tz: string): string {
  const [d, t] = v.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (shown - guess)).toISOString();
}

// ---------- settings ----------
async function settingsPage(): Promise<void> {
  const s = (settings = await api<Settings>('settings'));
  const me = await api<{ keys: Record<string, boolean> }>('me');
  const facts = await api<{ text: string; checkedAt: string; changes: string[] }>('facts').catch(() => null);
  const chk = (n: string, v: boolean, label: string) => `<label class="check"><input type="checkbox" name="${n}"${v ? ' checked' : ''}> ${label}</label>`;
  app.innerHTML = `${nav('#/settings')}<main><form class="card settings">
<h1>Settings</h1>
<p class="small">Keys in Vercel: ${Object.entries(me.keys).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · ')}</p>
<h2>Claude</h2>
<div class="row"><label>Research model <input name="m_research" value="${esc(s.models.research)}"></label><label>Plan model <input name="m_plan" value="${esc(s.models.plan)}"></label></div>
<div class="row"><label>Writing model <input name="m_write" value="${esc(s.models.write)}"></label><label>Checks and links model <input name="m_check" value="${esc(s.models.check)}"></label></div>
<div class="row"><label>Writing effort <select name="writeEffort">${['low', 'medium', 'high'].map(e => `<option${e === s.writeEffort ? ' selected' : ''}>${e}</option>`).join('')}</select></label><label>Web searches per article <input type="number" name="maxSearches" min="1" max="10" value="${s.maxSearches}"></label></div>
<h2>Humanizer</h2>
${chk('h_enabled', s.humanizer.enabled, 'On')}
<div class="row"><label>Provider <select name="h_provider"><option value="groq"${s.humanizer.provider === 'groq' ? ' selected' : ''}>Groq (free tier)</option><option value="openrouter"${s.humanizer.provider === 'openrouter' ? ' selected' : ''}>OpenRouter</option></select></label><label>Model <input name="h_model" value="${esc(s.humanizer.model)}"></label></div>
<div class="row"><label>Reasoning effort <select name="h_reason">${['low', 'medium', 'high'].map(e => `<option${e === s.humanizer.reasoningEffort ? ' selected' : ''}>${e}</option>`).join('')}</select></label><label>Temperature <input type="number" step="0.05" min="0" max="2" name="h_temp" value="${s.humanizer.temperature}"></label><label>Top-p <input type="number" step="0.05" min="0.05" max="1" name="h_topp" value="${s.humanizer.topP}"></label></div>
${chk('fb_enabled', s.humanizer.fallback.enabled, 'Fallback when the main provider is out for the day')}
<div class="row"><label>Fallback provider <select name="fb_provider"><option value="openrouter"${s.humanizer.fallback.provider === 'openrouter' ? ' selected' : ''}>OpenRouter</option><option value="groq"${s.humanizer.fallback.provider === 'groq' ? ' selected' : ''}>Groq</option></select></label><label>Fallback model <input name="fb_model" value="${esc(s.humanizer.fallback.model)}"></label></div>
<p class="muted small">Method: paraphrase. When a provider hits its daily limit it pauses itself and the fallback takes over; if both are out, articles carry on without the humanizer. OpenRouter free models end in <code>:free</code> (50 requests a day, or 1,000 after a one-time $10 top-up).</p>
<h2>Text</h2>
<div class="row"><label>Grammar slips <select name="slips">${['light', 'off', 'heavy'].map(e => `<option${e === s.slips ? ' selected' : ''}>${e}</option>`).join('')}</select></label><label>Spelling <select name="spelling"><option value="en-US"${s.spelling === 'en-US' ? ' selected' : ''}>US English</option><option value="en-GB"${s.spelling === 'en-GB' ? ' selected' : ''}>UK English</option></select></label><label>Default length <select name="defaultLength">${Object.entries(LENGTHS).map(([k, v]) => `<option value="${k}"${k === s.defaultLength ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label></div>
<label>Authors, one per line (picked at random per article)<textarea name="authors" rows="5">${esc(s.authors.join('\n'))}</textarea></label>
<label>Names that must never appear (games, apps, brands), one per line<textarea name="bannedNames" rows="4">${esc(s.bannedNames.join('\n'))}</textarea></label>
<h2>Checks and posting</h2>
${chk('oneScan', s.oneScan, 'One GPTZero scan per article')}
${chk('rescanAfterRewrite', s.rescanAfterRewrite, 'Rescan after the rewrite (single articles only; uses a second scan)')}
${chk('requirePass', s.requirePass, 'Require a pass to post (single articles only)')}
<label>Pass mark (% human) <input type="number" name="passMark" min="0" max="100" value="${s.passMark}" class="num"></label>
${chk('autoPostBatches', s.autoPostBatches, 'Post batches automatically into their slots')}
${chk('internalLinks', s.internalLinks, 'Add 2 or 3 internal links to live articles')}
<div class="row"><label>Time zone <input name="timeZone" value="${esc(s.timeZone)}"></label><label>Stop after this many errors in a row <input type="number" name="maxFailures" min="1" max="10" value="${s.maxFailures}" class="num"></label></div>
<h2>Prices (USD, for the usage log)</h2>
<label>Per million tokens, one model per line: model in out<textarea name="prices" rows="5">${Object.entries(s.prices).map(([k, v]) => `${k} ${v.inPerM} ${v.outPerM}`).join('\n')}</textarea></label>
<div class="row"><label>Web search per 1,000 <input type="number" step="0.01" name="searchPer1k" value="${s.searchPer1k}"></label><label>GPTZero per 1,000 words <input type="number" step="0.001" name="gptzeroPer1kWords" value="${s.gptzeroPer1kWords}"></label></div>
<button>Save settings</button>
</form>
${facts ? `<section class="card"><h2>NumFall facts used in articles</h2><p class="small muted">Checked against the App Store listing and the website on ${when(facts.checkedAt)}.</p><pre class="small">${esc(facts.text)}</pre>${facts.changes.length ? `<p class="note">${facts.changes.map(esc).join('<br>')}</p>` : ''}</section>` : ''}
</main>`;
  bindNav();
  $('form.settings').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const g = (k: string) => String(f.get(k) ?? '');
    const lines = (k: string) => g(k).split('\n').map(x => x.trim()).filter(Boolean);
    const prices: Settings['prices'] = {};
    for (const l of lines('prices')) {
      const [m, i, o] = l.split(/\s+/);
      if (m && Number.isFinite(+i) && Number.isFinite(+o)) prices[m] = { inPerM: +i, outPerM: +o };
    }
    const next: Settings = {
      ...s,
      models: { research: g('m_research'), plan: g('m_plan'), write: g('m_write'), check: g('m_check') },
      writeEffort: g('writeEffort') as Settings['writeEffort'],
      maxSearches: +g('maxSearches'),
      humanizer: { ...s.humanizer, enabled: f.has('h_enabled'), provider: g('h_provider') as 'groq', model: g('h_model'), reasoningEffort: g('h_reason') as 'low', temperature: +g('h_temp'), topP: +g('h_topp'), fallback: { enabled: f.has('fb_enabled'), provider: g('fb_provider') as 'openrouter', model: g('fb_model') } },
      slips: g('slips') as Settings['slips'],
      spelling: g('spelling') as Settings['spelling'],
      defaultLength: g('defaultLength') as Settings['defaultLength'],
      authors: lines('authors'),
      bannedNames: lines('bannedNames'),
      oneScan: f.has('oneScan'),
      rescanAfterRewrite: f.has('rescanAfterRewrite'),
      requirePass: f.has('requirePass'),
      passMark: +g('passMark'),
      autoPostBatches: f.has('autoPostBatches'),
      internalLinks: f.has('internalLinks'),
      timeZone: g('timeZone'),
      maxFailures: +g('maxFailures'),
      prices,
      searchPer1k: +g('searchPer1k'),
      gptzeroPer1kWords: +g('gptzeroPer1kWords'),
    };
    try {
      settings = await api<Settings>('settings', { settings: next });
      toast('Settings saved.');
    } catch (err) {
      toast((err as Error).message, true);
    }
  });
}

// ---------- usage ----------
async function usage(): Promise<void> {
  const from = new Date(Date.now() - 31 * 86400_000).toISOString();
  const rows = await api<{ at: string; article_id: string | null; step: string; provider: string; model: string | null; input_tokens: number; output_tokens: number; searches: number; words: number; cost_usd: number; ok: boolean; note: string | null }[]>('usage', undefined, { from });
  const by = new Map<string, number>();
  rows.forEach(r => by.set(r.provider, (by.get(r.provider) ?? 0) + Number(r.cost_usd)));
  const total = rows.reduce((n, r) => n + Number(r.cost_usd), 0);
  app.innerHTML = `${nav('#/usage')}<main><h1>Usage, last 31 days</h1>
<p><strong>${money(total)}</strong> in total · ${[...by].map(([k, v]) => `${k} ${money(v)}`).join(' · ')}</p>
<table class="list small"><thead><tr><th>When</th><th>Step</th><th>Provider / model</th><th>Tokens in/out</th><th>Searches</th><th>GPTZero words</th><th>Cost</th><th></th></tr></thead><tbody>
${rows.map(r => `<tr${r.ok ? '' : ' class="failed"'}><td>${when(r.at)}</td><td>${r.article_id ? `<a href="#/a/${r.article_id}">${esc(r.step)}</a>` : esc(r.step)}</td><td>${esc(r.provider)} ${esc(r.model ?? '')}</td><td>${r.input_tokens}/${r.output_tokens}</td><td>${r.searches || ''}</td><td>${r.words || ''}</td><td>${money(Number(r.cost_usd))}</td><td>${r.ok ? '' : esc(r.note ?? 'failed')}</td></tr>`).join('')}
</tbody></table></main>`;
  bindNav();
}

// ---------- router and the browser runner ----------
async function route(): Promise<void> {
  try {
    const me = await api<{ admin: boolean }>('me');
    if (!me.admin) return login();
    settings ??= await api<Settings>('settings');
    const h = location.hash || '#/';
    if (h.startsWith('#/a/')) await one(h.slice(4));
    else if (h === '#/new') newBatch();
    else if (h === '#/settings') await settingsPage();
    else if (h === '#/usage') await usage();
    else await list();
  } catch (e) {
    app.innerHTML = `<main><p class="err">${esc((e as Error).message)}</p><button onclick="location.reload()">Reload</button></main>`;
  }
}

// While this tab is open on the articles list, it also works on waiting articles (the lease stops it and
// the background job from paying for the same step).
let running = false;
setInterval(async () => {
  if (running || document.hidden || (location.hash && location.hash !== '#/')) return;
  running = true;
  try {
    const r = await api<{ article: Article | null }>('run', {});
    if (r.article) await list();
  } catch {
    /* the background job carries on */
  } finally {
    running = false;
  }
}, 20_000);

window.addEventListener('hashchange', route);
route();

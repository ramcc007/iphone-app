// numfall.store admin (/admin): sign-in, dashboard, blog list and editor. Real URLs (history API), so filters
// and pages survive Back and can be bookmarked. The server checks the admin cookie on every /api/admin call;
// hiding things here is only for convenience.
import { api, ApiError, esc, toast, $ } from './lib';
import { renderDashboard } from './dashboard';
import { renderContentList, type ContentListConfig, type ListRow } from './content-list';
import { renderBlogEditor } from './blog-editor';

const app = document.getElementById('app')!;
let dirtyGuard: (() => boolean) | null = null;

// After a confirmed admin sign-in, this device never sends Google Analytics data (the site's GA script reads
// this flag before it does anything) and the public site shows an "Admin" link in its header.
function markAdminDevice(): void {
  try {
    localStorage.setItem('nf-no-ga', '1');
    localStorage.setItem('nf-admin', '1');
  } catch {}
}

function navigate(href: string, replace = false): void {
  if (dirtyGuard?.() && !confirm('You have unsaved changes. Leave this page?')) return;
  const same = new URL(href, location.href).pathname === location.pathname;
  history[replace ? 'replaceState' : 'pushState'](null, '', href);
  void route(same);
}

function shell(active: 'dash' | 'blog', title: string): HTMLElement {
  document.title = `${title} | NumFall admin`;
  app.innerHTML = `
<a class="skip" href="#main">Skip to content</a>
<header class="adm-top"><div class="adm-wrap">
<a class="brand" href="/admin" data-nav><span class="logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span>NumFall <span class="adm-tag">Admin</span></a>
<nav aria-label="Admin menu"><a href="/admin" data-nav${active === 'dash' ? ' aria-current="page"' : ''}>Dashboard</a><a href="/admin/blog" data-nav${active === 'blog' ? ' aria-current="page"' : ''}>Manage blog</a><a href="/" target="_blank" rel="noopener">View site ↗</a><button type="button" class="link" id="signout">Sign out</button></nav>
</div></header>
<main id="main" class="adm-wrap adm-main" tabindex="-1"></main>`;
  $('#signout').addEventListener('click', async () => {
    await api('logout', { method: 'POST' }).catch(() => undefined);
    try {
      localStorage.removeItem('nf-admin');
    } catch {}
    location.assign('/admin');
  });
  return $('#main');
}

function login(): void {
  document.title = 'Sign in | NumFall admin';
  app.innerHTML = `<main class="login-wrap"><form class="panel login" id="login"><h1>NumFall admin</h1>
<label>Password<input type="password" id="pw" autocomplete="current-password" required></label>
<button type="submit">Sign in</button><p class="err" role="alert" id="err"></p></form></main>`;
  $('#pw').focus();
  $('#login').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $<HTMLButtonElement>('#login button');
    btn.disabled = true;
    try {
      await api('login', { method: 'POST', body: { password: $<HTMLInputElement>('#pw').value } });
      const me = await api<{ admin: boolean }>('me');
      if (!me.admin) throw new ApiError(401, 'Signed in, but the browser did not keep the cookie. Allow cookies for this site.');
      markAdminDevice();
      void route();
    } catch (err) {
      $('#err').textContent = (err as Error).message;
      btn.disabled = false;
    }
  });
}

const blogConfig: ContentListConfig<{ id: string; slug: string; title: string; category: string; status: string; publish_at: string; updated_at: string; created_at?: string }> = {
  title: 'Blog posts',
  noun: 'post',
  newHref: '/admin/blog/new',
  load: () => api('blog'),
  toRow: r => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category,
    status: r.status === 'published' ? 'published' : r.status === 'scheduled' ? 'scheduled' : 'draft',
    live: (r.status === 'published' || r.status === 'scheduled') && Date.parse(r.publish_at) <= Date.now(),
    publishAt: r.publish_at, updatedAt: r.updated_at, createdAt: r.created_at,
  }),
  publicPath: (r: ListRow) => `/blog/${r.slug}`,
  editHref: (r: ListRow) => `/admin/blog/${r.id}`,
  remove: async (r: ListRow) => void (await api(`blog/${r.id}`, { method: 'DELETE' })),
  publishNow: async (r: ListRow) => {
    await api(`blog/${r.id}`, { method: 'PATCH', body: { action: 'publish_now' } });
    return 'Published. It is live now.';
  },
};

async function route(sameList = false): Promise<void> {
  dirtyGuard = null;
  const path = location.pathname.replace(/\/+$/, '') || '/admin';
  // Same list, new filters: redraw from the URL without reloading anything.
  const existing = document.getElementById('main') as (HTMLElement & { _redraw?: () => void }) | null;
  if (sameList && path === '/admin/blog' && existing?._redraw && !new URLSearchParams(location.search).get('article')) return existing._redraw();
  try {
    const me = await api<{ admin: boolean }>('me');
    if (!me.admin) return login();
    markAdminDevice();
    if (path === '/admin/blog') {
      const q = new URLSearchParams(location.search);
      // From the article writer: /admin/blog?article=<id> opens that article's post.
      if (q.get('article')) {
        const { rows } = await api<{ rows: { id: string; article_id: string | null }[] }>('blog');
        const hit = rows.find(r => r.article_id === q.get('article'));
        return navigate(hit ? `/admin/blog/${hit.id}` : '/admin/blog', true);
      }
      const el = shell('blog', 'Blog posts');
      return renderContentList(el, blogConfig, navigate);
    }
    const m = path.match(/^\/admin\/blog\/([0-9a-f-]{36}|new)$/);
    if (m) {
      const el = shell('blog', m[1] === 'new' ? 'New post' : 'Edit post');
      return renderBlogEditor(el, m[1] === 'new' ? null : m[1], navigate, fn => (dirtyGuard = fn));
    }
    if (path !== '/admin') history.replaceState(null, '', '/admin');
    renderDashboard(shell('dash', 'Dashboard'));
  } catch (e) {
    const err = e as ApiError;
    if (err.status === 401) return login();
    const el = document.getElementById('main') ?? app;
    el.innerHTML = `<div class="panel notice"><p>${esc(err.message || 'Something went wrong.')}</p><button type="button" id="reload">Reload</button></div>`;
    $('#reload').addEventListener('click', () => location.reload());
  }
}

// In-app links: no full page load, and Back works.
document.addEventListener('click', e => {
  const a = (e.target as Element).closest('a[data-nav]') as HTMLAnchorElement | null;
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  e.preventDefault();
  navigate(a.getAttribute('href')!);
});
window.addEventListener('popstate', () => void route(true));
window.addEventListener('beforeunload', e => {
  if (dirtyGuard?.()) e.preventDefault();
});
window.addEventListener('admin:signed-out', () => toast('Your session ended. Sign in again.', true));
void route();

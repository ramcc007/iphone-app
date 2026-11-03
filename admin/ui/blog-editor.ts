// Blog post editor (new and edit): TipTap rich text (text only), SEO fields with a live Google preview,
// key takeaways, FAQ, sources, and the publish box (Save draft, Publish/Update, Publish now while scheduled).
import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { api, ApiError, esc, fmtDate, localInputToUtc, relative, toast, utcToLocalInput, $, $$ } from './lib';
import { slugify } from '../../writer/shared/text';

const APP_CARD_MARK = '<!--app-card-->';
const SITE = 'https://www.numfall.store';

export interface Post {
  id: string;
  article_id: string | null;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  author: string;
  meta_title: string;
  description: string;
  key_takeaways: string[];
  faq: { q: string; a: string }[];
  sources: { name: string; url: string }[];
  content_html: string;
  status: 'draft' | 'scheduled' | 'published' | 'unpublished';
  publish_at: string;
  updated_at?: string;
  created_at?: string;
  live?: boolean;
}
interface ListInfo { rows: { id: string; slug: string; title: string }[]; timeZone: string; authors: string[]; categories: string[] }

// The App Store card is a block the writer can place once; stored as <!--app-card-->.
const AppCard = Node.create({
  name: 'appCard',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  parseHTML: () => [{ tag: 'div[data-app-card]' }],
  renderHTML: () => ['div', { 'data-app-card': '1', class: 'appcard-mark', contenteditable: 'false' }, 'App Store card (shown here on the page)'],
});

const BASE_CATEGORIES = ['How-to and techniques', 'Number puzzles', 'Brain and habits', 'Casual gaming', 'NumFall guides'];

export async function renderBlogEditor(el: HTMLElement, id: string | null, navigate: (href: string, replace?: boolean) => void, setDirtyGuard: (fn: (() => boolean) | null) => void): Promise<void> {
  el.innerHTML = '<p class="muted">Loading…</p>';
  const [info, existing] = await Promise.all([api<ListInfo>('blog'), id ? api<Post>(`blog/${id}`) : Promise.resolve(null)]);
  const tz = info.timeZone;
  const p: Post = existing ?? {
    id: '', article_id: null, slug: '', title: '', excerpt: '', category: BASE_CATEGORIES[0], tags: [], author: info.authors[0] ?? '',
    meta_title: '', description: '', key_takeaways: [], faq: [], sources: [], content_html: '<p></p>', status: 'draft', publish_at: new Date().toISOString(),
  };
  const status = p.status === 'unpublished' ? 'draft' : p.status;
  const live = !!p.live || status === 'published';
  const categories = [...new Set([...BASE_CATEGORIES, ...info.categories])];
  let slugTouched = !!p.slug;
  let dirty = false;
  const faq = p.faq.map(x => ({ ...x }));
  const sources = p.sources.map(x => ({ ...x }));

  el.innerHTML = `
<div class="ed-head"><a href="/admin/blog" data-nav class="ed-back">← All posts</a>
<h1>${id ? 'Edit post' : 'New post'}</h1></div>
<div class="ed-grid">
<div class="ed-main">
  <section class="panel">
    <label>Title<input id="title" maxlength="120" value="${esc(p.title)}" required></label>
    <label>URL slug <span class="hint" id="slugHint"></span>
      <span class="slug-row"><span class="muted">/blog/</span><input id="slug" value="${esc(p.slug)}" maxlength="80" spellcheck="false" aria-describedby="slugHint"></span></label>
    <label>Excerpt <span class="hint">shown on blog cards</span><textarea id="excerpt" rows="2" maxlength="300">${esc(p.excerpt)}</textarea></label>
  </section>
  <section class="panel">
    <div class="tt-bar" role="toolbar" aria-label="Formatting">
      <button type="button" data-cmd="p" title="Paragraph" aria-label="Paragraph">¶</button>
      <button type="button" data-cmd="h2" title="Heading" aria-label="Heading">H2</button>
      <button type="button" data-cmd="h3" title="Subheading" aria-label="Subheading">H3</button>
      <button type="button" data-cmd="bold" title="Bold" aria-label="Bold"><b>B</b></button>
      <button type="button" data-cmd="italic" title="Italic" aria-label="Italic"><i>I</i></button>
      <button type="button" data-cmd="ul" title="Bulleted list" aria-label="Bulleted list">• List</button>
      <button type="button" data-cmd="ol" title="Numbered list" aria-label="Numbered list">1. List</button>
      <button type="button" data-cmd="quote" title="Quote" aria-label="Quote">“ ”</button>
      <button type="button" data-cmd="link" title="Add link" aria-label="Add link">Link</button>
      <button type="button" data-cmd="unlink" title="Remove link" aria-label="Remove link">Unlink</button>
      <button type="button" data-cmd="card" title="Insert the App Store card" aria-label="Insert the App Store card">App card</button>
      <button type="button" data-cmd="undo" title="Undo" aria-label="Undo">↶</button>
      <button type="button" data-cmd="redo" title="Redo" aria-label="Redo">↷</button>
    </div>
    <div id="tt" class="tt prose-ed"></div>
    <p class="hint" id="wc"></p>
  </section>
  <section class="panel">
    <h2>In short (key takeaways)</h2>
    <label><span class="hint">One per line, up to 6. Shown in a box at the top of the article.</span><textarea id="takeaways" rows="4">${esc(p.key_takeaways.join('\n'))}</textarea></label>
  </section>
  <section class="panel"><h2>FAQ</h2><div id="faq"></div><button type="button" class="ghost" id="addFaq">Add question</button></section>
  <section class="panel"><h2>Sources and credits</h2><div id="sources"></div><button type="button" class="ghost" id="addSrc">Add source</button></section>
</div>
<aside class="ed-side">
  <section class="panel publish">
    <h2>Publish</h2>
    <p class="status-line">Status: <span class="badge ${status}" id="statusBadge">${status === 'published' ? 'Published' : status === 'scheduled' ? (p.live ? 'Live' : 'Scheduled') : 'Draft'}</span>
    ${status === 'scheduled' && !p.live ? `<br><span class="small muted">Goes live ${esc(fmtDate(p.publish_at, tz))} (${esc(relative(p.publish_at))})</span>` : ''}</p>
    <label>Publish date <span class="hint">${esc(tz)} · a future date schedules it</span><input type="datetime-local" id="pubAt" value="${esc(utcToLocalInput(p.publish_at, tz))}"></label>
    <div class="pub-btns">
      <button type="button" class="ghost" data-save="draft">${status === 'draft' ? 'Save draft' : 'Move to drafts'}</button>
      <button type="button" data-save="publish">${status === 'draft' ? 'Publish' : 'Update'}</button>
      ${status === 'scheduled' && !p.live ? '<button type="button" class="go" id="pubNow">Publish now</button>' : ''}
    </div>
    ${p.slug && id ? `<p class="small"><a href="/blog/${esc(p.slug)}" target="_blank" rel="noopener">${live ? 'View post ↗' : 'Preview ↗'}</a></p>` : ''}
    ${id ? `<p class="small muted">Created ${esc(fmtDate(p.created_at, tz))} · last saved ${esc(fmtDate(p.updated_at, tz))}</p><button type="button" class="link danger" id="del">Delete post</button>` : ''}
  </section>
  <section class="panel">
    <h2>Details</h2>
    <label>Category<input id="category" list="cats" value="${esc(p.category)}" maxlength="40"><datalist id="cats">${categories.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <label>Tags <span class="hint">comma separated</span><input id="tags" value="${esc(p.tags.join(', '))}"></label>
    <label>Author<input id="author" list="authors" value="${esc(p.author)}" maxlength="60"><datalist id="authors">${info.authors.map(a => `<option value="${esc(a)}">`).join('')}</datalist></label>
  </section>
  <section class="panel">
    <h2>Search appearance</h2>
    <label>Meta title <span class="count" id="mtCount"></span><input id="metaTitle" maxlength="70" value="${esc(p.meta_title)}" placeholder="Defaults to the title"></label>
    <label>Meta description <span class="count" id="mdCount"></span><textarea id="metaDesc" rows="3" maxlength="160">${esc(p.description)}</textarea></label>
    <div class="serp" aria-label="Google preview"><div class="serp-url">www.numfall.store › blog › <span id="serpSlug"></span></div><div class="serp-title" id="serpTitle"></div><div class="serp-desc" id="serpDesc"></div></div>
  </section>
</aside>
</div>`;

  // ---------- TipTap ----------
  const editor = new Editor({
    element: $('#tt', el),
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true, protocols: ['mailto'], HTMLAttributes: { rel: null, target: null } },
      }),
      AppCard,
    ],
    content: (p.content_html || '<p></p>').replace(APP_CARD_MARK, '<div data-app-card="1"></div>'),
    editorProps: { attributes: { 'aria-label': 'Article text', role: 'textbox', 'aria-multiline': 'true' } },
  });
  const words = () => {
    const n = editor.getText().trim().split(/\s+/).filter(Boolean).length;
    $('#wc', el).textContent = `${n} words · about ${Math.max(1, Math.round(n / 230))} min read`;
  };
  const toolbarState = () => {
    const on: Record<string, boolean> = {
      h2: editor.isActive('heading', { level: 2 }), h3: editor.isActive('heading', { level: 3 }), bold: editor.isActive('bold'), italic: editor.isActive('italic'),
      ul: editor.isActive('bulletList'), ol: editor.isActive('orderedList'), quote: editor.isActive('blockquote'), link: editor.isActive('link'),
    };
    $$<HTMLButtonElement>('[data-cmd]', el).forEach(b => { if (b.dataset.cmd! in on) b.setAttribute('aria-pressed', String(on[b.dataset.cmd!])); });
  };
  editor.on('update', () => ((dirty = true), words()));
  editor.on('selectionUpdate', toolbarState);
  editor.on('transaction', toolbarState);
  words();
  $$<HTMLButtonElement>('[data-cmd]', el).forEach(b =>
    b.addEventListener('click', () => {
      const c = editor.chain().focus();
      switch (b.dataset.cmd) {
        case 'p': c.setParagraph().run(); break;
        case 'h2': c.toggleHeading({ level: 2 }).run(); break;
        case 'h3': c.toggleHeading({ level: 3 }).run(); break;
        case 'bold': c.toggleBold().run(); break;
        case 'italic': c.toggleItalic().run(); break;
        case 'ul': c.toggleBulletList().run(); break;
        case 'ol': c.toggleOrderedList().run(); break;
        case 'quote': c.toggleBlockquote().run(); break;
        case 'unlink': c.unsetLink().run(); break;
        case 'undo': c.undo().run(); break;
        case 'redo': c.redo().run(); break;
        case 'card':
          if (editor.getHTML().includes('data-app-card')) return toast('The App Store card is already in the article (once is enough).', true);
          c.insertContent({ type: 'appCard' }).run();
          break;
        case 'link': {
          const prev = editor.getAttributes('link').href as string | undefined;
          const href = prompt('Link address: https://…, /blog/… or mailto:…', prev ?? 'https://');
          if (href === null) return;
          if (!href.trim()) return void c.unsetLink().run();
          if (!/^(https?:\/\/\S+\.\S+|\/\S*|mailto:\S+@\S+)$/i.test(href.trim())) return toast('That link is not a full web address, a /blog/ path or a mailto: address.', true);
          c.extendMarkRange('link').setLink({ href: href.trim() }).run();
          break;
        }
      }
    }),
  );

  // ---------- fields ----------
  const val = (sel: string) => ($(sel, el) as HTMLInputElement).value;
  const otherSlugs = new Map(info.rows.filter(r => r.id !== p.id).map(r => [r.slug, r.title]));
  const slugOf = () => slugify(val('#slug') || val('#title')).split('-').filter(Boolean).slice(0, 6).join('-');
  const serp = () => {
    const slug = slugOf();
    const title = (val('#metaTitle') || val('#title') || 'Post title').trim();
    const full = `${title} | NumFall`.length <= 60 ? `${title} | NumFall` : title;
    $('#serpTitle', el).textContent = full.length > 62 ? `${full.slice(0, 60)}…` : full;
    $('#serpSlug', el).textContent = slug || 'your-post-url';
    const d = val('#metaDesc') || val('#excerpt');
    $('#serpDesc', el).textContent = d.length > 158 ? `${d.slice(0, 155)}…` : d || 'Add a meta description: one or two plain sentences on what the post answers.';
    const mt = val('#metaTitle').length, md = val('#metaDesc').length;
    $('#mtCount', el).textContent = `${mt}/60`;
    $('#mtCount', el).className = `count${mt > 60 ? ' bad' : ''}`;
    $('#mdCount', el).textContent = `${md}/155`;
    $('#mdCount', el).className = `count${md > 155 || (md > 0 && md < 70) ? ' bad' : md ? ' good' : ''}`;
    const hint = $('#slugHint', el);
    const taken = otherSlugs.get(slug);
    const ok = /^[a-z0-9]+(-[a-z0-9]+){2,5}$/.test(slug);
    hint.textContent = taken ? `already used by "${taken}"` : ok ? `${SITE}/blog/${slug}` : '3 to 6 words';
    hint.className = `hint${taken || !ok ? ' bad' : ''}`;
  };
  $('#title', el).addEventListener('input', () => {
    if (!slugTouched) ($('#slug', el) as HTMLInputElement).value = slugify(val('#title')).split('-').filter(Boolean).slice(0, 6).join('-');
    serp();
  });
  $('#slug', el).addEventListener('input', () => ((slugTouched = true), serp()));
  $('#slug', el).addEventListener('blur', () => (($('#slug', el) as HTMLInputElement).value = slugOf()));
  ['#metaTitle', '#metaDesc', '#excerpt'].forEach(s => $(s, el).addEventListener('input', serp));
  el.addEventListener('input', () => (dirty = true));
  serp();

  const drawFaq = () => {
    $('#faq', el).innerHTML = faq.length
      ? faq.map((f, i) => `<div class="rep"><label>Question ${i + 1}<input data-fq="${i}" value="${esc(f.q)}" maxlength="200"></label><label>Answer<textarea data-fa="${i}" rows="2" maxlength="1000">${esc(f.a)}</textarea></label><button type="button" class="link danger" data-frm="${i}" aria-label="Remove question ${i + 1}">Remove</button></div>`).join('')
      : '<p class="muted small">No questions yet. Three or more help the FAQ show in search results.</p>';
    $$<HTMLInputElement>('[data-fq]', el).forEach(x => x.addEventListener('input', () => (faq[+x.dataset.fq!].q = x.value)));
    $$<HTMLTextAreaElement>('[data-fa]', el).forEach(x => x.addEventListener('input', () => (faq[+x.dataset.fa!].a = x.value)));
    $$<HTMLButtonElement>('[data-frm]', el).forEach(x => x.addEventListener('click', () => (faq.splice(+x.dataset.frm!, 1), (dirty = true), drawFaq())));
  };
  const drawSrc = () => {
    $('#sources', el).innerHTML = sources.length
      ? sources.map((s, i) => `<div class="rep two"><label>Name<input data-sn="${i}" value="${esc(s.name)}" maxlength="100" placeholder="e.g. Cornell University"></label><label>Address<input data-su="${i}" value="${esc(s.url)}" placeholder="https://"></label><button type="button" class="link danger" data-srm="${i}" aria-label="Remove source ${i + 1}">Remove</button></div>`).join('')
      : '<p class="muted small">No sources yet.</p>';
    $$<HTMLInputElement>('[data-sn]', el).forEach(x => x.addEventListener('input', () => (sources[+x.dataset.sn!].name = x.value)));
    $$<HTMLInputElement>('[data-su]', el).forEach(x => x.addEventListener('input', () => (sources[+x.dataset.su!].url = x.value)));
    $$<HTMLButtonElement>('[data-srm]', el).forEach(x => x.addEventListener('click', () => (sources.splice(+x.dataset.srm!, 1), (dirty = true), drawSrc())));
  };
  $('#addFaq', el).addEventListener('click', () => (faq.push({ q: '', a: '' }), drawFaq(), $<HTMLInputElement>(`[data-fq="${faq.length - 1}"]`, el).focus()));
  $('#addSrc', el).addEventListener('click', () => (sources.push({ name: '', url: 'https://' }), drawSrc(), $<HTMLInputElement>(`[data-sn="${sources.length - 1}"]`, el).focus()));
  drawFaq();
  drawSrc();

  // ---------- save ----------
  const body = () => ({
    title: val('#title'),
    slug: slugOf(),
    excerpt: val('#excerpt'),
    category: val('#category'),
    tags: val('#tags').split(',').map(t => t.trim()).filter(Boolean),
    author: val('#author'),
    meta_title: val('#metaTitle'),
    description: val('#metaDesc'),
    key_takeaways: val('#takeaways').split('\n').map(t => t.trim()).filter(Boolean),
    faq,
    sources,
    content_html: editor.getHTML(),
    publish_at: val('#pubAt') ? localInputToUtc(val('#pubAt'), tz) : '',
  });
  const save = async (intent: 'draft' | 'publish' | 'unpublish', btn: HTMLButtonElement) => {
    $$<HTMLButtonElement>('.pub-btns button', el).forEach(b => (b.disabled = true));
    btn.setAttribute('aria-busy', 'true');
    try {
      const saved = id
        ? await api<Post>(`blog/${id}`, { method: 'PUT', body: { intent, post: body() } })
        : await api<Post>('blog', { method: 'POST', body: { intent, post: body() } });
      dirty = false;
      toast(saved.status === 'draft' ? 'Saved as a draft.' : saved.status === 'scheduled' && !saved.live ? `Scheduled for ${fmtDate(saved.publish_at, tz)}.` : 'Published. It is live now.');
      navigate(`/admin/blog/${saved.id}`, true);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not save. Check your connection and try again.';
      toast(msg.split('\n')[0] + (msg.includes('\n') ? ` (+${msg.split('\n').length - 1} more, listed below)` : ''), true);
      showProblems(msg);
      $$<HTMLButtonElement>('.pub-btns button', el).forEach(b => (b.disabled = false));
      btn.removeAttribute('aria-busy');
    }
  };
  const showProblems = (msg: string) => {
    let box = $('#problems', el);
    if (!box) {
      box = document.createElement('div');
      box.id = 'problems';
      box.className = 'problems';
      box.setAttribute('role', 'alert');
      $('.publish', el).appendChild(box);
    }
    box.innerHTML = `<strong>Not saved:</strong><ul>${msg.split('\n').map(m => `<li>${esc(m)}</li>`).join('')}</ul>`;
  };
  $$<HTMLButtonElement>('[data-save]', el).forEach(b =>
    b.addEventListener('click', () => save(b.dataset.save === 'publish' ? 'publish' : status !== 'draft' && b.dataset.save === 'draft' ? 'unpublish' : 'draft', b)),
  );
  // Publish now: saves the edits on screen with the publish date set to this minute.
  $('#pubNow', el)?.addEventListener('click', e => {
    if (!confirm(`Publish "${val('#title')}" now? It goes live immediately and its date changes to now instead of ${fmtDate(p.publish_at, tz)}. Your edits are saved too.`)) return;
    ($('#pubAt', el) as HTMLInputElement).value = utcToLocalInput(new Date().toISOString(), tz);
    void save('publish', e.currentTarget as HTMLButtonElement);
  });
  $('#del', el)?.addEventListener('click', async () => {
    if (!confirm(`Delete "${p.title}" permanently? ${live ? 'It comes off the site at once. ' : ''}This cannot be undone.`)) return;
    try {
      await api(`blog/${id}`, { method: 'DELETE' });
      dirty = false;
      toast('Deleted.');
      navigate('/admin/blog');
    } catch (e) {
      toast((e as Error).message, true);
    }
  });
  setDirtyGuard(() => dirty);
}

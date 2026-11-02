// Mobile check: sideways scrolling, header rows, tap targets (44 px), text sizes, cookie notice, contents-link jumps
// and phone/desktop content parity, at 360, 390, 430, 844x390 and 768 px. Run: node tools/site/mobile-check.cjs [page-filter]
// Mobile checks for every page type and screen size. Prints one block per page/size with only the problems.
const { chromium } = require('playwright');
const BASE = process.env.BASE || "http://127.0.0.1:8766/"; // serve site/dist (plus rendered blog pages under m/) here
const PAGES = ['index.html', 'about.html', 'support.html', 'privacy.html', 'terms.html', 'press.html', '404.html', 'm/blog.html', 'm/blog-page2.html', 'm/category.html', 'm/article.html', 'm/post-404.html'];
const SIZES = [[360, 800, 'light'], [390, 844, 'dark'], [430, 932, 'light'], [844, 390, 'dark'], [768, 1024, 'light']];
const only = process.argv[2] ? process.argv[2].split(',') : null;

(async () => {
  const b = await chromium.launch();
  const summary = {};
  for (const name of PAGES.filter(p => !only || only.some(o => p.includes(o)))) {
    for (const [w, h, scheme] of SIZES) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, isMobile: w < 800, hasTouch: true, deviceScaleFactor: 2, bypassCSP: true });
      const p = await ctx.newPage();
      await p.goto(BASE + name, { waitUntil: 'load' });
      await p.waitForTimeout(200);
      const r = await p.evaluate(() => {
        const out = { issues: [] };
        const vw = window.innerWidth, vh = window.innerHeight;
        const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
        // 1. overflow
        const sw = document.documentElement.scrollWidth;
        if (sw > vw + 1) out.issues.push(`page scrolls sideways: ${sw}px wide in ${vw}px`);
        const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return vis(e) && r.right > vw + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.rain,.phone'); }).slice(0, 4);
        wide.forEach(e => out.issues.push(`sticks out right: ${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} right=${Math.round(e.getBoundingClientRect().right)}`));
        // 2. header
        const head = document.querySelector('header.top');
        if (head) {
          const hr = head.getBoundingClientRect();
          out.header = Math.round(hr.height);
          const links = [...head.querySelectorAll('nav a')].filter(vis);
          const rows = new Set(links.map(a => Math.round(a.getBoundingClientRect().top))).size;
          if (rows > 1) out.issues.push(`header nav wraps to ${rows} rows (header ${Math.round(hr.height)}px tall)`);
          if (hr.height > vh * 0.15) out.issues.push(`header takes ${Math.round(hr.height / vh * 100)}% of the screen height`);
          out.sticky = getComputedStyle(head).position;
        }
        // 3. tap targets (block-level controls; inline text links in paragraphs counted separately)
        const ctrls = [...document.querySelectorAll('a,button,summary,input,select,textarea,[role=button]')].filter(vis).filter(e => !e.closest('[hidden]'));
        const small = [], inlineSmall = [];
        for (const e of ctrls) {
          const r = e.getBoundingClientRect();
          const inline = getComputedStyle(e).display === 'inline' && e.closest('p,li') && !e.closest('nav,footer,.crumbs,.toc,.sharebox,.pager');
          if (r.height < 44 || r.width < 44) (inline ? inlineSmall : small).push(`${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''}${e.closest('footer') ? '(footer)' : e.closest('header.top') ? '(header)' : e.closest('header') ? '(page head)' : e.closest('.crumbs') ? '(crumbs)' : e.closest('.toc') ? '(toc)' : e.closest('.pager') ? '(pager)' : ''} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        out.small = small; out.inlineSmall = inlineSmall.length;
        // overlapping or too-close targets (< 8px apart)
        const close = [];
        const rects = ctrls.map(e => [e, e.getBoundingClientRect()]);
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
          const [a, ra] = rects[i], [c, rc] = rects[j];
          if (a.contains(c) || c.contains(a)) continue;
          const dx = Math.max(0, Math.max(ra.left, rc.left) - Math.min(ra.right, rc.right));
          const dy = Math.max(0, Math.max(ra.top, rc.top) - Math.min(ra.bottom, rc.bottom));
          const tiny = x => x.height < 44 || x.width < 44; if (dx < 8 && dy < 8 && (tiny(ra) || tiny(rc)) && !a.closest('#consent') && !c.closest('#consent') && (getComputedStyle(a).display !== 'inline' || getComputedStyle(c).display !== 'inline')) close.push(`"${a.textContent.trim().slice(0, 12)}"/"${c.textContent.trim().slice(0, 12)}"`);
        }
        out.touching = close.slice(0, 6); out.touchingCount = close.length;
        // 4. text sizes
        const sizes = {};
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n; while ((n = walker.nextNode())) {
          if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement) || n.parentElement.closest('.rain,.phone,[aria-hidden=true],script,style')) continue;
          const fs = parseFloat(getComputedStyle(n.parentElement).fontSize);
          if (fs < 12) { const k = `${n.parentElement.tagName.toLowerCase()}.${String(n.parentElement.className).split(' ')[0]} ${fs}px "${n.textContent.trim().slice(0, 20)}"`; sizes[k] = 1; }
        }
        out.tinyText = Object.keys(sizes).slice(0, 6);
        const para = document.querySelector('main p, .prose p, .lead');
        if (para) out.bodyFont = parseFloat(getComputedStyle(para).fontSize) + '/' + getComputedStyle(para).lineHeight;
        const prose = document.querySelector('.prose p');
        if (prose) out.lineChars = Math.round(prose.getBoundingClientRect().width / (parseFloat(getComputedStyle(prose).fontSize) * 0.5));
        [...document.querySelectorAll('input,select,textarea')].filter(vis).forEach(e => { if (parseFloat(getComputedStyle(e).fontSize) < 16) out.issues.push(`form field font ${getComputedStyle(e).fontSize} (iPhone zooms in)`); });
        // 5. consent banner
        const c = document.getElementById('consent');
        if (c && !c.hidden) {
          const cr = c.getBoundingClientRect();
          out.consent = `${Math.round(cr.height)}px (${Math.round(cr.height / vh * 100)}% of screen)`;
          const badge = [...document.querySelectorAll('.store-badge')].find(vis);
          if (badge) { const br = badge.getBoundingClientRect(); if (br.bottom > cr.top && br.top < cr.bottom && br.top < vh) out.issues.push('cookie notice covers the App Store button on first screen'); }
        }
        // meta
        const vp = document.querySelector('meta[name=viewport]')?.content || '';
        if (/user-scalable=no|maximum-scale=1/.test(vp)) out.issues.push('viewport blocks zoom');
        out.firstScreen = (() => { const h1 = document.querySelector('h1'); return h1 ? Math.round(h1.getBoundingClientRect().top) : null; })();
        // parity data
        out.parity = { text: document.body.innerText.length, h: document.querySelectorAll('h1,h2,h3').length, links: document.querySelectorAll('a[href]').length, ld: document.querySelectorAll('script[type="application/ld+json"]').length,
          hidden: [...document.querySelectorAll('main *, header *, footer *')].filter(e => getComputedStyle(e).display === 'none' && e.textContent.trim().length > 20 && !e.closest('[hidden],details:not([open]),dialog')).map(e => e.tagName + '.' + e.className).slice(0, 4) };
        return out;
      });
      // 6. contents-box jump: is the heading visible under the sticky header?
      if (name === 'm/article.html' && w < 800) {
        const link = true;
        if (link) {
          await p.evaluate(() => { location.hash = 'faq'; }); await p.waitForTimeout(900);
          const hid = await p.evaluate(() => { const id = location.hash.slice(1); const t = document.getElementById(id); const head = document.querySelector('header.top'); const hb = head && getComputedStyle(head).position.match(/sticky|fixed/) ? head.getBoundingClientRect().bottom : 0; return t ? Math.round(t.getBoundingClientRect().top - hb) : 'none'; });
          if (typeof hid === 'number' && hid < 0) r.issues.push(`contents link: heading ends up ${-hid}px under the sticky header`);
          r.tocJump = hid;
        }
      }
      const key = `${name} ${w}x${h} ${scheme}`;
      summary[key] = r;
      console.log(`\n== ${key} header=${r.header}px ${r.sticky || ''} body=${r.bodyFont || '-'} h1top=${r.firstScreen} lineChars=${r.lineChars || '-'} consent=${r.consent || '-'}${r.tocJump !== undefined ? ' tocJump=' + r.tocJump : ''}`);
      r.issues.forEach(x => console.log('  !', x));
      if (r.small.length) console.log(`  small targets (${r.small.length}):`, r.small.slice(0, 8).join(' | '));
      if (r.inlineSmall) console.log(`  inline text links under 44px tall: ${r.inlineSmall}`);
      if (r.touchingCount) console.log(`  touching targets (${r.touchingCount}):`, r.touching.join(' '));
      if (r.tinyText.length) console.log('  text under 12px:', r.tinyText.join(' | '));
      console.log('  parity', JSON.stringify(r.parity));
      await ctx.close();
    }
  }
  await b.close();
})();

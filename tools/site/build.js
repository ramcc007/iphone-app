// Builds the website (site/dist) from site/src using site/site.config.json.
// Run: node tools/site/build.js        Check only: node tools/site/build.js --check
// Placeholders written in [SQUARE BRACKETS] in the config are highlighted and listed, because they must be
// replaced before the site is published (the App Store needs real privacy, terms and support URLs).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../../site'), SRC = path.join(ROOT, 'src'), DIST = path.join(ROOT, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
// Private values (legal name, support email) live in site/site.config.local.json, which git ignores, so they never reach the repository.
const localCfg = path.join(ROOT, 'site.config.local.json');
if (fs.existsSync(localCfg)) Object.assign(cfg, JSON.parse(fs.readFileSync(localCfg, 'utf8')));
// On Vercel the same private values come from project environment variables.
const ENV = { SITE_LEGAL_NAME: 'legalName', SITE_SUPPORT_EMAIL: 'supportEmail', SITE_GOVERNING_LAW: 'governingLaw', SITE_URL: 'siteUrl', SITE_APPSTORE_URL: 'appStoreUrl' };
for (const [k, v] of Object.entries(ENV)) if (process.env[k]) cfg[v] = process.env[k];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const placeholders = [];
const val = (k) => {
  const v = cfg[k] === undefined ? '' : String(cfg[k]);
  if (/^\[.*\]$/.test(v)) { placeholders.push(k + ' = ' + v); return '<span class="todo">' + esc(v) + '</span>'; }
  return esc(v);
};
const fill = (text, extra) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (extra && k in extra) ? extra[k] : (k in cfg ? val(k) : m));
const layout = fs.readFileSync(path.join(SRC, 'layout.html'), 'utf8');
const pages = fs.readdirSync(path.join(SRC, 'pages')).filter((f) => f.endsWith('.html'));
const out = {}, sitemap = [];
// The day a page last changed in git, for the sitemap. Falls back to today when git is not available.
const lastModified = (file) => {
  try { const d = require('child_process').execSync('git log -1 --format=%cs -- "' + file + '"', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); if (d) return d; } catch (e) {}
  return new Date().toISOString().slice(0, 10);
};
// Structured data for search engines on the home page: the website and the app. No ratings or reviews are claimed.
const structuredData = (description) => {
  const app = { '@type': 'MobileApplication', name: cfg.appName, description, url: cfg.siteUrl + '/', image: cfg.siteUrl + '/icon-512.png',
    operatingSystem: 'iOS, iPadOS', applicationCategory: 'GameApplication', applicationSubCategory: 'Puzzle',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@type': 'Organization', name: cfg.appName, url: cfg.siteUrl + '/', logo: cfg.siteUrl + '/icon-512.png', email: cfg.supportEmail } };
  if (cfg.appStoreUrl) { app.downloadUrl = cfg.appStoreUrl; app.installUrl = cfg.appStoreUrl; app.sameAs = [cfg.appStoreUrl]; }
  return { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: cfg.appName, url: cfg.siteUrl + '/', description: cfg.tagline }, app] };
};
for (const f of pages) {
  let body = fs.readFileSync(path.join(SRC, 'pages', f), 'utf8');
  const meta = body.match(/^<!--\s*title:\s*(.*?)\s*\|\s*description:\s*(.*?)\s*-->\s*/);
  if (!meta) throw new Error(f + ': missing "<!-- title: ... | description: ... -->" first line');
  body = body.slice(meta[0].length);
  const storeLine = cfg.appStoreUrl ? '<a href="' + esc(cfg.appStoreUrl) + '" target="_blank" rel="noopener">Download on the App Store</a>' : 'Coming soon to the App Store for iPhone and iPad.';
  // Apple's official black badge, unmodified (developer.apple.com/app-store/marketing/guidelines): at least 40 px tall, with clear space around it.
  const storeButton = cfg.appStoreUrl ? '<a class="store-badge" href="' + esc(cfg.appStoreUrl) + '" target="_blank" rel="noopener"><img src="/app-store-badge.svg" alt="Download on the App Store" width="168" height="56"></a>' : '<span class="btn" aria-disabled="true">Coming soon to the App Store</span>';
  const emailLink = '<a href="mailto:' + esc(cfg.supportEmail) + '">' + val('supportEmail') + '</a>';
  const content = fill(body, { storeLine, storeButton, emailLink });
  const plain = (s) => fill(s).replace(/<[^>]+>/g, '');
  const title = plain(meta[1]), description = plain(meta[2]), notFound = f === '404.html';
  const fullTitle = title.includes(cfg.appName) ? title : title + ' | ' + cfg.appName;
  const urlPath = f === 'index.html' ? '/' : '/' + f.replace('.html', '');
  const jsonLd = f === 'index.html' ? '<script type="application/ld+json">' + JSON.stringify(structuredData(description)).replace(/</g, '\\u003c') + '</script>' : '';
  // Website analytics (Google Analytics 4), only after the visitor taps Accept. Declining loads nothing from Google.
  // The app itself collects nothing; this covers numfall.store only (see the privacy policy's "This website" section).
  const ga = cfg.gaMeasurementId;
  const analytics = ga ? `<div id="consent" class="consent" role="dialog" aria-live="polite" aria-label="Cookie choice" hidden><p>We use Google Analytics cookies to count visits to this website (not the app). OK? <a href="/privacy#website">Details</a></p><div><button type="button" class="btn small" data-c="yes">Accept</button><button type="button" class="btn ghost small" data-c="no">No thanks</button></div></div>
<script>(function(){var id='${ga}',k='nf-consent',b=document.getElementById('consent');
function load(){if(window.gtag)return;var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments);};gtag('js',new Date());gtag('config',id);}
function get(){try{return localStorage.getItem(k);}catch(e){return null;}}
function set(v){try{localStorage.setItem(k,v);}catch(e){}}
var c=get();if(c==='yes')load();else if(c!=='no')b.hidden=false;
b.addEventListener('click',function(e){var v=e.target.getAttribute('data-c');if(!v)return;set(v);b.hidden=true;if(v==='yes')load();else if(window.gtag)location.reload();});
var r=document.getElementById('cookie-settings');if(r)r.addEventListener('click',function(e){e.preventDefault();try{localStorage.removeItem(k);}catch(x){}b.hidden=false;});})();</script>` : '';
  // Smart App Banner: Safari on iPhone and iPad shows Apple's "Get" bar at the top of every page.
  const appId = (cfg.appStoreUrl.match(/id(\d+)/) || [])[1];
  const appBanner = appId ? '<meta name="apple-itunes-app" content="app-id=' + appId + '">' : '';
  out[f] = fill(layout, { fullTitle: esc(fullTitle), description: esc(description), canonical: esc(cfg.siteUrl + urlPath), robots: notFound ? 'noindex' : 'index, follow', jsonLd, appBanner, analytics, content, year: String(new Date().getFullYear()) });
  // SEO checks: a broken page fails the build (and so the Vercel deploy) instead of going live.
  const problems = [];
  if (fullTitle.length > 65) problems.push('title is ' + fullTitle.length + ' characters (keep it to 65 so search results do not cut it off)');
  if (!notFound && (description.length < 70 || description.length > 170)) problems.push('description is ' + description.length + ' characters (aim for 70 to 170)');
  if ((content.match(/<h1[ >]/g) || []).length !== 1) problems.push('needs exactly one <h1>');
  if (/sudoku/i.test(out[f])) problems.push('uses a trademarked game name (see CLAUDE.md)');
  if (problems.length) throw new Error(f + ': ' + problems.join('; '));
  if (!notFound) sitemap.push({ loc: cfg.siteUrl + urlPath, lastmod: lastModified(path.join(SRC, 'pages', f)) });
  const left = out[f].match(/\{\{\w+\}\}/g);
  if (left) throw new Error(f + ': unknown placeholder ' + left[0]);
}
if (process.argv.includes('--check')) { console.log('Site builds: ' + pages.length + ' pages. Still to fill in: ' + (new Set(placeholders).size ? [...new Set(placeholders)].join('; ') : 'nothing')); process.exit(0); }
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST, { recursive: true });
for (const f of pages) fs.writeFileSync(path.join(DIST, f), out[f]);
fs.copyFileSync(path.join(SRC, 'style.css'), path.join(DIST, 'style.css'));
fs.copyFileSync(path.join(SRC, 'favicon.svg'), path.join(DIST, 'favicon.svg'));
// Icons and the social sharing image (made from the app icon; see site/README.md).
for (const f of fs.readdirSync(path.join(SRC, 'static'))) fs.copyFileSync(path.join(SRC, 'static', f), path.join(DIST, f));
fs.writeFileSync(path.join(DIST, 'site.webmanifest'), JSON.stringify({ name: cfg.appName, short_name: cfg.appName, description: cfg.tagline, start_url: '/', display: 'browser', background_color: '#13161F', theme_color: '#13161F',
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2) + '\n');
fs.writeFileSync(path.join(DIST, 'robots.txt'), fill(fs.readFileSync(path.join(SRC, 'robots.txt'), 'utf8')));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemap.map((u) => '  <url><loc>' + esc(u.loc) + '</loc><lastmod>' + u.lastmod + '</lastmod></url>').join('\n') + '\n</urlset>\n');
// llms.txt (llmstxt.org): a plain-text summary of the site for AI assistants. Plain text, so placeholders are filled without HTML.
const storeStatus = cfg.appStoreUrl ? 'available on the App Store: ' + cfg.appStoreUrl : 'coming soon to the App Store.';
const llms = fs.readFileSync(path.join(SRC, 'llms.txt'), 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k) => k === 'storeStatus' ? storeStatus : (k in cfg ? String(cfg[k]) : m));
if (/\{\{\w+\}\}|sudoku/i.test(llms)) throw new Error('llms.txt: unknown placeholder or trademarked name');
fs.writeFileSync(path.join(DIST, 'llms.txt'), llms);
console.log('Wrote ' + pages.length + ' pages to site/dist/.');
if (placeholders.length) console.log('NOT READY TO PUBLISH. Fill these in site/site.config.json:\n  ' + [...new Set(placeholders)].join('\n  '));
if (placeholders.length && process.env.VERCEL) { console.error('Refusing to deploy a site with placeholders.'); process.exit(1); }

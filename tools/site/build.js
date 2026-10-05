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
const out = {};
for (const f of pages) {
  let body = fs.readFileSync(path.join(SRC, 'pages', f), 'utf8');
  const meta = body.match(/^<!--\s*title:\s*(.*?)\s*\|\s*description:\s*(.*?)\s*-->\s*/);
  if (!meta) throw new Error(f + ': missing "<!-- title: ... | description: ... -->" first line');
  body = body.slice(meta[0].length);
  const storeLine = cfg.appStoreUrl ? '<a href="' + esc(cfg.appStoreUrl) + '">Download on the App Store</a>' : 'Coming soon to the App Store for iPhone and iPad.';
  const storeButton = cfg.appStoreUrl ? 'Download on the App Store' : 'Coming soon to the App Store';
  const content = fill(body, { storeLine, storeButton });
  const plain = (s) => fill(s).replace(/<[^>]+>/g, '');
  out[f] = fill(layout, { title: esc(plain(meta[1])), description: esc(plain(meta[2])), content, year: String(new Date().getFullYear()) });
  const left = out[f].match(/\{\{\w+\}\}/g);
  if (left) throw new Error(f + ': unknown placeholder ' + left[0]);
}
if (process.argv.includes('--check')) { console.log('Site builds: ' + pages.length + ' pages. Still to fill in: ' + (new Set(placeholders).size ? [...new Set(placeholders)].join('; ') : 'nothing')); process.exit(0); }
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST, { recursive: true });
for (const f of pages) fs.writeFileSync(path.join(DIST, f), out[f]);
fs.copyFileSync(path.join(SRC, 'style.css'), path.join(DIST, 'style.css'));
fs.copyFileSync(path.join(SRC, 'favicon.svg'), path.join(DIST, 'favicon.svg'));
fs.copyFileSync(path.join(SRC, 'vercel.json'), path.join(DIST, 'vercel.json'));
console.log('Wrote ' + pages.length + ' pages to site/dist/.');
if (placeholders.length) console.log('NOT READY TO PUBLISH. Fill these in site/site.config.json:\n  ' + [...new Set(placeholders)].join('\n  '));

// Builds the admin page into site/dist/admin (run after tools/site/build.js).
//   site role (numfall.store):      the admin area - admin/ui (dashboard, blog list, TipTap editor)
//   writer role (APP_ROLE=writer):  the NumFall Writer tool - writer/ui
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const writer = process.env.APP_ROLE === 'writer';
const out = join(root, 'site', 'dist', 'admin');
mkdirSync(out, { recursive: true });
const entry = writer ? join(root, 'writer', 'ui', 'main.ts') : join(root, 'admin', 'ui', 'main.ts');
const files = writer ? join(root, 'site', 'admin') : join(root, 'admin', 'ui');
await build({ entryPoints: [entry], bundle: true, minify: true, format: 'iife', target: 'es2022', outfile: join(out, 'app.js'), logLevel: 'warning' });
for (const f of ['index.html', 'admin.css']) cpSync(join(files, f), join(out, f));
console.log(`Wrote the ${writer ? 'writer tool' : 'admin area'} to site/dist/admin/.`);

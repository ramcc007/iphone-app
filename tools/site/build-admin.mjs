// Builds the NumFall Writer admin page into site/dist/admin (run after tools/site/build.js).
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'site', 'dist', 'admin');
mkdirSync(out, { recursive: true });
await build({ entryPoints: [join(root, 'writer', 'ui', 'main.ts')], bundle: true, minify: true, format: 'iife', target: 'es2022', outfile: join(out, 'app.js'), logLevel: 'warning' });
for (const f of ['index.html', 'admin.css']) cpSync(join(root, 'site', 'admin', f), join(out, f));
console.log('Wrote the admin page to site/dist/admin/.');

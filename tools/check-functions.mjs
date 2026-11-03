// Loads every Vercel function the way Vercel does (CommonJS, require() of ES modules switched off), so a
// dependency that only ships ES modules fails here instead of crashing in production (FUNCTION_INVOCATION_FAILED).
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const out = '.tmp-functions';
rmSync(out, { recursive: true, force: true });
execFileSync('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit', 'false', '--outDir', out], { stdio: 'inherit' });
const fns = readdirSync(join(out, 'api')).filter(f => f.endsWith('.js'));
for (const f of fns) {
  // og.js also loads @vercel/og (an ES module) the way it does when drawing an image.
  const extra = f === 'og.js' ? '.loadImageResponse().then(x => { if (typeof x !== "function") process.exit(1); })' : '';
  execFileSync(process.execPath, ['--no-experimental-require-module', '-e', `require(${JSON.stringify('./' + join(out, 'api', f))})${extra}`], { stdio: 'inherit' });
}
rmSync(out, { recursive: true, force: true });
console.log(`Functions load under CommonJS: ${fns.join(', ')}`);

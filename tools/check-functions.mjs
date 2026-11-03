// Loads every Vercel function the way Vercel does (CommonJS, require() of ES modules switched off), so a
// dependency that only ships ES modules fails here instead of crashing in production (FUNCTION_INVOCATION_FAILED).
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const out = '.tmp-functions';
rmSync(out, { recursive: true, force: true });
execFileSync('npx', ['tsc', '-p', 'tsconfig.json', '--noEmit', 'false', '--outDir', out], { stdio: 'inherit' });
// og.js is the exception: @vercel/og ships ES modules and Vercel's builder handles it (share images render live).
const fns = readdirSync(join(out, 'api')).filter(f => f.endsWith('.js') && f !== 'og.js');
for (const f of fns) {
  execFileSync(process.execPath, ['--no-experimental-require-module', '-e', `require(${JSON.stringify('./' + join(out, 'api', f))})`], { stdio: 'inherit' });
}
rmSync(out, { recursive: true, force: true });
console.log(`Functions load under CommonJS: ${fns.join(', ')}`);

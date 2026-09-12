import { build } from 'esbuild';
import { readdir, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await mkdir('.test-build', { recursive: true });
const entries = (await readdir('tests')).filter((name) => name.endsWith('.test.ts'));
await build({
  entryPoints: entries.map((name) => `tests/${name}`),
  outdir: '.test-build', outExtension: { '.js': '.mjs' },
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
  sourcemap: 'inline',
});
const result = spawnSync(process.execPath,
  ['--test', ...entries.map((name) => `.test-build/${name.replace(/\.ts$/, '.mjs')}`)],
  { stdio: 'inherit' });
process.exitCode = result.status ?? 1;

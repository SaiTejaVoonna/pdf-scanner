import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

/** Stamps dist/sw.js with a hash of the built assets so each release is a byte-different worker (that is what triggers an update). */
const stampServiceWorker = () => ({
  name: 'stamp-service-worker',
  apply: 'build' as const,
  closeBundle() {
    const dist = new URL('./dist', import.meta.url).pathname;
    const hash = createHash('sha256');
    for (const f of readdirSync(join(dist, 'assets')).sort()) hash.update(f);
    hash.update(readFileSync(join(dist, 'index.html')));
    const file = join(dist, 'sw.js');
    writeFileSync(file, readFileSync(file, 'utf-8').replace('__BUILD_ID__', `pdf-scanner-${pkg.version}-${hash.digest('hex').slice(0, 10)}`));
  },
});

// Relative base so the build works from any path (GitHub Pages serves it under /<repo>/).
export default defineConfig({
  base: './',
  plugins: [stampServiceWorker()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', sourcemap: false },
});

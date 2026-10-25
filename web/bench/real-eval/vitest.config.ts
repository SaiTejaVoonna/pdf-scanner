import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['bench/real-eval/*.eval.ts'], testTimeout: 600_000 } });

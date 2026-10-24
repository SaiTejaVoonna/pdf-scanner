import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['bench/real-eval/engine.eval.ts'], testTimeout: 600_000 } });

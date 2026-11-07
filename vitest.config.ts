import { defineConfig } from 'vitest/config';

// Kept apart from vite.config.ts so tests skip the IWSDK dev plugin.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});

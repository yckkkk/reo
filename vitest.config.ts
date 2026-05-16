import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rendererSourcePath = fileURLToPath(new URL('./src/renderer/src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': rendererSourcePath,
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://127.0.0.1/',
      },
    },
    fileParallelism: false,
    include: ['src/renderer/**/*.test.{ts,tsx}'],
    maxWorkers: 1,
    setupFiles: ['src/renderer/src/test/setup.ts'],
  },
});

import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const rendererSourcePath = fileURLToPath(new URL('./src/renderer/src', import.meta.url));

export default defineConfig({
  main: {},
  preload: {
    build: {
      rolldownOptions: {
        output: {
          entryFileNames: '[name].cjs',
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': rendererSourcePath,
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  },
});

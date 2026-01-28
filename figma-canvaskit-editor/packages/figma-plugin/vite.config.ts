import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/code.ts'),
      name: 'figma-plugin',
      formats: ['iife'],
      fileName: () => 'code.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'code.js',
      },
    },
  },
});

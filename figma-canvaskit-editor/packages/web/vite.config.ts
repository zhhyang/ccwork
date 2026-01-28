import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5176,
  },
  optimizeDeps: {
    exclude: ['canvaskit-wasm'],
  },
});

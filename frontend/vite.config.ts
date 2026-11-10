declare const process: { env: Record<string, string | undefined> };

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API runs on :8000; the proxy keeps the browser on one origin (no CORS needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_DEV_API ?? 'http://localhost:8000', changeOrigin: true } },
  },
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});

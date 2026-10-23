import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/health': {
        target: process.env.API_PROXY_URL ?? 'http://127.0.0.1:3001',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/api': {
        target: process.env.API_PROXY_URL ?? 'http://127.0.0.1:3001',
      },
    },
  },
  preview: { host: '0.0.0.0', port: 5173, strictPort: true },
});

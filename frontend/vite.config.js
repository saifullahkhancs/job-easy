import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Dev-server only: listen on all interfaces and accept sandbox/preview
    // hosts (e.g. *.e2b.app) so the app can be viewed from a browser through
    // a proxied URL. No effect on `vite build` output.
    host: true,
    allowedHosts: ['.e2b.app'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})

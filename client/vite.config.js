import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the browser talks only to Vite (port 5173). Vite forwards
// every /api call to the Express server, so there is no CORS to configure.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
  // `npm test`: Vitest runs components in jsdom, a browser simulated in Node.
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
  },
});

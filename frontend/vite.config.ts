import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend REST API (see backend/src/main/resources/application.yml, port 8080).
      // Frontend code must always call relative paths like /api/v1/... so the same
      // routing works in production behind nginx.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Spring WebSocket endpoint. `ws: true` is required for the upgrade handshake.
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    css: true,
    // @testing-library/jest-dom's matchers need the vitest globals (e.g. `expect`) available
    // on the global object at import time.
    globals: true,
  },
})

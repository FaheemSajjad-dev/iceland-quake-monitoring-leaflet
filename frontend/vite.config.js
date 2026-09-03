import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const backendPort = process.env.BACKEND_PORT || '5001'
  const backendProxy = {
    target: `http://127.0.0.1:${backendPort}`,
    changeOrigin: true,
  }

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    build: {
      target: 'esnext',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
    server: {
      port: 5174,
      proxy: {
        '/health': { ...backendProxy },
        '/earthquakes': { ...backendProxy },
        '/insights': { ...backendProxy },
        '/volcanoes': { ...backendProxy },
        '/scrape-volcanoes': { ...backendProxy },
        '/reconcile': { ...backendProxy },
        '/initialize-data': { ...backendProxy },
        '/shakemap': { ...backendProxy },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/__tests__/setup.js',
    },
  }
})

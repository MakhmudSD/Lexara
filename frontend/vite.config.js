import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
const sentryPackageExists = existsSync(resolve('node_modules/@sentry/react'));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: sentryPackageExists ? {} : {
      '@sentry/react': resolve('src/vendor/sentry-react-stub.js'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-sentry': ['@sentry/react'],
          'vendor-analytics': ['@vercel/analytics', '@vercel/speed-insights'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/tests/setup.js'],
    css: false,
  },
});

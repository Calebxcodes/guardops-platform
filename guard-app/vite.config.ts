import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Strondis Guard',
        short_name: 'Strondis Guard',
        description: 'Strondis Guard — officer portal for shift tracking, clock-in and reporting',
        theme_color: '#1e3a8a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-72.png',   sizes: '72x72',   type: 'image/png' },
          { src: '/icon-96.png',   sizes: '96x96',   type: 'image/png' },
          { src: '/icon-128.png',  sizes: '128x128', type: 'image/png' },
          { src: '/icon-144.png',  sizes: '144x144', type: 'image/png' },
          { src: '/icon-152.png',  sizes: '152x152', type: 'image/png' },
          { src: '/icon-192.png',  sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-384.png',  sizes: '384x384', type: 'image/png' },
          { src: '/icon-512.png',  sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React stack
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Icons
          'vendor-icons': ['lucide-react'],
          // Utilities
          'vendor-utils': ['axios', 'date-fns', 'zustand', 'clsx'],
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})

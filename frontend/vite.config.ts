import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Strondis Ops',
        short_name: 'Strondis Ops',
        description: 'Strondis Ops — security operations management platform',
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 8 },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})

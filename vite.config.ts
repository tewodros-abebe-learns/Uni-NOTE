import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
          navigateFallback: '/index.html'
        },
        devOptions: {
          enabled: false,
          type: 'module',
          navigateFallback: 'index.html',
        },
        manifest: {
          name: 'Uni.Note',
          short_name: 'Uni.Note',
          description: 'Academic Knowledge Base & Note-Taking Platform',
          theme_color: '#131314',
          background_color: '#131314',
          display: 'standalone',
          id: '/', start_url: '/', scope: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        }
      })
    ],
    build: {
      // Avoid duplicate preload fetches with service-worker cached ES modules.
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/katex/')) return 'math';
            if ((id.includes('@firebase/firestore') || id.includes('/firebase/firestore/'))) return 'firestore';
            if ((id.includes('@firebase/auth') || id.includes('/firebase/auth/'))) return 'auth';
            if ((id.includes('@firebase/storage') || id.includes('/firebase/storage/'))) return 'storage';
            if (id.includes('@firebase') || id.includes('/firebase/')) return 'firebase-core';
            if (id.includes('/motion') || id.includes('/framer-motion')) return 'motion';
            if (id.includes('/react-dom/') || id.includes('/react/')) return 'react';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: ['.e2b.app'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

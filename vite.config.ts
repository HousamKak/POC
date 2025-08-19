// ========================================
// vite.config.ts - Vite Configuration
// ========================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Graph-First Programming IDE',
        short_name: 'GFP IDE',
        description: 'Visual architecture design and code generation IDE',
        theme_color: '#667eea',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  css: {
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@/components': resolve(__dirname, './components'),
      '@/domain': resolve(__dirname, './domain'),
      '@/application': resolve(__dirname, './application'),
      '@/infrastructure': resolve(__dirname, './infrastructure'),
      '@/interface': resolve(__dirname, './interface'),
      '@/utils': resolve(__dirname, './utils'),
      '@/types': resolve(__dirname, './types'),
      '@/hooks': resolve(__dirname, './hooks'),
      '@/stores': resolve(__dirname, './stores'),
      '@/scripts': resolve(__dirname, './scripts')
    }
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(process.env['npm_package_version'])
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          d3: ['d3'],
          editor: ['monaco-editor', '@monaco-editor/react']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true,
    open: true
  },
  preview: {
    port: 4173,
    host: true
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'd3', 'lodash']
  }
});
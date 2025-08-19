import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import checker from 'vite-plugin-checker';

export default defineConfig({
  plugins: [
    react({
      // React Fast Refresh is enabled by default in newer versions
      // fastRefresh: true, // Remove this line as it's deprecated
    }),
    
    // TypeScript type checking
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint "./**/*.{ts,tsx}" --ignore-pattern "node_modules/**" --ignore-pattern "dist/**"',
      },
    }),
    
    // Progressive Web App support
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Graph-First Programming IDE',
        short_name: 'GFP IDE',
        description: 'Visual architecture design with automatic code generation',
        theme_color: '#667eea',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],

  // Development server configuration
  server: {
    port: 5173,
    host: true, // Listen on all addresses
    open: true, // Auto-open browser
    cors: true,
    hmr: {
      overlay: true,
    },
  },

  // Build configuration
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    
    // Rollup options
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          react: ['react', 'react-dom'],
          d3: ['d3'],
          vendor: ['lucide-react'],
        },
      },
    },
    
    // Build optimizations
    chunkSizeWarningLimit: 1000,
    
    // Asset handling
    assetsInlineLimit: 4096,
  },

  // Path resolution
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@types': '/src/types',
      '@utils': '/src/utils',
    },
  },

  // CSS configuration
  css: {
    modules: { localsConvention: 'camelCaseOnly' }
    // PostCSS plugins loaded via separate postcss.config.js
  },

  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  // Optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'd3',
      'lucide-react',
    ],
    exclude: [
      // Exclude any problematic dependencies
    ],
  },

  // Preview server (for production build testing)
  preview: {
    port: 4173,
    host: true,
    open: true,
  },

  // ESBuild configuration
  esbuild: {
    target: 'esnext',
    format: 'esm',
    logOverride: {
      'this-is-undefined-in-esm': 'silent',
    },
  },

  // Worker configuration
  worker: {
    format: 'es',
  },
});
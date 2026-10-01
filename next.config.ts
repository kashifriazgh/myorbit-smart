import type { NextConfig } from 'next';
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',

  runtimeCaching: [
    // ─── App shell / navigation ────────────────────────────────────────────────
    // StaleWhileRevalidate: serve from cache IMMEDIATELY, update in background.
    // This replaces the old NetworkFirst(10s) and makes the app open instantly.
    {
      urlPattern: /^https:\/\/myorbit\.app\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages',
        expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: ({ request }: { request: Request }) =>
        request.mode === 'navigate',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages',
        expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
      },
    },

    // ─── Next.js static JS/CSS chunks ──────────────────────────────────────────
    // CacheFirst: hashed filenames never change; serve from cache forever.
    {
      urlPattern: /\/_next\/static\/.+/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 256, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },

    // ─── Next.js image optimisation ────────────────────────────────────────────
    {
      urlPattern: /\/_next\/image\?url=.+/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },

    // ─── Google Fonts ──────────────────────────────────────────────────────────
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
        expiration: { maxEntries: 8, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: { maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },

    // ─── Static assets (images, icons, lottie, etc.) ──────────────────────────
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp|json)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },

    // ─── Firebase Firestore / Auth (network only – never cache live data) ──────
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https:\/\/securetoken\.googleapis\.com\/.*/i,
      handler: 'NetworkOnly',
    },

    // ─── Internal API routes (short-lived, network-first with quick fallback) ──
    {
      urlPattern: /\/api\//i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  // Disable strict mode in development to prevent double-rendering and double-effect execution on every page navigation
  reactStrictMode: false,
  
  // Package import optimization for ultra-fast dev compilation
  experimental: {
    optimizePackageImports: [
      '@mui/material',
      '@mui/icons-material',
      '@mui/lab',
      '@mui/x-date-pickers',
      'lucide-react',
      'recharts',
      'chart.js',
      'framer-motion',
      'moment',
      'moment-timezone',
      '@tiptap/react',
      '@tiptap/starter-kit',
      'dexie',
    ],
  },

  
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // Disable source maps in development for faster builds
  productionBrowserSourceMaps: false,
  
  // Optimize webpack for development
  webpack: (config, { dev }) => {
    if (dev) {
      // Use ultra-fast cheap source maps for development compiles
      config.devtool = 'eval-cheap-module-source-map';

      config.watchOptions = {
        // Ignore specific directories to improve performance
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/public/**',
          '**/coverage/**',
          '**/dist/**',
          '**/build/**',
          '**/.cache/**',
          '**/logs/**',
          '**/*.log',
          '**/cleanup-dev.js',
          '**/README.md',
          '**/MY_ORBIT_APP_DOCUMENTATION.md',
        ],
      };
    }
    return config;
  },
};

export default withPWA(nextConfig);

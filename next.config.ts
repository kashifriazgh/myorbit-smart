import type { NextConfig } from 'next';
import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public', // service worker will be generated here
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Optimize for development
  experimental: {
    optimizePackageImports: [
      '@mui/material',
      '@mui/icons-material',
      '@mui/lab',
      '@mui/x-date-pickers',
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

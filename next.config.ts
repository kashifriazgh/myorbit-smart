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
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  // Disable source maps in development for faster builds
  productionBrowserSourceMaps: false,
  // Optimize webpack for development
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
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

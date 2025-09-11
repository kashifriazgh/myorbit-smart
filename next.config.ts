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
  },
  // Disable source maps in development for faster builds
  productionBrowserSourceMaps: false,
};

export default withPWA(nextConfig);

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const forceClean = args.includes('--force') || args.includes('-f') || args.includes('--all');

console.log('🧹 Cleaning up dev environment...');

if (fs.existsSync('.next')) {
  console.log('🧹 Removing .next folder to prevent cache conflicts...');
  try {
    fs.rmSync('.next', { recursive: true, force: true });
  } catch (e) {
    console.warn('Could not remove .next directory:', e.message);
  }
}

// Always safe to clean lightweight caches
// Remove TypeScript build cache
if (fs.existsSync('tsconfig.tsbuildinfo')) {
  console.log('🧹 Removing TypeScript build info...');
  fs.unlinkSync('tsconfig.tsbuildinfo');
}

if (fs.existsSync('.tsbuildinfo')) {
  console.log('🧹 Removing TypeScript cache...');
  fs.unlinkSync('.tsbuildinfo');
}

// Remove ESLint cache
if (fs.existsSync('.eslintcache')) {
  console.log('🧹 Removing ESLint cache...');
  fs.unlinkSync('.eslintcache');
}

console.log('✅ Lightweight cleanup complete!');
console.log('🚀 Start your dev server:');
console.log('   npm run dev        (Standard dev server)');
console.log('   npm run dev:turbo  (Ultra-fast Turbopack - HIGHLY RECOMMENDED!)');

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const forceClean = args.includes('--force') || args.includes('-f') || args.includes('--all');

console.log('🧹 Cleaning up dev environment...');

if (forceClean) {
  // Remove .next folder (Only on explicit force)
  if (fs.existsSync('.next')) {
    console.log('⚠️  Removing .next folder (Full Cold Clean)...');
    fs.rmSync('.next', { recursive: true, force: true });
  }
  
  // Clear npm cache (Only on explicit force)
  console.log('⚠️  Clearing npm cache...');
  try {
    require('child_process').execSync('npm cache clean --force', {
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('Failed to clear npm cache (non-critical):', err.message);
  }
} else {
  console.log('💡 Keeping Next.js compiler cache (.next/cache) to ensure fast startup and quick page navigation.');
  console.log('👉 To perform a full cold-rebuild clean, run: npm run clean -- --force');
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

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning up dev environment...');

// Remove .next folder
if (fs.existsSync('.next')) {
  console.log('Removing .next folder...');
  fs.rmSync('.next', { recursive: true, force: true });
}

// Remove TypeScript cache
if (fs.existsSync('.tsbuildinfo')) {
  console.log('Removing TypeScript cache...');
  fs.unlinkSync('.tsbuildinfo');
}

// Remove ESLint cache
if (fs.existsSync('.eslintcache')) {
  console.log('Removing ESLint cache...');
  fs.unlinkSync('.eslintcache');
}

// Clear npm cache
console.log('Clearing npm cache...');
require('child_process').execSync('npm cache clean --force', {
  stdio: 'inherit',
});

console.log('✅ Cleanup complete! Dev mode should be faster now.');
console.log('💡 Run: npm run dev');



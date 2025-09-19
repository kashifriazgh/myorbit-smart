#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get command line arguments
const args = process.argv.slice(2);
const watchDirs =
  args.length > 0 ? args : ['app/components', 'app/lib', 'app/page.tsx'];

console.log(`🚀 Starting Next.js dev server with optimized watching...`);
console.log(`📁 Watching directories: ${watchDirs.join(', ')}`);

// Read .devignore file if it exists
let devIgnorePatterns = [];
try {
  const devIgnoreContent = fs.readFileSync('.devignore', 'utf8');
  devIgnorePatterns = devIgnoreContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  console.log(
    `🚫 Ignoring ${devIgnorePatterns.length} patterns from .devignore`
  );
} catch (err) {
  console.log('📝 No .devignore file found, using default patterns');
}

// Create a custom environment with selective watching
const env = {
  ...process.env,
  NEXT_WATCH_DIRS: watchDirs.join(','),
  NEXT_DEV_IGNORE: devIgnorePatterns.join(','),
  // Disable some features for faster development
  NEXT_DISABLE_SOURCE_MAPS: 'true',
  NEXT_DISABLE_ESLINT: 'true',
  // Optimize for development
  NODE_ENV: 'development',
  NEXT_TELEMETRY_DISABLED: '1',
};

// Start Next.js with custom options
const nextArgs = ['next', 'dev', '--port', '3000', '--turbo'];

const nextProcess = spawn('npx', nextArgs, {
  env,
  stdio: 'inherit',
  shell: true,
});

nextProcess.on('close', (code) => {
  console.log(`Next.js process exited with code ${code}`);
});

nextProcess.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  nextProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  nextProcess.kill('SIGTERM');
});

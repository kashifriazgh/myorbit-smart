const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. Transparent SVG Tick for Favicons
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="512" height="512">
  <g transform="translate(4,4)">
    <path d="M62 10 A38 38 0 1 0 82 25" fill="none" stroke="#2563eb" stroke-width="12" stroke-linecap="round"/>
    <path d="M28 48 L43 62 L70 33" fill="none" stroke="#2563eb" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

// 2. Premium PWA App Icon with Gradient Background for iOS & Android App Install
const pwaIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <g transform="translate(64,64) scale(4)">
    <g transform="translate(4,4)">
      <path d="M62 10 A38 38 0 1 0 82 25" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round"/>
      <path d="M28 48 L43 62 L70 33" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>
</svg>`;

async function main() {
  const rootDir = path.resolve(__dirname, '..');

  // Convert favicon SVG to PNG buffer
  const faviconBuffer = Buffer.from(faviconSvg);
  const pwaBuffer = Buffer.from(pwaIconSvg);

  // 1. Generate favicon.ico in public
  await sharp(faviconBuffer)
    .resize(32, 32)
    .toFile(path.join(rootDir, 'public', 'favicon.ico'));

  // 2. Generate PWA Icons (192x192 and 512x512)
  await sharp(pwaBuffer)
    .resize(192, 192)
    .toFile(path.join(rootDir, 'public', 'icons', 'icon-192x192.png'));

  await sharp(pwaBuffer)
    .resize(512, 512)
    .toFile(path.join(rootDir, 'public', 'icons', 'icon-512x512.png'));

  console.log('✅ Favicons & PWA Icons successfully generated!');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});

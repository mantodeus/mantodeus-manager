#!/usr/bin/env node
/**
 * Convert Kanit WOFF2 fonts to base64 for embedding in invoice template
 * Run: node scripts/embed-fonts.js
 */

const fs = require('fs');
const path = require('path');

const fonts = [
  { file: 'Kanit-Thin.woff2', weight: 100 },
  { file: 'Kanit-Light.woff2', weight: 300 },
  { file: 'Kanit-Regular.woff2', weight: 400 },
  { file: 'Kanit-Medium.woff2', weight: 500 },
];

const fontDir = path.join(__dirname, '../services/pdf-service/fonts/Kanit');

console.log('Converting Kanit WOFF2 fonts to base64...\n');

const fontFaces = fonts.map(({ file, weight }) => {
  const filePath = path.join(fontDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Font file not found: ${filePath}`);
    process.exit(1);
  }
  
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  
  console.log(`✅ ${file} (weight ${weight}): ${Math.round(base64.length / 1024)}KB encoded`);
  
  return `    @font-face {
      font-family: 'Kanit';
      src: url("data:font/woff2;base64,${base64}") format("woff2");
      font-weight: ${weight};
      font-style: normal;
      font-display: block;
    }`;
}).join('\n');

console.log('\n✅ All fonts converted. Copy the CSS below into server/templates/invoice.ts:\n');
console.log('```css');
console.log(fontFaces);
console.log('```');

// Optionally write to a file
const outputFile = path.join(__dirname, '../server/templates/kanit-fonts-base64.css');
fs.writeFileSync(outputFile, fontFaces);
console.log(`\n📝 Also saved to: ${outputFile}`);

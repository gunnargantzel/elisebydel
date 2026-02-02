#!/usr/bin/env node
/**
 * Build-script for Azure Static Web Apps.
 * Kopierer azure-static-web til build/ (output_location).
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'azure-static-web');
const dest = path.join(__dirname, '..', 'build');

if (!fs.existsSync(src)) {
  console.error('azure-static-web folder not found');
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

function copyRecursive(srcDir, destDir) {
  for (const name of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, name);
    const destPath = path.join(destDir, name);
    if (fs.statSync(srcPath).isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(src, dest);
console.log('Copied azure-static-web to build/');

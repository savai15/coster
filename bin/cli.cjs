#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const distPath = path.join(__dirname, '..', 'dist', 'index.cjs');

if (fs.existsSync(distPath)) {
  require(distPath);
} else {
  console.error('Build not found. Run "npm run build" first.');
  process.exit(1);
}

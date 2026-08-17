import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node18',
  outDir: 'dist',
  external: ['@modelcontextprotocol/sdk', 'chokidar', '@xenova/transformers'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});

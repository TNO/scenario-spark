import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/scenario-spark/',
  publicDir: 'public',

  build: {
    outDir: 'docs',
    sourcemap: true,
    minify: 'esbuild',
    cssMinify: 'esbuild',
  },

  define: {
    'process.env.SERVER': JSON.stringify(process.env.SERVER),
  },

  resolve: {
    extensions: ['.ts', '.js', '.wasm', '.csv', '.json'],
    alias: {
      'osm-polygon-features': resolve(__dirname, 'src/utils/osm-polygon-features.js'),
    },
  },

  server: {
    port: 8339,
  },

  assetsInclude: ['**/BUILD_ID', '*.wasm', '*.csv', '*.json'],
});

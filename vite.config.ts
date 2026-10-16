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
    rollupOptions: {
      output: {
        // Stable filenames for code and CSS, so the service worker can precache them.
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        // Content-hash other assets (images, fonts), so replaced files bypass stale caches.
        assetFileNames: (asset) =>
          asset.names?.some((name) => name.endsWith('.css')) ? 'assets/[name][extname]' : 'assets/[name]-[hash][extname]',
      },
    },
  },

  define: {
    'process.env.SERVER': JSON.stringify(process.env.SERVER),
  },

  resolve: {
    extensions: ['.ts', '.js', '.wasm', '.csv', '.json'],
    alias: {
      'osm-polygon-features': resolve(__dirname, 'src/utils/osm-polygon-features.js'),
      // Use the workspace library source directly, so changes are picked up without a rebuild
      'morphological-box': resolve(__dirname, 'packages/morphological-box/src/index.ts'),
    },
  },

  server: {
    port: 8339,
  },

  assetsInclude: ['**/BUILD_ID', '*.wasm', '*.csv', '*.json'],
});

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { cpSync, existsSync, mkdirSync } from 'fs';

function copyExtensionAssets() {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist');
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }

      // Copy manifest
      const manifestSrc = resolve(__dirname, 'extension/manifest.json');
      const manifestDest = resolve(outDir, 'manifest.json');
      if (existsSync(manifestSrc)) {
        cpSync(manifestSrc, manifestDest);
      }

      // Copy assets if they exist
      const assetsSrc = resolve(__dirname, 'extension/assets');
      const assetsDest = resolve(outDir, 'assets');
      if (existsSync(assetsSrc)) {
        cpSync(assetsSrc, assetsDest, { recursive: true });
      }
    }
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'extension/popup/popup.html'),
        options: resolve(__dirname, 'extension/options/options.html'),
        'service-worker': resolve(__dirname, 'extension/background/service-worker.ts'),
        'content-script': resolve(__dirname, 'extension/content/content-script.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'background/[name].js';
          }
          if (chunkInfo.name === 'content-script') {
            return 'content/[name].js';
          }
          return 'pages/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  plugins: [copyExtensionAssets()]
});

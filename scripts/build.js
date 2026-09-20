import { build } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'dist');

async function buildAll() {
  console.log('🚀 Starting Universal Reader build pipeline...\n');

  // Clean dist
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Build Popup
  console.log('📦 Step 1: Building Popup and Options...');
  await build({
    configFile: false,
    root: path.resolve(rootDir, 'extension'),
    base: '',
    build: {
      outDir: outDir,
      emptyOutDir: false,
      rollupOptions: {
        input: {
          popup: path.resolve(rootDir, 'extension/popup/popup.html'),
          options: path.resolve(rootDir, 'extension/options/options.html')
        },
        output: {
          entryFileNames: 'pages/[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    }
  });

  // Normalize popup.html and options.html location to dist root
  const nestedPopup = path.resolve(outDir, 'popup/popup.html');
  const destPopup = path.resolve(outDir, 'popup.html');
  if (fs.existsSync(nestedPopup)) {
    let content = fs.readFileSync(nestedPopup, 'utf-8');
    content = content.replace(/\.\.\//g, ''); // fix relative paths
    fs.writeFileSync(destPopup, content);
    fs.rmSync(path.resolve(outDir, 'popup'), { recursive: true, force: true });
  }

  const nestedOptions = path.resolve(outDir, 'options/options.html');
  const destOptions = path.resolve(outDir, 'options.html');
  if (fs.existsSync(nestedOptions)) {
    let content = fs.readFileSync(nestedOptions, 'utf-8');
    content = content.replace(/\.\.\//g, ''); // fix relative paths
    fs.writeFileSync(destOptions, content);
    fs.rmSync(path.resolve(outDir, 'options'), { recursive: true, force: true });
  }

  // 2. Build Content Script (IIFE - completely self-contained)
  console.log('📦 Step 2: Building Content Script (self-contained IIFE)...');
  await build({
    configFile: false,
    root: rootDir,
    build: {
      outDir: path.resolve(outDir, 'content'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'extension/content/content-script.ts'),
        name: 'UniversalReaderContent',
        formats: ['iife'],
        fileName: () => 'content-script.js'
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true
        }
      }
    }
  });

  // 3. Build Background Service Worker (ES Module)
  console.log('📦 Step 3: Building Background Service Worker...');
  await build({
    configFile: false,
    root: rootDir,
    build: {
      outDir: path.resolve(outDir, 'background'),
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'extension/background/service-worker.ts'),
        formats: ['es'],
        fileName: () => 'service-worker.js'
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true
        }
      }
    }
  });

  // 4. Copy manifest and assets
  console.log('📦 Step 4: Copying manifest and assets...');
  fs.copyFileSync(
    path.resolve(rootDir, 'extension/manifest.json'),
    path.resolve(outDir, 'manifest.json')
  );

  const assetsSrc = path.resolve(rootDir, 'extension/assets');
  const assetsDest = path.resolve(outDir, 'assets');
  if (fs.existsSync(assetsSrc)) {
    fs.cpSync(assetsSrc, assetsDest, { recursive: true });
  }

  console.log('\n✨ Build complete! Chrome extension ready in dist/');
}

buildAll().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});

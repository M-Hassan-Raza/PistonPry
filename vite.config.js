import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        results: resolve(__dirname, 'results_entry.html'),
        background: resolve(__dirname, 'src/background/index.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        format: 'es',
      },
    },
  },
  // Use relative paths so chrome-extension:// URLs resolve correctly
  base: '',
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'public/manifest.json', dest: '.' },
        { src: 'public/images/*', dest: 'images' },
      ],
    }),
    // Rename results_entry.html to results.html in output
    {
      name: 'rename-results-html',
      writeBundle(options, bundle) {
        const fs = require('fs');
        const path = require('path');
        const outDir = options.dir || 'dist';
        const src = path.resolve(outDir, 'results_entry.html');
        const dest = path.resolve(outDir, 'results.html');
        if (fs.existsSync(src)) {
          // Remove raw copy from publicDir if it exists
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          fs.renameSync(src, dest);
        }
      },
    },
    // Custom plugin to build content script as IIFE
    {
      name: 'build-content-iife',
      async writeBundle() {
        const { build } = await import('vite');
        await build({
          configFile: false,
          build: {
            outDir: 'dist',
            emptyOutDir: false,
            lib: {
              entry: resolve(__dirname, 'src/content/index.js'),
              formats: ['iife'],
              name: 'PistonPryContent',
              fileName: () => 'content.js',
            },
            rollupOptions: {
              output: {
                entryFileNames: 'content.js',
              },
            },
          },
        });
      },
    },
  ],
});

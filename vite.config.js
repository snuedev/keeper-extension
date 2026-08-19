import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const fromHere = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: fromHere('./chrome-extension/src'),
  publicDir: fromHere('./chrome-extension/public'),

  // Relative asset URLs. The default absolute paths resolve against the
  // chrome-extension:// origin and 404.
  base: './',

  build: {
    outDir: fromHere('./chrome-extension/dist'),

    // outDir sits outside root, so Vite prompts before wiping it.
    emptyOutDir: true,

    target: 'esnext',

    rollupOptions: {
      input: {
        popup: fromHere('./chrome-extension/src/popup.html'),
        background: fromHere('./chrome-extension/src/background.js'),
      },

      output: {
        // manifest.json names the service worker by path, so it cannot carry a
        // content hash the way the popup bundle does.
        entryFileNames: (chunk) =>
          chunk.name === 'background'
            ? 'background.js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
});

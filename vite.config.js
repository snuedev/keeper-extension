import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Resolve a path relative to this config file. `import.meta.url` is the ES
// module equivalent of the older `__dirname`, which does not exist in a file
// loaded as a module ("type": "module" in package.json).
const fromHere = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Vite treats `root` as the folder holding the source and the HTML entry, so
  // the built popup.html lands at the top of dist/ rather than nested inside a
  // src/ folder.
  root: fromHere('./chrome-extension/src'),

  // Copied into dist/ untouched. manifest.json and the icons live here because
  // they must ship at exact paths that Chrome looks for.
  publicDir: fromHere('./chrome-extension/public'),

  // Emit relative asset URLs ("./assets/popup.js"). The default is absolute
  // ("/assets/popup.js"), which is a rooted path that means something different
  // once the page is served from a chrome-extension:// origin.
  base: './',

  build: {
    outDir: fromHere('./chrome-extension/dist'),

    // outDir sits outside `root`, so Vite asks before wiping it. This is a
    // build artifact folder, so wiping it every time is what we want.
    emptyOutDir: true,

    // The popup only ever runs in the installed version of Chrome, so there is
    // no old browser to down-compile for.
    target: 'esnext',

    rollupOptions: {
      input: { popup: fromHere('./chrome-extension/src/popup.html') },
    },
  },
});

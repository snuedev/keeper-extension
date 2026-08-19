import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

// Resolve a path relative to this config file. `import.meta.url` is the ES
// module equivalent of the older `__dirname`, which does not exist in a file
// loaded as a module ("type": "module" in package.json).
const fromHere = (path) => fileURLToPath(new URL(path, import.meta.url));

// Where .env lives. This is deliberately not `root` (see envDir below).
const envDir = fromHere('.');

const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

// defineConfig also accepts a function, which is how you get at the mode and
// command before the config object is built.
export default defineConfig(({ command, mode }) => {
  // Reads .env files from envDir *and* picks up matching variables already set
  // in the environment, which is how CI supplies them.
  const env = loadEnv(mode, envDir, 'VITE_');
  const missing = REQUIRED_ENV.filter((name) => !env[name]);

  // lib/firebase.js checks this too, but that check only runs once the popup is
  // open in Chrome. Without this one a build with a missing or misspelled
  // variable finishes green -- on CI especially, where a typo in a repository
  // secret would otherwise ship a bundle that fails on open. Fail the build
  // instead, where somebody is watching.
  if (command === 'build' && missing.length > 0) {
    throw new Error(
      `Missing Firebase config: ${missing.join(', ')}.\n` +
        `Expected them in ${envDir}/.env (copy .env.example) or in the ` +
        'environment. On CI they come from repository secrets: Settings -> ' +
        'Secrets and variables -> Actions.',
    );
  }

  return {
    // Vite treats `root` as the folder holding the source and the HTML entry,
    // so the built popup.html lands at the top of dist/ rather than nested
    // inside a src/ folder.
    root: fromHere('./chrome-extension/src'),

    // Copied into dist/ untouched. manifest.json and the icons live here
    // because they must ship at exact paths that Chrome looks for.
    publicDir: fromHere('./chrome-extension/public'),

    // Where to look for .env files. This defaults to `root`, which above is
    // chrome-extension/src -- so without this line Vite would quietly look for
    // .env inside the source folder, find nothing, and build a bundle with an
    // undefined Firebase config. Point it at the repo root, where .env actually
    // lives, next to .env.example.
    envDir,

    // Emit relative asset URLs ("./assets/popup.js"). The default is absolute
    // ("/assets/popup.js"), which is a rooted path that means something
    // different once the page is served from a chrome-extension:// origin.
    base: './',

    build: {
      outDir: fromHere('./chrome-extension/dist'),

      // outDir sits outside `root`, so Vite asks before wiping it. This is a
      // build artifact folder, so wiping it every time is what we want.
      emptyOutDir: true,

      // The popup only ever runs in the installed version of Chrome, so there
      // is no old browser to down-compile for.
      target: 'esnext',

      rollupOptions: {
        input: { popup: fromHere('./chrome-extension/src/popup.html') },
      },
    },
  };
});

// One place where the Firebase app is created. Everything else imports `auth`
// and `db` from here, so the app is only ever initialized once.
//
// The config below comes from the .env file at the top of the repo (copy
// .env.example to get started). Vite reads that file itself -- there is no
// `dotenv` package to install -- and substitutes each `import.meta.env.VITE_*`
// reference with a plain string when it builds.
//
// Worth being clear about why the values moved out of this file: it is *not*
// because they are secret. A Firebase web API key only identifies which project
// a request belongs to, and whatever you do, it ends up in the built bundle
// that ships to every user's machine. They live in .env so you can point the
// extension at a different Firebase project -- a scratch one while developing,
// the real one for release -- without editing code.
//
// What actually keeps one person's notes away from another is firestore.rules
// plus Authentication.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// If .env is missing or a line is left blank, the values above come out
// `undefined` and initializeApp() still succeeds -- the extension then fails
// later with a confusing auth error instead. Checking here turns that into one
// clear message naming the variables you actually need to set.
const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);

if (missing.length > 0) {
  throw new Error(
    `Firebase config is missing: ${missing.join(', ')}.\n` +
      'Copy .env.example to .env at the top of the repo, fill in the values ' +
      'from your Firebase project, and rebuild.',
  );
}

const app = initializeApp(firebaseConfig);

// getAuth() defaults to storing the session in IndexedDB, scoped to this
// extension's own origin. That is what keeps you signed in after the popup
// closes and after the browser restarts, and it refreshes the expiring token on
// its own. Do not try to cache tokens in chrome.storage by hand -- the SDK
// already does this correctly, and ID tokens expire after an hour.
export const auth = getAuth(app);

// The notes database. lib/notes.js is the only file that touches it directly.
export const db = getFirestore(app);

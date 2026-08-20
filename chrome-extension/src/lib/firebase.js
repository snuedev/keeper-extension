import { initializeApp } from 'firebase/app';
import { indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// A Firebase web API key identifies the project rather than authenticating it,
// and is meant to ship in client code. Access is controlled by firestore.rules.
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

// Named rather than left to getAuth's own guess, because the service worker
// and the popup only see the same session if they agree on where it is kept,
// and a service worker has no localStorage for getAuth to fall back to.
export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
});
export const db = getFirestore(app);

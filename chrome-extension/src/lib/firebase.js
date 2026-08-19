// One place where the Firebase app is created. Everything else imports `auth`
// and `db` from here, so the app is only ever initialized once.
//
// About the API key below: it is not a secret and it is not a password. A
// Firebase web API key only identifies which project a request belongs to — it
// ships in the page source of every Firebase web app there is. What actually
// keeps one person's notes away from another is the Firestore security rules
// plus Authentication.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCEIGUChToGQwsiQ00FuA8oHeXNiryayyY',
  authDomain: 'keeperext.firebaseapp.com',
  projectId: 'keeperext',
  storageBucket: 'keeperext.firebasestorage.app',
  messagingSenderId: '222138233823',
  appId: '1:222138233823:web:27f1e6c19fa7c5c3120a6a',
};

const app = initializeApp(firebaseConfig);

// getAuth() defaults to storing the session in IndexedDB, scoped to this
// extension's own origin. That is what keeps you signed in after the popup
// closes and after the browser restarts, and it refreshes the expiring token on
// its own. Do not try to cache tokens in chrome.storage by hand — the SDK
// already does this correctly, and ID tokens expire after an hour.
export const auth = getAuth(app);

// Not used until Phase 2 (notes), but this is the file that owns it.
export const db = getFirestore(app);

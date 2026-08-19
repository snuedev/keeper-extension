import { initializeApp } from 'firebase/app';
import { indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// A Firebase web API key identifies the project rather than authenticating it,
// and is meant to ship in client code. Access is controlled by firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyCEIGUChToGQwsiQ00FuA8oHeXNiryayyY',
  authDomain: 'keeperext.firebaseapp.com',
  projectId: 'keeperext',
  storageBucket: 'keeperext.firebasestorage.app',
  messagingSenderId: '222138233823',
  appId: '1:222138233823:web:27f1e6c19fa7c5c3120a6a',
};

const app = initializeApp(firebaseConfig);

// Named rather than left to getAuth's own guess, because the service worker
// and the popup only see the same session if they agree on where it is kept,
// and a service worker has no localStorage for getAuth to fall back to.
export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
});
export const db = getFirestore(app);

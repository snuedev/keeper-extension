import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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

export const auth = getAuth(app);
export const db = getFirestore(app);

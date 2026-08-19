import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { auth } from './firebase.js';

export function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// Firebase's email-enumeration protection reports a wrong password and an
// unregistered email identically as 'auth/invalid-credential', so the two
// cannot be told apart here and deliberately share one message.
const MESSAGES = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-email': 'That does not look like an email address.',
  'auth/missing-password': 'Enter a password.',
  'auth/email-already-in-use': 'An account already exists for that email.',
  'auth/weak-password': 'Passwords need to be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'Could not reach Keeper. Check your connection.',
  'auth/operation-not-allowed':
    'Email sign-in is switched off for this project. Enable it in the Firebase console.',
};

export function describeAuthError(error) {
  return MESSAGES[error?.code] ?? 'Something went wrong. Please try again.';
}

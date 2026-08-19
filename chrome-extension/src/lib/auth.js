// Thin wrappers over the four Firebase Auth calls the popup needs, plus a
// translator that turns Firebase's error codes into something a person can read.
//
// The wrappers exist so that no view file imports from 'firebase/auth'
// directly. If the auth provider ever changes, this is the only file to touch.

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

// Fires once shortly after the popup opens — with a user object or with null —
// and then again on every sign-in and sign-out. That single callback is what
// decides which view you are looking at.
//
// Returns an unsubscribe function. The popup never calls it (the whole page is
// thrown away when the popup closes), but returning it keeps this wrapper
// honest about what the SDK gives back.
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// Firebase ships email-enumeration protection on by default, which means a
// wrong password and an email that was never registered both come back as
// 'auth/invalid-credential'. That is deliberate — it stops people probing your
// project to find out which email addresses have accounts. So there is one
// message covering both, and no attempt to guess which happened.
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

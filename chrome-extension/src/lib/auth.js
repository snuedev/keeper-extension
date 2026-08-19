import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { auth } from './firebase.js';
import { SIGN_IN_WITH_GOOGLE } from './messages.js';

function keeperError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Run in the service worker rather than here: the consent window takes focus,
// and a popup that loses focus is torn down along with any promise it is
// waiting on. onAuthChange then reports the result through the auth database
// both contexts share.
export async function signInWithGoogle() {
  if (!globalThis.chrome?.runtime?.sendMessage) {
    throw keeperError('keeper/google-unavailable');
  }

  const reply = await chrome.runtime.sendMessage({
    type: SIGN_IN_WITH_GOOGLE,
  });

  if (!reply?.ok) {
    throw keeperError(reply?.code ?? 'keeper/google-no-token');
  }

  return reply;
}

export function isCancelledSignIn(error) {
  return error?.code === 'keeper/google-cancelled';
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
  'auth/account-exists-with-different-credential':
    'That email is already registered with a password. Sign in with it instead.',
  'keeper/google-unavailable':
    'Google sign-in needs Keeper to be running as an installed extension.',
  'keeper/google-no-token': 'Google did not return a sign-in. Try again.',
};

export function describeAuthError(error) {
  return MESSAGES[error?.code] ?? 'Something went wrong. Please try again.';
}

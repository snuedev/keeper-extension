import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { auth } from './firebase.js';
import {
  DELETE_ACCOUNT_WITH_GOOGLE,
  SIGN_IN_WITH_GOOGLE,
  SIGN_IN_WITH_GOOGLE_ADDING_PASSWORD,
} from './messages.js';
import { clearPendingGoogleLink } from './pending-link.js';

function keeperError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

// Firebase trusts Google to vouch for Gmail addresses. If a Gmail user later
// signs in with Google, Firebase merges the accounts on its own, but it deletes
// the password when the address was never verified. Verifying keeps both.
export async function signUp(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  sendEmailVerification(user).catch(() => {});
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

// Google flows run in the service worker rather than here: the consent window
// takes focus, and a popup that loses focus is torn down along with any promise
// it is waiting on. onAuthChange then reports the result through the auth
// database both contexts share.
async function runInWorker(type, payload = {}) {
  if (!globalThis.chrome?.runtime?.sendMessage) {
    throw keeperError('keeper/google-unavailable');
  }

  const reply = await chrome.runtime.sendMessage({ ...payload, type });

  // Chrome resolves with nothing when no listener answers, which happens when
  // the worker still running is a build from before this message existed.
  if (reply === undefined) {
    throw keeperError('keeper/worker-outdated');
  }

  if (!reply.ok) {
    throw keeperError(reply?.code ?? 'keeper/google-no-token');
  }

  return reply;
}

export function signInWithGoogle() {
  return runInWorker(SIGN_IN_WITH_GOOGLE);
}

export function signInWithGoogleAddingPassword(email, password) {
  return runInWorker(SIGN_IN_WITH_GOOGLE_ADDING_PASSWORD, { email, password });
}

// Signing in fires the auth listener, which swaps this view for the notes list
// before the link below finishes, so a failed link can only be logged.
export async function signInAddingGoogle(pending, password) {
  const { user } = await signInWithEmailAndPassword(auth, pending.email, password);
  await clearPendingGoogleLink();

  const credential = GoogleAuthProvider.credential(
    pending.idToken,
    pending.accessToken,
  );
  linkWithCredential(user, credential).catch((error) => console.error(error));
}

export function isAccountTakenBySignUp(error) {
  return error?.code === 'auth/email-already-in-use';
}

export function needsGoogleLink(error) {
  return error?.code === 'auth/account-exists-with-different-credential';
}

export function deleteAccountWithGoogle() {
  return runInWorker(DELETE_ACCOUNT_WITH_GOOGLE);
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
  'auth/missing-email': 'Enter your email address.',
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
  'auth/user-mismatch':
    'That Google account is not the one signed in to Keeper. Pick the same account.',
  'auth/credential-already-in-use':
    'That Google account already belongs to a different Keeper account.',
  'keeper/google-email-mismatch':
    'Pick the Google account that uses the email you entered.',
  'auth/requires-recent-login': 'Keeper needs to confirm it is you. Try again.',
  'keeper/worker-outdated':
    'Keeper was just updated. Reload it from chrome://extensions and try again.',
  'keeper/not-signed-in': 'You are no longer signed in. Sign in and try again.',
};

export function describeAuthError(error) {
  return MESSAGES[error?.code] ?? 'Something went wrong. Please try again.';
}

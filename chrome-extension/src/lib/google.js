import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  signInWithCredential,
} from 'firebase/auth';

import { eraseAccount } from './account.js';
import { auth } from './firebase.js';
import { savePendingGoogleLink } from './pending-link.js';

const CLIENT_ID =
  '222138233823-0bsdkkdldobgr8ecsu2td3acdhunrcso.apps.googleusercontent.com';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

function keeperError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function launchWebAuthFlow(url) {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (result) => {
      // Closing the consent window is reported the same way a real failure is,
      // and it is by far the likelier of the two.
      if (chrome.runtime.lastError || !result) {
        reject(keeperError('keeper/google-cancelled'));
        return;
      }

      resolve(result);
    });
  });
}

async function requestGoogleCredential(loginHint) {
  if (!globalThis.chrome?.identity?.launchWebAuthFlow) {
    throw keeperError('keeper/google-unavailable');
  }

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'id_token token');
  url.searchParams.set('redirect_uri', chrome.identity.getRedirectURL());
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('nonce', randomNonce());
  url.searchParams.set('prompt', 'select_account');
  if (loginHint) {
    url.searchParams.set('login_hint', loginHint);
  }

  const redirected = await launchWebAuthFlow(url.toString());

  // The implicit flow returns its result in the fragment, which browsers never
  // send to a server, rather than in the query string.
  const returned = new URLSearchParams(new URL(redirected).hash.slice(1));
  const idToken = returned.get('id_token');

  if (!idToken) {
    throw keeperError(
      returned.get('error') === 'access_denied'
        ? 'keeper/google-cancelled'
        : 'keeper/google-no-token',
    );
  }

  return GoogleAuthProvider.credential(idToken, returned.get('access_token'));
}

function emailFromIdToken(idToken) {
  const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(payload)).email ?? '';
}

function sameEmail(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

// When the email already belongs to a password account, Firebase refuses to
// open a second account for it. The Google credential is kept so the popup
// can ask for that password and attach Google to the existing account.
async function signInWithGoogleCredential(credential) {
  try {
    return await signInWithCredential(auth, credential);
  } catch (error) {
    if (error?.code === 'auth/account-exists-with-different-credential') {
      await savePendingGoogleLink({
        email: emailFromIdToken(credential.idToken),
        idToken: credential.idToken,
        accessToken: credential.accessToken,
      });
    }
    throw error;
  }
}

export async function runGoogleSignIn() {
  return signInWithGoogleCredential(await requestGoogleCredential());
}

export async function runGoogleSignInAddingPassword({ email, password }) {
  const credential = await requestGoogleCredential(email);

  if (!sameEmail(emailFromIdToken(credential.idToken), email)) {
    throw keeperError('keeper/google-email-mismatch');
  }

  const { user } = await signInWithGoogleCredential(credential);

  try {
    await linkWithCredential(user, EmailAuthProvider.credential(email, password));
  } catch (error) {
    // The account already had a password; signing in with Google was enough.
    if (error?.code !== 'auth/provider-already-linked') {
      throw error;
    }
  }
}

export async function runGoogleAccountDeletion() {
  // A freshly woken service worker has not yet read the stored session, and
  // currentUser reads as null until it has.
  await auth.authStateReady();
  const user = auth.currentUser;

  if (!user) {
    throw keeperError('keeper/not-signed-in');
  }

  const credential = await requestGoogleCredential(user.email);
  await reauthenticateWithCredential(user, credential);
  await eraseAccount(user);
}

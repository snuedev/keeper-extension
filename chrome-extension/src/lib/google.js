import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

import { auth } from './firebase.js';

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

export async function runGoogleSignIn() {
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

  const credential = GoogleAuthProvider.credential(
    idToken,
    returned.get('access_token'),
  );

  return signInWithCredential(auth, credential);
}

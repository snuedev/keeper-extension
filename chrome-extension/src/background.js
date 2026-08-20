import { SIGN_IN_WITH_GOOGLE } from './lib/messages.js';
import { runGoogleSignIn } from './lib/google.js';

// The consent window steals focus, and a popup that loses focus is destroyed
// mid-flow. This worker outlives that, and the signed-in session it stores
// reaches the popup through the auth database both contexts share.
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== SIGN_IN_WITH_GOOGLE) return false;

  runGoogleSignIn().then(
    () => respond({ ok: true }),
    (error) => respond({ ok: false, code: error?.code }),
  );

  return true;
});

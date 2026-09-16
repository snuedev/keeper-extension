import {
  DELETE_ACCOUNT_WITH_GOOGLE,
  SIGN_IN_WITH_GOOGLE,
} from './lib/messages.js';
import { runGoogleAccountDeletion, runGoogleSignIn } from './lib/google.js';

const HANDLERS = {
  [SIGN_IN_WITH_GOOGLE]: runGoogleSignIn,
  [DELETE_ACCOUNT_WITH_GOOGLE]: runGoogleAccountDeletion,
};

// The consent window steals focus, and a popup that loses focus is destroyed
// mid-flow. This worker outlives that, and the signed-in session it stores
// reaches the popup through the auth database both contexts share.
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  const handler = HANDLERS[message?.type];
  if (!handler) return false;

  handler().then(
    () => respond({ ok: true }),
    (error) => {
      console.error(error);
      respond({ ok: false, code: error?.code ?? 'keeper/worker-failed' });
    },
  );

  return true;
});

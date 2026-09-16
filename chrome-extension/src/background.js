import {
  DELETE_ACCOUNT_WITH_GOOGLE,
  SIGN_IN_WITH_GOOGLE,
  SIGN_IN_WITH_GOOGLE_ADDING_PASSWORD,
} from './lib/messages.js';
import {
  runGoogleAccountDeletion,
  runGoogleSignIn,
  runGoogleSignInAddingPassword,
} from './lib/google.js';

const HANDLERS = {
  [SIGN_IN_WITH_GOOGLE]: runGoogleSignIn,
  [SIGN_IN_WITH_GOOGLE_ADDING_PASSWORD]: runGoogleSignInAddingPassword,
  [DELETE_ACCOUNT_WITH_GOOGLE]: runGoogleAccountDeletion,
};

// The consent window steals focus, and a popup that loses focus is destroyed
// mid-flow. This worker outlives that, and the signed-in session it stores
// reaches the popup through the auth database both contexts share.
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  const handler = HANDLERS[message?.type];
  if (!handler) return false;

  handler(message).then(
    () => respond({ ok: true }),
    (error) => {
      console.error(error);
      respond({ ok: false, code: error?.code ?? 'keeper/worker-failed' });
    },
  );

  return true;
});

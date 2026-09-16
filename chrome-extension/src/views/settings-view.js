import { deleteAccountWithPassword, signsInWithPassword } from '../lib/account.js';
import {
  deleteAccountWithGoogle,
  describeAuthError,
  isCancelledSignIn,
} from '../lib/auth.js';
import { describeNotesError } from '../lib/notes.js';
import { themeToggleMarkup, wireThemeToggle } from '../lib/theme.js';

const WRONG_PASSWORD_CODES = ['auth/invalid-credential', 'auth/wrong-password'];

function describeDeleteError(error) {
  const code = error?.code ?? '';

  if (WRONG_PASSWORD_CODES.includes(code)) {
    return 'That password is incorrect.';
  }

  // Firestore's codes carry no prefix, while Firebase Auth's and Keeper's do.
  return code.includes('/') ? describeAuthError(error) : describeNotesError(error);
}

const PASSWORD_CONFIRM = `
  <p class="confirm__text">
    Enter your password to confirm. Your account and every note in it will be
    deleted. This action cannot be undone.
  </p>
  <label class="field">
    <span class="field__label">Password</span>
    <input
      class="field__input"
      type="password"
      name="password"
      autocomplete="current-password"
    />
  </label>
`;

const GOOGLE_CONFIRM = `
  <p class="confirm__text">
    Google will ask you to pick your account once more to confirm it is you.
    Keeper closes while that window is open, and your account and every note in
    it are deleted as soon as you confirm. This action cannot be undone.
  </p>
`;

export function renderSettingsView(container, user, { onBack }) {
  const usesPassword = signsInWithPassword(user);

  container.innerHTML = `
    <header class="header header--row">
      <button class="button button--quiet" type="button" data-action="back">
        ← All notes
      </button>
      <div class="header__actions">${themeToggleMarkup}</div>
    </header>
    <main class="panel panel--settings">
      <section class="settings__section">
        <h2 class="settings__heading">Profile</h2>
        <dl class="settings__details">
          <dt>Email</dt>
          <dd data-field="email"></dd>
          <dt>Signs in with</dt>
          <dd>${usesPassword ? 'Email and password' : 'Google'}</dd>
        </dl>
      </section>

      <section class="settings__section">
        <h2 class="settings__heading settings__heading--danger">
          Delete account
        </h2>
        <p class="panel__hint">
          Permanently removes your Keeper account and all of your notes. This
          action cannot be undone.
        </p>

        <button
          class="button button--danger-outline"
          type="button"
          data-action="start-delete"
        >
          Delete my account
        </button>

        <form class="confirm confirm--stacked" novalidate hidden>
          ${usesPassword ? PASSWORD_CONFIRM : GOOGLE_CONFIRM}

          <p class="form__error" role="alert" hidden></p>

          <div class="form__actions">
            <button class="button" type="button" data-action="cancel-delete">
              Keep my account
            </button>
            <button class="button button--danger-filled" type="submit">
              Delete forever
            </button>
          </div>
        </form>
      </section>
    </main>
  `;

  wireThemeToggle(container);

  container.querySelector('[data-field="email"]').textContent =
    user.email ?? 'No email on file';

  const backButton = container.querySelector('[data-action="back"]');
  const startButton = container.querySelector('[data-action="start-delete"]');
  const form = container.querySelector('.confirm');
  const passwordInput = form.querySelector('input[name="password"]');
  const errorText = form.querySelector('.form__error');
  const formButtons = form.querySelectorAll('button');

  function showError(message) {
    errorText.textContent = message;
    errorText.hidden = false;
  }

  function clearError() {
    errorText.textContent = '';
    errorText.hidden = true;
  }

  function setBusy(isBusy) {
    formButtons.forEach((button) => {
      button.disabled = isBusy;
    });
    backButton.disabled = isBusy;
    if (passwordInput) {
      passwordInput.disabled = isBusy;
    }
  }

  function openConfirm() {
    startButton.hidden = true;
    form.hidden = false;
    (passwordInput ?? form.querySelector('button[type="submit"]')).focus();
  }

  function closeConfirm() {
    clearError();
    form.reset();
    form.hidden = true;
    startButton.hidden = false;
    startButton.focus();
  }

  function deleteAccount() {
    return usesPassword
      ? deleteAccountWithPassword(user, passwordInput.value)
      : deleteAccountWithGoogle();
  }

  backButton.addEventListener('click', onBack);
  startButton.addEventListener('click', openConfirm);

  form
    .querySelector('[data-action="cancel-delete"]')
    .addEventListener('click', closeConfirm);

  form.addEventListener('input', clearError);

  // On success there is nothing to do here: deleting the account signs it out,
  // and popup.js swaps in the sign-in screen when it hears that.
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    if (usesPassword && !passwordInput.value) {
      showError('Enter your password.');
      passwordInput.focus();
      return;
    }

    setBusy(true);

    try {
      await deleteAccount();
    } catch (error) {
      if (!isCancelledSignIn(error)) {
        showError(describeDeleteError(error));
      }
      setBusy(false);
      passwordInput?.focus();
    }
  });
}

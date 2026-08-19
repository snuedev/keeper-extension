import {
  describeAuthError,
  isCancelledSignIn,
  signIn,
  signInWithGoogle,
  signUp,
} from '../lib/auth.js';
import { themeToggleMarkup, wireThemeToggle } from '../lib/theme.js';

// Google's brand guidelines require their own mark on the button, and an
// inline SVG is the only way to ship one under the extension's CSP.
const GOOGLE_MARK = `
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z"/>
    <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"/>
    <path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z"/>
    <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z"/>
  </svg>
`;

export function renderAuthView(container) {
  container.innerHTML = `
    <header class="header header--row">
      <h1 class="header__title">Keeper</h1>
      <div class="header__actions">${themeToggleMarkup}</div>
    </header>
    <main class="panel">
      <p class="panel__hint">Sign in, or create an account to get started.</p>

      <button
        class="button button--google"
        type="button"
        data-action="google"
      >
        ${GOOGLE_MARK}
        Continue with Google
      </button>

      <p class="divider">or</p>

      <form class="form" novalidate>
        <label class="field">
          <span class="field__label">Email</span>
          <input
            class="field__input"
            type="email"
            name="email"
            autocomplete="username"
          />
        </label>

        <label class="field">
          <span class="field__label">Password</span>
          <input
            class="field__input"
            type="password"
            name="password"
            autocomplete="current-password"
          />
        </label>

        <p class="form__error" role="alert" hidden></p>

        <div class="form__actions">
          <button class="button button--primary" type="submit">Sign in</button>
          <button class="button" type="button" data-action="sign-up">
            Create account
          </button>
        </div>
      </form>

    </main>
  `;

  wireThemeToggle(container);

  const form = container.querySelector('.form');
  const googleButton = container.querySelector('[data-action="google"]');
  const emailInput = form.querySelector('input[name="email"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const errorText = form.querySelector('.form__error');
  const buttons = form.querySelectorAll('button');

  function showError(message) {
    errorText.textContent = message;
    errorText.hidden = false;
  }

  function clearError() {
    errorText.textContent = '';
    errorText.hidden = true;
  }

  function setBusy(isBusy) {
    buttons.forEach((button) => {
      button.disabled = isBusy;
    });
    googleButton.disabled = isBusy;
  }

  async function submit(attempt) {
    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Enter your email and password.');
      return;
    }

    setBusy(true);
    try {
      await attempt(email, password);
    } catch (error) {
      showError(describeAuthError(error));
      setBusy(false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(signIn);
  });

  form
    .querySelector('[data-action="sign-up"]')
    .addEventListener('click', () => submit(signUp));

  form.addEventListener('input', clearError);

  googleButton.addEventListener('click', async () => {
    clearError();
    setBusy(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      // Chrome closes this popup as soon as the consent window opens, so on the
      // usual path nothing below ever runs. It matters when Keeper is open in a
      // tab, which survives the flow.
      if (!isCancelledSignIn(error)) {
        showError(describeAuthError(error));
      }
      setBusy(false);
    }
  });

  emailInput.focus();
}

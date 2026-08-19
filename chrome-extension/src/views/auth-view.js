// The sign-in / create-account panel. Shown whenever nobody is signed in.
//
// Every view in this project follows the same shape: a single exported function
// that takes the element to draw into, fills it, and wires up its own event
// listeners. Switching views means calling a different one of these — the old
// markup and the listeners attached to it go away together.

import { describeAuthError, signIn, signUp } from '../lib/auth.js';

export function renderAuthView(container) {
  container.innerHTML = `
    <header class="header">
      <h1 class="header__title">Keeper</h1>
    </header>
    <main class="panel">
      <p class="panel__hint">Sign in, or create an account to get started.</p>

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

  const form = container.querySelector('.form');
  const emailInput = form.querySelector('input[name="email"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const errorText = form.querySelector('.form__error');
  const buttons = form.querySelectorAll('button');

  function showError(message) {
    // textContent, never innerHTML: anything that came from outside this file
    // is treated as text, so a stray "<" can never turn into markup.
    errorText.textContent = message;
    errorText.hidden = false;
  }

  function clearError() {
    errorText.textContent = '';
    errorText.hidden = true;
  }

  function setBusy(isBusy) {
    // These are network calls. Without this you can fire off three sign-ins by
    // impatiently clicking three times.
    buttons.forEach((button) => {
      button.disabled = isBusy;
    });
  }

  // `attempt` is either signIn or signUp. Both take (email, password) and both
  // return a promise, so one handler covers both buttons.
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
      // Nothing to do on success. The auth listener in popup.js notices the new
      // user and swaps this view out for the list.
    } catch (error) {
      showError(describeAuthError(error));
      setBusy(false);
    }
  }

  form.addEventListener('submit', (event) => {
    // Without this the browser tries to submit the form somewhere and navigates
    // the popup to a dead URL. There is no server here — every form in an
    // extension needs this line.
    event.preventDefault();
    submit(signIn);
  });

  form
    .querySelector('[data-action="sign-up"]')
    .addEventListener('click', () => submit(signUp));

  // Typing is the user's way of saying "I know, I'm fixing it".
  form.addEventListener('input', clearError);

  emailInput.focus();
}

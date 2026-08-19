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

  emailInput.focus();
}

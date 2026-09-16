import {
  describeAuthError,
  isAccountTakenBySignUp,
  isCancelledSignIn,
  needsGoogleLink,
  sendPasswordReset,
  signIn,
  signInAddingGoogle,
  signInWithGoogle,
  signInWithGoogleAddingPassword,
  signUp,
} from '../lib/auth.js';
import {
  clearPendingGoogleLink,
  readPendingGoogleLink,
} from '../lib/pending-link.js';
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

        <button class="link-button" type="button" data-action="forgot-password">
          Forgot password?
        </button>

        <p class="form__error" role="alert" hidden></p>

        <button
          class="button button--google"
          type="button"
          data-action="google-add-password"
          hidden
        >
          ${GOOGLE_MARK}
          Continue with Google and add this password
        </button>

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
  const addPasswordButton = form.querySelector(
    '[data-action="google-add-password"]',
  );
  const buttons = form.querySelectorAll('button');

  function showError(message) {
    errorText.textContent = message;
    errorText.hidden = false;
  }

  function clearError() {
    errorText.textContent = '';
    errorText.hidden = true;
    addPasswordButton.hidden = true;
  }

  async function openLinkViewIfPending() {
    const pending = await readPendingGoogleLink();
    if (pending) {
      renderLinkView(container, pending);
    }
    return Boolean(pending);
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
      setBusy(false);

      if (attempt === signUp && isAccountTakenBySignUp(error)) {
        showError(
          'An account already exists for that email. If you made it with Google, continue with Google to add this password to it.',
        );
        addPasswordButton.hidden = false;
        return;
      }

      showError(describeAuthError(error));
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

  addPasswordButton.addEventListener('click', () =>
    runGoogleFlow(() =>
      signInWithGoogleAddingPassword(
        emailInput.value.trim(),
        passwordInput.value,
      ),
    ),
  );

  form
    .querySelector('[data-action="forgot-password"]')
    .addEventListener('click', () =>
      renderResetView(container, emailInput.value.trim()),
    );

  async function runGoogleFlow(flow) {
    clearError();
    setBusy(true);

    try {
      await flow();
    } catch (error) {
      // Chrome closes this popup as soon as the consent window opens, so on the
      // usual path nothing below ever runs. It matters when Keeper is open in a
      // tab, which survives the flow.
      if (needsGoogleLink(error) && (await openLinkViewIfPending())) {
        return;
      }
      if (!isCancelledSignIn(error)) {
        showError(describeAuthError(error));
      }
      setBusy(false);
    }
  }

  googleButton.addEventListener('click', () => runGoogleFlow(signInWithGoogle));

  emailInput.focus();

  // The popup that started a Google sign-in is usually closed by the time the
  // worker learns the email needs linking, so the next popup picks it up here.
  openLinkViewIfPending().catch(() => {});
}

function renderLinkView(container, pending) {
  container.innerHTML = `
    <header class="header header--row">
      <h1 class="header__title">Keeper</h1>
      <div class="header__actions">${themeToggleMarkup}</div>
    </header>
    <main class="panel">
      <p class="panel__message">You already have a Keeper account</p>
      <p class="panel__hint"></p>

      <form class="form" novalidate>
        <input type="email" name="email" autocomplete="username" hidden />

        <label class="field">
          <span class="field__label">Password</span>
          <input
            class="field__input"
            type="password"
            name="password"
            autocomplete="current-password"
          />
        </label>

        <button class="link-button" type="button" data-action="forgot-password">
          Forgot password?
        </button>

        <p class="form__error" role="alert" hidden></p>

        <div class="form__actions">
          <button class="button button--primary" type="submit">
            Sign in and add Google
          </button>
          <button class="button" type="button" data-action="cancel">
            Cancel
          </button>
        </div>
      </form>
    </main>
  `;

  wireThemeToggle(container);

  container.querySelector('.panel__hint').textContent =
    `${pending.email} already signs in with a password. Enter it once to add Google to the same account, and after that either way works.`;

  const form = container.querySelector('.form');
  const passwordInput = form.querySelector('input[name="password"]');
  const errorText = form.querySelector('.form__error');
  const buttons = form.querySelectorAll('button');

  form.querySelector('input[name="email"]').value = pending.email;

  function setBusy(isBusy) {
    buttons.forEach((button) => {
      button.disabled = isBusy;
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorText.hidden = true;

    if (!passwordInput.value) {
      errorText.textContent = 'Enter your password.';
      errorText.hidden = false;
      return;
    }

    setBusy(true);
    try {
      await signInAddingGoogle(pending, passwordInput.value);
    } catch (error) {
      errorText.textContent = describeAuthError(error);
      errorText.hidden = false;
      setBusy(false);
    }
  });

  form.addEventListener('input', () => {
    errorText.hidden = true;
  });

  form
    .querySelector('[data-action="forgot-password"]')
    .addEventListener('click', () => renderResetView(container, pending.email));

  form
    .querySelector('[data-action="cancel"]')
    .addEventListener('click', async () => {
      await clearPendingGoogleLink();
      renderAuthView(container);
    });

  passwordInput.focus();
}

function renderResetView(container, email) {
  container.innerHTML = `
    <header class="header header--row">
      <h1 class="header__title">Keeper</h1>
      <div class="header__actions">${themeToggleMarkup}</div>
    </header>
    <main class="panel">
      <p class="panel__message">Reset your password</p>
      <p class="panel__hint">
        Enter the email you signed up with and we will send you a link to choose
        a new password.
      </p>

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

        <p class="form__error" role="alert" hidden></p>
        <p class="form__notice" role="status" hidden></p>

        <div class="form__actions">
          <button class="button button--primary" type="submit">
            Send reset link
          </button>
          <button class="button" type="button" data-action="back">
            Back to sign in
          </button>
        </div>
      </form>
    </main>
  `;

  wireThemeToggle(container);

  const form = container.querySelector('.form');
  const emailInput = form.querySelector('input[name="email"]');
  const errorText = form.querySelector('.form__error');
  const noticeText = form.querySelector('.form__notice');
  const submitButton = form.querySelector('button[type="submit"]');

  emailInput.value = email;

  function showOnly(element, message) {
    errorText.hidden = true;
    noticeText.hidden = true;
    element.textContent = message;
    element.hidden = false;
  }

  function clearMessages() {
    errorText.hidden = true;
    noticeText.hidden = true;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessages();

    const address = emailInput.value.trim();
    if (!address) {
      showOnly(errorText, 'Enter your email address.');
      return;
    }

    submitButton.disabled = true;
    try {
      await sendPasswordReset(address);
      // Firebase's email-enumeration protection resolves this for addresses
      // with no account too, so the wording cannot promise an email arrives.
      showOnly(
        noticeText,
        `If ${address} has a Keeper password, a reset link is on its way. Check your inbox and spam folder.`,
      );
    } catch (error) {
      showOnly(errorText, describeAuthError(error));
    } finally {
      submitButton.disabled = false;
    }
  });

  form.addEventListener('input', clearMessages);

  form
    .querySelector('[data-action="back"]')
    .addEventListener('click', () => renderAuthView(container));

  emailInput.focus();
}

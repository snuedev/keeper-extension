// What you see once you are signed in.
//
// Phase 1 stops here: it proves the account works and gives you a way back out
// via Sign out. Phase 2 fills the empty area with real notes from Firestore and
// adds the "New note" button.

import { describeAuthError, signOutUser } from '../lib/auth.js';

export function renderListView(container, user) {
  container.innerHTML = `
    <header class="header header--row">
      <h1 class="header__title">Keeper</h1>
      <button class="button button--quiet" type="button" data-action="sign-out">
        Sign out
      </button>
    </header>
    <main class="panel">
      <p class="panel__message">No notes yet.</p>
      <p class="panel__hint">Writing notes arrives in Phase 2.</p>
      <p class="panel__error" role="alert" hidden></p>
    </main>
    <footer class="footer">
      <span class="footer__account"></span>
    </footer>
  `;

  // The email is text the user typed, so it goes in with textContent rather
  // than being pasted into the template string above.
  container.querySelector('.footer__account').textContent =
    user.email ?? 'Signed in';

  const errorText = container.querySelector('.panel__error');
  const signOutButton = container.querySelector('[data-action="sign-out"]');

  signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true;
    try {
      await signOutUser();
      // No view switch here either. signOut makes the auth listener in popup.js
      // fire with null, and that is what puts the sign-in panel back.
    } catch (error) {
      errorText.textContent = describeAuthError(error);
      errorText.hidden = false;
      signOutButton.disabled = false;
    }
  });
}

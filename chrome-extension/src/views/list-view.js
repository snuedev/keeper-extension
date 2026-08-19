// What you see once you are signed in: your notes, newest first, plus the two
// ways out of here — write a new one, or sign out.
//
// This view does not switch to the editor itself. It calls the `onOpenNote`
// callback it was handed and lets popup.js do the switching, for the same
// reason it does not switch to the sign-in panel: one file decides what is on
// screen, and it is popup.js.
//
// Unlike the Phase 1 views, this one returns a teardown function. It holds a
// live Firestore subscription, and that has to be stopped when you leave.

import { describeAuthError, signOutUser } from '../lib/auth.js';
import { createNote, describeNotesError, watchNotes } from '../lib/notes.js';

export function renderListView(container, user, { onOpenNote }) {
  container.innerHTML = `
    <header class="header header--row">
      <h1 class="header__title">Keeper</h1>
      <button class="button button--quiet" type="button" data-action="sign-out">
        Sign out
      </button>
    </header>
    <main class="panel panel--list">
      <button class="button button--primary" type="button" data-action="new-note">
        New note
      </button>

      <p class="panel__error" role="alert" hidden></p>

      <!--
        aria-live tells a screen reader to announce this list when it changes on
        its own, which it does: notes arrive from Firestore rather than from a
        click, including notes written on another machine.
      -->
      <ul class="notes" aria-live="polite"></ul>

      <p class="panel__hint notes__empty" hidden>
        Nothing here yet. Write your first note.
      </p>
    </main>
    <footer class="footer">
      <span class="footer__account"></span>
    </footer>
  `;

  // The email is text the user typed, so it goes in with textContent rather
  // than being pasted into the template string above.
  container.querySelector('.footer__account').textContent =
    user.email ?? 'Signed in';

  const list = container.querySelector('.notes');
  const emptyMessage = container.querySelector('.notes__empty');
  const errorText = container.querySelector('.panel__error');
  const newNoteButton = container.querySelector('[data-action="new-note"]');
  const signOutButton = container.querySelector('[data-action="sign-out"]');

  function showError(message) {
    errorText.textContent = message;
    errorText.hidden = false;
  }

  function clearError() {
    errorText.textContent = '';
    errorText.hidden = true;
  }

  // The first line of the body, for the second line of the card. Notes can be
  // long and the card is one line tall, so anything past the first line would
  // only be clipped by CSS anyway.
  function previewOf(note) {
    const firstLine = (note.body ?? '').split('\n').find((line) => line.trim());
    return firstLine?.trim() ?? 'Empty note';
  }

  // Built out of createElement rather than an innerHTML template, because
  // everything on the card is text the user typed. textContent puts it on the
  // page as text — a note whose title is "<img onerror=...>" is a note about
  // HTML, not a script.
  function buildCard(note) {
    const item = document.createElement('li');

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'note';
    // A real <button> gets keyboard focus, Enter and Space, and is announced as
    // a button — all of which a clickable <div> would have to reimplement.
    card.addEventListener('click', () => onOpenNote(note));

    const title = document.createElement('span');
    title.className = 'note__title';
    title.textContent = note.title?.trim() || 'Untitled note';

    const preview = document.createElement('span');
    preview.className = 'note__preview';
    preview.textContent = previewOf(note);

    card.append(title, preview);
    item.append(card);
    return item;
  }

  function draw(notes) {
    clearError();
    list.replaceChildren(...notes.map(buildCard));
    emptyMessage.hidden = notes.length > 0;
  }

  newNoteButton.addEventListener('click', async () => {
    clearError();
    newNoteButton.disabled = true;
    try {
      const noteId = await createNote(user.uid);
      // Straight into the editor with the blank note. Nothing to load: it was
      // just created empty, and we already know its id.
      onOpenNote({ id: noteId, title: '', body: '' });
    } catch (error) {
      showError(describeNotesError(error));
      newNoteButton.disabled = false;
    }
  });

  signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true;
    try {
      await signOutUser();
      // No view switch here. signOut makes the auth listener in popup.js fire
      // with null, and that is what puts the sign-in panel back.
    } catch (error) {
      showError(describeAuthError(error));
      signOutButton.disabled = false;
    }
  });

  // Start listening last, so every element the callback touches already exists.
  const stopWatching = watchNotes(user.uid, draw, (error) => {
    showError(describeNotesError(error));
  });

  return stopWatching;
}

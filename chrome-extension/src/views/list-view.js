// What you see once you are signed in: your notes, newest first, plus the ways
// out of here — write a new one, search what is already there, open the whole
// thing in a tab, or sign out.
//
// This view does not switch to the editor itself. It calls the `onOpenNote`
// callback it was handed and lets popup.js do the switching, for the same
// reason it does not switch to the sign-in panel: one file decides what is on
// screen, and it is popup.js.
//
// Unlike the Phase 1 views, this one returns a teardown function. It holds a
// live Firestore subscription and a repeating timer, and both have to be
// stopped when you leave.

import { describeAuthError, signOutUser } from '../lib/auth.js';
import { clearDraftsFor } from '../lib/drafts.js';
import {
  createNote,
  describeNotesError,
  updatedMillis,
  watchNotes,
} from '../lib/notes.js';
import { isTabView, openInTab } from '../lib/tab.js';
import { relativeTime } from '../lib/time.js';

// "5 minutes ago" is wrong a minute later. Nothing redraws on its own while the
// popup sits open, so the timestamps are nudged along on a timer instead.
const CLOCK_TICK_MS = 60 * 1000;

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

      <!--
        type="search" rather than type="text" gets the little clear "x" inside
        the box for free, and tells the browser what this field is for.
      -->
      <input
        class="field__input search"
        type="search"
        placeholder="Search notes"
        aria-label="Search notes"
        hidden
      />

      <p class="panel__error" role="alert" hidden></p>

      <!--
        aria-live tells a screen reader to announce this list when it changes on
        its own, which it does: notes arrive from Firestore rather than from a
        click, including notes written on another machine.
      -->
      <ul class="notes" aria-live="polite"></ul>

      <p class="panel__hint notes__empty" hidden></p>
    </main>
    <footer class="footer footer--row">
      <span class="footer__account"></span>
      <button class="button button--quiet" type="button" data-action="open-tab">
        Open in tab
      </button>
    </footer>
  `;

  // The email is text the user typed, so it goes in with textContent rather
  // than being pasted into the template string above.
  container.querySelector('.footer__account').textContent =
    user.email ?? 'Signed in';

  const list = container.querySelector('.notes');
  const searchInput = container.querySelector('.search');
  const emptyMessage = container.querySelector('.notes__empty');
  const errorText = container.querySelector('.panel__error');
  const newNoteButton = container.querySelector('[data-action="new-note"]');
  const signOutButton = container.querySelector('[data-action="sign-out"]');
  const openTabButton = container.querySelector('[data-action="open-tab"]');

  // Already in a tab: the button would open a second copy of the page you are
  // looking at.
  openTabButton.hidden = isTabView();

  // Everything Firestore last sent, before the search box has had its say. The
  // filtering happens here rather than in a Firestore query because the whole
  // list is already in memory and already up to date — a query would cost a
  // round trip per keystroke to answer a question we can answer instantly.
  // (Firestore also cannot search inside a text field, only match whole values.)
  let allNotes = [];

  // The <span>s currently showing a time, kept so the ticking clock can update
  // their text without redrawing the list. Redrawing would take focus off
  // whichever card you had tabbed to.
  let timeCells = [];

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

  function matches(note, term) {
    const haystack = `${note.title ?? ''}\n${note.body ?? ''}`.toLowerCase();
    return haystack.includes(term);
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

    const time = document.createElement('span');
    time.className = 'note__time';
    // The list above is an aria-live region, so a screen reader announces
    // anything that changes inside it. These cells are rewritten every minute
    // by the clock, and "5 minutes ago, 6 minutes ago" read aloud over a note
    // somebody is trying to work with is noise. aria-live="off" on the cell
    // itself opts this one bit of the region out; the text is still there to
    // be read on purpose.
    time.setAttribute('aria-live', 'off');
    const millis = updatedMillis(note);
    // Parked on the element so the clock tick can re-render it later without
    // going back to the note object.
    time.dataset.millis = millis ?? '';
    time.textContent = relativeTime(millis);

    card.append(title, preview, time);
    item.append(card);
    return item;
  }

  function refreshTimes() {
    for (const cell of timeCells) {
      // A dataset value is always a string, and an empty one means "no server
      // timestamp yet" — Number('') is 0, which would read as 1970.
      const raw = cell.dataset.millis;
      cell.textContent = relativeTime(raw === '' ? null : Number(raw));
    }
  }

  // The one place that decides what is on screen: the notes, the filter, and
  // which of the two empty messages applies.
  function draw() {
    const term = searchInput.value.trim().toLowerCase();
    const visible = term
      ? allNotes.filter((note) => matches(note, term))
      : allNotes;

    list.replaceChildren(...visible.map(buildCard));
    timeCells = [...list.querySelectorAll('.note__time')];

    // No point offering to search an empty list.
    searchInput.hidden = allNotes.length === 0;

    // Two different situations that both look like "no notes on screen", and
    // they need different words. Being told "write your first note" when you
    // have ninety of them and simply mistyped a search is the kind of small
    // wrongness that makes an app feel careless.
    if (visible.length > 0) {
      emptyMessage.hidden = true;
    } else if (allNotes.length === 0) {
      emptyMessage.textContent = 'Nothing here yet. Write your first note.';
      emptyMessage.hidden = false;
    } else {
      emptyMessage.textContent = `No notes match “${searchInput.value.trim()}”.`;
      emptyMessage.hidden = false;
    }
  }

  searchInput.addEventListener('input', draw);

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

  openTabButton.addEventListener('click', openInTab);

  signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true;
    try {
      // Drafts are the only note text Keeper keeps outside Firestore, so they
      // go before the session does. Failing to clear them is not a reason to
      // refuse to sign out, which is why this is not inside the try's happy
      // path — clearDraftsFor swallows its own errors.
      await clearDraftsFor(user.uid);
      await signOutUser();
      // No view switch here. signOut makes the auth listener in popup.js fire
      // with null, and that is what puts the sign-in panel back.
    } catch (error) {
      showError(describeAuthError(error));
      signOutButton.disabled = false;
    }
  });

  // Start listening last, so every element the callback touches already exists.
  const stopWatching = watchNotes(
    user.uid,
    (notes) => {
      clearError();
      allNotes = notes;
      draw();
    },
    (error) => {
      showError(describeNotesError(error));
    },
  );

  const clock = setInterval(refreshTimes, CLOCK_TICK_MS);

  return () => {
    stopWatching();
    clearInterval(clock);
  };
}

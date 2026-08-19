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

      <input
        class="field__input search"
        type="search"
        placeholder="Search notes"
        aria-label="Search notes"
        hidden
      />

      <p class="panel__error" role="alert" hidden></p>

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

  container.querySelector('.footer__account').textContent =
    user.email ?? 'Signed in';

  const list = container.querySelector('.notes');
  const searchInput = container.querySelector('.search');
  const emptyMessage = container.querySelector('.notes__empty');
  const errorText = container.querySelector('.panel__error');
  const newNoteButton = container.querySelector('[data-action="new-note"]');
  const signOutButton = container.querySelector('[data-action="sign-out"]');
  const openTabButton = container.querySelector('[data-action="open-tab"]');

  openTabButton.hidden = isTabView();

  let allNotes = [];
  let timeCells = [];

  function showError(message) {
    errorText.textContent = message;
    errorText.hidden = false;
  }

  function clearError() {
    errorText.textContent = '';
    errorText.hidden = true;
  }

  function previewOf(note) {
    const firstLine = (note.body ?? '').split('\n').find((line) => line.trim());
    return firstLine?.trim() ?? 'Empty note';
  }

  function matches(note, term) {
    const haystack = `${note.title ?? ''}\n${note.body ?? ''}`.toLowerCase();
    return haystack.includes(term);
  }

  function buildCard(note) {
    const item = document.createElement('li');

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'note';
    card.addEventListener('click', () => onOpenNote(note));

    const title = document.createElement('span');
    title.className = 'note__title';
    title.textContent = note.title?.trim() || 'Untitled note';

    const preview = document.createElement('span');
    preview.className = 'note__preview';
    preview.textContent = previewOf(note);

    const time = document.createElement('span');
    time.className = 'note__time';
    // Opts these out of the surrounding aria-live region, which would otherwise
    // announce every minute as the clock rewrites them.
    time.setAttribute('aria-live', 'off');
    const millis = updatedMillis(note);
    time.dataset.millis = millis ?? '';
    time.textContent = relativeTime(millis);

    card.append(title, preview, time);
    item.append(card);
    return item;
  }

  function refreshTimes() {
    for (const cell of timeCells) {
      const raw = cell.dataset.millis;
      cell.textContent = relativeTime(raw === '' ? null : Number(raw));
    }
  }

  function draw() {
    const term = searchInput.value.trim().toLowerCase();
    const visible = term
      ? allNotes.filter((note) => matches(note, term))
      : allNotes;

    list.replaceChildren(...visible.map(buildCard));
    timeCells = [...list.querySelectorAll('.note__time')];

    searchInput.hidden = allNotes.length === 0;

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
      await clearDraftsFor(user.uid);
      await signOutUser();
    } catch (error) {
      showError(describeAuthError(error));
      signOutButton.disabled = false;
    }
  });

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

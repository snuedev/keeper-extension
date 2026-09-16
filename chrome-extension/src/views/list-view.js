import { describeAuthError, signOutUser } from '../lib/auth.js';
import { clearDraft } from '../lib/drafts.js';
import { PROFILE_ICON, TRASH_ICON } from '../lib/icons.js';
import {
  createNote,
  deleteNote,
  describeNotesError,
  updatedMillis,
  watchNotes,
} from '../lib/notes.js';
import { isTabView, openInTab } from '../lib/tab.js';
import { themeToggleMarkup, wireThemeToggle } from '../lib/theme.js';
import { relativeTime } from '../lib/time.js';

const CLOCK_TICK_MS = 60 * 1000;

export function renderListView(container, user, { onOpenNote, onOpenSettings }) {
  container.innerHTML = `
    <header class="header header--row">
      <h1 class="header__title">Keeper</h1>
      <div class="header__actions">
        ${themeToggleMarkup}
        <button
          class="button button--quiet button--icon"
          type="button"
          data-action="settings"
          title="Profile and settings"
          aria-label="Profile and settings"
        >
          ${PROFILE_ICON}
        </button>
        <button class="button button--quiet" type="button" data-action="sign-out">
          Sign out
        </button>
      </div>
    </header>
    <main class="panel panel--list">
      <button class="button button--primary button--new-note" type="button" data-action="new-note">
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

      <!--
        The count is announced instead of the list itself: the list is rebuilt
        on every search keystroke, and a live region on it would read all of
        the notes out again each time.
      -->
      <p class="visually-hidden" role="status"></p>

      <ul class="notes"></ul>

      <p class="panel__hint notes__empty" hidden></p>
    </main>
    <footer class="footer footer--row">
      <span class="footer__account"></span>
      <button class="button button--quiet" type="button" data-action="open-tab">
        Open in tab
      </button>
    </footer>
  `;

  wireThemeToggle(container);

  container.querySelector('.footer__account').textContent =
    user.email ?? 'Signed in';

  const list = container.querySelector('.notes');
  const announcement = container.querySelector('[role="status"]');
  const searchInput = container.querySelector('.search');
  const emptyMessage = container.querySelector('.notes__empty');
  const errorText = container.querySelector('.panel__error');
  const newNoteButton = container.querySelector('[data-action="new-note"]');
  const signOutButton = container.querySelector('[data-action="sign-out"]');
  const settingsButton = container.querySelector('[data-action="settings"]');
  const openTabButton = container.querySelector('[data-action="open-tab"]');

  openTabButton.hidden = isTabView();

  let allNotes = [];
  let timeCells = [];

  // Held here rather than read off the page, because every snapshot and every
  // search keystroke rebuilds the cards and would wipe an open confirmation.
  let confirmingId = null;
  let deletingId = null;

  function showError(message) {
    errorText.textContent = message;
    errorText.hidden = false;
  }

  function clearError() {
    errorText.textContent = '';
    errorText.hidden = true;
  }

  function titleOf(note) {
    return note.title?.trim() || 'Untitled note';
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
    item.className = 'note-item';
    item.dataset.noteId = note.id;

    if (note.id === confirmingId) {
      item.append(buildConfirm(note));
    } else {
      item.append(buildNoteButton(note), buildTrashButton(note));
    }

    return item;
  }

  function buildNoteButton(note) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'note';
    card.addEventListener('click', () => onOpenNote(note));

    const title = document.createElement('span');
    title.className = 'note__title';
    title.textContent = titleOf(note);

    const preview = document.createElement('span');
    preview.className = 'note__preview';
    preview.textContent = previewOf(note);

    const time = document.createElement('span');
    time.className = 'note__time';
    const millis = updatedMillis(note);
    time.dataset.millis = millis ?? '';
    time.textContent = relativeTime(millis);

    card.append(title, preview, time);
    return card;
  }

  function buildTrashButton(note) {
    const trash = document.createElement('button');
    trash.type = 'button';
    trash.className = 'button button--quiet button--icon note__delete';
    trash.innerHTML = TRASH_ICON;
    trash.title = 'Delete note';
    trash.setAttribute('aria-label', `Delete ${titleOf(note)}`);
    trash.addEventListener('click', () => askToDelete(note));
    return trash;
  }

  function buildConfirm(note) {
    const box = document.createElement('div');
    box.className = 'confirm';
    box.innerHTML = `
      <p class="confirm__text"></p>
      <div class="form__actions">
        <button class="button" type="button" data-action="keep">Keep it</button>
        <button
          class="button button--danger-filled"
          type="button"
          data-action="delete"
        >
          Delete
        </button>
      </div>
    `;

    box.querySelector('.confirm__text').textContent =
      `Delete “${titleOf(note)}”? This action cannot be undone.`;

    const keepButton = box.querySelector('[data-action="keep"]');
    const deleteButton = box.querySelector('[data-action="delete"]');
    keepButton.disabled = deleteButton.disabled = note.id === deletingId;

    keepButton.addEventListener('click', () => cancelDelete(note));
    deleteButton.addEventListener('click', () => confirmDelete(note));
    return box;
  }

  function focusInCard(noteId, selector) {
    list
      .querySelector(`[data-note-id="${CSS.escape(noteId)}"] ${selector}`)
      ?.focus();
  }

  function askToDelete(note) {
    clearError();
    confirmingId = note.id;
    draw();
    focusInCard(note.id, '[data-action="delete"]');
  }

  function cancelDelete(note) {
    confirmingId = null;
    draw();
    focusInCard(note.id, '.note__delete');
  }

  async function confirmDelete(note) {
    deletingId = note.id;
    draw();

    try {
      await deleteNote(user.uid, note.id);
      clearDraft(user.uid, note.id);
    } catch (error) {
      showError(describeNotesError(error));
    } finally {
      confirmingId = deletingId = null;
      draw();
    }
  }

  function refreshTimes() {
    for (const cell of timeCells) {
      const raw = cell.dataset.millis;
      cell.textContent = relativeTime(raw === '' ? null : Number(raw));
    }
  }

  function draw() {
    // A hidden box cannot be cleared by hand, and a term left in it would go on
    // filtering the next note that arrives.
    if (allNotes.length === 0) {
      searchInput.value = '';
    }
    searchInput.hidden = allNotes.length === 0;

    const query = searchInput.value.trim();
    const term = query.toLowerCase();
    const visible = term
      ? allNotes.filter((note) => matches(note, term))
      : allNotes;

    list.replaceChildren(...visible.map(buildCard));
    timeCells = [...list.querySelectorAll('.note__time')];

    if (visible.length > 0) {
      emptyMessage.hidden = true;
    } else if (allNotes.length === 0) {
      emptyMessage.textContent = 'Nothing here yet. Write your first note.';
      emptyMessage.hidden = false;
    } else {
      emptyMessage.textContent = `No notes match “${query}”.`;
      emptyMessage.hidden = false;
    }

    announcement.textContent = emptyMessage.hidden
      ? `${visible.length} ${visible.length === 1 ? 'note' : 'notes'}`
      : emptyMessage.textContent;
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
  settingsButton.addEventListener('click', onOpenSettings);

  signOutButton.addEventListener('click', async () => {
    signOutButton.disabled = true;
    try {
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

import { clearDraft, readDraft, saveDraft } from '../lib/drafts.js';
import { deleteNote, describeNotesError, updateNote } from '../lib/notes.js';

const SAVE_DELAY_MS = 800;

export function renderEditorView(container, user, note, { onBack }) {
  container.innerHTML = `
    <header class="header header--row">
      <button class="button button--quiet" type="button" data-action="back">
        ← All notes
      </button>
      <button
        class="button button--quiet button--danger"
        type="button"
        data-action="delete"
      >
        Delete
      </button>
    </header>
    <main class="panel panel--editor">
      <input
        class="field__input editor__title"
        type="text"
        placeholder="Title"
        aria-label="Title"
      />
      <textarea
        class="field__input editor__body"
        placeholder="Write anything…"
        aria-label="Note"
      ></textarea>

      <p class="panel__error" role="alert" hidden></p>

      <!--
        Chrome suppresses window.confirm() in an extension popup, and anything
        that takes focus closes the popup outright, so the confirmation has to
        be markup inside the page.
      -->
      <div class="confirm" hidden>
        <p class="confirm__text">Delete this note? There is no undo.</p>
        <div class="form__actions">
          <button class="button" type="button" data-action="cancel-delete">
            Keep it
          </button>
          <button
            class="button button--danger-filled"
            type="button"
            data-action="confirm-delete"
          >
            Delete
          </button>
        </div>
      </div>
    </main>
    <footer class="footer">
      <span class="footer__status" role="status"></span>
    </footer>
  `;

  const titleInput = container.querySelector('.editor__title');
  const bodyInput = container.querySelector('.editor__body');
  const errorText = container.querySelector('.panel__error');
  const statusText = container.querySelector('.footer__status');
  const confirmBox = container.querySelector('.confirm');
  const backButton = container.querySelector('[data-action="back"]');
  const deleteButton = container.querySelector('[data-action="delete"]');

  titleInput.value = note.title ?? '';
  bodyInput.value = note.body ?? '';

  let unsaved = {};
  let saveTimer = null;
  let deleted = false;
  let torndown = false;

  // What Firestore is believed to hold, updated as writes succeed. A draft
  // records this alongside the text, so a restore can tell "nobody else touched
  // this" from "someone edited it elsewhere" without comparing a local clock
  // against Firestore's.
  let saved = { title: titleInput.value, body: bodyInput.value };

  function setStatus(message) {
    statusText.textContent = message;
  }

  function showError(message) {
    errorText.textContent = message;
    errorText.hidden = false;
  }

  function clearError() {
    errorText.textContent = '';
    errorText.hidden = true;
  }

  // Serialized so an earlier save cannot land after a later one and report a
  // stale result: leaving the title by clicking "All notes" fires a blur save
  // and the back button's save back to back.
  let saves = Promise.resolve(true);

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    saves = saves.then(writeChanges);
    return saves;
  }

  async function writeChanges() {
    const fields = unsaved;
    unsaved = {};

    if (deleted || Object.keys(fields).length === 0) {
      return true;
    }

    setStatus('Saving…');
    try {
      await updateNote(user.uid, note.id, fields);
      clearError();
      saved = { ...saved, ...fields };

      const stillTyping = Object.keys(unsaved).length > 0;

      if (!stillTyping) {
        clearDraft(user.uid, note.id);
      }

      setStatus(stillTyping ? 'Saving…' : 'Saved');
      return true;
    } catch (error) {
      unsaved = { ...fields, ...unsaved };
      showError(describeNotesError(error));
      setStatus('Not saved');
      return false;
    }
  }

  function scheduleSave(fields) {
    unsaved = { ...unsaved, ...fields };
    setStatus('Editing…');

    // Written without a delay of its own: the delay below is exactly the window
    // where the text exists only in a popup that closes when it loses focus.
    saveDraft(user.uid, note.id, {
      title: titleInput.value,
      body: bodyInput.value,
      base: saved,
    });

    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
  }

  titleInput.addEventListener('input', () => {
    scheduleSave({ title: titleInput.value });
  });

  bodyInput.addEventListener('input', () => {
    scheduleSave({ body: bodyInput.value });
  });

  titleInput.addEventListener('blur', saveNow);
  bodyInput.addEventListener('blur', saveNow);

  backButton.addEventListener('click', async () => {
    backButton.disabled = true;
    if (await saveNow()) {
      onBack();
    } else {
      backButton.disabled = false;
    }
  });

  deleteButton.addEventListener('click', () => {
    clearError();
    confirmBox.hidden = false;
    container.querySelector('[data-action="confirm-delete"]').focus();
  });

  container
    .querySelector('[data-action="cancel-delete"]')
    .addEventListener('click', () => {
      confirmBox.hidden = true;
      bodyInput.focus();
    });

  container
    .querySelector('[data-action="confirm-delete"]')
    .addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;

      // Must happen before the delete, or a queued save lands after it and
      // recreates the note.
      clearTimeout(saveTimer);
      saveTimer = null;
      unsaved = {};

      try {
        await deleteNote(user.uid, note.id);
        deleted = true;
        clearDraft(user.uid, note.id);
        onBack();
      } catch (error) {
        showError(describeNotesError(error));
        confirmBox.hidden = true;
        event.currentTarget.disabled = false;
      }
    });

  // Chrome's own "save this page" dialog would take focus and close the popup
  // with the note still in it.
  function handleShortcut(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    // Synthetic keydowns from password managers and some IMEs arrive with no
    // key at all.
    if (event.key?.toLowerCase() !== 's') return;

    event.preventDefault();
    saveNow();
  }

  document.addEventListener('keydown', handleShortcut);

  async function restoreDraft() {
    const draft = await readDraft(user.uid, note.id);
    if (!draft || deleted || torndown) return;

    const remote = { title: note.title ?? '', body: note.body ?? '' };

    const typedSinceOpen =
      titleInput.value !== remote.title || bodyInput.value !== remote.body;
    if (typedSinceOpen) return;

    const draftTitle = draft.title ?? '';
    const draftBody = draft.body ?? '';

    if (draftTitle === remote.title && draftBody === remote.body) {
      clearDraft(user.uid, note.id);
      return;
    }

    // The note moved on after this draft was taken, so something else — another
    // window, another machine — has written to it since. Applying the draft
    // would silently throw that away, so the stored version stays on screen and
    // the draft stays on disk rather than either being destroyed.
    const base = draft.base ?? remote;
    if (base.title !== remote.title || base.body !== remote.body) {
      showError(
        'This note changed somewhere else, so your unsaved copy was not applied.',
      );
      return;
    }

    titleInput.value = draftTitle;
    bodyInput.value = draftBody;

    scheduleSave({ title: draftTitle, body: draftBody });
    setStatus('Restored unsaved changes');
  }

  if (titleInput.value) {
    bodyInput.focus();
  } else {
    titleInput.focus();
  }

  setStatus('Saved');
  restoreDraft();

  return () => {
    torndown = true;
    clearTimeout(saveTimer);
    document.removeEventListener('keydown', handleShortcut);
  };
}

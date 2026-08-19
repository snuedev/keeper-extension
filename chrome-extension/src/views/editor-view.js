// One note, open for writing. Title, body, a way back, and a way to delete it.
//
// There is no Save button on purpose. The popup is destroyed the instant it
// loses focus — click the page behind it and this whole file's variables are
// gone — so a button you have to remember to press is a button you will
// sometimes forget, and the note goes with it. Instead the note saves itself
// shortly after you stop typing.

import {
  deleteNote,
  describeNotesError,
  updateNote,
} from '../lib/notes.js';

// How long to wait after the last keystroke before writing to Firestore.
//
// Saving on every keystroke would work, but each one is a network round trip
// and a billable Firestore write — "hello" typed slowly would be five of them.
// Waiting for a pause collapses that into one. Long enough to catch a normal
// pause between words, short enough that you would have to be trying to close
// the popup inside the window.
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
        that steals focus closes the popup outright — which would take the
        unsaved note with it. So the confirmation is ordinary markup that lives
        inside the page.
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
      <!--
        role="status" makes a screen reader read this out when it changes,
        without yanking focus away from what you are typing.
      -->
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

  // .value, not an attribute in the template above: the note is the user's own
  // text, and setting it as a property means it is never parsed as markup.
  titleInput.value = note.title ?? '';
  bodyInput.value = note.body ?? '';

  // What has changed since the last successful write. Only changed fields go to
  // Firestore, so typing in the title never rewrites the body.
  let unsaved = {};
  let saveTimer = null;
  // Set once the note is deleted, so a save that was already queued does not
  // quietly recreate it.
  let gone = false;

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

  // Saves run one after another rather than all at once. Leaving the title box
  // by clicking "All notes" fires a blur save and then the back button's own
  // save, and without this the second could finish first and report "saved"
  // while the first was still in the air and about to fail.
  let saves = Promise.resolve(true);

  // Returns whether the note is safely stored, so the caller can decide whether
  // it is alright to navigate away. Cancels the pending timer straight away —
  // that part cannot wait its turn in the queue.
  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    saves = saves.then(writeChanges);
    return saves;
  }

  async function writeChanges() {
    const fields = unsaved;
    unsaved = {};

    if (gone || Object.keys(fields).length === 0) {
      return true;
    }

    setStatus('Saving…');
    try {
      await updateNote(user.uid, note.id, fields);
      clearError();
      // More may have been typed while that was in the air.
      setStatus(Object.keys(unsaved).length > 0 ? 'Saving…' : 'Saved');
      return true;
    } catch (error) {
      // Put the changes back so the next save picks them up again rather than
      // dropping them on the floor.
      unsaved = { ...fields, ...unsaved };
      showError(describeNotesError(error));
      setStatus('Not saved');
      return false;
    }
  }

  function scheduleSave(fields) {
    unsaved = { ...unsaved, ...fields };
    setStatus('Editing…');
    // Restarting the timer on every keystroke is what makes this fire once
    // after you stop, rather than once every 800ms while you type.
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
  }

  titleInput.addEventListener('input', () => {
    scheduleSave({ title: titleInput.value });
  });

  bodyInput.addEventListener('input', () => {
    scheduleSave({ body: bodyInput.value });
  });

  // Leaving the field is a strong hint that you are done with it, so do not sit
  // on the change waiting for a timer that may never get to run.
  titleInput.addEventListener('blur', saveNow);
  bodyInput.addEventListener('blur', saveNow);

  backButton.addEventListener('click', async () => {
    backButton.disabled = true;
    if (await saveNow()) {
      onBack();
    } else {
      // The write failed and the text only exists in this popup. Staying put is
      // the only thing that keeps it on screen.
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

      // Cancel the pending save first. Without this, a save queued a moment ago
      // could land after the delete and write the note back into existence.
      clearTimeout(saveTimer);
      saveTimer = null;
      unsaved = {};

      try {
        await deleteNote(user.uid, note.id);
        gone = true;
        onBack();
      } catch (error) {
        showError(describeNotesError(error));
        confirmBox.hidden = true;
        event.currentTarget.disabled = false;
      }
    });

  // A brand new note opens with the cursor in the title; an existing one opens
  // in the body, which is where you are far more likely to be adding to it.
  if (titleInput.value) {
    bodyInput.focus();
  } else {
    titleInput.focus();
  }

  setStatus('Saved');

  // Leaving the editor for any reason — including signing out — must not leave
  // a timer running against markup that has been thrown away.
  return () => clearTimeout(saveTimer);
}

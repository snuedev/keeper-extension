import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import { db } from './firebase.js';

function notesCollection(uid) {
  return collection(db, 'users', uid, 'notes');
}

function noteDoc(uid, noteId) {
  return doc(db, 'users', uid, 'notes', noteId);
}

export function updatedMillis(note) {
  return note.updatedAt?.toMillis?.() ?? null;
}

// serverTimestamp() reads back as null until the server confirms the write, so
// a just-edited note sorts to the top rather than dropping to the bottom and
// jumping back.
function timeOf(timestamp) {
  return timestamp?.toMillis?.() ?? Number.POSITIVE_INFINITY;
}

function newestFirst(a, b) {
  const left = timeOf(a.updatedAt);
  const right = timeOf(b.updatedAt);
  if (left === right) return 0;
  return left > right ? -1 : 1;
}

export function watchNotes(uid, onNotes, onError) {
  const notesQuery = query(notesCollection(uid), orderBy('updatedAt', 'desc'));

  return onSnapshot(
    notesQuery,
    (snapshot) => {
      const notes = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      }));

      onNotes(notes.sort(newestFirst));
    },
    onError,
  );
}

export async function createNote(uid) {
  const created = await addDoc(notesCollection(uid), {
    title: '',
    body: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return created.id;
}

export function updateNote(uid, noteId, fields) {
  return updateDoc(noteDoc(uid, noteId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

export function deleteNote(uid, noteId) {
  return deleteDoc(noteDoc(uid, noteId));
}

const MESSAGES = {
  'permission-denied': 'Keeper is not allowed to open those notes.',
  unavailable: 'Could not reach Keeper. Check your connection.',
  unauthenticated: 'Your session expired. Sign out and back in.',
  'not-found': 'That note is gone.',
  'resource-exhausted': 'Keeper is over its quota for today.',
};

export function describeNotesError(error) {
  return MESSAGES[error?.code] ?? 'Something went wrong. Please try again.';
}

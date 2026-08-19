// Every Firestore call Keeper makes lives here, in the same spirit as
// lib/auth.js: no view file imports from 'firebase/firestore' directly, so the
// shape of the data is decided in one place.
//
// The layout is users/{uid}/notes/{noteId} — one document per note, nested
// under the person who owns it. The alternative was a single flat `notes`
// collection with an `ownerUid` field on every document, and this is better for
// one reason: the owner's ID is part of the path, so a query cannot reach
// somebody else's notes even by accident. See firestore.rules, where that is
// what makes the whole rule one line.

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

// collection(db, 'users', uid, 'notes') is Firestore's way of spelling the path
// "users/<uid>/notes". Passing the segments separately instead of gluing a
// string together means a uid containing a slash could never escape into the
// path.
function notesCollection(uid) {
  return collection(db, 'users', uid, 'notes');
}

function noteDoc(uid, noteId) {
  return doc(db, 'users', uid, 'notes', noteId);
}

// A Firestore timestamp comes back as a Timestamp object, not a number, so it
// has to be converted before it can be compared.
//
// The missing case is the interesting one. serverTimestamp() is filled in by
// Firestore's servers, so for the second or so between saving a note and the
// server confirming, this field is still null locally. Treating that as the
// largest possible number puts a note you just edited at the top of the list,
// which is where it belongs — without this, it would visibly drop to the bottom
// and then jump back up.
function timeOf(timestamp) {
  return timestamp?.toMillis?.() ?? Number.POSITIVE_INFINITY;
}

// When a note was last written, in plain milliseconds, or null if the server
// has not stamped it yet. This exists so the list view can show "2 hours ago"
// without importing Firestore's Timestamp class or knowing that .toMillis()
// is a thing — same reason no view imports from 'firebase/firestore'.
export function updatedMillis(note) {
  return note.updatedAt?.toMillis?.() ?? null;
}

function newestFirst(a, b) {
  const left = timeOf(a.updatedAt);
  const right = timeOf(b.updatedAt);
  if (left === right) return 0;
  return left > right ? -1 : 1;
}

// Subscribes to the whole list and calls `onNotes` with it — once shortly after
// you ask, and again every time anything changes, including changes made in
// another window or on another machine. Keeper has no refresh button anywhere
// because of this.
//
// Returns an unsubscribe function. Call it when you navigate away from the
// list: the callback would otherwise keep firing at markup that is no longer on
// screen.
export function watchNotes(uid, onNotes, onError) {
  const notesQuery = query(notesCollection(uid), orderBy('updatedAt', 'desc'));

  return onSnapshot(
    notesQuery,
    (snapshot) => {
      // A snapshot document is not a plain object: the fields come out of
      // .data(), and the id sits beside them rather than inside them.
      const notes = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      }));

      // Firestore has already ordered these — the sort here only moves the
      // handful with a not-yet-confirmed timestamp, as explained above.
      onNotes(notes.sort(newestFirst));
    },
    onError,
  );
}

// Creates an empty note and hands back its id so the caller can open it in the
// editor. Firestore generates that id, which is why this has to wait for the
// write to land rather than returning straight away.
export async function createNote(uid) {
  const created = await addDoc(notesCollection(uid), {
    title: '',
    body: '',
    // serverTimestamp() is a placeholder, not a value — Firestore fills it in
    // from its own clock when the write arrives. That matters because a laptop
    // with a wrong system clock would otherwise sort its notes into the wrong
    // order on every other device.
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return created.id;
}

// `fields` is whatever changed — { title }, { body }, or both. updatedAt is
// stamped here rather than at each call site so it cannot be forgotten, which
// would quietly break the newest-first ordering of the list.
export function updateNote(uid, noteId, fields) {
  return updateDoc(noteDoc(uid, noteId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

export function deleteNote(uid, noteId) {
  return deleteDoc(noteDoc(uid, noteId));
}

// Firestore's error codes, translated the way lib/auth.js translates the auth
// ones. 'permission-denied' is the interesting one: if that ever turns up in
// normal use, the security rules have not been deployed.
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

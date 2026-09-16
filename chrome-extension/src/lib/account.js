import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';

import {
  collection,
  getDocs,
  getFirestore,
  writeBatch,
} from 'firebase/firestore/lite';

import { clearDraftsFor } from './drafts.js';
import { app } from './firebase.js';

// The lite build, because Google users are deleted from the service worker,
// and the full build talks to Firestore through XMLHttpRequest, which service
// workers do not have. Lite uses fetch.
const liteDb = getFirestore(app);

// Firestore rejects a batch holding more than 500 writes.
const BATCH_LIMIT = 500;

async function deleteAllNotes(uid) {
  const { docs } = await getDocs(collection(liteDb, 'users', uid, 'notes'));

  for (let start = 0; start < docs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(liteDb);
    docs
      .slice(start, start + BATCH_LIMIT)
      .forEach((noteSnapshot) => batch.delete(noteSnapshot.ref));
    await batch.commit();
  }
}

export function signsInWithPassword(user) {
  return user.providerData.some(
    (provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID,
  );
}

// Notes go first: firestore.rules only let a signed-in owner delete them, so
// once the account is gone nobody could clean them up.
export async function eraseAccount(user) {
  await deleteAllNotes(user.uid);
  await clearDraftsFor(user.uid);
  await deleteUser(user);
}

// Firebase refuses to delete an account that has not signed in recently, so
// the password is checked again first, even for a session opened a minute ago.
export async function deleteAccountWithPassword(user, password) {
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
  await eraseAccount(user);
}

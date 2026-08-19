const KEY_PREFIX = 'draft:';

function keyFor(uid, noteId) {
  return `${KEY_PREFIX}${uid}:${noteId}`;
}

// Absent when the page is opened outside the installed extension, which should
// disable drafts rather than throw on load.
const storage = globalThis.chrome?.storage?.local ?? null;

// Queued so a set() and the remove() that clears it cannot resolve out of
// order and leave a draft behind for a note that saved cleanly.
let writes = Promise.resolve();

function queue(work) {
  writes = writes.then(work).catch(() => {});
  return writes;
}

export function saveDraft(uid, noteId, draft) {
  if (!storage) return Promise.resolve();

  return queue(() =>
    storage.set({
      [keyFor(uid, noteId)]: { ...draft, at: Date.now() },
    }),
  );
}

export async function readDraft(uid, noteId) {
  if (!storage) return null;

  try {
    const key = keyFor(uid, noteId);
    const stored = await storage.get(key);
    return stored[key] ?? null;
  } catch {
    return null;
  }
}

export function clearDraft(uid, noteId) {
  if (!storage) return Promise.resolve();
  return queue(() => storage.remove(keyFor(uid, noteId)));
}

export function clearDraftsFor(uid) {
  if (!storage) return Promise.resolve();

  return queue(async () => {
    const everything = await storage.get(null);
    const mine = Object.keys(everything).filter((key) =>
      key.startsWith(`${KEY_PREFIX}${uid}:`),
    );

    if (mine.length > 0) {
      await storage.remove(mine);
    }
  });
}

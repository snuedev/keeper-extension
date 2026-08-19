// A scratch copy of whatever is being typed, parked in chrome.storage.local.
//
// The popup is destroyed the moment it loses focus — click the page behind it,
// press Escape, switch windows — and every variable in the editor goes with it.
// The 800ms save delay in the editor is a small window, but it is a real one,
// and a failed write leaves text that only exists on screen. So the editor
// mirrors what you are typing into local storage as you type, and puts it back
// the next time you open that note.
//
// This is a rescue net, not storage. chrome.storage.local is per-browser and
// per-profile: it does not sync to your other machines and it does not survive
// reinstalling the extension. The notes themselves live in Firestore. Anything
// here is a copy that should be short-lived.

const KEY_PREFIX = 'draft:';

// One key per note rather than one key for "the current draft", because
// "Open in tab" means two Keeper pages can be open on two different notes.
function keyFor(uid, noteId) {
  return `${KEY_PREFIX}${uid}:${noteId}`;
}

// chrome.storage only exists when the page is running as part of the installed
// extension. Reaching for it through globalThis and falling back to null means
// opening dist/popup.html straight from disk degrades to "no draft rescue"
// instead of throwing on load.
const storage = globalThis.chrome?.storage?.local ?? null;

// Writes are queued behind each other so they land in the order they were
// asked for. Without this, a set() and the remove() that clears it could
// resolve the other way round and leave a draft behind for a note that saved
// perfectly well.
let writes = Promise.resolve();

function queue(work) {
  // The .catch keeps one failed write from poisoning the chain for every write
  // after it. A draft is a nice-to-have; if storage is full or unavailable,
  // the note itself is still on its way to Firestore.
  writes = writes.then(work).catch(() => {});
  return writes;
}

// `draft` is the whole editor: { title, body }. Both fields go in every time,
// so restoring is a straight assignment rather than a merge.
export function saveDraft(uid, noteId, draft) {
  if (!storage) return Promise.resolve();

  return queue(() =>
    storage.set({
      [keyFor(uid, noteId)]: { ...draft, at: Date.now() },
    }),
  );
}

// Resolves with { title, body, at } or null. Never rejects: a draft that
// cannot be read is the same situation as no draft at all, and it must not
// stop the editor from opening.
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

// Called on sign-out. Drafts are the only place Keeper keeps note text outside
// Firestore, so leaving them behind would mean a signed-out browser still had
// pieces of someone's notes sitting in it.
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

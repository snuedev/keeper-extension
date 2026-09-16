const KEY = 'pendingGoogleLink';

// Google ID tokens expire after an hour. Dropping the link well before then
// means the password step never fails on a token that has quietly gone stale.
const MAX_AGE_MS = 30 * 60 * 1000;

// Session storage lives in memory only and is readable by the popup and the
// service worker but not by web pages, which suits a short-lived sign-in token.
const storage = globalThis.chrome?.storage?.session ?? null;

export async function savePendingGoogleLink({ email, idToken, accessToken }) {
  if (!storage) return;
  await storage.set({
    [KEY]: { email, idToken, accessToken, savedAt: Date.now() },
  });
}

export async function readPendingGoogleLink() {
  if (!storage) return null;

  const { [KEY]: pending } = await storage.get(KEY);
  if (!pending) return null;

  if (Date.now() - pending.savedAt > MAX_AGE_MS) {
    await clearPendingGoogleLink();
    return null;
  }

  return pending;
}

export async function clearPendingGoogleLink() {
  if (!storage) return;
  await storage.remove(KEY);
}

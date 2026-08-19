# Keeper — Implementation Plan

A Chrome extension that gives you a private place to jot notes from anywhere in the
browser. Sign in, write, close the popup, come back later (or on another machine)
and your notes are still there.

**Status:** planning. The repo already has a Manifest V3 scaffold and a Firebase
project (`keeperext`) wired up.

---

## 1. What we're building

The whole product is one small popup panel that hangs off the toolbar icon.

The journey:

1. Click the Keeper icon. If you've never signed in, you get a sign-in / create-account panel.
2. Create an account with an email and password (or sign in to an existing one).
3. You land on your list of notes. Empty at first.
4. Write a note. It saves on its own — no "did that save?" anxiety.
5. Close the popup, close the browser, come back tomorrow. Still signed in, notes still there.
6. Sign out. The panel goes back to the sign-in screen and shows nothing.
7. Sign back in. Everything's there again.

That's the entire v1. Anything else is later.

---

## 2. Where the project stands today

**What's already good and worth keeping:**

| Thing | Notes |
| --- | --- |
| `chrome-extension/manifest.json` | Manifest V3, name, description, all four icon sizes. Solid base. |
| Firebase project `keeperext` | Already created, config already in the repo. |
| `firebase.json` + `.firebaserc` | Hosting configured, pointed at `public/`. |
| `.github/workflows/*` | Auto-deploys hosting on merge and on PRs. We'll reuse this for the privacy policy page. |
| Icon set | `heart16/32/48/128.png` plus a promo image. The store listing needs these. |

**What has to be replaced:**

- `background.js` does not run. It declares `const db` twice (that's a hard syntax
  error — JavaScript won't even parse the file), mixes Realtime Database and
  Firestore, and has literal `<script>` tags sitting inside a `.js` file.
- The manifest's `content_security_policy` points `script-src` at
  `gstatic.com`. Manifest V3 does not allow loading scripts from other servers,
  and the Chrome Web Store rejects extensions that try. The Firebase SDK has to
  ship *inside* the extension.
- `popup.js` calls `signInWithEmailAndPassword(email, password)` where `email`
  and `password` were never defined, and calls `firebase.auth()` in a file where
  Firebase was never initialized.
- `keeper.html` and `login.html` both use `<form action="/login" method="post">`.
  On a normal website the browser posts that to a server. There is no server
  here — the form just navigates the popup to a dead URL. Every form needs a
  JavaScript handler that calls `event.preventDefault()` instead.
- Both HTML files put `<h3>` and `<link>` inside `<head>`. Browsers quietly
  patch this up, but it'll bite once the layout gets more complex.
- `permissions: ["activeTab"]` isn't used by anything. Extra permissions scare
  users at install time and slow down store review. Drop it until something needs it.

---

## 3. The shape of it

Six decisions worth making explicitly up front.

### 3.1 A background service worker, but only for Google sign-in

Phases 0–3 shipped without one, and that was right: everything happened while
the popup was open, so there was nothing for a worker to do.

Google sign-in changed that. The consent screen opens in its own window, and a
Chrome popup is destroyed the instant it loses focus — the popup would be gone
long before Google redirected back, taking the promise waiting on the result
with it. So `background.js` exists now, and it does exactly one thing: it runs
the sign-in flow described in §3.3 when the popup asks it to.

Everything else stays in the popup. If we later want right-click "save selection
to Keeper" or a reminder alarm, this is where those go too.

**Why not more:** the MV3 service worker has its own lifecycle rules (Chrome
shuts it down after roughly 30 seconds idle) and it is the single most confusing
part of extension development. It earns its place here because the popup
genuinely cannot do this job; it should not collect work it doesn't need.

### 3.2 Bundle the Firebase SDK with Vite

Add a build step. `npm run build` produces a `dist/` folder, and `dist/` is what
you load into Chrome.

```
chrome-extension/
  public/                 # copied to dist/ untouched
    manifest.json
    icons/
  src/
    popup.html            # the one and only page
    popup.js              # view switching, wiring
    lib/
      firebase.js         # initializes the app, exports auth + db
      auth.js             # signUp / signIn / signOut / onAuthChange
      notes.js            # watchNotes / createNote / updateNote / deleteNote
    views/
      auth-view.js
      list-view.js
      editor-view.js
    styles.css
  dist/                   # build output — load THIS folder in Chrome
```

**Why:** MV3 bans remote scripts, so the SDK must be a local file either way.
You could hand-download Firebase's compat files and skip the build step entirely,
but that's the deprecated v8 API and it ships around 500KB. Vite tree-shakes the
modern v10+ modular SDK down to roughly a fifth of that, and gives you a real
import system.

The dev loop is: `npm run build`, then hit the reload arrow on the extension card
at `chrome://extensions`. If that gets tedious later, `@crxjs/vite-plugin` adds
hot reload — but start without it. Fewer moving parts to debug.

### 3.3 Email + password, using the Firebase Auth SDK directly

Enable the Email/Password provider in the Firebase console, then use
`createUserWithEmailAndPassword` and `signInWithEmailAndPassword` from the popup
page.

**Why:** these are plain HTTPS calls and they work fine in an extension. The
Firebase auth flows that *don't* work are `signInWithPopup` and
`signInWithRedirect` — the "Sign in with Google" button — because those need a
real browser popup window and a real web origin. Working around that means an
offscreen document or `chrome.identity`. Email and password sidesteps all of it.

**Google sign-in, added after Phase 3.** The catch above is real:
`signInWithPopup` and `signInWithRedirect` do not work here. The way around it
is to run the OAuth handshake ourselves with `chrome.identity.launchWebAuthFlow`
and hand the resulting token to Firebase:

1. `chrome.identity.getRedirectURL()` gives us
   `https://<extension-id>.chromiumapp.org/`. Nothing is ever fetched from that
   address — Chrome watches for it and intercepts the redirect.
2. Send the user to Google's authorize endpoint asking for `id_token token`,
   with `scope=openid email profile` and a random `nonce` (Google requires one
   for this response type).
3. Google redirects back with the tokens in the URL *fragment*. Fragments are
   never sent to a server, which is what makes this safe without a client secret.
4. `GoogleAuthProvider.credential(idToken, accessToken)` wraps them, and
   `signInWithCredential(auth, credential)` turns them into a Firebase session.

From there it is an ordinary Firebase session — `onAuthStateChanged`, the same
notes, the same rules. Nothing downstream knows or cares which button was used.

Two things this depends on:

- The **OAuth Web client ID** lives in `lib/google.js`. It's the one Firebase
  auto-creates when you enable the Google provider (Firebase console →
  Authentication → Sign-in method → Google → Web SDK configuration). Client IDs
  are not secrets; they ship in the source of every web app.
- That client needs `https://<extension-id>.chromiumapp.org/` on its **authorized
  redirect URI** list, set in the Google Cloud console. An unpacked extension's
  ID is derived from its folder path, so it changes if the folder moves and the
  redirect silently stops matching. Pin it with a `key` field in the manifest
  before this gets annoying.

### 3.4 Staying signed in is free

The Firebase Auth SDK stores the session in IndexedDB by default, scoped to the
extension's own origin. It survives the popup closing and the browser restarting,
and it silently refreshes the token in the background.

So the "log out and log back in" requirement needs no token code from us:

- `onAuthStateChanged(auth, user => ...)` fires on every popup open with either a
  user or `null`. That single callback drives which view you see.
- `signOut(auth)` clears it. On the next popup open, `user` is `null`.

**Do not** hand-roll token storage in `chrome.storage`. It's the obvious-looking
move and it's a trap — Firebase ID tokens expire after an hour, and you'd be
reimplementing refresh logic the SDK already does correctly.

### 3.5 Firestore, one note per document, nested under the user

```
users/{uid}/notes/{noteId}
    title      string
    body       string
    createdAt  timestamp
    updatedAt  timestamp
```

**Why nested under `{uid}` rather than a flat `notes` collection with an
`ownerUid` field:** the security rule becomes a single line you can actually
reason about, and every query is naturally scoped to one person. There is no way
to accidentally write a query that leaks someone else's notes, because the path
itself contains the user ID.

Use `onSnapshot` to read the list. It pushes changes live instead of you
re-fetching, so a note written on your laptop shows up on your desktop without a
refresh button.

### 3.6 Security rules are the actual security

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/notes/{noteId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

Deploy with `firebase deploy --only firestore:rules`.

**About the API key sitting in the repo:** that's fine, and it's supposed to be.
A Firebase web API key is an identifier, not a password — it tells Google which
project you're talking to. It's in the page source of every Firebase web app.
What actually protects the data is the rules above plus Auth. (Later: restrict the
key to your extension in the Google Cloud console, and turn on App Check.)

---

## 4. What the popup looks like

One HTML page, four views, swapped by JavaScript. Popups are roughly 360×500
pixels — design for that, not for a desktop window.

```
                  onAuthStateChanged fires
                           |
              +------------+------------+
              |                         |
         user is null              user exists
              |                         |
        [ Auth view ]             [ List view ]
     sign in / create acct       notes, newest first
                                  + "New note"
                                  + sign out
                                        |
                                  tap a note
                                        |
                                 [ Editor view ]
                                 title + body,
                                 autosaves, back, delete
```

There's a fourth: a **loading view**, shown for the split second before
`onAuthStateChanged` first fires. Without it the popup flashes the sign-in screen
at an already-signed-in user every single time. Small detail, very visible.

---

## 5. Build phases

Each phase ends somewhere you can actually click.

### Phase 0 — Make it build and load

- `npm init`, install `firebase` and `vite`
- Restructure into the layout in §3.2
- Rewrite `manifest.json`: drop `content_security_policy`, drop `background`,
  drop `activeTab`, keep `storage`, point `default_popup` at the built `popup.html`
- Add `host_permissions` for `https://*.googleapis.com/` and
  `https://*.firebaseio.com/` — avoids cross-origin surprises
- Delete `background.js`, `popup.js`, `login.html`, `keeper.html`
- Add `dist/` and `node_modules/` to `.gitignore`

**Done when:** `npm run build` succeeds, you load `dist/` via "Load unpacked" at
`chrome://extensions`, and clicking the icon opens a popup that says anything at all.

### Phase 1 — Accounts

- Enable Email/Password in Firebase console → Authentication → Sign-in method
- `lib/firebase.js`: `initializeApp` + `getAuth` + `getFirestore`
- `lib/auth.js`: thin wrappers over the four SDK calls
- `views/auth-view.js`: email field, password field, "Sign in" and "Create account",
  one place to show errors
- `popup.js`: `onAuthStateChanged` decides loading / auth / list

**Done when:** you can create an account, close the popup, reopen it, and land
straight on the (empty) list. Signing out returns you to the sign-in panel.

### Phase 2 — Notes

- Write and deploy the rules from §3.6
- `lib/notes.js`: `watchNotes(uid, cb)` via `onSnapshot`, plus `createNote`,
  `updateNote`, `deleteNote`
- `views/list-view.js`: note cards showing title + first line, newest first
- `views/editor-view.js`: title input, body textarea, back, delete

**Done when:** you can write a note, close the popup, reopen, and it's there.
Sign out and back in — still there. Two accounts can't see each other's notes.

### Phase 3 — Make it pleasant

- Debounce saves to roughly 800ms after you stop typing, not once per keystroke
  (every keystroke would be a billable Firestore write and a network round trip)
- Draft rescue: mirror the in-progress text into `chrome.storage.local` on every
  change, restore it on open, clear it once the save lands
- A search box that filters the list
- Relative timestamps ("2 hours ago")
- A real empty state and real error messages
- "Open in tab" — `chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') })`
  for when the popup is too cramped
- Ctrl/Cmd+S to save now

### Phase 4 — Theme and Google sign-in

- **A light / dark toggle**, cycling system → light → dark and back, stored in
  `chrome.storage.local`. The palette moves to CSS's `light-dark()` so each
  colour is written once instead of twice, and `data-theme` on `<html>` only has
  to flip `color-scheme` to swap the whole set. `light-dark()` takes colours
  only, so the one box-shadow token is assembled from two colour tokens.
- **Google sign-in** per §3.3, run from the service worker in §3.1.

**Done when:** the toggle survives closing the popup, an account made with
Google lands on the same list as one made with a password, and both see only
their own notes.

Two rough edges worth knowing, neither worth fixing yet:

- Extension pages can't run inline scripts, so the stored theme is only applied
  once the bundle parses. If your choice differs from your system setting,
  there's a brief flash of the system one.
- Clicking "Continue with Google" closes the popup, because the consent window
  takes focus. Sign-in still completes in the worker — reopen Keeper and you're
  in. Use "Open in tab" if you'd rather watch it happen.

---

## 6. Traps worth knowing about in advance

**The popup is destroyed when it closes.** Click outside it, switch tabs, press
Escape — the page is gone and every variable with it. Nothing survives that isn't
in Firestore or `chrome.storage`. This is why Phase 3's draft rescue exists.

**Auth errors are deliberately vague now.** Firebase turned on email-enumeration
protection by default, so a wrong password and a nonexistent account both come
back as `auth/invalid-credential`. Don't try to write "no account with that
email" — you can't tell, and that's the point (it stops people probing for which
emails are registered). Show one message: "Email or password is incorrect."

**`chrome.storage.local` is not a database.** It's per-browser and per-profile.
It's the right place for a scratch draft; it's the wrong place for the notes
themselves, because it doesn't sync and doesn't survive a reinstall.

**Errors inside the popup are easy to miss.** Right-click the popup → Inspect
opens its own DevTools window. The regular page console shows you nothing.

**If Firestore requests hang and never resolve,** try
`initializeFirestore(app, { experimentalForceLongPolling: true })`. Firestore's
default streaming transport occasionally misbehaves in extension contexts. Only
reach for this if you actually see the symptom.

**Reloading the extension does not reload an open popup.** Close and reopen it.

---

## 7. Deliberately not in v1

Password reset (add later, it's about ten lines) ·
rich text or Markdown · tags and folders · right-click "save selection to Keeper"
· sharing notes · offline editing · Firefox and Safari builds

(Google sign-in was on this list and got built anyway — see §3.3 and Phase 4.)

---

## 8. Definition of done

Mapped straight back to the original ask:

- [ ] A user can create an account and log in
- [ ] A logged-in user has a space to write notes about anything
- [ ] Notes are saved for later
- [ ] The user can log out
- [ ] Logging back in shows their notes again, and they can add more
- [ ] One user cannot read another user's notes (verified with two accounts)

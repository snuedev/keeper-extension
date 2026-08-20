# keeper-extension

Keeper is a Chrome extension that gives you a private place to jot notes from
anywhere in the browser. It lives entirely in the popup that hangs off the
toolbar icon — no page it injects into, no window to manage. See
[docs/PLAN.md](docs/PLAN.md) for the plan the build followed.

**Status:** Phases 0–4 complete. Accounts, notes, polish, and theming all work.
What is left is the store listing.

## What it does

Click the heart icon and one of three panels appears.

**If you are not signed in,** you get the sign-in panel: Continue with Google, or
an email and password to sign in with or create an account. The session is kept
by Firebase in the extension's own storage, so it survives closing the popup,
closing Chrome, and restarting the machine. You stay signed in until you sign
out.

**Once you are signed in,** you land on your notes, newest first. Each card shows
the title, the first non-empty line of the body, and when it was last touched
("just now", "3 hours ago", "yesterday", then a date once it is over a week old).
A search box filters the list as you type. "New note" opens a blank one straight
away.

**Opening a note** gives you a title field and a body field, and that is it.
There is no save button: it saves itself about 800ms after you stop typing, and
the footer tells you where it is up to — Editing…, Saving…, Saved, or Not saved
if the write failed. Ctrl/Cmd+S saves immediately rather than waiting. Delete
asks once before it goes through. Back returns to the list, flushing anything
still unsaved on the way.

Three smaller things worth knowing:

- **Drafts survive the popup being destroyed.** A Chrome popup is torn down the
  moment it loses focus — click another window and every variable in it is gone.
  Keeper mirrors what you are typing into local browser storage on every change
  and puts it back when you reopen the note ("Restored unsaved changes"), then
  clears it once the real save lands. If the note changed somewhere else in the
  meantime it leaves both alone rather than overwriting one with the other.
  Signing out clears every draft belonging to that account.
- **"Open in tab"** reopens the same page as a full browser tab, for when 360×500
  pixels is not enough room to think in.
- **Light, dark, or match the system**, on a button in the header that cycles the
  three. The choice is remembered.

Notes live in Firestore under your own user ID, and the security rules make that
path the only one your account can read or write. Two accounts cannot see each
other's notes.

## Getting set up

You need Node. If you are on WSL, install it *inside* Linux rather than using a
Windows install — a Windows `node.exe` reaching into the Linux filesystem writes
files that Linux then cannot delete.

```bash
npm install
```

## Firebase config (one time)

The extension needs to know which Firebase project to talk to. Those values live
in a `.env` file at the top of the repo, which is not committed:

```bash
cp .env.example .env
```

Then fill in the six values from the Firebase console, under **Project settings
-> General -> Your apps -> SDK setup and configuration**. If you skip this, the
build still succeeds but the popup fails on open with a message naming the
variables it wanted.

There is no `dotenv` package to install — Vite reads `.env` itself, and swaps
each `import.meta.env.VITE_FIREBASE_*` reference for a plain string when it
builds. The `VITE_` prefix is required: Vite deliberately keeps variables
without it out of the bundle.

**These values are not passwords.** A Firebase web API key only says which
project a request belongs to, and it ends up inside the built bundle on every
user's machine no matter where you keep it — you can read it out of
`dist/assets/*.js` yourself. The reason it lives in `.env` is so you can point
the extension at a scratch project while developing and the real one for
release, without editing code. What actually stops one person reading another
person's notes is `firestore.rules` plus Authentication.

GitHub Actions has its own copy of these six values, stored as repository
secrets, because `.env` is not committed. If you add or rename one, update it in
**Settings -> Secrets and variables -> Actions** too, or CI will build a broken
bundle.

## Firestore security rules (one time)

`firestore.rules` is what actually stops one person reading another person's
notes. It is not enough to have it in the repo — it only does anything once it
is running on Google's servers:

```bash
npm install -g firebase-tools   # if you do not have it
firebase login
firebase deploy --only firestore:rules
```

Do this before signing in for the first time. Until the rules are deployed,
saving a note fails with "Keeper is not allowed to open those notes" — Firestore
denies everything by default, which is the right way round for it to fail.

Re-run the deploy any time you edit `firestore.rules`.

## The dev loop

```bash
npm run build
```

That writes `chrome-extension/dist/`. **`dist/` is the folder you load into
Chrome** — not `chrome-extension/`, and not the repo root.

First time only:

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and pick `chrome-extension/dist`

After that, each time you change the code: run `npm run build` again, then hit
the reload arrow on the Keeper card at `chrome://extensions`.

Two things that catch people out:

- **Reloading the extension does not reload an open popup.** Close it and click
  the icon again.
- **The popup has its own console.** Right-click inside the popup and choose
  Inspect. Errors there do not show up in the console of whatever page you were
  looking at.

`npm run watch` rebuilds automatically when you save a file, so you only have to
click the reload arrow.

## What is in each file

### The extension

| File | What it does |
| --- | --- |
| `chrome-extension/public/manifest.json` | The extension's identity card: name, description, icons, which page the toolbar button opens, which service worker to run, and the two permissions it asks for (`storage` for drafts and theme, `identity` for Google sign-in). Everything in `public/` is copied into the build untouched. |
| `chrome-extension/src/popup.html` | The one and only page. It ships with a small "Loading…" panel already in the markup rather than rendering it from JavaScript, so a signed-in user does not get a flash of the sign-in screen while Firebase looks up their stored session. |
| `chrome-extension/src/popup.js` | The traffic controller. It asks Firebase who is signed in and swaps between the three views accordingly, holds the teardown function for whichever view is on screen, and wipes that account's drafts whenever a session ends. It is the only file that decides what is on screen — the views ask it to switch rather than switching themselves. |
| `chrome-extension/src/styles.css` | Every style in the extension, plus the two colour palettes. |
| `chrome-extension/src/background.js` | The service worker, which exists for exactly one job: running the Google sign-in flow. Google's consent window steals focus, which destroys the popup along with anything it was waiting on; the worker outlives that. |

### Views — what you actually look at

| File | What it does |
| --- | --- |
| `src/views/auth-view.js` | The sign-in panel: the Google button (with Google's mark inlined as SVG, because the extension's content rules forbid loading it from their servers), email and password fields, "Sign in" and "Create account", and one place errors appear. |
| `src/views/list-view.js` | Your notes. Subscribes to Firestore for live updates, builds each card, filters on the search box, refreshes the relative times on a timer so "just now" does not sit there for an hour, and handles New note, Sign out, and Open in tab. Cards are built with `createElement` and `textContent` rather than by pasting strings into HTML, so a note titled `<img onerror=…>` is a note about HTML, not a script. |
| `src/views/editor-view.js` | The note itself. Owns the debounced autosave, the status line, the delete confirmation, the Ctrl/Cmd+S shortcut, and restoring a rescued draft. |

### Library — the pieces the views call

| File | What it does |
| --- | --- |
| `src/lib/firebase.js` | Starts Firebase up and reads the project values out of `.env` and hands out the two things everything else needs: `auth` and `db`. If a value is missing it stops there with a message naming the variable, rather than letting the extension fail later with a confusing auth error. It pins session storage to IndexedDB rather than letting Firebase choose, because the popup and the service worker only see the same sign-in if they agree on where it is kept — and a service worker has no `localStorage` to fall back on. |
| `src/lib/auth.js` | Sign up, sign in, sign in with Google, sign out, and "tell me when the signed-in user changes". Also `describeAuthError`, which turns Firebase's error codes into sentences a person can act on. |
| `src/lib/google.js` | The Google sign-in flow itself: build the consent URL, open it through Chrome's identity API, pull the token out of the URL Google redirects back to, and hand it to Firebase. Runs in the service worker. |
| `src/lib/messages.js` | One constant — the name of the message the popup sends the worker to start that flow. It is its own file so neither side can drift from the other by a typo. |
| `src/lib/notes.js` | Everything Firestore: watch the list live, create, update, delete, and `describeNotesError` for the same reason `auth.js` has one. Notes are stored at `users/{uid}/notes/{noteId}`, so the path itself contains the owner and no query can accidentally reach across accounts. |
| `src/lib/drafts.js` | The draft rescue, in local browser storage. Writes are queued one after another so a save and the clear that follows it cannot land out of order and strand a stale draft. |
| `src/lib/time.js` | Turns a timestamp into "just now" / "3 hours ago" / "yesterday" / "12 Mar", using the browser's own `Intl` formatters so it comes out in the user's language and date format for free. |
| `src/lib/theme.js` | The light/dark/system toggle: reads the saved choice, sets the attribute the stylesheet keys off, and wires up the button. |
| `src/lib/tab.js` | Opening the popup as a full tab, and knowing whether it is currently running as one. |

### Around the extension

| File | What it does |
| --- | --- |
| `vite.config.js` | The build. Points Vite at `src/`, copies `public/` over, and emits two entry points: the popup bundle with a content hash in its name, and `background.js` without one, because `manifest.json` names the worker by path and cannot follow a hash. Asset URLs are made relative — absolute ones resolve against the `chrome-extension://` origin and 404. |
| `firestore.rules` | The actual security. A note can only be read or written by the account whose ID appears in its path. |
| `firebase.json` / `.firebaserc` | Which Firebase project this is, where the rules live, and which folder Hosting serves. |
| `.env.example` / `.env` | The template for your Firebase project values, and your filled-in copy. `.env` is never committed. |
| `public/index.html` | The website Firebase Hosting deploys — this is where the privacy policy the Chrome Web Store requires goes. Not part of the extension. |
| `.github/workflows/` | Deploy the Hosting site on merge, and put up a preview for pull requests. |
| `store-assets/` | The promo image for the store listing. Not shipped in the extension. |
| `docs/PLAN.md`, `docs/plan.html` | The build plan, and a formatted version of it to read in a browser. |

Watch out for the two different `public/` folders: `chrome-extension/public/` is
part of the extension, while the top-level `public/` is the website.

## A note on the font

Phase 4 briefly set the whole UI in Times New Roman. It did not look good — a
newspaper serif at popup size reads cramped and fuzzy — so it was reverted to
the system font stack (`system-ui`, with `-apple-system` and `"Segoe UI"` behind
it) at 14px, which suits the interface far better. `system-ui` means whichever
interface font the operating system already uses, so Keeper renders in Segoe UI
Variable on Windows and SF Pro on macOS and sits inside Chrome rather than on
top of it.

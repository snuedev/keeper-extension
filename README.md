# keeper-extension

A Chrome extension that gives you a private place to jot notes from anywhere in
the browser. See [docs/PLAN.md](docs/PLAN.md) for the full plan.

**Status:** Phase 2 complete — you can create an account, sign in, write notes,
and they are still there when you come back. Phase 3 is the polish: debounced
drafts, search, timestamps.

## Getting set up

You need Node. If you are on WSL, install it *inside* Linux rather than using a
Windows install — a Windows `node.exe` reaching into the Linux filesystem writes
files that Linux then cannot delete.

```bash
npm install
```

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

## Layout

```
chrome-extension/
  public/        copied into dist/ as-is (manifest.json, icons)
  src/           the source Vite bundles (popup.html, popup.js, styles.css)
  dist/          build output - load THIS in Chrome; not committed
store-assets/    promo image for the Chrome Web Store listing, not shipped
public/          Firebase Hosting site (the privacy policy page, Phase 4)
firestore.rules  who is allowed to read and write which notes
```

Watch out for the two different `public/` folders: `chrome-extension/public/` is
part of the extension, while the top-level `public/` is the website Firebase
Hosting deploys.

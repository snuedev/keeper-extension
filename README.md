# keeper-extension

A Chrome extension that gives you a private place to jot notes from anywhere in
the browser. See [docs/PLAN.md](docs/PLAN.md) for the full plan.

**Status:** Phase 0 complete — the project builds and loads. There is no sign-in
and no note-taking yet; those are Phases 1 and 2.

## Getting set up

You need Node. If you are on WSL, install it *inside* Linux rather than using a
Windows install — a Windows `node.exe` reaching into the Linux filesystem writes
files that Linux then cannot delete.

```bash
npm install
```

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
```

Watch out for the two different `public/` folders: `chrome-extension/public/` is
part of the extension, while the top-level `public/` is the website Firebase
Hosting deploys.

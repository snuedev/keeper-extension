// Entry point for the popup page, and the only file that decides what is on
// screen.
//
// Two things drive that decision. Firebase says whether somebody is signed in,
// which picks between the sign-in panel and the notes; and the notes views hand
// back callbacks — open this note, go back to the list — which move between the
// two signed-in screens. No view ever swaps itself out. That way there is
// exactly one place to look when the wrong thing is showing.

import { onAuthChange } from './lib/auth.js';
import { isTabView } from './lib/tab.js';
import { renderAuthView } from './views/auth-view.js';
import { renderEditorView } from './views/editor-view.js';
import { renderListView } from './views/list-view.js';

const app = document.querySelector('#app');

// The same page serves both the toolbar popup and the full tab that "Open in
// tab" creates. A popup has to state its own size or it collapses to fit its
// contents; a tab has a whole window to fill. One class on <body> is the
// difference — see the .in-tab rules in styles.css.
if (isTabView()) {
  document.body.classList.add('in-tab');
}

// Views may hand back a teardown function — the list view has a live Firestore
// subscription, the editor has a save timer — and whatever the last view left
// behind has to be stopped before the next one draws over it. Otherwise a
// Firestore update would fire a callback at markup that is no longer on screen.
let tearDownCurrentView = null;

function show(renderView) {
  tearDownCurrentView?.();
  tearDownCurrentView = renderView() ?? null;
}

function showList(user) {
  show(() =>
    renderListView(app, user, {
      onOpenNote: (note) => showEditor(user, note),
    }),
  );
}

function showEditor(user, note) {
  show(() =>
    renderEditorView(app, user, note, {
      onBack: () => showList(user),
    }),
  );
}

// Remember: the popup page is destroyed the moment the popup closes. Nothing in
// this file survives that, which is why anything worth keeping has to be in
// Firestore before then.
onAuthChange((user) => {
  if (user) {
    showList(user);
  } else {
    // Signing out from anywhere, including the editor, lands here — and `show`
    // tears down whatever that screen had running on its way past.
    show(() => renderAuthView(app));
  }
});

import { onAuthChange } from './lib/auth.js';
import { clearDraftsFor } from './lib/drafts.js';
import { isTabView } from './lib/tab.js';
import { loadTheme } from './lib/theme.js';
import { renderAuthView } from './views/auth-view.js';
import { renderEditorView } from './views/editor-view.js';
import { renderListView } from './views/list-view.js';

const app = document.querySelector('#app');

if (isTabView()) {
  document.body.classList.add('in-tab');
}

// Extension pages cannot run inline scripts, so the stored choice can only be
// applied once the bundle has loaded. Kicked off before anything else to keep
// the window in which the system theme shows through as short as possible.
loadTheme();

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

let signedInUid = null;

onAuthChange((user) => {
  if (user) {
    signedInUid = user.uid;
    showList(user);
    return;
  }

  // Covers every way a session ends, not just the sign-out button: an expired
  // token or an account signed out from another device lands here too, and
  // leaving drafts behind would leave note text in the browser profile for
  // whoever opens Keeper next. A failure is not worth reporting over — the next
  // popup opens on this same branch and tries again.
  if (signedInUid) {
    clearDraftsFor(signedInUid).catch(() => {});
    signedInUid = null;
  }

  show(() => renderAuthView(app));
});

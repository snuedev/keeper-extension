import { onAuthChange } from './lib/auth.js';
import { isTabView } from './lib/tab.js';
import { renderAuthView } from './views/auth-view.js';
import { renderEditorView } from './views/editor-view.js';
import { renderListView } from './views/list-view.js';

const app = document.querySelector('#app');

if (isTabView()) {
  document.body.classList.add('in-tab');
}

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

onAuthChange((user) => {
  if (user) {
    showList(user);
  } else {
    show(() => renderAuthView(app));
  }
});

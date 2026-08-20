const STORAGE_KEY = 'theme';
const MODES = ['system', 'light', 'dark'];

const storage = globalThis.chrome?.storage?.local ?? null;

const GLYPHS = { system: '◐', light: '☀', dark: '☾' };
const LABELS = {
  system: 'Theme: matching the system. Switch to light.',
  light: 'Theme: light. Switch to dark.',
  dark: 'Theme: dark. Switch to matching the system.',
};

let mode = 'system';

function paintRoot() {
  const root = document.documentElement;

  if (mode === 'system') {
    root.removeAttribute('data-theme');
    return;
  }

  root.dataset.theme = mode;
}

export async function loadTheme() {
  if (storage) {
    try {
      const stored = (await storage.get(STORAGE_KEY))[STORAGE_KEY];
      if (MODES.includes(stored)) {
        mode = stored;
      }
    } catch {
      mode = 'system';
    }
  }

  paintRoot();
  return mode;
}

function advanceTheme() {
  mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  paintRoot();
  storage?.set({ [STORAGE_KEY]: mode }).catch(() => {});
}

export function wireThemeToggle(container) {
  const button = container.querySelector('[data-action="theme"]');
  if (!button) return;

  function paintButton() {
    button.textContent = GLYPHS[mode];
    button.title = LABELS[mode];
    button.setAttribute('aria-label', LABELS[mode]);
  }

  button.addEventListener('click', () => {
    advanceTheme();
    paintButton();
  });

  paintButton();
}

export const themeToggleMarkup = `
  <button
    class="button button--quiet button--icon"
    type="button"
    data-action="theme"
  ></button>
`;

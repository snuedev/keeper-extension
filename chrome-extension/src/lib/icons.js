const svg = (paths) => `
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >${paths}</svg>
`;

export const TRASH_ICON = svg(`
  <path d="M3 6h18" />
  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  <path d="M10 11v6" />
  <path d="M14 11v6" />
`);

export const PROFILE_ICON = svg(`
  <circle cx="12" cy="8" r="4" />
  <path d="M4 21a8 8 0 0 1 16 0" />
`);

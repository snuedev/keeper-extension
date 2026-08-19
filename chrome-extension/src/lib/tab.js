// "Open in tab" — the same popup page, opened as a full browser tab.
//
// A Chrome popup is capped at roughly 360x600 pixels and it closes the instant
// you click anything behind it. That is fine for jotting a line down and
// terrible for writing anything longer. A tab is an ordinary page: as big as
// the window, and it stays open.
//
// It is the same popup.html either way. The only difference is the ?view=tab
// marker on the URL, which the page reads to lay itself out wider.

const TAB_MARKER = 'view=tab';

// True when this copy of the page is running as a tab rather than as the
// popup, which is how the "Open in tab" button knows to hide itself.
export function isTabView() {
  return new URLSearchParams(window.location.search).get('view') === 'tab';
}

export function openInTab() {
  // chrome.runtime.getURL turns a path inside the extension into the full
  // chrome-extension://<id>/... address the browser needs. Hard-coding that
  // address is not possible — the id is assigned at install time.
  //
  // chrome.tabs.create needs no "tabs" permission: that permission only gates
  // reading a tab's url and title, which Keeper never does. Opening one of our
  // own pages is free, and keeping the permission list short is what keeps the
  // install prompt quiet.
  const url = chrome.runtime.getURL(`popup.html?${TAB_MARKER}`);

  chrome.tabs.create({ url });

  // The popup and the new tab would otherwise sit on top of each other, both
  // live, both editing the same notes. Closing the small one leaves exactly
  // one Keeper on screen.
  window.close();
}

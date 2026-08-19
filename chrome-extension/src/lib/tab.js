const TAB_MARKER = 'view=tab';

export function isTabView() {
  return new URLSearchParams(window.location.search).get('view') === 'tab';
}

export function openInTab() {
  // chrome.tabs.create needs no "tabs" permission — that only gates reading a
  // tab's url and title.
  const url = chrome.runtime.getURL(`popup.html?${TAB_MARKER}`);

  chrome.tabs.create({ url });
  window.close();
}

// Entry point for the popup page.
//
// The whole of the popup's routing is one subscription: Firebase tells us
// whether somebody is signed in, and that decides which view gets drawn. No
// view ever swaps itself — they trigger a sign-in or a sign-out and let the
// callback below do the swapping. That way there is exactly one place that
// decides what is on screen.

import { onAuthChange } from './lib/auth.js';
import { renderAuthView } from './views/auth-view.js';
import { renderListView } from './views/list-view.js';

const app = document.querySelector('#app');

// Remember: the popup page is destroyed the moment the popup closes. Nothing in
// this file survives that, which is why there is no state to clean up and why
// anything worth keeping has to live in Firestore.
onAuthChange((user) => {
  if (user) {
    renderListView(app, user);
  } else {
    renderAuthView(app);
  }
});

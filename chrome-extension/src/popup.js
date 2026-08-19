// Entry point for the popup page.
//
// Phase 0 only proves the build pipeline works: bundle, load the unpacked
// extension, click the icon, see something. Phase 1 replaces the body of
// render() with the onAuthStateChanged switch between the loading, auth and
// list views described in the plan.

const app = document.querySelector('#app');

function render() {
  app.innerHTML = `
    <header class="header">
      <h1 class="header__title">Keeper</h1>
    </header>
    <main class="panel">
      <p class="panel__message">The build pipeline works.</p>
      <p class="panel__hint">Sign-in lands in Phase 1.</p>
    </main>
  `;
}

render();

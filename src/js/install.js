/**
 * "Install app" support (Progressive Web App).
 *
 * - Chrome / Edge / Samsung Internet (Android & desktop): uses the browser's
 *   native install prompt via `beforeinstallprompt`.
 * - iPhone / iPad Safari: no prompt API exists, so we show the
 *   Share → "Add to Home Screen" steps instead.
 * - Already installed (running as an app): everything stays hidden.
 *
 * UI: a dismissible bar at the bottom of the screen plus a permanent
 * "Install app" button in the footer.
 */
const DISMISS_KEY = 'prepways-install-dismissed';
const DISMISS_DAYS = 14;

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports as Mac

function dismissedRecently() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY));
    return t && Date.now() - t < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

export function initInstall() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  if (standalone()) return;

  let deferred = null;
  const footerButtons = [...document.querySelectorAll('[data-install]')];
  let bar = null;
  let sheet = null;

  const canInstall = () => Boolean(deferred) || isIOS;

  function refresh() {
    footerButtons.forEach((b) => (b.hidden = !canInstall()));
    if (canInstall() && !dismissedRecently()) showBar();
  }

  function showBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'install-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Install the PrepWays app');
    bar.innerHTML = `
      <img src="/icons/icon-192.png" alt="" width="44" height="44" />
      <p><b>Get the PrepWays app</b><span>Quick access, works offline, no app store needed.</span></p>
      <button class="btn btn--primary btn--sm" type="button" data-install-now>Install</button>
      <button class="icon-btn install-bar__close" type="button" aria-label="Dismiss">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>`;
    document.body.append(bar);
    bar.querySelector('[data-install-now]').addEventListener('click', install);
    bar.querySelector('.install-bar__close').addEventListener('click', () => {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      hideBar();
    });
    requestAnimationFrame(() => requestAnimationFrame(() => bar?.classList.add('is-shown')));
    document.body.classList.add('has-install-bar');
  }

  function hideBar() {
    if (!bar) return;
    const el = bar;
    bar = null;
    el.classList.remove('is-shown');
    document.body.classList.remove('has-install-bar');
    setTimeout(() => el.remove(), 500);
  }

  function showIOSSheet() {
    if (!sheet) {
      sheet = document.createElement('dialog');
      sheet.className = 'install-sheet';
      sheet.setAttribute('aria-labelledby', 'install-sheet-title');
      sheet.innerHTML = `
        <h2 id="install-sheet-title">Install PrepWays</h2>
        <ol>
          <li>Tap the <b>Share</b> button
            <svg class="icon" viewBox="0 0 24 24" aria-label="Share icon"><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
            in Safari's toolbar.</li>
          <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>. PrepWays now opens like an app.</li>
        </ol>
        <form method="dialog"><button class="btn btn--primary btn--block">Got it</button></form>`;
      document.body.append(sheet);
      sheet.addEventListener('click', (e) => e.target === sheet && sheet.close());
    }
    sheet.showModal();
  }

  async function install() {
    if (deferred) {
      const prompt = deferred;
      deferred = null;
      prompt.prompt();
      const { outcome } = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
      if (outcome === 'accepted') hideBar();
      refresh();
    } else if (isIOS) {
      showIOSSheet();
    }
  }

  footerButtons.forEach((b) => b.addEventListener('click', install));

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    hideBar();
    footerButtons.forEach((b) => (b.hidden = true));
  });

  refresh();
}

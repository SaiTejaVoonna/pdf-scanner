import { h } from '../dom';
import { icon } from './icons';
import * as store from '../store';

/**
 * "Update ready" banner. A new service worker waits until the user taps Update; before reloading, open editors are asked to
 * save their drafts (event `app-flush-drafts`) and pending writes are awaited, so no edit is lost.
 */
export function watchForUpdates(reg: ServiceWorkerRegistration): void {
  let shown = false;
  let reloading = false;
  // On the very first visit the worker claims the page; that is not an update and must not reload anything.
  const hadController = !!navigator.serviceWorker.controller;
  let dismissed = false;
  let banner: HTMLElement;
  const dismissButton = h('button', { class: 'icon-btn', 'aria-label': 'Dismiss', onclick: () => banner.remove() }, icon('close', 20));
  const show = (worker: ServiceWorker) => {
    if (shown) return;
    shown = true;
    banner = h('div', { class: 'update-banner', role: 'status' },
      h('span', {}, 'A new version is ready.'),
      h('button', { class: 'btn primary', onclick: async () => {
        window.dispatchEvent(new Event('app-flush-drafts'));
        await store.whenSaved();
        worker.postMessage({ type: 'SKIP_WAITING' });
      } }, 'Update'),
      dismissButton);
    // A modal dialog makes everything outside it unclickable, so the banner moves into the topmost open dialog (like toasts).
    const place = () => {
      const open = [...document.querySelectorAll('dialog[open]')];
      const host: Element = open.length ? open[open.length - 1] : document.body;
      if (banner.parentElement !== host) host.append(banner);
    };
    place();
    new MutationObserver(() => { if (banner.isConnected || !dismissed) place(); }).observe(document.body, { childList: true });
    dismissButton.addEventListener('click', () => { dismissed = true; });
  };
  const check = (r: ServiceWorkerRegistration) => { if (r.waiting && navigator.serviceWorker.controller) show(r.waiting); };
  check(reg);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => { if (w.state === 'installed') check(reg); });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update().catch(() => undefined); });
}

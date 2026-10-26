import './camera.css';
import './style.css';
import { restore, setProtectedStorage } from './store';
import { mountApp } from './ui/app';
import { watchForUpdates } from './ui/updateBanner';

// Tabs can be killed without warning on phones: whenever the page is hidden, open editors write their draft immediately.
const flushDrafts = () => window.dispatchEvent(new Event('app-flush-drafts'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDrafts(); });
window.addEventListener('pagehide', flushDrafts);

async function start() {
  await restore();
  mountApp(document.getElementById('app')!);
  void protectStorage();
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('./sw.js').then(watchForUpdates).catch(() => { /* offline support is optional */ });
  }
}
void start();

/**
 * Browsers may delete a site's saved data after a few days without use (iPhone in particular, unless the app is installed to the
 * home screen). Ask for persistent storage and tell the app whether the scans are safe, so it can say so honestly.
 */
async function protectStorage(): Promise<void> {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  let persisted = false;
  try { persisted = (await navigator.storage?.persisted?.()) ?? false; if (!persisted) persisted = (await navigator.storage?.persist?.()) ?? false; } catch { /* not supported */ }
  setProtectedStorage(standalone || persisted);
}

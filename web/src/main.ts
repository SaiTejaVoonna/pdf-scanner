import './style.css';
import { restore } from './store';
import { mountApp } from './ui/app';
import { watchForUpdates } from './ui/updateBanner';

// Tabs can be killed without warning on phones: whenever the page is hidden, open editors write their draft immediately.
const flushDrafts = () => window.dispatchEvent(new Event('app-flush-drafts'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDrafts(); });
window.addEventListener('pagehide', flushDrafts);

async function start() {
  await restore();
  mountApp(document.getElementById('app')!);
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('./sw.js').then(watchForUpdates).catch(() => { /* offline support is optional */ });
  }
}
void start();

import './style.css';
import { restore } from './store';
import { mountApp } from './ui/app';

async function start() {
  await restore();
  mountApp(document.getElementById('app')!);
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
  }
}
void start();

// Renders the icon set (light and dark, at the sizes the app uses) to docs/screenshots/web-icons.png.
//   node e2e/icon-sheet.mjs
import { chromium } from '@playwright/test';
import { ICON_NAMES, ICON_PATHS } from '../src/ui/icons.ts';

const svg = (name, size) => `<svg viewBox="0 -960 960 960" width="${size}" height="${size}" fill="currentColor">${ICON_PATHS[name].map((d) => `<path d="${d}"/>`).join('')}</svg>`;
const cell = (n) => `<div class="c"><div class="i">${svg(n, 28)}</div><span>${n}</span></div>`;
const panel = (cls, title) => `<section class="${cls}"><h2>${title}</h2><div class="grid">${ICON_NAMES.map(cell).join('')}</div>
<div class="tiles"><div class="tile">${svg('image', 26)}<b>Import images</b></div><div class="tile">${svg('camera', 26)}<b>Take photo</b></div><div class="tile">${svg('combine', 26)}<b>Combine PDFs</b></div><div class="tile">${svg('resize', 26)}<b>Resize images</b></div></div>
<div class="scan">${svg('scan', 30)} Scan pages</div></section>`;
const html = `<!doctype html><meta charset=utf-8><style>
body{margin:0;display:flex;font:15px system-ui,sans-serif}
section{width:520px;padding:24px;box-sizing:border-box}
.light{background:#faf8ff;color:#1a1b21;--p:#2457d6;--t:#eaf0ff;--onp:#fff}
.dark{background:#121318;color:#e3e2e9;--p:#b4c5ff;--t:#232734;--onp:#002a78}
h2{margin:0 0 16px;font-size:18px}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px 6px;margin-bottom:22px}
.c{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;opacity:.9}
.i{width:52px;height:52px;border-radius:14px;background:var(--t);display:grid;place-items:center;color:var(--p)}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.tile{background:var(--t);border-radius:20px;padding:14px;min-height:92px;display:flex;flex-direction:column;justify-content:space-between;color:inherit}
.tile svg{color:var(--p)}
.scan{background:var(--p);color:var(--onp);border-radius:20px;height:72px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:20px;font-weight:700}
</style>${panel('light', 'Light')}${panel('dark', 'Dark')}`;
const out = new URL('../../docs/screenshots/web-icons.png', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1040, height: 640 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();

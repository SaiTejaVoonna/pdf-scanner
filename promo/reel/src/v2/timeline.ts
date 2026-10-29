// The timeline for the second reel (30 fps): scenes, voice lines, taps and sound effects, all in absolute frames.
// Voice lengths are the generated WAV lengths (promo/voice/v2); word times inside each line come from words.json.
export const FPS = 30;

export const SCENES = {
  hook: { from: 0, dur: 80 },
  camera: { from: 75, dur: 158 }, // home -> Scan -> live outline -> auto-capture -> the straightened page
  look: { from: 228, dur: 100 },
  pages: { from: 326, dur: 122 },
  size: { from: 446, dur: 196 },
  tools: { from: 640, dur: 128 },
  privacy: { from: 765, dur: 162 },
  end: { from: 925, dur: 125 },
} as const;

export const DURATION = SCENES.end.from + SCENES.end.dur; // 1050 frames = 35 s

export const VOICE = [
  { id: 'hook', from: 6, sec: 1.92 },
  { id: 'open', from: 78, sec: 2.56 },
  { id: 'find', from: 156, sec: 1.88 },
  { id: 'tap', from: 236, sec: 0.85 },
  { id: 'scanned', from: 270, sec: 1.47 },
  { id: 'pages', from: 330, sec: 3.61 },
  { id: 'form', from: 450, sec: 2.05 },
  { id: 'pick', from: 516, sec: 1.09 },
  { id: 'done', from: 556, sec: 0.66 },
  { id: 'nowm', from: 588, sec: 1.17 },
  { id: 'tools', from: 646, sec: 2.62 },
  { id: 'private', from: 770, sec: 3.24 },
  { id: 'offline', from: 880, sec: 1.19 },
  { id: 'free', from: 930, sec: 0.75 },
  { id: 'end', from: 958, sec: 2.43 },
] as const;

/** Moments, in absolute frames. */
export const AT = {
  scanTap: 110, // tap Scan on "Snap it"
  captured: 192, // the app's auto-capture (real footage, see Camera in Reel2.tsx)
  straighten: 196, // the captured page flies out flat
  enhancedTap: 246,
  addTap: 360,
  importTap: 384,
  spreadIn: 392,
  qualityTap: 524, // the quality whose estimate is under 200 KB
  createTap: 540,
  saved: 548,
  pdfPage: 588, // the real PDF page, no watermark
  tiles: [653, 671, 699, 705], // Compress, Resize, Combine, Split, on their words
  resize: 732,
  rowAccount: 770,
  rowPhone: 815,
  rowOffline: 880,
} as const;

export const SFX = [
  { from: 64, src: 'whoosh-fast.mp3', volume: 0.26, cut: 28, note: 'into the phone' },
  { from: 77, src: 'air-zoom-vacuum.mp3', volume: 0.2, cut: 30, note: 'phone rises' },
  { from: AT.scanTap, src: 'switch-tap.mp3', volume: 0.3, cut: 12, note: 'tap Scan' },
  { from: AT.captured, src: 'sparkle-touch.mp3', volume: 0.16, cut: 40, note: 'auto-capture' },
  { from: AT.straighten + 2, src: 'paper-slide.mp3', volume: 0.22, cut: 26, note: 'page flies out flat' },
  { from: AT.enhancedTap, src: 'switch-tap.mp3', volume: 0.3, cut: 12, note: 'tap Enhanced' },
  { from: AT.enhancedTap + 4, src: 'sparkle-touch.mp3', volume: 0.12, cut: 40, note: 'page brightens' },
  { from: AT.addTap, src: 'switch-tap.mp3', volume: 0.26, cut: 12, note: 'tap +' },
  { from: AT.importTap, src: 'switch-tap.mp3', volume: 0.26, cut: 12, note: 'tap Import images' },
  { from: AT.spreadIn, src: 'paper-page-turn.mp3', volume: 0.3, cut: 15, note: 'spread arrives as two pages' },
  { from: AT.qualityTap, src: 'switch-tap.mp3', volume: 0.3, cut: 12, note: 'tap the size' },
  { from: AT.createTap, src: 'switch-tap.mp3', volume: 0.3, cut: 12, note: 'tap Create PDF' },
  { from: AT.saved, src: 'sparkle-touch.mp3', volume: 0.2, cut: 50, note: 'PDF saved' },
  { from: AT.pdfPage, src: 'paper-slide.mp3', volume: 0.22, cut: 26, note: 'the clean PDF page' },
  ...AT.tiles.map((f) => ({ from: f, src: 'switch-tap.mp3', volume: 0.14, cut: 12, note: 'tool tile' })),
  { from: AT.resize - 2, src: 'whoosh-fast.mp3', volume: 0.18, cut: 24, note: 'resize result' },
  { from: AT.rowAccount, src: 'air-zoom-vacuum.mp3', volume: 0.16, cut: 30, note: 'privacy card' },
  { from: AT.rowOffline, src: 'sparkle-touch.mp3', volume: 0.14, cut: 40, note: 'works offline' },
  { from: 921, src: 'impact-zoom-quick.mp3', volume: 0.16, cut: 30, note: 'end card lands, just before "Free"' },
  { from: 954, src: 'shimmer-sparkle-sweep.mp3', volume: 0.08, cut: 60, note: 'afterglow' },
] as const;

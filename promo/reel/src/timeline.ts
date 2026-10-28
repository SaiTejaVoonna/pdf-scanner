// The one timeline for the reel (30 fps). Scenes, voice lines, taps and sound effects are all derived from it,
// so moving a scene moves its voice, captions and sounds with it.
export const FPS = 30;

export const SCENES = {
  hook: { from: 0, dur: 108 },
  add: { from: 108, dur: 96 },
  crop: { from: 204, dur: 144 },
  look: { from: 348, dur: 120 },
  pages: { from: 468, dur: 126 },
  save: { from: 594, dur: 104 },
  outro: { from: 680, dur: 182 }, // starts while the phone is still fading out, so no empty frame
} as const;

export const DURATION = SCENES.outro.from + SCENES.outro.dur; // 862 frames ≈ 28.7 s

/** Voice lines (files in public/voice), with the frame each starts on. Durations are the generated WAV lengths. */
export const VOICE = [
  { id: 'hook', from: SCENES.hook.from + 8, sec: 2.15 },
  { id: 'import', from: SCENES.add.from + 6, sec: 2.47 },
  { id: 'crop', from: SCENES.crop.from + 8, sec: 3.78 },
  { id: 'look', from: SCENES.look.from + 6, sec: 3.11 },
  { id: 'pages', from: SCENES.pages.from + 6, sec: 3.54 },
  { id: 'export', from: SCENES.save.from + 6, sec: 2.41 },
  { id: 'outro', from: SCENES.outro.from + 36, sec: 3.24 },
] as const;

/** Moments inside scenes (frames relative to the scene start). */
export const BEATS = {
  hookFlatten: 66, // the crooked photo becomes a flat page
  addTap: 36, // tap "Import photos"
  addSwap: 44, // the page appears in the document
  cropAuto: 30, // tap Auto
  cropDragStart: 70, // a corner is dragged (12 real frames, 2 frames each)
  lookTap: 34, // tap Enhanced
  pagesAdd: 30, // tap "+" (the sheet opens with Book spread chosen)
  pagesSpread: 58, // tap "Import images"
  pagesResult: 70, // the spread arrives as pages 4–5
  saveTap: 44, // tap "Create PDF"
  saveDone: 52, // "PDF saved"
} as const;

/** Sound effects: frame (absolute), file in public/sfx, volume and what it marks on screen. */
export const SFX = [
  { from: SCENES.hook.from + BEATS.hookFlatten - 4, src: 'whoosh-fast.mp3', volume: 0.28, cut: 28, note: 'photo flattens into a page' },
  { from: SCENES.add.from + 2, src: 'air-zoom-vacuum.mp3', volume: 0.22, cut: 30, note: 'phone rises into view' },
  { from: SCENES.add.from + BEATS.addTap, src: 'switch-tap.mp3', volume: 0.3, cut: 12, note: 'tap Import photos' },
  { from: SCENES.add.from + BEATS.addSwap, src: 'paper-slide.mp3', volume: 0.22, cut: 26, note: 'page lands in the document' },
  { from: SCENES.crop.from + BEATS.cropAuto, src: 'switch-tap.mp3', volume: 0.3, cut: 12, note: 'tap Auto' },
  { from: SCENES.look.from + BEATS.lookTap, src: 'switch-tap.mp3', volume: 0.3, cut: 12, note: 'tap Enhanced' },
  { from: SCENES.look.from + BEATS.lookTap + 4, src: 'sparkle-touch.mp3', volume: 0.12, cut: 40, note: 'page brightens' },
  { from: SCENES.pages.from + BEATS.pagesAdd, src: 'switch-tap.mp3', volume: 0.26, cut: 12, note: 'tap +' },
  { from: SCENES.pages.from + BEATS.pagesSpread, src: 'switch-tap.mp3', volume: 0.26, cut: 12, note: 'tap Import images' },
  { from: SCENES.pages.from + BEATS.pagesResult, src: 'paper-page-turn.mp3', volume: 0.32, cut: 15, note: 'spread arrives as two pages' },
  { from: SCENES.save.from + BEATS.saveTap, src: 'switch-tap.mp3', volume: 0.3, cut: 12, note: 'tap Create PDF' },
  { from: SCENES.save.from + BEATS.saveDone, src: 'sparkle-touch.mp3', volume: 0.2, cut: 50, note: 'PDF saved' },
  { from: SCENES.outro.from + 8, src: 'air-zoom-vacuum.mp3', volume: 0.2, cut: 30, note: 'pages fan out' },
  { from: SCENES.outro.from + 106, src: 'impact-zoom-quick.mp3', volume: 0.22, cut: 34, note: 'wordmark lands' },
  { from: SCENES.outro.from + 110, src: 'shimmer-sparkle-sweep.mp3', volume: 0.1, cut: 60, note: 'afterglow' },
] as const;

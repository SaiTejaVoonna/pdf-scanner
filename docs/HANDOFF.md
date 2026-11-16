# Handoff (15 Nov 2026)

State of the project for whoever picks it up next (a new session or a person). Everything below was checked in the repo or in
a run, except where it says "not measured".

## What is live
- Web app: https://saitejavoonna.github.io/pdf-scanner/ (GitHub Pages, deploys on push). Branch `claude/amazing-babbage-qr2tmb`;
  `main` is an older copy. The app is unchanged by anything in this note: nothing below has been shipped.
- The app's name is not final. Do not show or say a name in the promo videos yet.

## Engine v2 is in the app on the work branch, not live
Branch `claude/kind-mayer-b24yx0` holds the whole integration. The live app (branch `claude/amazing-babbage-qr2tmb`) is unchanged:
**nothing is shipped until the owner says "push"**.

Full-app benchmark, the same 300 photos, same machine (`web/bench/real-eval/README.md`, 15 Nov 2026):

| | Found | IoU >= 0.8 | IoU >= 0.9 | Green | False green | Time per photo |
|---|---|---|---|---|---|---|
| Live now (rules + v1) | 94% | 54% | 36% | 24% | 6% | about 510 ms |
| Work branch (rules + v2) | 94% | **69%** | **52%** | 52% | **2%** | **about 280 ms** |

What was done (the six steps of the old plan):
1. **Export.** `web/ml/export_weights.py` handles both networks; v2 is `web/public/model/corners2.bin` (2.77 MB, 2.57 MB gzipped,
   against 0.98 MB for v1).
2. **Runs in the browser.** `web/src/modelNet.ts` runs either file (the file says which engine it is). Its two hot loops also
   exist as a 4 KB WebAssembly module with SIMD (`web/src/modelKernels.c`, built by `web/scripts/build-kernels.sh` into
   `modelKernels.ts`): about 6 times faster, same numbers, no library. Where a browser cannot run it the TypeScript loops do the work
   (themselves 2 to 2.5 times faster than before).
3. **Parity.** `web/tests/modelNet.test.ts` checks v1 and v2 against PyTorch, the 48x48 mask included.
4. **Mask self-check.** `maskOverlap()` and `combine()` in `web/src/core/find.ts`. With v2 the model leads: its outline is used
   when it sees a page, and the page is "high" (green, no Check badge) only when the outline matches the model's own mask by more
   than 0.9, as in training. When the model sees no page the rules' answer is kept but is never green. The TypeScript check was
   compared with `agree()` from `train2.py` on the 300 photos: 1 of 300 lands on the other side of 0.9.
5. **Benchmark.** The table above. v2 wins on good crops and false green falls.
6. **Tests.** `npm test` 137 pass, `npm run e2e` 57 pass (one of them checks that the WebAssembly kernels are really in use).

## Engine v3: trained, not adopted (16 Nov 2026)
v2 fails mostly on pages that are small in the photo, pages that fill the frame or are cut by its edge, and fingers over the page.
`GEN_HARD=1` in `web/ml/gen.py` makes those; 12,000 such pictures are in the private Kaggle dataset
`saitejavoonna2026/page-corners-hard` (with the v2 weights as the starting point). The kernel
`saitejavoonna2026/page-corners-train-v3` trained 24 rounds on the old data plus these (its output holds the v3 `net2.pt`).

Result on the same 300 photos, whole pipeline: found 97% (v2 94%), IoU>=0.8 71% (69%), IoU>=0.9 57% (52%), green 57% (52%),
but false green 4%, 12 photos (v2 2%, 5 photos). Photo by photo 21 got better and 16 got worse. A stricter mask threshold does not
rescue it: at every threshold from 0.90 to 0.96 v3 has at least as many false greens as v2 for a similar green share. The rule was
"replace only if it beats v2", and trust in green matters most, so **v2 stays in `corners2.bin`**. Gains were where the new data
aimed (ID cards 37 to 47%, receipts 57 to 68%); pages under 5% of the photo are still almost never right (1 of 10).
Next ideas, none started: make the mask check harder to fool (hard pictures with wrong-but-plausible outlines), a second look at
small pages (crop and re-run), 224 px input, a pretrained backbone. `pipeline.eval.ts` now also writes each photo's mask overlap.

Open models were looked at too (15 Nov): DocCornerNet LEAN (MIT, 1.9 MB) scores 84% on the 300 photos but was trained on that
dataset's training half (research-only sources inside) and gets 67% on Mendeley pages, where v2 gets 87 to 93%; DocAligner's default
model is 79 MB. Neither is used. What they do differently and we do not yet: a pretrained backbone, 224 px input, more varied real data.

One line switches back to v1: `MODEL_FILE` in `web/src/modelFile.ts` (plus the same name in `web/public/sw.js`). v1's file stays in the repo.

Still open before "push":
- **Speed on a real phone is not measured.** In desktop Chromium the v2 model step takes 39 ms against 195 ms for the live v1 step,
  and 251 ms against 1163 ms with the CPU slowed 6 times, so a phone should be faster than today, not slower. Still worth one try
  on a mid-range Android phone.
- **Download.** The first photo fetches 2.8 MB instead of 1 MB (once, then it is kept for offline use).
- **ID cards are the weak group**: found 78% (86% live), though good crops rise from 16% to 37%. More real ID-card photos in training
  would help.
- The way rules and model are combined was chosen on these same 300 photos (among five simple variants), so the gain on other
  photos may be a little smaller. The model-only results on the 877-page exam (README in `web/ml/kaggle/`) point the same way.

Optional trial: write the model run and the straightening step in Rust (WebAssembly) and compare speed with TypeScript on the
same photos. Not measured yet. Move the engine to Rust only if it is clearly faster.

## Where things are (these are NOT in git)
- Trained v2 weights: the Kaggle run `saitejavoonna2026/page-corners-train-gpu` (private; download with
  `kapi.py`, see below). Also in the old session's scratch folder as `gen/net2-kaggle30.pt`, which may be gone.
- Training data: the private Kaggle dataset `saitejavoonna2026/page-corners-train` (36,000 generated pictures, 412 licensed Mendeley
  photos, 60 held-back). Rebuild locally with `web/ml/gen.py` and `web/ml/data/fetch_mendeley.py`.
- The 300-photo benchmark set and the 877-page exam come from DocCornerDataset (mixed licences, includes research-only sources):
  **test use only, never train the shipped model on it.** `web/bench/real-eval/prepare.py` downloads it.
- The owner's 41 private photos: not in the repo, still need outline labels.

## Kaggle GPU
- Account `saitejavoonna2026`. The token is a network secret on the cloud environment, so it is never in the repo or in a variable.
  The Kaggle CLI cannot use it directly; `web/ml/kaggle/kapi.py` can (it points the client at www.kaggle.com so the proxy adds the token).
  Steps: `web/ml/kaggle/README.md`. One 30-round run took 60 minutes on a free T4.
- To improve the model next: more real photos (the rest of the Mendeley set, about 600 more, then the owner's 41), a failure
  analysis of the exam to see what v2 gets wrong, and retrain.

## Other open items
- UI: mocks are in `docs/design/next-ui/` (glass style and a "Notebook" direction). The Notebook mock was judged to look bad by the owner;
  nothing is chosen. Design skill: `.claude/skills/frontend-design`.
- New tools planned: password remove/add, sign, ID card mode, passport photo, reorder, then OCR. Not started.
- Android: **`webapp/` packs the web app as an Android app** (16 Nov 2026): a WebView that serves `web/dist` from the APK under
  `https://appassets.androidplatform.net/`, with no INTERNET permission. `MainActivity.kt` connects the camera permission, the file
  picker, the back button, sharing and saving (Downloads); `assets/shell.js` is the page side of that. Build: `npm run build` in
  `web/`, then `./gradlew :webapp:assembleDebug`; CI job "Build web-app APK" uploads the APK. Its id is `com.saiteja.pdfscanner.web`,
  so it installs next to the Kotlin app. **Not yet run on a phone or emulator** (none in the cloud session): the APK builds, lint
  passes, and shell.js was tested in Chromium with a stand-in for Android. Not done: opening a PDF or photo sent from another app.
  The Kotlin app in `app/` is behind the web app and unchanged.
- Reels: `promo/` has two finished Reels (renders are in `promo/out`, not in git). The Mixkit music licence still needs the owner's check.
- Repo: no licence chosen yet; the default branch is still the long `claude/...` name (owner to rename in GitHub settings).
- Name and domain: StashScan was the favourite; stashscan.com is taken, stashscan.app looked free. Nothing bought, nothing renamed.

## Working rules the owner set
- Do not change the live app or publish anything unless told to ("push").
- Show only features that were checked in the app; no OCR or "perfect" claims; no claim about ads.
- Commits in this repo carry the owner as author, with Claude as co-author.

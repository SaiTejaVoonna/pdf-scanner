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
| Work branch (rules + v2) | 94% | **69%** | **52%** | 52% | **2%** | about 530 ms |

What was done (the six steps of the old plan):
1. **Export.** `web/ml/export_weights.py` handles both networks; v2 is `web/public/model/corners2.bin` (2.77 MB, 2.57 MB gzipped,
   against 0.98 MB for v1).
2. **Runs in the browser.** `web/src/modelNet.ts` runs either file (the file says which engine it is). The inner loops were
   rewritten and are 2 to 2.5 times faster for both engines; that is what pays for v2's extra work.
3. **Parity.** `web/tests/modelNet.test.ts` checks v1 and v2 against PyTorch, the 48x48 mask included.
4. **Mask self-check.** `maskOverlap()` and `combine()` in `web/src/core/find.ts`. With v2 the model leads: its outline is used
   when it sees a page, and the page is "high" (green, no Check badge) only when the outline matches the model's own mask by more
   than 0.9, as in training. When the model sees no page the rules' answer is kept but is never green. The TypeScript check was
   compared with `agree()` from `train2.py` on the 300 photos: 1 of 300 lands on the other side of 0.9.
5. **Benchmark.** The table above. v2 wins on good crops and false green falls.
6. **Tests.** `npm test` 135 pass, `npm run e2e` 57 pass.

One line switches back to v1: `MODEL_FILE` in `web/src/modelFile.ts` (plus the same name in `web/public/sw.js`). v1's file stays in the repo.

Still open before "push":
- **Speed on a real phone is not measured.** In desktop Chromium with the CPU slowed 4 to 6 times, the v2 model step took 12 to 17%
  longer than the live v1 step (the model is under half of the time per photo). A real mid-range Android phone should be tried.
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
- Android: the Kotlin app in `app/` is behind the web app. A Tauri wrap of the web app was proposed as a trial: not tried.
- Reels: `promo/` has two finished Reels (renders are in `promo/out`, not in git). The Mixkit music licence still needs the owner's check.
- Repo: no licence chosen yet; the default branch is still the long `claude/...` name (owner to rename in GitHub settings).
- Name and domain: StashScan was the favourite; stashscan.com is taken, stashscan.app looked free. Nothing bought, nothing renamed.

## Working rules the owner set
- Do not change the live app or publish anything unless told to ("push").
- Show only features that were checked in the app; no OCR or "perfect" claims; no claim about ads.
- Commits in this repo carry the owner as author, with Claude as co-author.

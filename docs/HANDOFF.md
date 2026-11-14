# Handoff (13 Nov 2026)

State of the project for whoever picks it up next (a new session or a person). Everything below was checked in the repo or in
a run, except where it says "not measured".

## What is live
- Web app: https://saitejavoonna.github.io/pdf-scanner/ (GitHub Pages, deploys on push). Branch `claude/amazing-babbage-qr2tmb`;
  `main` is an older copy. The app is unchanged by anything in this note: nothing below has been shipped.
- The app's name is not final. Do not show or say a name in the promo videos yet.

## Next job: put engine v2 into the app
The trained v2 model beats the shipped one **on its own**, but it is not in the app and has not been run through the app's pipeline.

Model-only results (`web/ml/kaggle/README.md`, `web/ml/compare_models.py`):

| Photos | Model | Good crops (IoU >= 0.8) | False green |
|---|---|---|---|
| Real exam (877 pages) | shipped | 59% | 36% |
| | v2 | 72% | 2% |
| Held-back Mendeley (60) | shipped | 48% | 48% |
| | v2 | 93% | 3% |

Steps, in order:
1. **Export. Done (14 Nov).** `web/ml/export_weights.py` now handles both networks. The v2 file is `web/public/model/corners2.bin`
   (2.77 MB, 2.57 MB gzipped, against 0.98 MB for v1) and the PyTorch outputs to match are in `web/tests/fixtures/model2-parity.json`
   (corners, presence, var and the 48x48 mask). The app does not load the file yet. `run_folded()` in the script is the
   layer-by-layer recipe for the TypeScript port; it reproduces the PyTorch model from the written file to within 1.2e-05.
2. **Run it in the browser.** `web/src/modelNet.ts` runs v1 in plain TypeScript. Add v2 next to it (do not replace v1 until v2 wins).
3. **Parity.** `web/tests/modelNet.test.ts` compares the TypeScript output with PyTorch on a fixture. Do the same for v2. It must match.
4. **Use the mask as the self-check.** In training, "green" means presence > 0.5 AND the corner outline overlaps the predicted
   mask by more than 0.9 (`agree()` in `web/ml/train2.py`). That is why false green fell from about a third to 2-3%. `combine()` in
   `web/src/core/find.ts` must get the same check, or the gain is lost.
5. **Full-app benchmark.** `web/bench/real-eval/README.md`. Baseline to beat, same 300 photos: found 94%, IoU >= 0.8 **54%**,
   IoU >= 0.9 **36%**, false green **6%**, about 460 ms per photo. Ship only if v2 wins on good crops without raising false green,
   and does not slow a phone noticeably (not measured yet: speed and download size of v2 on a phone-class device).
6. Then `npm test` (128 unit tests) and `npm run e2e` (57 browser tests). Push to the live app only when the owner says "push".

Optional trial before step 2: write the model run and the straightening step in Rust (WebAssembly) and compare speed with
TypeScript on the same photos. Not measured yet. Move the engine to Rust only if it is clearly faster.

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

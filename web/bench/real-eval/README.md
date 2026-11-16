# Real-photo evaluation of the page finder

Scores the engine against real photos with hand-marked page corners, so every change to the engine shows numbers instead of guesses.

The photos are **not** in the repository (they are third-party data with their own licences: MIDV and SmartDoc are research-use only,
COCO is CC BY 4.0). They are downloaded into a folder you choose.

```
python3 -I bench/real-eval/prepare.py  /some/folder  [count]      # downloads one test shard of mapo80/DocCornerDataset, writes eval.rgba + eval.json
npx vitest run --config bench/real-eval/vitest.config.ts /some/folder  # runs the engine on them (EVAL_DIR=/some/folder)
python3 -I bench/real-eval/score.py /some/folder                  # overlap, found, "green", false-green per source
```

Numbers to watch: **IoU >= 0.9 / 0.8** (how close the crop is) and **false green** (the engine said "sure" but the crop was wrong).
Baseline of the rule-based engine on 300 photos (October 2026): found 83%, IoU>=0.8 26%, green 43%, false green 25% of all images.

## Result with the learned model (October 2026, 300 photos, same set)
Rules alone: found 83%, IoU>=0.8 26%, IoU>=0.9 17%, green 43%, **false green 25%**.
Rules + early model (epoch 2 of a 14-epoch run, trained on generated data only) combined by `combine`: found 94%, IoU>=0.8 **54%**, IoU>=0.9 **36%**, green 24%, **false green 6%**.
Run it with `EVAL_DIR=... MODEL_BIN=... npx vitest run --config bench/real-eval/vitest.config.ts pipeline`, then `score.py` on `result-pipeline.json` (copy it to `result.json`).

## Engine v2 (15 November 2026, the same 300 photos, one machine, one run each)
`pipeline` now uses the model the app ships (`src/modelFile.ts`); `MODEL_BIN=public/model/corners.bin` runs engine v1 instead.

| | Found | IoU >= 0.8 | IoU >= 0.9 | Green | False green | ms per photo |
|---|---|---|---|---|---|---|
| Rules alone | 83% | 26% | 17% | 43% | 25% | 290 |
| Rules + v1, as live (old loops) | 94% | 54% | 36% | 24% | 6% | about 510 |
| Rules + v1, new loops | 94% | 54% | 36% | 24% | 6% | 392 |
| Rules + v2, new loops | 94% | 69% | 52% | 52% | 2% | 529 |

By source, v2 against v1 (IoU >= 0.8): document 100% (64%), card 64% (45%), id 54% (46%), idcard 37% (16%), midv500 77% (77%),
receipt 57% (61%). Found falls for idcard (78% against 86%).

Two more runs that need no scoring step:
- `dump` writes what the rules, v1 and v2 each say about every photo (`dump.json`), so ways of combining them can be compared
  without running the engines again. Five were compared; the one in `combine` (the model leads, green only by its own mask check)
  had the most good crops and the lowest false green. They were chosen on these 300 photos, so expect a slightly smaller gain elsewhere.
- `speed` times one run of each engine on a fixed input (no photos needed).

The mask check in TypeScript (`maskOverlap`) against `agree()` in `web/ml/train2.py`, same corners and mask, 300 photos: mean
difference 0.001, largest 0.015, and 1 photo falls on the other side of the 0.9 line.

Model step alone in desktop Chromium (median of 9 runs, CPU slowed with DevTools throttling; not a real phone):

| CPU | v1 as live | v1 new loops | v2 new loops |
|---|---|---|---|
| Full speed | 205 ms | 80 ms | 225 ms |
| 4x slower | 959 ms | 491 ms | 1118 ms |
| 6x slower | 1622 ms | 629 ms | 1817 ms |

### With the WebAssembly kernels (16 November 2026)
The same v2 model and the same answers (found 94%, IoU >= 0.8 69%, IoU >= 0.9 52%, green 52%, false green 2%), 277 ms per photo
in the full pipeline. Model step alone in desktop Chromium, median of 9 runs:

| CPU | v1 as live | v2 TypeScript loops | v2 WebAssembly kernels |
|---|---|---|---|
| Full speed | 195 ms | 201 ms | 39 ms |
| 4x slower | 812 ms | 988 ms | 174 ms |
| 6x slower | 1163 ms | 1469 ms | 251 ms |

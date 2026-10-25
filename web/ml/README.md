# The page-corner model

A small neural network (0.2 M weights, about 1 MB) that finds the four corners of a page. In the app it is a **second opinion** next to the
rule-based finder (`src/core/find.ts` `combine`); it runs in the background worker with a plain TypeScript implementation
(`src/modelNet.ts`), so there is no runtime library to download.

## Data: only what may be shipped
* **Training pictures are generated**, not downloaded photos of documents: synthetic pages (OFL fonts, lines, tables, photos, tilted, curled,
  shadowed, partly covered) on CC0 textures from Poly Haven and CC0 Poly Haven HDRI panoramas (room-like scenes, also used as "no page" negatives).
  `gen.py` builds them; the textures, fonts and panoramas are fetched at run time and are **not** in this repository.
* **Real photos are used for measuring only** (`exam.py`, `bench/real-eval/`): a test shard of the public DocCornerDataset (mixed licences, includes
  research-only sources). They never train the shipped model.

## Files
| File | What |
|---|---|
| `model.py` | the network (PyTorch) |
| `gen.py` | synthetic training data: `GEN_HDRI=1 GEN_HDRI_SHARE=0.5 GEN_NEG=0.3 python3 -I gen.py 3000 <seed> out.npz` |
| `train.py` | training (`THREADS=4 python3 -I train.py 14`), resumable (`ckpt.pt`), reports the real-photo exam every second epoch |
| `exam.py` | builds the real-photo exam |
| `weird.py` | stress test: blur, dark, glare, noise, JPEG, rotation, a hand over the page, junk frames |
| `export_weights.py` | folds BatchNorm and writes `public/model/corners.bin` plus the parity fixture |

## Updating the model in the app
1. Train, run `weird.py`, and check the end-to-end numbers: `bench/real-eval` (`pipeline.eval.ts` then `score.py`). The new model must beat the previous one on IoU>=0.8 and must not raise false green.
2. `python3 -I export_weights.py net.pt ../public/model/corners.bin ../tests/fixtures/model-parity.json`
3. `npx vitest run tests/modelNet.test.ts` (the TypeScript output must match PyTorch), then the browser tests.

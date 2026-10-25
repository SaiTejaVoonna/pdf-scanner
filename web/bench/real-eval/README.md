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

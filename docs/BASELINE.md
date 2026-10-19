# Detection baseline (five real photos)

Measured with `node bench/score.mjs <photos> web/bench/labels/baseline-5.json` (raw detection only, no manual correction).
The photos are private and not in the repo; the hand labels (coordinates only) are in `web/bench/labels/baseline-5.json`.
Pass rule: no more than 0.5% of the must-keep area (each labelled page shrunk 5%) outside the crop, no more than 15% of the
crop being background, and for "none" photos no detection. Must-keep is a proxy here because these pages are full of
writing; held-out sets should supply real must-keep polygons.

| Photo | Scene | Before (`096c505`) | Current raw (`588fcfd`) |
|---|---|---|---|
| P1 | open notebook spread on a bed, laptop above | FAIL: IoU 36%, loss 14.9%, 61% background | PASS: IoU 95%, loss 0%, 4.9% background (one box over both pages, not yet split) |
| P2 | app preview shown on a phone (weak label) | FAIL: IoU 25%, 75% background | PASS: IoU 98% |
| P3 | phone showing a white page, red cloth | FAIL: IoU 27%, 74% background | PASS: IoU 98% |
| P4 | dark phone screen (no white paper) | FAIL: a box was returned | PASS: nothing returned (correct in white-paper mode) |
| P5 | white letterhead page in a folder with a stack of sheets behind; left half in shadow | FAIL (before the writing-safety fallback, `334ce0f`): IoU 73%, **16.5% of the page content cut** | PASS: IoU 84%, 0.2% cut, 14.7% extra background (a looser box around the writing, nothing lost) |

**Limits:** five photos, labelled by one person, and the detector was tuned while looking at them, so this is a regression
baseline and not an accuracy claim. Broader accuracy is unproven until held-out photos exist. P1 passes as a single outer
box; splitting it into two pages is the book-spread work.

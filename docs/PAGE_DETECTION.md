# Page detection

Goal: find the four corners of a page in a photo, offline, without native libraries or Google services, and
**decline to guess** when unsure (the app then keeps the full image).

Pipeline (`imaging/EdgeDetector.kt`), run on a copy shrunk to about 400 px:

1. **Canny edges** (`CannyEdges`): light blur, Sobel gradient taking the strongest of the R/G/B channels (so a page
   that differs from the desk only in colour is still seen), non-maximum suppression, hysteresis thresholds derived
   from the image.
2. **Hough lines** (`HoughLines`): the strongest straight lines, near-duplicates suppressed. The four sides of the
   image frame are added as candidates so a page cut off by the frame can still be found.
3. **Quad candidates:** every set of four lines that forms two roughly parallel pairs crossing each other.
4. **Scoring** (a candidate must pass all of these):
   - covers 12-98.5% of the image, convex, clockwise, interior angles within 50-130°, sensible side ratios;
   - the outline lies on real edges (edge support per side, sides on the frame count half);
   - **contrast across each side:** mean colour/brightness of a band outside vs inside must differ. A printed line has
     paper on both sides; a page edge has paper on one side and desk on the other. This rejects text blocks.
   - not dominated by the frame: at most two frame sides, at least two real sides.
5. A second, brightness-based segmentation (`RegionCandidates`) proposes extra candidates for smooth backgrounds;
   they are scored by the same rules, so the better evidence wins.
6. Edge density above 65% (texture or noise) returns nothing.

Honest limits: this detector has been tested on synthetic scenes (texture, shadow, perspective, low contrast,
colour-only difference, clutter, cut-off pages). It has **not** yet been run against a set of real photos; the
owner's phone testing so far was of the earlier, simpler detector, whose weaknesses on a cluttered photo motivated
this rewrite. Busy scenes with several overlapping papers can still fail. Contributions of difficult test photos (that you have the
right to share) are welcome.

## Paper-colour candidates (web)
Line-based candidates alone were fooled by clutter (patterned bedding, keyboards, floors): long straight lines are
everywhere. The web detector therefore also looks at colour. Paper is usually the whitest thing in the photo, so the
per-pixel minimum of R, G, B is thresholded at two Otsu levels, the mask is opened (erode then dilate) to cut thin
bridges, and a quadrilateral is fitted around each large blob's convex hull (repeatedly dropping the edge whose removal
adds the least area). Every candidate, whatever produced it, must also pass a check that most of its interior is as
white as its own 90th percentile, and its score is multiplied by that fraction cubed. Dark paper on a bright table is
still handled by the older brightness segmentation.

## Crop margin
Detected corners are moved outwards by a small margin (1.2% of the page size, `CROP_MARGIN`) because clipping a page
edge or printed footer is worse than including a sliver of desk.

## Real-photo check and benchmark
One real, difficult photo (a letter inside a folder on marble, with a blue card behind it, blurry edges and fingers at
the bottom) was tried on the web detector. It returned a plausible crop around the *folder and papers*, but its bottom
edge landed on a printed rule above the letter's footer, so the footer was cut off. Raising the contrast threshold
did not fix that: it produced worse quads built from the image frame, and the synthetic tests passed at every
setting, so the synthetic suite cannot tell good from bad on real photos. Tuning one constant against one photo
would be guesswork, so it was not done.

To measure instead of guess, use the benchmark:

```bash
cd web
# put photos in a folder (they never leave your machine); optionally add <name>.json next to a photo with the true
# corners: {"corners": [[x, y], [x, y], [x, y], [x, y]]} as 0..1 fractions, clockwise from the top-left
npm run bench -- /path/to/photos /path/to/output
```

It runs the real detector in Chromium, writes `<name>-detected.png` with the result drawn on each photo, and prints
how many were found and, where ground truth exists, the mean overlap (IoU). `bench/photos/` is git-ignored so private
documents cannot be committed by accident.

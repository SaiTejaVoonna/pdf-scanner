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

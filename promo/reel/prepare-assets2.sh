#!/usr/bin/env bash
# Second reel: copies the captured screens, camera frames, exported PDF pages and voice into public/v2/
# (music and sound effects are shared with the first reel; run prepare-assets.sh once for those).
set -euo pipefail
cd "$(dirname "$0")"; C=../capture/final2; D=public/v2
mkdir -p $D/shots $D/cam $D/pdf $D/voice src/v2
cp $C/[0-9]*.png $D/shots/ && cp $C/camseq/*.jpg $D/cam/
cp $C/layout.json src/v2/layout.json && cp $C/camseq.json src/v2/camseq.json && cp $C/facts.json src/v2/facts.json
cp ../capture/cam/report-cam.jpg ../capture/docs/photo-report.jpg $D/
pdftoppm -r 150 -png $C/reel.pdf $D/pdf/page
python3 - <<'PY'
from PIL import Image, ImageChops
import glob
for f in sorted(glob.glob('public/v2/pdf/page-*.png')):  # trim the white bands A4 adds around a photo
    im = Image.open(f).convert('RGB'); box = ImageChops.difference(im, Image.new('RGB', im.size, 'white')).convert('L').point(lambda v: 255 if v > 12 else 0).getbbox()
    im.crop(box).save(f.replace('page-', 'trim-'))
PY
cp ../voice/v2/af_heart-*.wav $D/voice/ && cp ../voice/v2/words.json src/v2/words.json

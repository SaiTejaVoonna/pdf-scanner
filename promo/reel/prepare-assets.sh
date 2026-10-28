#!/usr/bin/env bash
# Copies the captured screenshots, the exported PDF pages, the voice, and the music and sound effects into public/.
set -euo pipefail
cd "$(dirname "$0")"; C=../capture/final; A=../../.claude/skills/video-shotcraft/assets/audio
mkdir -p public/shots public/pdf public/sfx public/music
cp $C/*.png public/shots/ && cp $C/layout.json src/layout.json
cp ../capture/docs/photo-report.jpg public/
pdftoppm -r 150 -png $C/reel.pdf public/pdf/page
python3 - <<'PY'
from PIL import Image, ImageChops
import glob
for f in sorted(glob.glob('public/pdf/page-*.png')):  # trim the white bands A4 adds around a photo
    im = Image.open(f).convert('RGB'); box = ImageChops.difference(im, Image.new('RGB', im.size, 'white')).convert('L').point(lambda v: 255 if v > 12 else 0).getbbox()
    im.crop(box).save(f.replace('page-', 'trim-'))
PY
for s in ui/switch-tap paper/paper-slide paper/paper-page-turn transition/whoosh-fast transition/air-zoom-vacuum light/sparkle-touch light/shimmer-sparkle-sweep impact/impact-zoom-quick; do cp $A/sfx/$s.mp3 public/sfx/; done
cp $A/bgm/house-vibez.mp3 public/music/
mkdir -p public/voice && cp ../voice/af_heart-*.wav public/voice/

"""Downloads the CC BY 4.0 "New Image Dataset for Document Corner Localization" (Mendeley Data x3nm4cxr83 v3, cite
https://ieeexplore.ieee.org/abstract/document/9116896/) and keeps a 640 px copy of each photo with its four corners.
Usage: python3 -I fetch_mendeley.py OUT_DIR. The photos are not stored in the repository."""
import concurrent.futures as cf, io, json, pathlib, sys, urllib.request
from PIL import Image, ImageOps

API = 'https://data.mendeley.com/public-api/datasets/x3nm4cxr83'
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
get = lambda url: urllib.request.urlopen(url, timeout=120).read()
root = json.loads(get(f'{API}/folders/3?version=3'))[0]['id']
files = json.loads(get(f'{API}/files?folder_id={root}&version=3'))
by = {}
for f in files:
    stem, ext = f['filename'].rsplit('.', 1)
    by.setdefault(stem, {})[ext.lower()] = f['content_details']['download_url']

def one(stem):
    d = by[stem]
    dst = out / f'{stem.strip("()")}.jpg'
    if dst.exists() or 'jpg' not in d or 'csv' not in d: return None
    vals = get(d['csv']).decode().strip().split(',')[:8]
    im = Image.open(io.BytesIO(get(d['jpg'])))
    W, H = im.size  # the corners are given in stored pixel coordinates (no EXIF rotation applied)
    pts = [[float(vals[i]) / W, float(vals[i + 1]) / H] for i in range(0, 8, 2)]
    im = im.convert('RGB'); im.thumbnail((640, 640)); im.save(dst, quality=90)
    return stem.strip('()'), pts

meta = {}
with cf.ThreadPoolExecutor(8) as ex:
    for r in ex.map(one, sorted(by)):
        if r: meta[r[0]] = r[1]
old = json.loads((out / 'corners.json').read_text()) if (out / 'corners.json').exists() else {}
old.update(meta); (out / 'corners.json').write_text(json.dumps(old))
print(len(old), 'photos')

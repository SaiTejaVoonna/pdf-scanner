"""Downloads the CC BY 4.0 "New Image Dataset for Document Corner Localization" (Mendeley Data x3nm4cxr83 v3, cite
https://ieeexplore.ieee.org/abstract/document/9116896/) and keeps a 640 px copy of each photo with its four corners.
Usage: python3 -I fetch_mendeley.py OUT_DIR. The photos are not stored in the repository."""
import concurrent.futures as cf, io, json, pathlib, sys, time, urllib.request
from PIL import Image, ImageOps

API = 'https://data.mendeley.com/public-api/datasets/x3nm4cxr83'
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
def get(url):
    for attempt in range(5):  # the server drops connections now and then
        try: return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=120).read()
        except Exception:  # resets and cut-off downloads
            if attempt == 4: raise
            time.sleep(2 ** attempt)
root = json.loads(get(f'{API}/folders/3?version=3'))[0]['id']
files = json.loads(get(f'{API}/files?folder_id={root}&version=3'))
by = {}
for f in files:
    stem, ext = f['filename'].rsplit('.', 1)
    by.setdefault(stem, {})[ext.lower()] = f['content_details']['download_url']

def one(stem):
    d = by[stem]
    name = stem.strip('()'); dst = out / f'{name}.jpg'; side = out / f'{name}.json'
    if side.exists() and dst.exists(): return name, json.loads(side.read_text())
    if 'jpg' not in d or 'csv' not in d: return None
    try:
        vals = get(d['csv']).decode().strip().split(',')[:8]
        im = Image.open(io.BytesIO(get(d['jpg'])))
    except Exception as e:
        print('skipped', name, e, flush=True); return None
    xy = [float(v) for v in vals]
    # Portrait photos store the camera's rotation in EXIF; their corners refer to the upright picture. Use the frame they fit in.
    up = ImageOps.exif_transpose(im)
    if max(xy[0::2]) <= up.size[0] * 1.01 and max(xy[1::2]) <= up.size[1] * 1.01: im = up
    W, H = im.size
    pts = [[xy[i] / W, xy[i + 1] / H] for i in range(0, 8, 2)]
    im = im.convert('RGB'); im.thumbnail((640, 640)); im.save(dst, quality=90); side.write_text(json.dumps(pts))
    return name, pts

meta = {}
with cf.ThreadPoolExecutor(4) as ex:
    for r in ex.map(one, sorted(by)):
        if r: meta[r[0]] = r[1]
(out / 'corners.json').write_text(json.dumps(meta))
print(len(meta), 'photos')

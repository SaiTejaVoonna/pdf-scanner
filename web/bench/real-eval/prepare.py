"""Downloads one test shard of the public mapo80/DocCornerDataset and writes small RGBA copies plus the true corners.
Usage: python3 -I prepare.py OUT_DIR [COUNT]. Needs: pip install pyarrow pillow."""
import io, json, sys, urllib.request, pathlib
import pyarrow.parquet as pq
from PIL import Image

out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
count = int(sys.argv[2]) if len(sys.argv) > 2 else 300
shard = out / 'test0.parquet'
if not shard.exists():
    urllib.request.urlretrieve('https://huggingface.co/datasets/mapo80/DocCornerDataset/resolve/main/test/data-00000.parquet', shard)
rows = [r for r in pq.read_table(shard).to_pylist() if not r['is_negative']][:count]
meta, blob = [], bytearray()
for r in rows:
    im = Image.open(io.BytesIO(r['image']['bytes'])).convert('RGBA')
    im.thumbnail((400, 400)); w, h = im.size
    blob += im.tobytes()
    q = [[r['corner_tl_x'], r['corner_tl_y']], [r['corner_tr_x'], r['corner_tr_y']], [r['corner_br_x'], r['corner_br_y']], [r['corner_bl_x'], r['corner_bl_y']]]
    meta.append({'name': r['filename'], 'w': w, 'h': h, 'gt': q})
(out / 'eval.rgba').write_bytes(bytes(blob)); (out / 'eval.json').write_text(json.dumps(meta))
print(f'{len(meta)} images written to {out}')

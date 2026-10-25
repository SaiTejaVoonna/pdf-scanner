import io, sys, numpy as np, pyarrow.parquet as pq
from PIL import Image
sys.path.insert(0, '.'); import gen
rows = pq.read_table('../dcd/test0.parquet').to_pylist()
X = np.zeros((len(rows), 192, 192, 3), np.uint8); Y = np.zeros((len(rows), 8), np.float32); P = np.zeros(len(rows), np.float32); cat = []
for i, r in enumerate(rows):
    X[i] = np.array(Image.open(io.BytesIO(r['image']['bytes'])).convert('RGB').resize((192, 192), Image.BILINEAR))
    cat.append(r['filename'].split('_')[0])
    if not r['is_negative']:
        q = np.array([[r['corner_tl_x'], r['corner_tl_y']], [r['corner_tr_x'], r['corner_tr_y']], [r['corner_br_x'], r['corner_br_y']], [r['corner_bl_x'], r['corner_bl_y']]], np.float32)
        Y[i] = gen.canonical(q).reshape(-1); P[i] = 1
np.savez('exam.npz', X=X, Y=Y, P=P, cat=np.array(cat)); print(X.shape, P.mean())

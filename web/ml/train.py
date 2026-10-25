import sys, time, numpy as np, torch, torch.nn.functional as F, cv2, glob
sys.path.insert(0, '.'); from model import CornerNet; import gen
torch.set_num_threads(int(__import__("os").environ.get("THREADS","4"))); torch.manual_seed(0); np.random.seed(0)
EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 12
tr = [np.load(f) for f in sorted(glob.glob('train_*.npz'))]
X = np.concatenate([t['X'] for t in tr]); Y = np.concatenate([t['Y'] for t in tr]); P = np.concatenate([t['P'] for t in tr])
v = np.load('val.npz'); ex = np.load('exam.npz')
print('train', X.shape, 'pos', P.mean(), flush=True)
mean, std = 0.5, 0.25
def prep(x): return ((torch.from_numpy(x).permute(0, 3, 1, 2).float() / 255) - mean) / std

def canon_batch(Yb):   # corners back into tl,tr,br,bl by position after a flip
    out = np.zeros_like(Yb)
    for i, y in enumerate(Yb): out[i] = gen.canonical(y.reshape(4, 2)).reshape(-1)
    return out

def poly_iou(a, b, S=96):
    ma = np.zeros((S, S), np.uint8); mb = np.zeros((S, S), np.uint8)
    cv2.fillPoly(ma, [(a.reshape(4, 2) * S).astype(np.int32)], 1); cv2.fillPoly(mb, [(b.reshape(4, 2) * S).astype(np.int32)], 1)
    return (ma & mb).sum() / max(1, (ma | mb).sum())

net = CornerNet(); opt = torch.optim.AdamW(net.parameters(), 3e-3, weight_decay=1e-4)
steps = EPOCHS * (len(X) // 64); sched = torch.optim.lr_scheduler.OneCycleLR(opt, 3e-3, total_steps=steps, pct_start=0.15)

def predict(Xs):
    net.eval(); qs, ps = [], []
    with torch.no_grad():
        for i in range(0, len(Xs), 128):
            q, p, _ = net(prep(Xs[i:i + 128])); qs.append(q.numpy()); ps.append(torch.sigmoid(p).numpy())
    net.train(); return np.concatenate(qs), np.concatenate(ps)

def report(name, d, thr=0.5):
    q, p = predict(d['X']); pos = d['P'] > 0
    iou = np.array([poly_iou(q[i], d['Y'][i]) if pos[i] else 0 for i in range(len(q))])
    green = p > thr
    print(f"  {name}: positives n={pos.sum()} IoU>=0.9 {100*(iou[pos]>=0.9).mean():.0f}%  >=0.8 {100*(iou[pos]>=0.8).mean():.0f}%  mean {iou[pos].mean():.2f} | green {100*green[pos].mean():.0f}% of pages; FALSE-GREEN (green & IoU<0.8) {100*(green[pos]&(iou[pos]<0.8)).mean():.0f}% of pages; green on no-page {100*green[~pos].mean() if (~pos).any() else 0:.0f}%", flush=True)
    return iou

import os
t0 = time.time(); start = 0
if os.path.exists('ckpt.pt'):
    ck = torch.load('ckpt.pt'); net.load_state_dict(ck['net']); opt.load_state_dict(ck['opt']); sched.load_state_dict(ck['sched']); start = ck['ep']; print('resumed at', start, flush=True)
for ep in range(start, EPOCHS):
    perm = np.random.permutation(len(X)); tot = 0; nb = 0
    for i in range(0, len(perm) - 63, 64):
        idx = perm[i:i + 64]; xb, yb, pb = X[idx].copy(), Y[idx].copy(), P[idx]
        # augmentation: flips (corners are re-labelled by position), colour jitter
        if np.random.rand() < 0.5: xb = xb[:, :, ::-1]; yb = yb.reshape(-1, 4, 2); yb[..., 0] = 1 - yb[..., 0]; yb = canon_batch(yb.reshape(-1, 8))
        if np.random.rand() < 0.3: xb = xb[:, ::-1]; yb = yb.reshape(-1, 4, 2); yb[..., 1] = 1 - yb[..., 1]; yb = canon_batch(yb.reshape(-1, 8))
        xt = prep(np.ascontiguousarray(xb)); xt = xt * torch.empty(len(idx), 1, 1, 1).uniform_(0.85, 1.15) + torch.empty(len(idx), 3, 1, 1).uniform_(-0.1, 0.1)
        q, p, var = net(xt); yt = torch.from_numpy(yb); pt = torch.from_numpy(pb); m = pt > 0
        loss = F.binary_cross_entropy_with_logits(p, pt) * 0.5
        if m.any(): loss = loss + F.smooth_l1_loss(q[m], yt[m], beta=0.02) * 20 + var[m].mean() * 2
        opt.zero_grad(); loss.backward(); opt.step(); sched.step(); tot += loss.item(); nb += 1
    print(f'epoch {ep+1}/{EPOCHS} loss {tot/nb:.4f} time {time.time()-t0:.0f}s', flush=True)
    torch.save({'net': net.state_dict(), 'opt': opt.state_dict(), 'sched': sched.state_dict(), 'ep': ep + 1}, 'ckpt.pt')
    if (ep + 1) % 2 == 0 or ep + 1 == EPOCHS:
        report('synthetic val', v); report('REAL exam ', ex); torch.save(net.state_dict(), 'net.pt')
torch.save(net.state_dict(), 'net.pt')

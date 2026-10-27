"""Trains CornerNet2 (model2.py). Same data and augmentation as train.py, plus the page-mask target, and optional real photos:
REAL=dir with corners.json + <name>.jpg (licensed or the owner's own photos), mixed in at REAL_SHARE of every batch.
Resumable (ckpt2.pt). Reports the real-photo exam every second epoch, with 'green' decided by the mask check."""
import glob, json, os, sys, time, numpy as np, torch, torch.nn.functional as F, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from model2 import CornerNet2; import gen
torch.set_num_threads(int(os.environ.get('THREADS', '4'))); torch.manual_seed(0); np.random.seed(0)
EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 12
tr = [np.load(f) for f in sorted(glob.glob('train_*.npz'))]
X = np.concatenate([t['X'] for t in tr]); Y = np.concatenate([t['Y'] for t in tr]); P = np.concatenate([t['P'] for t in tr])
v = np.load('val.npz'); ex = np.load('exam.npz')
RX, RY = np.zeros((0, 192, 192, 3), np.uint8), np.zeros((0, 8), np.float32)
if os.environ.get('REAL'):
    d = os.environ['REAL']; c = json.load(open(f'{d}/corners.json'))
    RX = np.stack([cv2.resize(cv2.cvtColor(cv2.imread(f'{d}/{k}.jpg'), cv2.COLOR_BGR2RGB), (192, 192), interpolation=cv2.INTER_AREA) for k in c])
    RY = np.stack([gen.canonical(np.array(q, np.float32)).reshape(-1) for q in c.values()]).astype(np.float32)
SHARE = float(os.environ.get('REAL_SHARE', '0.25')) if len(RX) else 0
print('train', X.shape, 'real', RX.shape, flush=True)
mean, std, HM = 0.5, 0.25, 48
prep = lambda x: ((torch.from_numpy(np.ascontiguousarray(x)).permute(0, 3, 1, 2).float() / 255) - mean) / std
canon = lambda Yb: np.stack([gen.canonical(y.reshape(4, 2)).reshape(-1) for y in Yb]).astype(np.float32)

def masks(Yb, Pb, S=HM):
    m = np.zeros((len(Yb), S, S), np.float32)
    for i in range(len(Yb)):
        if Pb[i] > 0: cv2.fillPoly(m[i], [np.round(Yb[i].reshape(4, 2) * S * 8).astype(np.int32)], 1, shift=3)
    return torch.from_numpy(m)

def poly_iou(a, b, S=96):
    ma = np.zeros((S, S), np.uint8); mb = np.zeros((S, S), np.uint8)
    cv2.fillPoly(ma, [(a.reshape(4, 2) * S).astype(np.int32)], 1); cv2.fillPoly(mb, [(b.reshape(4, 2) * S).astype(np.int32)], 1)
    return (ma & mb).sum() / max(1, (ma | mb).sum())

net = CornerNet2(); opt = torch.optim.AdamW(net.parameters(), 3e-3, weight_decay=1e-4)
steps = EPOCHS * (len(X) // 64); sched = torch.optim.lr_scheduler.OneCycleLR(opt, 3e-3, total_steps=steps, pct_start=0.15)

def predict(Xs):
    net.eval(); qs, ps, ms = [], [], []
    with torch.no_grad():
        for i in range(0, len(Xs), 128):
            q, p, _, m = net(prep(Xs[i:i + 128])); qs.append(q.numpy()); ps.append(torch.sigmoid(p).numpy()); ms.append(torch.sigmoid(m).numpy())
    net.train(); return np.concatenate(qs), np.concatenate(ps), np.concatenate(ms)

def agree(q, m):
    """Overlap of the corner outline with the predicted page mask: the self-check behind 'green'."""
    a = np.zeros((HM, HM), np.uint8); cv2.fillPoly(a, [np.round(q.reshape(4, 2) * HM * 8).astype(np.int32)], 1, shift=3)
    b = m > 0.5; return (a & b).sum() / max(1, (a | b).sum())

def report(name, d):
    q, p, m = predict(d['X']); pos = d['P'] > 0
    iou = np.array([poly_iou(q[i], d['Y'][i]) if pos[i] else 0 for i in range(len(q))])
    ag = np.array([agree(q[i], m[i]) for i in range(len(q))])
    for label, green in (('presence', p > 0.5), ('presence+mask', (p > 0.5) & (ag > 0.9))):
        print(f"  {name} [{label}]: n={pos.sum()} IoU>=0.9 {100*(iou[pos]>=0.9).mean():.0f}%  >=0.8 {100*(iou[pos]>=0.8).mean():.0f}%  mean {iou[pos].mean():.2f} | green {100*green[pos].mean():.0f}%  FALSE-GREEN {100*(green[pos]&(iou[pos]<0.8)).mean():.0f}%  green on no-page {100*green[~pos].mean() if (~pos).any() else 0:.0f}%", flush=True)

t0 = time.time(); start = 0
if os.path.exists('ckpt2.pt'):
    ck = torch.load('ckpt2.pt'); net.load_state_dict(ck['net']); opt.load_state_dict(ck['opt']); sched.load_state_dict(ck['sched']); start = ck['ep']; print('resumed at', start, flush=True)
for ep in range(start, EPOCHS):
    perm = np.random.permutation(len(X)); tot = 0; nb = 0
    for i in range(0, len(perm) - 63, 64):
        idx = perm[i:i + 64]; xb, yb, pb = X[idx].copy(), Y[idx].copy(), P[idx].copy()
        nr = int(round(64 * SHARE))
        if nr:
            j = np.random.randint(0, len(RX), nr); xb[:nr], yb[:nr], pb[:nr] = RX[j], RY[j], 1
            if np.random.rand() < 0.5:  # a quarter turn, so real photos in any orientation are learned
                xb[:nr] = np.rot90(xb[:nr], 1, (1, 2)); r = yb[:nr].reshape(-1, 4, 2).copy(); yb[:nr] = canon(np.stack([r[..., 1], 1 - r[..., 0]], -1).reshape(-1, 8))
        if np.random.rand() < 0.5: xb = xb[:, :, ::-1]; r = yb.reshape(-1, 4, 2); r[..., 0] = 1 - r[..., 0]; yb = canon(r.reshape(-1, 8))
        if np.random.rand() < 0.3: xb = xb[:, ::-1]; r = yb.reshape(-1, 4, 2); r[..., 1] = 1 - r[..., 1]; yb = canon(r.reshape(-1, 8))
        xt = prep(xb) * torch.empty(64, 1, 1, 1).uniform_(0.85, 1.15) + torch.empty(64, 3, 1, 1).uniform_(-0.1, 0.1)
        q, p, var, m = net(xt); yt = torch.from_numpy(yb); pt = torch.from_numpy(pb); pos = pt > 0
        loss = F.binary_cross_entropy_with_logits(p, pt) * 0.5 + F.binary_cross_entropy_with_logits(m, masks(yb, pb)) * 0.5
        if pos.any(): loss = loss + F.smooth_l1_loss(q[pos], yt[pos], beta=0.01) * 20 + var[pos].mean() * 2
        opt.zero_grad(); loss.backward(); opt.step(); sched.step(); tot += loss.item(); nb += 1
    print(f'epoch {ep+1}/{EPOCHS} loss {tot/nb:.4f} time {time.time()-t0:.0f}s', flush=True)
    torch.save({'net': net.state_dict(), 'opt': opt.state_dict(), 'sched': sched.state_dict(), 'ep': ep + 1}, 'ckpt2.pt')
    if (ep + 1) % 2 == 0 or ep + 1 == EPOCHS:
        report('synthetic val', v); report('REAL exam', ex); torch.save(net.state_dict(), 'net2.pt')
torch.save(net.state_dict(), 'net2.pt')

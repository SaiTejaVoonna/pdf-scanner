"""Model-only comparison: the shipped model (net_r1_ep2.pt) against an engine v2 checkpoint (ckpt2.pt) on the real exam and the
held-back licensed photos. Run from the training folder: python3 -I compare_models.py"""
import json, sys, numpy as np, torch, cv2
sys.path.insert(0, '.'); from model import CornerNet; from model2 import CornerNet2; import gen
torch.set_num_threads(4)
prep = lambda x: ((torch.from_numpy(np.ascontiguousarray(x)).permute(0, 3, 1, 2).float() / 255) - 0.5) / 0.25
def poly(q, S): m = np.zeros((S, S), np.uint8); cv2.fillPoly(m, [np.round(q.reshape(4, 2) * S * 8).astype(np.int32)], 1, shift=3); return m
def iou(a, b, S=128): ma, mb = poly(a, S), poly(b, S); return (ma & mb).sum() / max(1, (ma | mb).sum())
def load_real(d):
    c = json.load(open(f'{d}/corners.json'))
    X = np.stack([cv2.resize(cv2.cvtColor(cv2.imread(f'{d}/{k}.jpg'), cv2.COLOR_BGR2RGB), (192, 192), interpolation=cv2.INTER_AREA) for k in c])
    Y = np.stack([gen.canonical(np.array(q, np.float32)).reshape(-1) for q in c.values()]); return X, Y, np.ones(len(X))
ex = np.load('exam.npz'); sets = {'real exam (877 pages + 123 no-page)': (ex['X'], ex['Y'], ex['P']), 'held-back Mendeley (60)': load_real('../mend_val')}
old = CornerNet(); old.load_state_dict(torch.load('net_r1_ep2.pt')); old.eval()
new = CornerNet2(); ck = torch.load('ckpt2.pt'); new.load_state_dict(ck['net']); new.eval()
print('new model checkpoint: epoch', ck['ep'], 'batch', ck.get('batch'))
for name, (X, Y, P) in sets.items():
    pos = P > 0
    for label, net in (('shipped', old), ('v2-in-progress', new)):
        qs, ps, ms = [], [], []
        with torch.no_grad():
            for i in range(0, len(X), 100):
                o = net(prep(X[i:i+100])); qs.append(o[0].numpy()); ps.append(torch.sigmoid(o[1]).numpy())
                if len(o) > 3: ms.append(torch.sigmoid(o[3]).numpy())
        q, p = np.concatenate(qs), np.concatenate(ps)
        I = np.array([iou(q[i], Y[i]) if pos[i] else 0 for i in range(len(q))])
        green = p > 0.5
        if ms:
            m = np.concatenate(ms)
            ag = np.array([(lambda a, b: (a & b).sum() / max(1, (a | b).sum()))(poly(q[i], 48), m[i] > 0.5) for i in range(len(q))])
            green = green & (ag > 0.9)
        print(f'{name:38s} {label:15s} IoU>=0.9 {100*(I[pos]>=0.9).mean():3.0f}%  >=0.8 {100*(I[pos]>=0.8).mean():3.0f}%  mean {I[pos].mean():.2f} | green {100*green[pos].mean():3.0f}%  FALSE-GREEN {100*(green[pos]&(I[pos]<0.8)).mean():3.0f}%' + (f'  green on no-page {100*green[~pos].mean():.0f}%' if (~pos).any() else ''))

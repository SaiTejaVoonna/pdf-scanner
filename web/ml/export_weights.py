"""Exports a trained corner model for the browser: BatchNorm folded into the convolutions, all weights in one small file.
Handles both networks and tells them apart by the weights file: CornerNet (model.py, engine v1) and CornerNet2 (model2.py,
engine v2: 48 x 48 corner heat maps, a page mask, a presence score).

    python3 export_weights.py net.pt  ../public/model/corners.bin  ../tests/fixtures/model-parity.json
    python3 export_weights.py net2.pt ../public/model/corners2.bin ../tests/fixtures/model2-parity.json

File layout: uint32 (little endian) JSON length, the JSON manifest, space padding to a multiple of 4, then the float32 weights.
The manifest of a v2 file has "arch": 2 (a v1 file has no "arch"). Tensor names follow the model: stem, s1.0.expand / .dw /
.project, ..., then for v1 lat, up, fuse.0, fuse.1, pres and for v2 l48, l24, l12, l6, fuse.0, fuse.1, fuse.2, pres; each has a
".w" and a ".b".

The parity fixture holds the outputs of the PyTorch model for a fixed synthetic input, so the TypeScript inference
(src/modelNet.ts) can be checked against it in a unit test. For v2 it also holds "mask": the 48 x 48 page-mask logits, row by row.

Before it finishes, the script reads the written file back and runs the network from those folded weights alone, and stops with
an error if the result differs from the PyTorch model: a wrong fold or a wrong offset cannot pass silently.
"""
import json, os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import torch, torch.nn.functional as F
from model import CornerNet
from model2 import CornerNet2

def fold(conv, bn):
    w = conv.weight.detach().double()
    scale = bn.weight.detach().double() / torch.sqrt(bn.running_var.detach().double() + bn.eps)
    b = bn.bias.detach().double() - bn.running_mean.detach().double() * scale
    return (w * scale.view(-1, 1, 1, 1)).float().numpy(), b.float().numpy()

def plain(layer): return layer.weight.detach().float().numpy(), layer.bias.detach().float().numpy()

def parity_input(size=192):
    i = np.arange(3 * size * size, dtype=np.float64)
    return (np.sin(i * 0.001) * 1.5 + np.cos(i * 0.0137)).astype(np.float32).reshape(1, 3, size, size)

def collect(m, v2):
    """Every layer of the model as name -> (weight, bias), BatchNorm folded in."""
    t = {}
    def cbr(path, seq): t[path] = fold(seq[0], seq[1])
    cbr('stem', m.stem)
    order = ('s1', 's2', 's3', 's4') if v2 else ('s1', 's3', 's4', 's2')   # v1 keeps its old order, so its file stays byte-identical
    for si in order:
        for i, ir in enumerate(getattr(m, si)):
            p = f'{si}.{i}'
            cbr(f'{p}.expand', ir.body[0]); cbr(f'{p}.dw', ir.body[1]); t[f'{p}.project'] = fold(ir.body[2], ir.body[3])
    if v2:
        cbr('l48', m.l48); cbr('l24', m.l24); cbr('l12', m.l12); cbr('l6', m.l6)
        cbr('fuse.0', m.fuse[0]); cbr('fuse.1', m.fuse[1]); t['fuse.2'] = plain(m.fuse[2])
    else:
        cbr('lat', m.lat); cbr('up', m.up); cbr('fuse.0', m.fuse[0]); t['fuse.1'] = plain(m.fuse[1])
    t['pres'] = plain(m.pres)
    return t

def read_bin(path):
    """The written file back as (manifest, name -> array)."""
    buf = open(path, 'rb').read(); n = struct.unpack('<I', buf[:4])[0]
    man = json.loads(buf[4:4 + n]); flat = np.frombuffer(buf, '<f4', offset=4 + n)
    return man, {e['name']: torch.from_numpy(flat[e['offset']:e['offset'] + int(np.prod(e['shape']))].reshape(e['shape']).copy()) for e in man['tensors']}

def run_folded(man, t, x):
    """The network run from the exported (folded) weights only. This is the recipe the TypeScript port follows."""
    def conv(x, name, stride=1, dw=False, relu=True):
        w = t[name + '.w']; y = F.conv2d(x, w, t[name + '.b'], stride, w.shape[-1] // 2, groups=x.shape[1] if dw else 1)
        return y.clamp(0, 6) if relu else y
    def ir(x, p, stride):
        y = conv(conv(conv(x, p + '.expand'), p + '.dw', stride, True), p + '.project', relu=False)
        return x + y if stride == 1 and x.shape[1] == y.shape[1] else y
    def stage(x, s, n, first_stride):
        for i in range(n): x = ir(x, f'{s}.{i}', first_stride if i == 0 else 1)
        return x
    up = lambda a, ref: F.interpolate(a, size=ref.shape[-2:], mode='bilinear', align_corners=False)
    x = conv(x, 'stem', 2); mask = None
    if man.get('arch') == 2:
        f48 = stage(x, 's1', 2, 2); f24 = stage(f48, 's2', 3, 2); f12 = stage(f24, 's3', 3, 2); top = stage(f12, 's4', 3, 2)
        p = conv(f12, 'l12') + up(conv(top, 'l6'), f12); p = conv(f24, 'l24') + up(p, f24); p = conv(f48, 'l48') + up(p, f48)
        out = conv(conv(conv(p, 'fuse.0'), 'fuse.1'), 'fuse.2', relu=False); h, mask = out[:, :4], out[0, 4]
    else:
        f24 = stage(stage(x, 's1', 2, 2), 's2', 2, 2); top = stage(stage(f24, 's3', 3, 2), 's4', 2, 1)
        h = conv(conv(conv(f24, 'lat') + up(conv(top, 'up'), f24), 'fuse.0'), 'fuse.1', relu=False)
    hm = man['hm']; pr = F.softmax(h.reshape(1, 4, -1), -1).reshape(1, 4, hm, hm)
    g = (torch.arange(hm, dtype=torch.float32) + 0.5) / hm
    px = (pr.sum(2) * g).sum(-1); py = (pr.sum(3) * g).sum(-1)
    var = (pr.sum(2) * (g - px[..., None]) ** 2).sum(-1) + (pr.sum(3) * (g - py[..., None]) ** 2).sum(-1)
    logit = top.mean((2, 3)) @ t['pres.w'].T + t['pres.b']
    return torch.stack([px, py], -1).reshape(8), logit.reshape(()), var[0], mask

def main(net_path, out_bin, out_fixture):
    state = torch.load(net_path, map_location='cpu')
    v2 = 'l48.0.weight' in state
    m = CornerNet2() if v2 else CornerNet()
    m.load_state_dict(state); m.eval()
    tensors = collect(m, v2)
    manifest, blobs, off = {'input': 192, 'hm': m.hm, 'mean': 0.5, 'std': 0.25, 'tensors': []}, [], 0
    if v2: manifest['arch'] = 2
    for name, (w, b) in tensors.items():
        for kind, arr in (('w', w), ('b', b)):
            a = np.ascontiguousarray(arr, dtype='<f4')
            manifest['tensors'].append({'name': f'{name}.{kind}', 'shape': list(a.shape), 'offset': off}); blobs.append(a.tobytes()); off += a.size
    head = json.dumps(manifest, separators=(',', ':')).encode()
    head += b' ' * ((-len(head)) % 4)
    with open(out_bin, 'wb') as f:
        f.write(struct.pack('<I', len(head))); f.write(head)
        for b in blobs: f.write(b)
    x = torch.from_numpy(parity_input())
    with torch.no_grad():
        ref = m(x); got = run_folded(*read_bin(out_bin), x)
    ref = (ref[0][0], ref[1][0], ref[2][0]) + ((ref[3][0],) if v2 else (None,))
    worst = max(float((a - b).abs().max()) for a, b in zip(ref, got) if a is not None)
    if worst > 1e-3: sys.exit(f'export check FAILED: the written file differs from the PyTorch model by {worst:.2e}')
    fixture = {'corners': ref[0].tolist(), 'presenceLogit': float(ref[1]), 'var': ref[2].tolist()}
    if v2: fixture['mask'] = ref[3].reshape(-1).tolist()
    json.dump(fixture, open(out_fixture, 'w'))
    print('engine', 'v2' if v2 else 'v1', 'tensors', len(manifest['tensors']), 'floats', off, 'bytes', 4 + len(head) + off * 4,
          'read-back check: largest difference', f'{worst:.1e}')

if __name__ == '__main__': main(*sys.argv[1:4])

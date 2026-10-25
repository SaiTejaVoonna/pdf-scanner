"""Exports a trained CornerNet (model.py) for the browser: BatchNorm folded into the convolutions, all weights in one small file.

    python3 export_weights.py net.pt ../public/model/corners.bin ../tests/fixtures/model-parity.json

File layout of corners.bin: uint32 (little endian) JSON length, the JSON manifest, zero padding to a multiple of 4, then the
float32 weights. The parity fixture holds the outputs of the PyTorch model for a fixed synthetic input, so the TypeScript
inference (src/modelNet.ts) can be checked against it in a unit test.
"""
import json, os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import torch
from model import CornerNet

def fold(conv, bn):
    w = conv.weight.detach().double()
    scale = bn.weight.detach().double() / torch.sqrt(bn.running_var.detach().double() + bn.eps)
    b = bn.bias.detach().double() - bn.running_mean.detach().double() * scale
    return (w * scale.view(-1, 1, 1, 1)).float().numpy(), b.float().numpy()

def parity_input(size=192):
    i = np.arange(3 * size * size, dtype=np.float64)
    return (np.sin(i * 0.001) * 1.5 + np.cos(i * 0.0137)).astype(np.float32).reshape(1, 3, size, size)

def main(net_path, out_bin, out_fixture):
    m = CornerNet(); m.load_state_dict(torch.load(net_path)); m.eval()
    tensors = {}
    def cbr(path, seq): tensors[path] = fold(seq[0], seq[1])
    cbr('stem', m.stem)
    for si, seq in (('s1', m.s1), ('s3', m.s3), ('s4', m.s4)):
        for i, ir in enumerate(seq):
            p = f'{si}.{i}'
            cbr(f'{p}.expand', ir.body[0]); cbr(f'{p}.dw', ir.body[1]); tensors[f'{p}.project'] = fold(ir.body[2], ir.body[3])
    for i, ir in enumerate(m.s2):
        p = f's2.{i}'
        cbr(f'{p}.expand', ir.body[0]); cbr(f'{p}.dw', ir.body[1]); tensors[f'{p}.project'] = fold(ir.body[2], ir.body[3])
    cbr('lat', m.lat); cbr('up', m.up); cbr('fuse.0', m.fuse[0])
    tensors['fuse.1'] = (m.fuse[1].weight.detach().float().numpy(), m.fuse[1].bias.detach().float().numpy())
    tensors['pres'] = (m.pres.weight.detach().float().numpy(), m.pres.bias.detach().float().numpy())
    manifest, blobs, off = {'input': 192, 'hm': m.hm, 'mean': 0.5, 'std': 0.25, 'tensors': []}, [], 0
    for name, (w, b) in tensors.items():
        for kind, arr in (('w', w), ('b', b)):
            a = np.ascontiguousarray(arr, dtype='<f4')
            manifest['tensors'].append({'name': f'{name}.{kind}', 'shape': list(a.shape), 'offset': off}); blobs.append(a.tobytes()); off += a.size
    head = json.dumps(manifest, separators=(',', ':')).encode()
    head += b' ' * ((-len(head)) % 4)
    with open(out_bin, 'wb') as f:
        f.write(struct.pack('<I', len(head))); f.write(head)
        for b in blobs: f.write(b)
    x = parity_input()
    with torch.no_grad(): q, p, v = m(torch.from_numpy(x))
    json.dump({'corners': q[0].tolist(), 'presenceLogit': float(p[0]), 'var': v[0].tolist()}, open(out_fixture, 'w'))
    print('tensors', len(manifest['tensors']), 'floats', off, 'bytes', 4 + len(head) + off * 4)

if __name__ == '__main__': main(*sys.argv[1:4])

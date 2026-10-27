import torch, torch.nn as nn, torch.nn.functional as F
from model import cbr, IR

class CornerNet2(nn.Module):
    """Engine v2: twice as wide as CornerNet and twice as sharp. Four corner heat maps at 48 x 48 (one cell = 4 px of the 192 px
    input, CornerNet used 8 px), read out with a soft-argmax, plus a page mask (which pixels are page) used to check the corners,
    and a 'there is a page' score. About 0.9 M parameters, 3.5 MB."""
    def __init__(self, hm=48):
        super().__init__(); self.hm = hm
        self.stem = cbr(3, 24, 3, 2)                                              # 96
        self.s1 = nn.Sequential(IR(24, 32, 2, 2), IR(32, 32, 1))                  # 48
        self.s2 = nn.Sequential(IR(32, 48, 2), IR(48, 48, 1), IR(48, 48, 1))      # 24
        self.s3 = nn.Sequential(IR(48, 96, 2), IR(96, 96, 1), IR(96, 96, 1))      # 12
        self.s4 = nn.Sequential(IR(96, 128, 2), IR(128, 128, 1), IR(128, 160, 1)) # 6: whole-page context
        self.l48 = cbr(32, 48, 1); self.l24 = cbr(48, 48, 1); self.l12 = cbr(96, 48, 1); self.l6 = cbr(160, 48, 1)
        self.fuse = nn.Sequential(cbr(48, 48, 3), cbr(48, 48, 3), nn.Conv2d(48, 5, 1))   # 4 corners + mask
        self.pres = nn.Linear(160, 1)
    def forward(self, x):
        up = lambda t, ref: F.interpolate(t, size=ref.shape[-2:], mode='bilinear', align_corners=False)
        f48 = self.s1(self.stem(x)); f24 = self.s2(f48); f12 = self.s3(f24); f6 = self.s4(f12)
        p = self.l12(f12) + up(self.l6(f6), f12); p = self.l24(f24) + up(p, f24); p = self.l48(f48) + up(p, f48)
        out = self.fuse(p); h, mask = out[:, :4], out[:, 4]
        b = h.shape[0]; pr = F.softmax(h.reshape(b, 4, -1), -1).reshape(b, 4, self.hm, self.hm)
        g = (torch.arange(self.hm, dtype=torch.float32, device=x.device) + 0.5) / self.hm
        px = (pr.sum(2) * g).sum(-1); py = (pr.sum(3) * g).sum(-1)
        var = (pr.sum(2) * (g - px[..., None]) ** 2).sum(-1) + (pr.sum(3) * (g - py[..., None]) ** 2).sum(-1)
        return torch.stack([px, py], -1).reshape(b, 8), self.pres(f6.mean((2, 3))).squeeze(-1), var, mask

if __name__ == '__main__':
    import time
    m = CornerNet2(); print(sum(p.numel() for p in m.parameters()), 'parameters')
    x = torch.randn(1, 3, 192, 192); m.eval(); t = time.time()
    with torch.no_grad():
        for _ in range(20): m(x)
    print('ms per image (batch 1):', round((time.time() - t) * 50, 1))
    from model import CornerNet; m0 = CornerNet().eval(); t = time.time()
    with torch.no_grad():
        for _ in range(20): m0(x)
    print('old model ms:', round((time.time() - t) * 50, 1))

import torch, torch.nn as nn, torch.nn.functional as F

def cbr(i, o, k=3, s=1, g=1):
    return nn.Sequential(nn.Conv2d(i, o, k, s, k // 2, groups=g, bias=False), nn.BatchNorm2d(o), nn.ReLU6(inplace=True))

class IR(nn.Module):
    def __init__(self, i, o, s, e=4):
        super().__init__(); m = i * e
        self.body = nn.Sequential(cbr(i, m, 1), cbr(m, m, 3, s, m), nn.Conv2d(m, o, 1, bias=False), nn.BatchNorm2d(o))
        self.res = s == 1 and i == o
    def forward(self, x): y = self.body(x); return x + y if self.res else y

class CornerNet(nn.Module):
    """Four corner heatmaps (soft-argmax, so sub-cell accurate) plus a 'there is a page' score. About 0.2 M parameters."""
    def __init__(self, hm=24):
        super().__init__(); self.hm = hm
        self.stem = cbr(3, 16, 3, 2)                                  # 96
        self.s1 = nn.Sequential(IR(16, 24, 2, 2), IR(24, 24, 1))      # 48
        self.s2 = nn.Sequential(IR(24, 32, 2), IR(32, 32, 1))         # 24
        self.s3 = nn.Sequential(IR(32, 64, 2), IR(64, 64, 1), IR(64, 64, 1))   # 12
        self.s4 = nn.Sequential(IR(64, 96, 1), IR(96, 96, 1))         # 12
        self.lat = cbr(32, 32, 1); self.up = cbr(96, 32, 1)
        self.fuse = nn.Sequential(cbr(32, 32, 3), nn.Conv2d(32, 4, 1))
        self.pres = nn.Linear(96, 1)
    def forward(self, x):
        x = self.stem(x); x = self.s1(x); f24 = self.s2(x); f12 = self.s4(self.s3(f24))
        h = self.fuse(self.lat(f24) + F.interpolate(self.up(f12), size=f24.shape[-2:], mode='bilinear', align_corners=False))   # B,4,24,24
        b = h.shape[0]; p = F.softmax(h.reshape(b, 4, -1), -1).reshape(b, 4, self.hm, self.hm)
        g = (torch.arange(self.hm, dtype=torch.float32, device=x.device) + 0.5) / self.hm
        px = (p.sum(2) * g).sum(-1); py = (p.sum(3) * g).sum(-1)       # B,4
        var = (p.sum(2) * (g - px[..., None]) ** 2).sum(-1) + (p.sum(3) * (g - py[..., None]) ** 2).sum(-1)
        return torch.stack([px, py], -1).reshape(b, 8), self.pres(f12.mean((2, 3))).squeeze(-1), var

if __name__ == '__main__':
    m = CornerNet(); print(sum(p.numel() for p in m.parameters()), 'parameters')
    import time; x = torch.randn(1, 3, 192, 192); m.eval(); t = time.time()
    with torch.no_grad():
        for _ in range(20): m(x)
    print('ms per image (1 thread batch 1):', round((time.time() - t) * 50, 1))

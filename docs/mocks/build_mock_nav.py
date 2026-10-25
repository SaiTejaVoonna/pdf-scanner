"""Four ways to lay out the main navigation (one image). Run: python3 build_mock_nav.py"""
src = open('build_mocks4.py').read().split('\n# 1 HOME\n')[0]
exec(src)
CSS6 = '''
body{gap:26px;align-items:flex-start}.ph{width:300px;height:620px}
.cap{width:300px;font-size:12.5px;line-height:1.45;color:#aeb3c2}.cap b{color:#fff}
.h1{font-size:22px}.entry div{padding:12px 4px;font-size:12px}
.dock{margin-top:auto;display:flex;justify-content:space-around;padding:8px 6px 14px;background:#14161c;border-radius:22px 22px 0 0;box-shadow:0 -4px 16px #0008;position:relative}
.dock div{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10.5px;color:var(--muted);width:56px}.dock .on{color:#fff}
.dock .fab2{width:54px;height:54px;border-radius:50%;background:var(--pri);color:#fff;display:grid;place-items:center;margin-top:-28px;border:4px solid #14161c}
.xfab{position:absolute;right:14px;bottom:78px;background:var(--pri);color:#fff;border-radius:18px;padding:14px 18px;display:flex;gap:8px;align-items:center;font-weight:800;box-shadow:0 8px 20px #2457d680}
.xfab.low{bottom:16px}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:6px 14px 0}.topbar .ib{width:38px;height:38px}
.chiprow{display:flex;gap:8px;padding:6px 14px}.chiprow span{display:inline-flex;gap:6px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:99px;padding:8px 13px;font-size:12px;font-weight:600}
.sheet2{margin-top:auto;background:#1b1d24;border-radius:26px 26px 0 0;padding:8px 14px 16px;box-shadow:0 -8px 24px #000a}
.grab{width:40px;height:4px;border-radius:9px;background:#555;margin:0 auto 10px}
'''
def col(title, body, cap, dock=''):
    return f'<div class="col"><h3>{title}</h3><div class="ph"><div class="sb"><span>9:41</span><span></span></div>{body}{dock}</div><p class="cap">{cap}</p></div>'
def dockbar(items, fab=False):
    out=''
    for i,(n,ic_,on) in enumerate(items):
        if fab and i==len(items)//2: out+=f'<div class="fab2">{ic("cam",24)}</div>'
        out+=f'<div class="{"on" if on else ""}">{ic(ic_,21)}{n}</div>'
    return f'<div class="dock">{out}</div>'
rows = "".join(prow(*p) for p in pdfs[:3])
# A: dock with Scan in the middle
A = col('A · Dock, Scan in the middle', f'<div class="h1">PDF Scanner</div><div class="sub2">Private. Saved on this device.</div><div class="dlist">{rows}</div>',
 '<b>Why:</b> the thumb rests at the bottom centre, so the most-used action (Scan) is the easiest to hit; 4 places are one tap away.<br><b>Cost:</b> a dock on every screen takes height; five slots is the most it can hold.',
 dockbar([('PDFs','pdf',True),('Tools','tools',False),('Search','search',False),('Settings','gear',False)], fab=True))
# B: no dock, floating Scan, top actions
B = col('B · No dock, floating Scan', f'<div class="topbar"><div class="h1" style="padding:0">PDFs</div><div style="display:flex;gap:6px"><div class="ib">{ic("search",19)}</div><div class="ib">{ic("gear",19)}</div></div></div><div class="chiprow"><span>{ic("tools",15)} Tools</span><span>{ic("img",15)} Import</span><span>{ic("compress",15)} Compress</span></div><div class="dlist">{rows}</div><div class="xfab low">{ic("cam",22)} Scan</div>',
 '<b>Why:</b> the list gets the whole screen, and one big Scan button floats where the thumb is. Search and Settings are rare, so they sit at the top.<br><b>Cost:</b> Tools is a chip, easy to miss; the top corner is a stretch on tall phones.')
# C: three tabs + extended FAB above
C = col('C · Three tabs, Scan above the dock', f'<div class="h1" style="padding:6px 14px 0">PDFs</div><div class="srch" style="margin:8px 14px">{ic("search",17)} Search</div><div class="dlist">{rows}</div><div class="xfab">{ic("cam",22)} Scan</div>',
 '<b>Why:</b> the dock holds only places you <i>stay</i> (PDFs, Tools, Settings); Scan is an <i>action</i>, so it floats above them as the classic Material pattern. Search is a bar, always visible.<br><b>Cost:</b> two layers at the bottom; the Scan button hides the last row.',
 dockbar([('PDFs','pdf',True),('Tools','tools',False),('Settings','gear',False)]))
# D: camera first
cam = f'''<div class="cam" style="flex:1;margin-top:6px;background:linear-gradient(#4b5056,#3a3e43);position:relative;overflow:hidden">
<div style="position:absolute;top:10px;left:12px;right:12px;display:flex;justify-content:space-between"><div class="ib d">{ic("tools",18)}</div><div class="seg" style="transform:scale(.85)"><b class="on">{ic("one",18)}</b><b>{ic("two",18)}</b></div><div class="ib d">{ic("gear",18)}</div></div>
<div class="tint" style="left:44px;top:90px;width:210px;height:290px"></div><div class="bk" style="left:48px;top:94px;width:202px;height:282px"><div class="p">{L(12)}</div></div>
<div style="position:absolute;bottom:92px;left:0;right:0;text-align:center"><span class="pill"><span class="dot"></span> Hold steady</span></div></div>
<div class="sheet2"><div class="grab"></div><div style="display:flex;align-items:center;gap:12px"><div class="th2" style="width:40px;height:52px">{P(5)}</div><div style="flex:1"><b>Your PDFs</b><div class="mut" style="font-size:12px">12 files · Biology notes ch4 …</div></div><div class="shut" style="width:56px;height:56px;border-width:3px"></div></div></div>'''
D = col('D · Camera first', cam,
 '<b>Why:</b> a scanner is opened to scan, so the app opens straight on the camera (like phone scanner apps). Tools and Settings are two corner icons; your PDFs are a sheet you pull up.<br><b>Cost:</b> a visitor who wants a PDF must pull up the sheet; asks for camera permission at once.')
open('v6-nav.html','w').write(f'<!doctype html><meta charset="utf-8"><title>Navigation options</title><style>{CSS}{CSS2}{CSS3}{CSS4}{CSS6}</style><body>{A}{B}{C}{D}</body>')

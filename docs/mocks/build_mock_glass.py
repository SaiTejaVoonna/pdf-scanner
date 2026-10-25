"""Glass / frosted (Apple-style) mock: Home, Camera, Pages, Settings in one image. Run: python3 build_mock_glass.py"""
I = {
 'pdf':'<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
 'tools':'<path d="M14.5 6a4 4 0 0 0-5 5l-6 6 3 3 6-6a4 4 0 0 0 5-5l-3 3-2-2z"/>',
 'gear':'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
 'cam':'<path d="M4 8.5a2 2 0 0 1 2-2h1.6l1.2-1.7h6.4l1.2 1.7H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.8" r="3.4"/>',
 'search':'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
 'plus':'<path d="M12 5v14M5 12h14"/>','x':'<path d="M6 6l12 12M18 6L6 18"/>','chev':'<path d="M9 5l7 7-7 7"/>','back':'<path d="M15 5l-7 7 7 7"/>',
 'bolt':'<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>','one':'<rect x="7" y="3.5" width="10" height="17" rx="2"/>','two':'<rect x="2.5" y="5.5" width="8.5" height="13" rx="1.5"/><rect x="13" y="5.5" width="8.5" height="13" rx="1.5"/>',
 'lock':'<rect x="5.5" y="11" width="13" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>','cloud':'<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 18z"/>',
 'wand':'<path d="M4 20L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>','book':'<path d="M4 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-7"/><path d="M20 5v13h-7"/>','img':'<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M4 17l5-5 4 4 3-3 4 4"/>',
 'info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.4"/>','share':'<path d="M12 15V4M8 8l4-4 4 4M5 13v7h14v-7"/>','minus':'<path d="M6 12h12"/>',
}
ic = lambda n, s=22, sw=1.9: f'<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{I[n]}</svg>'
L = lambda n: ''.join('<i></i>' for _ in range(n))
P = lambda n=9: f'<div class="pg">{L(n)}</div>'
CSS = '''
*{box-sizing:border-box;margin:0}
body{background:#05060a;font:15px/1.3 -apple-system,"SF Pro Text",system-ui,"Segoe UI",Roboto,sans-serif;color:#fff;padding:26px;display:flex;gap:30px;justify-content:center;align-items:flex-start}
.col{display:flex;flex-direction:column;gap:10px;align-items:center}h3{font-size:13px;color:#8d93a1;font-weight:600}
.ph{width:330px;height:690px;border-radius:46px;border:7px solid #000;position:relative;overflow:hidden;
 background:radial-gradient(120% 60% at 15% 0%,#2b3a8f 0%,transparent 60%),radial-gradient(90% 55% at 100% 25%,#6a2f8f 0%,transparent 55%),radial-gradient(100% 60% at 0% 100%,#0f5d7a 0%,transparent 60%),#0b0d17}
.glass{background:rgba(255,255,255,.10);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 8px 24px rgba(0,0,0,.28)}
.sb{display:flex;justify-content:space-between;padding:12px 26px 0;font-size:13px;font-weight:600;position:relative;z-index:3}
.scroll{position:absolute;inset:0;padding:44px 0 110px;overflow:hidden}
.title{font-size:33px;font-weight:800;letter-spacing:-.02em;padding:8px 20px 4px}
.sub{color:rgba(255,255,255,.62);font-size:13px;padding:0 20px 10px}
.search{margin:6px 16px 12px;height:38px;border-radius:12px;display:flex;align-items:center;gap:8px;padding:0 12px;color:rgba(255,255,255,.55);font-size:15px}
.group{margin:0 16px 14px;border-radius:22px;overflow:hidden}
.row{display:flex;align-items:center;gap:12px;padding:11px 14px;position:relative}
.row+.row:before{content:"";position:absolute;left:70px;right:0;top:0;height:1px;background:rgba(255,255,255,.12)}
.thumb{width:40px;height:52px;border-radius:7px;background:#f3f1ea;flex:none;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.4)}
.pg{height:100%}.pg i{display:block;height:3px;margin:7px 6px 0;background:#9a9aa0;opacity:.6;border-radius:2px}
.row b{display:block;font-size:15.5px;font-weight:600}.row small{color:rgba(255,255,255,.55);font-size:12.5px}
.row .chev{margin-left:auto;color:rgba(255,255,255,.35)}
.cont{margin:0 16px 14px;border-radius:24px;padding:12px 14px;display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(80,130,255,.45),rgba(150,90,255,.30));border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(22px);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 10px 26px rgba(40,70,200,.35)}
.cont .btn{margin-left:auto;background:#fff;color:#0b1236;font-weight:700;border-radius:99px;padding:8px 16px;font-size:14px}
.lab{font-size:13px;color:rgba(255,255,255,.55);padding:2px 22px 6px;text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.tabs{position:absolute;left:16px;right:16px;bottom:20px;display:flex;gap:10px;align-items:center;z-index:5}
.cap{flex:1;height:62px;border-radius:99px;display:flex;justify-content:space-around;align-items:center;padding:0 8px}
.cap div{display:flex;flex-direction:column;align-items:center;gap:1px;font-size:10.5px;color:rgba(255,255,255,.62);width:64px;height:48px;justify-content:center;border-radius:99px}
.cap .on{color:#fff;background:rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.scanb{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#5b8cff,#3b5bdb);border:1px solid rgba(255,255,255,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 10px 26px rgba(50,90,255,.55)}
.nav{position:absolute;top:36px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center;z-index:4}
.circ{width:40px;height:40px;border-radius:50%;display:grid;place-items:center}
.pill{height:40px;border-radius:99px;padding:0 16px;display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px}
.card{border-radius:20px;padding:8px;height:178px;position:relative}.card .pg{background:#f3f1ea;border-radius:12px}
.card .n{position:absolute;left:14px;bottom:14px;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border-radius:99px;padding:1px 9px;font-size:12px;font-weight:600}
.card.wide{grid-column:1/3;height:150px;display:flex;gap:3px}.card.wide .pg{flex:1;border-radius:12px 0 0 12px}.card.wide .pg+.pg{border-radius:0 12px 12px 0}
.dot{position:absolute;right:12px;top:12px;width:20px;height:20px;border-radius:50%;background:#ff453a;display:grid;place-items:center;border:2px solid rgba(255,255,255,.7)}
.bar{position:absolute;left:16px;right:16px;bottom:20px;height:64px;border-radius:99px;display:flex;align-items:center;gap:8px;padding:0 8px;z-index:5}
.bar .go{flex:1;height:48px;border-radius:99px;background:linear-gradient(145deg,#5b8cff,#3b5bdb);display:grid;place-items:center;font-weight:700;border:1px solid rgba(255,255,255,.3);box-shadow:inset 0 1px 0 rgba(255,255,255,.45)}
.set .ico{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;flex:none}
.sw{margin-left:auto;width:50px;height:30px;border-radius:99px;background:#34c759;position:relative;flex:none}.sw:after{content:"";position:absolute;right:2px;top:2px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.35)}.sw.off{background:rgba(255,255,255,.22)}.sw.off:after{right:auto;left:2px}
.set .row small{display:block}
/* camera */
.camv{position:absolute;inset:0;background:linear-gradient(160deg,#4d5258,#2f3338)}
.bk{position:absolute;left:62px;top:150px;width:196px;height:300px;background:#f3f1ea;border-radius:3px;box-shadow:0 20px 40px rgba(0,0,0,.5)}.bk .pg i{margin:12px 14px 0}
.brk{position:absolute;width:30px;height:30px;border:3px solid #34c759}
.seg{display:flex;padding:3px;border-radius:99px}.seg b{width:46px;height:34px;border-radius:99px;display:grid;place-items:center;font-weight:400}.seg .on{background:rgba(255,255,255,.9);color:#111}
.shut{width:76px;height:76px;border-radius:50%;border:4px solid #fff;display:grid;place-items:center}.shut:before{content:"";width:60px;height:60px;border-radius:50%;background:#fff}
'''
def phone(title, inner): return f'<div class="col"><h3>{title}</h3><div class="ph"><div class="sb"><span>9:41</span><span></span></div>{inner}</div></div>'
def tabs(active):
    t=lambda n,i: f'<div class="{"on" if n==active else ""}">{ic(i,22)}{n}</div>'
    return f'<div class="tabs"><div class="cap glass">{t("PDFs","pdf")}{t("Tools","tools")}{t("Settings","gear")}</div><div class="scanb">{ic("cam",26,2)}</div></div>'
rows = [('Biology notes ch4','17 pages · 3.1 MB · today'),('Lab report','8 pages · 980 KB · Oct 22'),('Rent receipt','1 page · 210 KB · Oct 20'),('ID card','2 pages · 450 KB · Oct 18')]
row = lambda n,m: f'<div class="row"><div class="thumb">{P(7)}</div><div><b>{n}</b><small>{m}</small></div><span class="chev">{ic("chev",18,2.2)}</span></div>'
home = phone('1 · Home', f'''<div class="scroll"><div class="title">PDFs</div>
<div class="search glass">{ic("search",18)} Search</div>
<div class="cont"><div class="thumb">{P(5)}</div><div><b style="font-size:15.5px">Continue scanning</b><small style="color:rgba(255,255,255,.75);font-size:12.5px;display:block">4 pages · auto-saved</small></div><div class="btn">Open</div></div>
<div class="lab">Newest</div><div class="group glass">{"".join(row(*r) for r in rows)}</div></div>{tabs("PDFs")}''')
cam = phone('2 · Camera', f'''<div class="camv"></div><div class="bk"><div class="pg">{L(13)}</div></div>
<div class="brk" style="left:50px;top:138px;border-right:0;border-bottom:0;border-radius:10px 0 0 0"></div><div class="brk" style="right:50px;top:138px;border-left:0;border-bottom:0;border-radius:0 10px 0 0"></div><div class="brk" style="left:50px;top:446px;border-right:0;border-top:0;border-radius:0 0 0 10px"></div><div class="brk" style="right:50px;top:446px;border-left:0;border-top:0;border-radius:0 0 10px 0"></div>
<div class="nav"><div class="circ glass">{ic("x",20)}</div><div class="seg glass"><b class="on">{ic("one",19)}</b><b>{ic("two",19)}</b></div><div class="circ glass">{ic("bolt",19)}</div></div>
<div style="position:absolute;top:94px;left:0;right:0;text-align:center"><span class="pill glass" style="display:inline-flex;height:32px;font-size:13px"><span style="width:8px;height:8px;border-radius:50%;background:#34c759"></span>Hold steady</span></div>
<div style="position:absolute;bottom:0;left:0;right:0;height:170px;background:linear-gradient(transparent,rgba(0,0,0,.65))"></div>
<div style="position:absolute;bottom:34px;left:22px;right:22px;display:flex;align-items:center;justify-content:space-between"><div class="thumb glass" style="width:52px;height:52px;border-radius:14px;padding:4px"><div class="thumb" style="width:100%;height:100%;border-radius:9px">{P(4)}</div></div><div class="shut"></div><div class="pill glass">Done · 4</div></div>''')
card = lambda n, chk='': f'<div class="card glass"><div class="pg">{L(10)}</div><span class="n">{n}</span>{chk}</div>'
pages = phone('3 · Pages', f'''<div class="nav"><div class="circ glass">{ic("back",20)}</div><div class="pill glass" style="flex-direction:column;gap:0;height:44px;justify-content:center"><b style="font-size:14px">Biology notes ch4</b><small style="font-size:11px;color:rgba(255,255,255,.6)">17 pages · 2 to check</small></div><div class="circ glass">{ic("search",19)}</div></div>
<div class="scroll" style="padding-top:96px"><div class="grid">{card("1")}{card("2")}<div class="card wide glass"><div class="pg">{L(10)}</div><div class="pg">{L(10)}</div><span class="n">3–4</span></div>{card("5")}{card("6")}</div></div>
<div class="bar glass"><div class="circ" style="background:rgba(255,255,255,.14)">{ic("plus",22)}</div><div class="go">Make PDF</div></div>''')
ico = lambda c,i: f'<div class="ico" style="background:{c}">{ic(i,18,2)}</div>'
srow = lambda c,i,t,s,sw=None: f'<div class="row">{ico(c,i)}<div><b>{t}</b><small>{s}</small></div>{sw or ""}</div>'
sw = lambda on=True: f'<i class="sw{"" if on else " off"}"></i>'
settings = phone('4 · Settings', f'''<div class="scroll"><div class="title">Settings</div>
<div class="lab">Scanning</div><div class="group glass set">{srow("#0a84ff","wand","Auto-crop camera photos","Crop the page when you take it",sw(True))}{srow("#5e5ce6","img","Auto-crop imported images","Crop photos you import",sw(False))}{srow("#ff9f0a","book","Book reads right to left","Right page comes first",sw(False))}</div>
<div class="lab">Your files</div><div class="group glass set">{srow("#34c759","lock","Stays on this device","Nothing is uploaded")}{srow("#64d2ff","cloud","Back up everything","Save a ZIP of all your PDFs")}</div>
<div class="lab">About</div><div class="group glass set">{srow("#8e8e93","info","Credits and licences","Open-source parts we use")}</div></div>{tabs("Settings")}''')
open('v7-glass.html','w').write(f'<!doctype html><meta charset="utf-8"><title>Glass mock</title><style>{CSS}</style><body>{home}{cam}{pages}{settings}</body>')

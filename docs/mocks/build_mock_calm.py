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

CSS = """
*{box-sizing:border-box;margin:0}
body{background:#d9d8d4;font:15px/1.3 -apple-system,"SF Pro Text",system-ui,"Segoe UI",Roboto,sans-serif;color:#1c1c1e;padding:26px;display:flex;gap:26px;justify-content:center;align-items:flex-start}
.col{display:flex;flex-direction:column;gap:10px;align-items:center}h3{font-size:13px;color:#6b6b70;font-weight:600}
.ph{--bg:#f4f3f0;--card:#fff;--text:#1c1c1e;--mut:#8a8a8e;--line:#e6e5e1;--acc:#3552d9;--bar:rgba(255,255,255,.86);
 width:290px;height:610px;border-radius:42px;border:6px solid #1c1c1e;position:relative;overflow:hidden;background:var(--bg);color:var(--text)}
.ph.dark{--bg:#101113;--card:#1a1b1e;--text:#f2f2f3;--mut:#8f9096;--line:#2a2b2f;--acc:#8ea6ff;--bar:rgba(26,27,30,.86)}
.sb{display:flex;justify-content:space-between;padding:11px 24px 0;font-size:12px;font-weight:600;position:relative;z-index:3}
.scroll{position:absolute;inset:0;padding:38px 0 100px;overflow:hidden}
.title{font-size:30px;font-weight:700;letter-spacing:-.02em;padding:6px 18px 8px}
.search{margin:0 16px 14px;height:36px;border-radius:10px;background:rgba(120,120,128,.14);display:flex;align-items:center;gap:7px;padding:0 10px;color:var(--mut);font-size:14.5px}
.group{margin:0 16px 16px;border-radius:14px;background:var(--card);overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.row{display:flex;align-items:center;gap:12px;padding:10px 14px;position:relative}
.row+.row:before{content:"";position:absolute;left:66px;right:0;top:0;height:1px;background:var(--line)}
.set .row+.row:before{left:56px}
.thumb{width:36px;height:48px;border-radius:5px;background:#fff;flex:none;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.08),0 2px 5px rgba(0,0,0,.12)}
.pg{height:100%;background:#fbfaf7}.pg i{display:block;height:3px;margin:7px 6px 0;background:#b7b6b0;border-radius:2px}
.row b{display:block;font-size:15px;font-weight:600}.row small{color:var(--mut);font-size:12.5px}
.row .chev{margin-left:auto;color:#c4c3bf}
.cont{margin:0 16px 16px;border-radius:14px;padding:11px 14px;display:flex;align-items:center;gap:12px;background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.05)}
.cont .btn{margin-left:auto;color:var(--acc);font-weight:700;font-size:14.5px}
.lab{font-size:12.5px;color:var(--mut);padding:0 20px 6px;font-weight:500}
.tabs{position:absolute;left:0;right:0;bottom:0;padding:8px 14px 18px;display:flex;align-items:center;gap:10px;background:var(--bar);backdrop-filter:blur(20px) saturate(160%);border-top:1px solid var(--line);z-index:5}
.cap{flex:1;min-width:0;display:flex}
.cap div{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10.5px;color:var(--mut);flex:1;min-width:0;font-weight:500}.cap .on{color:var(--acc)}
.scanb{flex:none;height:44px;border-radius:22px;padding:0 15px;display:flex;align-items:center;gap:8px;background:var(--acc);color:#fff;font-weight:700;font-size:15px}
.ph.dark .scanb{color:#10142a}
.nav{position:absolute;top:34px;left:0;right:0;height:50px;display:flex;justify-content:space-between;align-items:center;padding:6px 12px 0;background:var(--bar);backdrop-filter:blur(20px);border-bottom:1px solid var(--line);z-index:4}
.nav .t{text-align:center}.nav .t b{display:block;font-size:15px}.nav .t small{font-size:11px;color:var(--mut)}
.ic{width:34px;display:grid;place-items:center;color:var(--acc)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px}
.card{border-radius:12px;height:170px;position:relative;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.07),0 3px 10px rgba(0,0,0,.10);overflow:hidden}
.card .n{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.6);color:#fff;border-radius:99px;padding:1px 8px;font-size:11.5px;font-weight:600}
.card.wide{grid-column:1/3;height:140px;display:flex}.card.wide .pg+.pg{border-left:1px solid #e3e2dc}
.flag{position:absolute;right:8px;top:8px;width:10px;height:10px;border-radius:50%;background:#f5a524}
.bar{position:absolute;left:0;right:0;bottom:0;padding:8px 14px 18px;display:flex;align-items:center;gap:10px;background:var(--bar);backdrop-filter:blur(20px);border-top:1px solid var(--line);z-index:5}
.bar .add{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:rgba(120,120,128,.14);color:var(--acc)}
.bar .go{flex:1;height:46px;border-radius:23px;background:var(--acc);color:#fff;display:grid;place-items:center;font-weight:700}
.set .ico{width:28px;height:28px;border-radius:7px;display:grid;place-items:center;flex:none;color:#fff}
.sw{margin-left:auto;width:46px;height:28px;border-radius:99px;background:#34c759;position:relative;flex:none}.sw:after{content:"";position:absolute;right:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.3)}.sw.off{background:rgba(120,120,128,.3)}.sw.off:after{right:auto;left:2px}
.camv{position:absolute;inset:0;background:#2b2e32}
.bk{position:absolute;left:52px;top:130px;width:176px;height:270px;background:#f6f4ee;border-radius:2px;box-shadow:0 14px 30px rgba(0,0,0,.5)}.bk .pg i{margin:11px 12px 0}
.brk{position:absolute;width:26px;height:26px;border:3px solid #34c759}
.dk{background:rgba(0,0,0,.45);color:#fff;backdrop-filter:blur(14px)}
.circ{width:38px;height:38px;border-radius:50%;display:grid;place-items:center}
.seg{display:flex;padding:3px;border-radius:99px}.seg b{width:42px;height:30px;border-radius:99px;display:grid;place-items:center}.seg .on{background:#fff;color:#111}
.shut{width:68px;height:68px;border-radius:50%;border:4px solid #fff;display:grid;place-items:center}.shut:before{content:"";width:54px;height:54px;border-radius:50%;background:#fff}
"""
def phone(title, inner, cls=''): return f'<div class="col"><h3>{title}</h3><div class="ph {cls}"><div class="sb"><span>9:41</span><span></span></div>{inner}</div></div>'
def tabs(active):
    t=lambda n,i: f'<div class="{"on" if n==active else ""}">{ic(i,23)}{n}</div>'
    return f'<div class="tabs"><div class="cap">{t("PDFs","pdf")}{t("Tools","tools")}{t("Settings","gear")}</div><div class="scanb">{ic("cam",21,2)} Scan</div></div>'
rows = [('Biology notes ch4','17 pages · 3.1 MB · today'),('Lab report','8 pages · 980 KB · Oct 22'),('Rent receipt','1 page · 210 KB · Oct 20'),('ID card','2 pages · 450 KB · Oct 18')]
row = lambda n,m: f'<div class="row"><div class="thumb"><div class="pg">{L(6)}</div></div><div><b>{n}</b><small>{m}</small></div><span class="chev">{ic("chev",17,2.2)}</span></div>'
def home(cls=''):
    return phone('Home' + (' (dark)' if cls else ''), f"""<div class="scroll"><div class="title">PDFs</div>
<div class="search">{ic("search",16)} Search</div>
<div class="cont"><div class="thumb"><div class="pg">{L(4)}</div></div><div><b style="font-size:15px">Continue scanning</b><small style="color:var(--mut);font-size:12.5px;display:block">4 pages · auto-saved</small></div><div class="btn">Open</div></div>
<div class="lab">Newest</div><div class="group">{"".join(row(*r) for r in rows)}</div></div>{tabs("PDFs")}""", cls)
cam = phone('Camera', f"""<div class="camv"></div><div class="bk"><div class="pg">{L(12)}</div></div>
<div class="brk" style="left:42px;top:120px;border-right:0;border-bottom:0;border-radius:8px 0 0 0"></div><div class="brk" style="right:42px;top:120px;border-left:0;border-bottom:0;border-radius:0 8px 0 0"></div><div class="brk" style="left:42px;top:402px;border-right:0;border-top:0;border-radius:0 0 0 8px"></div><div class="brk" style="right:42px;top:402px;border-left:0;border-top:0;border-radius:0 0 8px 0"></div>
<div style="position:absolute;top:36px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center"><div class="circ dk">{ic("x",19)}</div><div class="seg dk"><b class="on">{ic("one",18)}</b><b>{ic("two",18)}</b></div><div class="circ dk">{ic("bolt",18)}</div></div>
<div style="position:absolute;top:86px;left:0;right:0;text-align:center"><span class="dk" style="display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border-radius:99px;font-size:12.5px;font-weight:600"><span style="width:7px;height:7px;border-radius:50%;background:#34c759"></span>Hold steady</span></div>
<div style="position:absolute;bottom:30px;left:20px;right:20px;display:flex;align-items:center;justify-content:space-between"><div class="thumb" style="width:46px;height:46px;border-radius:10px"><div class="pg">{L(4)}</div></div><div class="shut"></div><div class="dk" style="padding:10px 16px;border-radius:99px;font-weight:600;font-size:14px">Done · 4</div></div>""")
card = lambda n, flag='': f'<div class="card"><div class="pg">{L(10)}</div><span class="n">{n}</span>{flag}</div>'
pages = phone('Pages', f"""<div class="nav"><div class="ic">{ic("back",21,2.2)}</div><div class="t"><b>Biology notes ch4</b><small>17 pages · 2 to check</small></div><div class="ic">{ic("search",20)}</div></div>
<div class="scroll" style="padding-top:98px"><div class="grid">{card("1")}{card("2")}<div class="card wide"><div class="pg" style="flex:1">{L(10)}</div><div class="pg" style="flex:1">{L(10)}</div><span class="n">3–4</span></div>{card("5",'<span class="flag"></span>')}{card("6")}</div></div>
<div class="bar"><div class="add">{ic("plus",22,2.2)}</div><div class="go">Make PDF</div></div>""")
ico = lambda c,i: f'<div class="ico" style="background:{c}">{ic(i,17,2)}</div>'
srow = lambda c,i,t,s,sw=None: f'<div class="row">{ico(c,i)}<div><b>{t}</b><small>{s}</small></div>{sw or ""}</div>'
sw = lambda on=True: f'<i class="sw{"" if on else " off"}"></i>'
settings = phone('Settings', f"""<div class="scroll"><div class="title">Settings</div>
<div class="lab">Scanning</div><div class="group set">{srow("#3552d9","wand","Auto-crop camera photos","Crop the page when you take it",sw(True))}{srow("#6b6bd6","img","Auto-crop imported images","Crop photos you import",sw(False))}{srow("#e08a1e","book","Book reads right to left","Right page comes first",sw(False))}</div>
<div class="lab">Your files</div><div class="group set">{srow("#2fa84f","lock","Stays on this device","Nothing is uploaded")}{srow("#3aa0c8","cloud","Back up everything","Save a ZIP of all your PDFs")}</div>
<div class="lab">About</div><div class="group set">{srow("#8e8e93","info","Credits and licences","Open-source parts we use")}</div></div>{tabs("Settings")}""")
open('v8-calm.html','w').write(f'<!doctype html><meta charset="utf-8"><title>Calm mock</title><style>{CSS}</style><body>{home()}{cam}{pages}{settings}{home("dark")}</body>')

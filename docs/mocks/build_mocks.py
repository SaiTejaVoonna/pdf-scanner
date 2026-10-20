"""Generates the UI mock pages (mobile + desktop per screen). Run: python3 build_mocks.py, then render with Playwright."""
I = {
'x':'<path d="M6 6l12 12M18 6L6 18"/>','back':'<path d="M15 5l-7 7 7 7"/>','bolt':'<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
'one':'<rect x="6" y="3" width="12" height="18" rx="2"/>','two':'<rect x="2.5" y="5" width="9" height="14" rx="1.5"/><rect x="12.5" y="5" width="9" height="14" rx="1.5"/>',
'img':'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 17l5-5 4 4 3-3 6 6"/>',
'cam':'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>','plus':'<path d="M12 5v14M5 12h14"/>','minus':'<path d="M6 12h12"/>',
'drag':'<path d="M5 8h14M5 12h14M5 16h14"/>','edit':'<path d="M4 20h4L19 9l-4-4L4 16z"/>','rot':'<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/>',
'crop':'<path d="M6 3v13h13M3 6h13v13"/>','del':'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>','dl':'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
'share':'<path d="M12 15V4M8 8l4-4 4 4M5 13v7h14v-7"/>','print':'<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/>','comb':'<rect x="3" y="7" width="8" height="12" rx="1"/><rect x="13" y="5" width="8" height="12" rx="1"/>',
'small':'<path d="M4 14h16M12 4v10M8 10l4 4 4-4M5 20h14"/>','sign':'<path d="M4 20c4-8 6 2 9-6s4-2 7-8"/>','doc':'<path d="M6 3h9l4 4v14H6zM14 3v5h5"/>','gear':'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
'wand':'<path d="M4 20L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>','id':'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M14 10h4M14 14h3"/>',
'board':'<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20l2-4M16 20l-2-4"/>','home':'<path d="M4 11l8-7 8 7v9H4z"/>','folder':'<path d="M3 6h7l2 2h9v11H3z"/>','search':'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
'more':'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>','check':'<path d="M5 12l5 5 9-10"/>','lock':'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
}
def ic(n, s=22): return f'<svg viewBox="0 0 24 24" style="width:{s}px;height:{s}px">{I[n]}</svg>'
L = lambda n: ''.join('<i></i>' for _ in range(n))
P = lambda n=10: f'<div class="p">{L(n)}</div>'

CSS = '''
.light{--bg:#faf8ff;--surface:#fff;--surface2:#eeedf4;--text:#1a1b21;--muted:#5b5d68;--line:#c5c6d0;--pc:#dce4ff;--soft:#2457d6;background:#e9e8ef!important}.light .lab .on{color:#1a1b21}.light .chips .on,.light .un .on,.light .side .on{color:#1a1b21}.light .ph{border-color:#222}.light .dk{border-color:#bbb}.light .side{background:#f2f1f7}.light .dk .chrome{background:#e3e2ea}.light .mn{border-color:var(--bg)}.light .toast{background:#2e3038;color:#fff}.light .btn.w{border-color:#c5c6d0}

:root{--bg:#121318;--surface:#1e1f25;--surface2:#292a2f;--text:#e3e2e9;--muted:#a9aab5;--line:#45464f;--pri:#2457d6;--pc:#173f9e;--soft:#b4c5ff;--ok:#34c759;--warn:#ffcc00;--danger:#ffb4ab}
*{box-sizing:border-box;margin:0}body{background:#06070a;font:15px/1.35 system-ui,sans-serif;color:var(--text);padding:28px;display:flex;gap:36px;align-items:flex-start;justify-content:center}
.col{display:flex;flex-direction:column;gap:10px;align-items:center}h3{font-size:13px;color:#8d93a1;font-weight:600}
svg{stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.ph{width:360px;height:760px;background:var(--bg);border-radius:38px;border:8px solid #000;position:relative;overflow:hidden;display:flex;flex-direction:column}
.dk{width:860px;height:600px;background:var(--bg);border-radius:12px;border:1px solid #333;position:relative;overflow:hidden;display:flex;flex-direction:column}
.dk .chrome{height:34px;background:#0c0d11;display:flex;align-items:center;gap:7px;padding:0 12px;border-bottom:1px solid #222}.dk .chrome b{width:11px;height:11px;border-radius:50%;background:#444}.dk .chrome span{margin:0 auto;background:#1a1b20;border-radius:8px;padding:4px 40px;font-size:12px;color:#8d93a1}
.dkb{flex:1;display:flex;min-height:0}.side{width:170px;background:#0f1014;border-right:1px solid #222;padding:14px 10px;display:flex;flex-direction:column;gap:4px}
.side div{display:flex;gap:10px;align-items:center;padding:9px 12px;border-radius:10px;color:var(--muted)}.side .on{background:var(--pc);color:#fff}.side h4{padding:4px 12px 12px;font-size:16px;color:var(--text)}
.main{flex:1;padding:18px 22px;overflow:hidden;position:relative;display:flex;flex-direction:column}
.sb{display:flex;justify-content:space-between;padding:10px 22px 2px;font-size:12px;font-weight:600;color:var(--muted)}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 8px;gap:8px}.hdr h2{font-size:19px;flex:1;text-align:center}
.ib{width:42px;height:42px;border-radius:50%;background:var(--surface2);display:grid;place-items:center;flex:none}.ib.d{background:#000a;color:#fff}
.btn{border-radius:99px;padding:13px 20px;text-align:center;font-weight:700;background:var(--surface2);border:1px solid var(--line)}.btn.pri{background:var(--pri);border-color:transparent;color:#fff}.btn.w{background:#fff;color:#111}
.card{background:var(--surface);border-radius:16px;border:1px solid var(--line)}.mut{color:var(--muted)}
.i2{width:38px;height:38px;border-radius:11px;background:var(--pc);color:var(--soft);display:grid;place-items:center;flex:none}
.p{background:#f3f1ea;border-radius:6px;overflow:hidden;width:100%;height:100%}.p i{display:block;height:4px;margin:9px 12px 0;background:#9a9aa0;opacity:.55;border-radius:2px}
.tile{padding:14px;display:flex;flex-direction:column;gap:10px;align-items:flex-start;font-weight:700}
.big{background:var(--pri);border-radius:20px;padding:18px;display:flex;align-items:center;gap:14px;color:#fff}
.tg{display:grid;gap:12px}.t2{grid-template-columns:1fr 1fr}.t4{grid-template-columns:repeat(4,1fr)}
.th{height:100px;background:var(--surface);border-radius:14px;padding:8px;position:relative;border:1px solid var(--line)}.th .p{height:100%}
.cam{flex:1;background:linear-gradient(#4b5056,#3a3e43);position:relative;overflow:hidden}
.bk{position:absolute;display:flex}.bk .p{border-radius:0}.bk .l{box-shadow:inset -18px 0 22px -14px #0007}.bk .r{box-shadow:inset 18px 0 22px -14px #0007}
.tint{position:absolute;background:#34c75930;border:3px solid var(--ok)}
.fold{position:absolute;width:8px;margin-left:-4px;background:#0b0c10;border-left:2px solid #fff;border-right:2px solid #fff;border-radius:2px;box-shadow:0 0 0 1px #0008,0 0 10px #000a}.fold:before,.fold:after{content:"";position:absolute;left:-10px;width:22px;height:22px;background:var(--ok);border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #000a}.fold:before{top:-11px}.fold:after{bottom:-11px}
.pill{display:inline-flex;gap:8px;align-items:center;background:#000a;color:#fff;border-radius:99px;padding:8px 14px;font-weight:600;font-size:14px}.dot{width:9px;height:9px;border-radius:50%;background:var(--ok)}
.seg{display:flex;background:#000a;border-radius:99px;padding:3px;color:#fff}.seg b{width:48px;height:36px;border-radius:99px;display:grid;place-items:center}.seg .on{background:#fff;color:#111}
.ctl{display:flex;justify-content:space-between;align-items:center;padding:14px 22px 22px;background:#000;color:#fff}
.shut{width:74px;height:74px;border-radius:50%;border:4px solid #fff;display:grid;place-items:center;position:relative;flex:none}.shut:before{content:"";width:58px;height:58px;border-radius:50%;background:#fff}.ring{position:absolute;inset:-9px;border-radius:50%;border:4px solid transparent;border-top-color:var(--warn);border-right-color:var(--warn);transform:rotate(30deg)}
.grid{display:grid;gap:14px;align-content:start}.cell{background:var(--surface);border-radius:14px;padding:8px;position:relative}.cell.sel{outline:2px solid var(--soft)}
.mn{position:absolute;right:-6px;top:-6px;width:24px;height:24px;border-radius:50%;background:#e5484d;display:grid;place-items:center;border:2px solid var(--bg);color:#fff;z-index:2}
.nb{position:absolute;left:14px;bottom:14px;background:#000b;border-radius:99px;padding:2px 9px;font-size:12px;color:#fff}.dg{position:absolute;right:12px;bottom:12px;background:#000b;color:#fff;border-radius:8px;padding:2px 6px}
.chk{position:absolute;left:14px;top:14px;background:var(--warn);color:#000;border-radius:99px;font-size:11px;font-weight:800;padding:2px 8px;z-index:2}
.tb{display:flex;justify-content:space-around;padding:10px 6px;background:var(--surface);margin:0 12px 8px;border-radius:18px}.tb div{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;color:var(--muted)}
.bot{display:flex;gap:10px;padding:8px 16px 18px}.bot .btn{flex:1}
.chips{display:flex;gap:8px;flex-wrap:wrap}.chips span{background:var(--surface2);border:1px solid var(--line);border-radius:99px;padding:7px 13px;font-size:13px;display:inline-flex;gap:6px;align-items:center}.chips .on{background:var(--pc);border-color:var(--soft);color:#fff}
.stage{flex:1;background:#0b0c10;position:relative}.crop{position:absolute;background:#f3f1ea}.crop i{display:block;height:5px;margin:14px 22px 0;background:#9a9aa0;opacity:.55;border-radius:3px}
.q{position:absolute;border:2.5px solid var(--soft)}.hd{position:absolute;width:20px;height:20px;border-radius:50%;background:var(--soft);border:3px solid #fff}
.fl{display:flex;gap:10px;padding:10px 14px}.fl div{width:66px;text-align:center;font-size:11px;color:var(--muted)}.fl .t{height:78px;border-radius:10px;margin-bottom:4px;border:2px solid transparent}.fl .on .t{border-color:var(--soft)}.fl .on{color:var(--text)}
.sheet{position:absolute;background:var(--surface);padding:14px 16px 16px;border:1px solid var(--line)}.grab{width:40px;height:4px;background:#555;border-radius:3px;margin:0 auto 12px}
.inp{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:12px;margin:9px 0}
.sl{height:6px;background:var(--bg);border-radius:3px;margin:20px 6px 8px;position:relative}.sl b{position:absolute;left:0;width:62%;top:0;bottom:0;background:var(--soft);border-radius:3px}.sl u{position:absolute;left:62%;top:-8px;width:22px;height:22px;background:#fff;border-radius:50%;transform:translateX(-50%);box-shadow:0 1px 4px #000a}
.lab{display:flex;justify-content:space-between;font-size:12px;color:var(--muted)}.lab .on{color:#fff;font-weight:700}
.cust{display:flex;align-items:center;gap:8px;margin-top:10px}.num{flex:1;background:var(--bg);border:2px solid var(--soft);border-radius:12px;padding:10px 12px;font-size:20px;font-weight:700}.un{display:flex;background:var(--bg);border:1px solid var(--line);border-radius:12px;overflow:hidden}.un span{padding:12px 14px;font-weight:600}.un .on{background:var(--pc);color:#fff}
.mini{display:flex;gap:9px;margin-top:12px}.mini div{flex:1;background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:9px;text-align:center;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:3px}
.toast{position:absolute;background:#2e3038;border-radius:14px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 6px 20px #000a;gap:20px}
'''
def mob(title, body): return f'<div class="col"><h3>{title}</h3><div class="ph"><div class="sb"><span>9:41</span><span></span></div>{body}</div></div>'
def desk(title, nav, body, active='Home'):
    items = [('home','Home'),('folder','Documents'),('gear','Settings')]
    side = '<h4>PDF Scanner</h4>' + ''.join(f'<div class="{"on" if n==active else ""}">{ic(i,18)}{n}</div>' for i,n in items) + '<div style="margin-top:auto;font-size:11px">Saved on this device · offline</div>'
    return f'<div class="col"><h3>{title}</h3><div class="dk"><div class="chrome"><b></b><b></b><b></b><span>saitejavoonna.github.io/pdf-scanner</span></div><div class="dkb"><div class="side">{side}</div><div class="main">{body}</div></div></div></div>'
CSS_EXTRA_PLACEHOLDER = ''
def page(name, label, *cols, cls=''):
    open(name+'.html','w').write(f'<!doctype html><meta charset="utf-8"><title>{label}</title><style>{CSS}</style>{globals().get("CSS_EXTRA", "")}<body class="{cls}">{"".join(cols)}</body>')

# 1 HOME ------------------------------------------------------------
tiles = [('img','Import'),('comb','Combine PDFs'),('small','Make smaller'),('sign','Sign'),('id','ID card'),('board','Whiteboard')]
mtiles = ''.join(f'<div class="card tile"><div class="i2">{ic(i)}</div>{n}</div>' for i,n in tiles)
rec = lambda n,m: f'<div><div class="th"><div class="p">{L(8)}</div></div><div style="margin-top:6px"><b style="font-size:13px">{n}</b><div class="mut" style="font-size:11px">{m}</div></div></div>'
m_home = mob('Mobile: double-column home', f'''<div class="hdr"><h2 style="text-align:left;font-size:22px">PDF Scanner</h2><div class="ib">{ic('gear')}</div></div>
<div style="padding:4px 14px"><div class="big" style="margin-bottom:12px">{ic('cam',34)}<div><b style="font-size:19px">Scan</b><div style="font-size:13px;opacity:.9">Page or book spread</div></div></div>
<div class="tg t2">{mtiles}</div></div>
<div style="padding:16px 16px 8px;display:flex;justify-content:space-between"><b>Recent</b><span class="mut">See all</span></div>
<div class="tg t2" style="padding:0 16px">{rec("Biology notes","3 pages · 880 KB")}{rec("ID card","2 pages · 210 KB")}</div>
<div style="margin-top:auto;text-align:center;padding:10px;font-size:12px" class="mut">Works offline · nothing is uploaded</div>''')
dtiles = ''.join(f'<div class="card tile" style="height:80px">{"<div class=i2>"+ic(i)+"</div>"}{n}</div>' for i,n in tiles)
d_home = desk('Desktop: sidebar + 3-column tiles', '', f'''<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><b style="font-size:22px">Home</b><div class="chips"><span>{ic('search',16)} Search documents</span></div></div>
<div style="display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:12px"><div class="big" style="grid-row:span 2">{ic('cam',40)}<div><b style="font-size:22px">Scan</b><div style="font-size:13px;opacity:.9">Camera or webcam. Page or book spread</div></div></div>{dtiles}</div>
<div style="margin:18px 0 8px;display:flex;justify-content:space-between"><b>Recent</b><span class="mut">See all</span></div>
<div class="tg t4">{rec("Biology notes","3 pages · 880 KB")}{rec("ID card","2 pages · 210 KB")}{rec("Receipt","1 page · 96 KB")}{rec("Lab report","8 pages · 2.1 MB")}</div>''')
page('mock-1-home','Home', m_home, d_home)

# 2 CAMERA ----------------------------------------------------------
m_cam = f'''<div class="cam"><div class="hdr"><div class="ib d">{ic('x',20)}</div><div class="seg"><b>{ic('one')}</b><b class="on">{ic('two')}</b></div><div class="ib d">{ic('bolt',20)}</div></div>
<div style="text-align:center"><span class="pill"><span class="dot"></span>Both pages found. Hold steady</span></div>
<div class="bk" style="left:30px;right:30px;top:140px;height:300px"><div class="p l">{L(12)}</div><div class="p r">{L(12)}</div></div>
<div class="tint" style="left:30px;width:150px;top:140px;height:300px;border-right:none"></div><div class="tint" style="left:180px;width:150px;top:140px;height:300px;border-left:none"></div>
<div class="fold" style="left:50%;top:130px;height:320px"></div></div>
<div class="ctl"><div style="text-align:center"><div style="width:44px;height:56px;border-radius:8px;border:2px solid #fff;background:#f3f1ea;margin:0 auto 3px"></div><span style="font-size:11px;color:#aaa">3 pages</span></div><div class="shut"><div class="ring"></div></div>
<div style="text-align:center"><div class="ib" style="background:#2a2d33;border:2px solid var(--ok);margin:0 auto 4px"><b>A</b></div><span style="font-size:11px;color:#aaa">Auto · Normal</span></div></div>'''
m_cam = f'<div class="col"><h3>Mobile: camera, book spread</h3><div class="ph"><div class="sb" style="position:absolute;z-index:3;left:0;right:0;color:#ddd"><span>9:41</span><span></span></div><div style="padding-top:18px;display:flex;flex-direction:column;flex:1;min-height:0">{m_cam}</div></div></div>'
d_cam = desk('Desktop: webcam or imported photo, controls on the right', '', f'''<div style="display:flex;gap:16px;flex:1;min-height:0"><div class="cam" style="border-radius:14px">
<div style="text-align:center;padding-top:12px"><span class="pill"><span class="dot"></span>Both pages found. Hold steady</span></div>
<div class="bk" style="left:30px;right:30px;top:80px;height:300px"><div class="p l">{L(12)}</div><div class="p r">{L(12)}</div></div>
<div class="tint" style="left:30px;width:185px;top:80px;height:300px;border-right:none"></div><div class="tint" style="left:215px;width:185px;top:80px;height:300px;border-left:none"></div>
<div class="fold" style="left:215px;top:70px;height:320px"></div></div>
<div style="width:200px;display:flex;flex-direction:column;gap:12px">
<div class="card" style="padding:12px"><div class="mut" style="font-size:12px;margin-bottom:8px">Mode</div><div class="seg" style="background:var(--surface2)"><b>{ic('one')}</b><b class="on">{ic('two')}</b><b>{ic('id')}</b></div></div>
<div class="card" style="padding:12px"><div class="mut" style="font-size:12px;margin-bottom:8px">Auto-capture</div><div class="chips"><span class="on">On</span><span>Fast</span><span class="on">Normal</span><span>Careful</span></div></div>
<div class="card" style="padding:12px"><div class="mut" style="font-size:12px;margin-bottom:8px">Captured (3)</div><div style="display:flex;gap:6px"><div style="width:44px;height:58px">{P(5)}</div><div style="width:44px;height:58px">{P(5)}</div><div style="width:44px;height:58px">{P(5)}</div></div></div>
<div class="btn pri" style="margin-top:auto">Capture · Space</div><div class="btn">Done</div></div></div>''', 'Home')
page('mock-2-camera','Camera', m_cam, d_cam)

# 3 PAGES -----------------------------------------------------------
def cell(n, h, extra='', sel=''): return f'<div class="cell {sel}" style="height:{h}px"><div class="mn">{ic("minus",14)}</div>{extra}{P()}<span class="nb">{n}</span><span class="dg">{ic("drag",16)}</span></div>'
m_pages = mob('Mobile: your pages (edit mode)', f'''<div class="hdr"><div class="ib">{ic('back')}</div><h2>Your pages</h2><b style="color:var(--soft);padding:0 6px">Done</b></div>
<div style="display:flex;gap:10px;padding:2px 16px 4px"><div class="ib">{ic('img')}</div><div class="ib">{ic('cam')}</div><div class="ib">{ic('plus')}</div></div>
<div class="grid" style="grid-template-columns:1fr 1fr;padding:10px 16px;flex:1">{cell(1,196)}{cell(2,196,'<span class="chk">Check</span>')}{cell(3,196,'','sel')}{cell(4,196)}</div>
<div class="toast" style="left:16px;right:16px;bottom:96px"><span>Spread added (2 pages)</span><b style="color:var(--soft)">Undo</b></div>
<div class="tb"><div>{ic('edit')}Edit</div><div>{ic('rot')}Rotate</div><div>{ic('crop')}Crop</div><div>{ic('del')}Delete</div></div>
<div class="bot"><div class="btn w">Preview</div><div class="btn pri" style="flex:1.3">Create PDF</div></div>''')
d_pages = desk('Desktop: 5-across grid, actions on top', '', f'''<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><b style="font-size:20px;white-space:nowrap">Your pages <span class="mut" style="font-size:14px">· 10</span></b>
<div class="chips"><span>{ic('img',16)} Import</span><span>{ic('cam',16)} Scan</span><span>{ic('rot',16)} Rotate</span></div><div style="display:flex;gap:8px;white-space:nowrap"><div class="btn w" style="padding:10px 18px">Preview</div><div class="btn pri" style="padding:10px 18px">Create PDF</div></div></div>
<div class="grid" style="grid-template-columns:repeat(5,1fr)">{''.join(cell(i,170,'<span class="chk">Check</span>' if i==3 else '', 'sel' if i==2 else '') for i in range(1,11))}</div>
<div class="toast" style="right:22px;bottom:18px"><span>Spread added (2 pages)</span><b style="color:var(--soft)">Undo</b></div>''', 'Home')
page('mock-3-pages','Pages', m_pages, d_pages)

# 4 EDIT ------------------------------------------------------------
flt = lambda n,bg,on='': f'<div class="{on}"><div class="t" style="background:{bg}"></div>{n}</div>'
m_edit = mob('Mobile: edit a page', f'''<div class="hdr"><div class="ib">{ic('back')}</div><h2>Page 2</h2><div class="btn pri" style="padding:10px 20px">Apply</div></div>
<div class="stage"><div class="crop" style="left:58px;right:58px;top:34px;bottom:34px">{L(14)}</div><div class="q" style="left:46px;right:46px;top:24px;bottom:24px"></div>
<div class="hd" style="left:36px;top:14px"></div><div class="hd" style="right:36px;top:14px"></div><div class="hd" style="right:36px;bottom:14px"></div><div class="hd" style="left:36px;bottom:14px"></div></div>
<div style="padding:12px 14px 4px"><div class="chips"><span>{ic('wand',16)} Auto-crop</span><span>{ic('rot',16)} Rotate</span><span>Full page</span></div></div>
<div class="fl">{flt('Original','#f3f1ea','on')}{flt('Enhanced','#fff')}{flt('Gray','#bbb')}{flt('B&amp;W','#eee')}{flt('Board','#e9f0ff')}</div>
<div style="padding:0 14px 18px;font-size:12px" class="mut">Drag the corners or tap Auto-crop. Applies to this page only.</div>''')
d_edit = desk('Desktop: big stage, tools on the right', '', f'''<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="display:flex;gap:10px;align-items:center"><div class="ib">{ic('back')}</div><b style="font-size:20px">Page 2 of 10</b></div><div style="display:flex;gap:8px"><div class="btn" style="padding:10px 18px">Cancel</div><div class="btn pri" style="padding:10px 22px">Apply</div></div></div>
<div style="display:flex;gap:16px;flex:1;min-height:0"><div class="stage" style="border-radius:14px"><div class="crop" style="left:70px;right:70px;top:24px;bottom:24px">{L(16)}</div><div class="q" style="left:58px;right:58px;top:14px;bottom:14px"></div>
<div class="hd" style="left:48px;top:4px"></div><div class="hd" style="right:48px;top:4px"></div><div class="hd" style="right:48px;bottom:4px"></div><div class="hd" style="left:48px;bottom:4px"></div></div>
<div style="width:230px;display:flex;flex-direction:column;gap:12px"><div class="card" style="padding:12px"><div class="mut" style="font-size:12px;margin-bottom:8px">Crop</div><div class="chips"><span>{ic('wand',16)} Auto-crop</span><span>Full page</span><span>{ic('rot',16)} Rotate</span></div></div>
<div class="card" style="padding:12px"><div class="mut" style="font-size:12px;margin-bottom:8px">Filter</div><div class="fl" style="padding:0;flex-wrap:wrap">{flt('Original','#f3f1ea','on')}{flt('Enhanced','#fff')}{flt('Gray','#bbb')}{flt('B&amp;W','#eee')}{flt('Board','#e9f0ff')}</div></div>
<div class="card" style="padding:12px;font-size:13px" class="mut">Arrow keys nudge a corner. Shift = faster.</div></div></div>''', 'Home')
page('mock-4-edit','Edit page', m_edit, d_edit)

# 5 CREATE PDF ------------------------------------------------------
sheet_inner = f'''<b style="font-size:18px">Create PDF</b><span class="mut"> · 3 pages</span>
<div class="inp"><span class="mut">Name</span>&nbsp; Biology notes<span class="mut">.pdf</span></div>
<div class="chips"><span>Receipt</span><span>Document</span><span>Homework</span><span>Photos</span></div>
<div style="margin-top:10px;font-weight:700">Size</div>
<div class="sl"><b></b><u></u></div><div class="lab"><span>Tiny</span><span>Small</span><span class="on">Balanced</span><span>High</span><span>Custom</span></div>
<div class="cust"><div class="num">500</div><div class="un"><span class="on">KB</span><span>MB</span></div></div>
<div class="mut" style="font-size:12px;margin-top:6px">Best quality that fits ≈ 498 KB. Updates as you type.</div>
<div class="chips" style="margin-top:10px"><span class="on">A4</span><span>Letter</span><span>Match photo</span><span>Passport photo</span></div>'''
actions = f'<div class="mini" style="margin-top:10px"><div>{ic("dl")}Download</div><div>{ic("share")}Share</div><div>{ic("print")}Print</div></div><div class="btn pri" style="margin-top:10px;padding:11px">Create PDF</div>'
m_pdf = mob('Mobile: Create PDF sheet', f'''<div class="hdr"><div class="ib">{ic('back')}</div><h2>Your pages</h2><span style="width:42px"></span></div><div class="grid" style="grid-template-columns:1fr 1fr;padding:10px 16px;opacity:.3"><div class="cell" style="height:160px"></div><div class="cell" style="height:160px"></div></div>
<div class="sheet" style="left:0;right:0;bottom:0;border-radius:26px 26px 0 0;box-shadow:0 -20px 40px #000a"><div class="grab"></div>{sheet_inner}{actions}</div>''')
d_pdf = desk('Desktop: centred dialog, preview beside the settings', '', f'''<div class="grid" style="grid-template-columns:repeat(5,1fr);opacity:.25">{''.join('<div class="cell" style="height:130px"></div>' for _ in range(5))}</div>
<div class="sheet" style="left:10px;right:10px;top:8px;border-radius:20px;box-shadow:0 20px 60px #000c;display:flex;gap:22px;padding:16px 20px"><div style="width:200px"><b style="font-size:13px" class="mut">Preview</b>
<div style="display:flex;gap:8px;margin-top:8px"><div style="width:100px;height:134px">{P(9)}</div><div style="width:100px;height:134px">{P(9)}</div></div><div class="mut" style="font-size:12px;margin-top:8px">3 pages · A4</div><div style="font-size:26px;font-weight:800;margin-top:14px">≈ 498 KB</div><div class="mut" style="font-size:12px">Estimated final size</div></div>
<div style="flex:1">{sheet_inner}{actions}</div></div>''', 'Home')
page('mock-5-create-pdf','Create PDF', m_pdf, d_pdf)

bg3 = lambda name,bg,pg: f'<div class="col"><h3>{name}</h3><div style="width:250px;height:330px;background:{bg};border-radius:14px;position:relative;overflow:hidden"><div class="bk" style="left:20px;right:20px;top:30px;height:260px"><div class="p l" style="background:{pg}">{L(10)}</div><div class="p r" style="background:{pg}">{L(10)}</div></div><div class="fold" style="left:50%;top:20px;height:280px"></div></div></div>'
page('mock-2b-fold-line','Fold line', bg3('On a white page, light desk','#d9dbe0','#fbfbf8'), bg3('On a cream page, wood desk','#8a6a4a','#f3f1ea'), bg3('On a dark desk','#1c1d21','#e9e7df'), bg3('Page with dark photo/ink','#3b3f44','#b9b6ad'))

# 6 CAMERA STATES (mobile only) ------------------------------------
def cam_phone(title, pill, quad_col, extra_top='', counter='', toast_html='', flash=True, dark=False, one=False):
    fl = f'<div class="ib d">{ic("bolt",20)}</div>' if flash else '<div style="width:42px"></div>'
    bg = 'linear-gradient(#1b1d20,#121315)' if dark else 'linear-gradient(#4b5056,#3a3e43)'
    pg = '#8f8d86' if dark else None
    page_html = (f'<div class="bk" style="left:30px;width:170px;top:150px;height:300px"><div class="p l" style="{"background:"+pg if pg else ""}">{L(12)}</div></div>' if one else
                 f'<div class="bk" style="left:30px;right:30px;top:150px;height:300px"><div class="p l" style="{"background:"+pg if pg else ""}">{L(12)}</div><div class="p r" style="{"background:"+pg if pg else ""}">{L(12)}</div></div>')
    if one:
        tint = f'<div class="tint" style="left:30px;width:170px;top:150px;height:300px;background:#ffcc0030;border-color:{quad_col}"></div>'
        fold = f'<div class="fold" style="left:50%;top:140px;height:320px;opacity:.55"></div>'
    else:
        tint = f'<div class="tint" style="left:30px;width:150px;top:150px;height:300px;border-right:none;border-color:{quad_col}"></div><div class="tint" style="left:180px;width:150px;top:150px;height:300px;border-left:none;border-color:{quad_col}"></div>'
        fold = '<div class="fold" style="left:50%;top:140px;height:320px"></div>'
    badges = '' if one else '<span class="pill" style="position:absolute;left:44px;top:160px;padding:3px 10px;font-size:12px">5</span><span class="pill" style="position:absolute;right:44px;top:160px;padding:3px 10px;font-size:12px">6</span>'
    return f'''<div class="col"><h3>{title}</h3><div class="ph"><div class="sb" style="position:absolute;z-index:3;left:0;right:0;color:#ddd"><span>9:41</span><span></span></div>
<div style="padding-top:18px;display:flex;flex-direction:column;flex:1;min-height:0"><div class="cam" style="background:{bg}"><div class="hdr"><div class="ib d">{ic("x",20)}</div><div class="seg"><b>{ic("one")}</b><b class="on">{ic("two")}</b></div>{fl}</div>
<div style="text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center">{pill}{counter}</div>{page_html}{tint}{fold}{badges}{extra_top}{toast_html}</div>
<div class="ctl"><div style="text-align:center"><div style="width:44px;height:56px;border-radius:8px;border:2px solid #fff;background:#f3f1ea;margin:0 auto 3px"></div><span style="font-size:11px;color:#aaa">4 pages</span></div><div class="shut"></div>
<div style="text-align:center"><div class="ib" style="background:#2a2d33;border:2px solid var(--ok);margin:0 auto 4px"><b>A</b></div><span style="font-size:11px;color:#aaa">Auto · Normal</span></div></div></div></div></div>'''
cnt = '<span class="pill" style="background:#fffd;color:#111;font-size:13px">Spread 3 · will be pages 5 &amp; 6</span>'
a = cam_phone('A. Ready: both pages and fold found', '<span class="pill"><span class="dot"></span>Both pages found. Hold steady</span>', 'var(--ok)', counter=cnt)
b = cam_phone('B. Only one page found: amber, no auto-capture', '<span class="pill" style="background:#5b4700"><span class="dot" style="background:var(--warn)"></span>Only the left page found. Move back</span>', 'var(--warn)', counter=cnt, one=True)
c = cam_phone('C. After the shot: two pages added', '<span class="pill"><span class="dot"></span>Captured. Turn the page</span>', 'var(--ok)', counter='<span class="pill" style="background:#fffd;color:#111;font-size:13px">Spread 3 done · next is 7 &amp; 8</span>', toast_html=f'<div class="toast" style="left:16px;right:16px;bottom:14px"><div style="display:flex;gap:8px;align-items:center"><div style="width:26px;height:34px">{P(3)}</div><div style="width:26px;height:34px">{P(3)}</div><span>Pages 5 &amp; 6 added</span></div><b style="color:var(--soft)">Undo</b></div>')
page('mock-6-camera-states','Camera states', a, b, c)
d = cam_phone('D. iPhone, dark room: no flash button, low-light hint', '<span class="pill" style="background:#5b4700"><span class="dot" style="background:var(--warn)"></span>Too dark. Add light or use Take photo</span>', 'var(--warn)', counter='', flash=False, dark=True)
e = cam_phone('E. Android Chrome: flash button shown', '<span class="pill"><span class="dot"></span>Both pages found. Hold steady</span>', 'var(--ok)', counter=cnt)
e = e.replace('<div class="ib d"><svg', '<div class="ib" style="background:var(--warn);color:#000"><svg',1) if False else e
page('mock-6b-camera-light','Camera light', d, e)

# 7 SAVED SCREEN ----------------------------------------------------
m_saved = mob('Mobile: after Create PDF', f'''<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center">
<div style="width:84px;height:84px;border-radius:50%;background:var(--pc);display:grid;place-items:center;color:var(--soft)">{ic('check',44)}</div>
<b style="font-size:24px">PDF saved</b><div class="mut">Biology notes.pdf · 3 pages · 498 KB</div>
<div class="card" style="padding:10px;width:150px;height:200px"><div class="p">{L(12)}</div></div>
<div style="font-size:12px" class="mut">Saved to this device. Nothing was uploaded.</div></div>
<div style="padding:0 16px 18px;display:flex;flex-direction:column;gap:10px"><div class="btn pri">Open</div><div style="display:flex;gap:10px"><div class="btn" style="flex:1">{ic('share',18)} Share</div><div class="btn" style="flex:1">Scan another</div></div></div>''')
d_saved = desk('Desktop: after Create PDF', '', f'''<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:40px">
<div class="card" style="padding:12px;width:190px;height:250px"><div class="p">{L(16)}</div></div>
<div style="max-width:300px"><div style="width:64px;height:64px;border-radius:50%;background:var(--pc);display:grid;place-items:center;color:var(--soft);margin-bottom:14px">{ic('check',34)}</div>
<b style="font-size:26px">PDF saved</b><div class="mut" style="margin:6px 0 18px">Biology notes.pdf · 3 pages · 498 KB. Saved to Downloads. Nothing was uploaded.</div>
<div class="btn pri" style="margin-bottom:10px">Open</div><div style="display:flex;gap:10px"><div class="btn" style="flex:1">Share</div><div class="btn" style="flex:1">Scan another</div></div></div></div>''', 'Home')
page('mock-7-saved','Saved', m_saved, d_saved)

# 8 SETTINGS --------------------------------------------------------
row = lambda t, sub, right='': f'<div class="card" style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px"><div><b>{t}</b><div class="mut" style="font-size:12px">{sub}</div></div>{right}</div>'
tog = lambda on=True: f'<div style="width:46px;height:26px;border-radius:99px;background:{"var(--pri)" if on else "var(--surface2)"};position:relative;flex:none"><div style="position:absolute;top:3px;{"right" if on else "left"}:3px;width:20px;height:20px;border-radius:50%;background:#fff"></div></div>'
body_set = f'''<div style="display:flex;flex-direction:column;gap:10px">
{row('Auto-capture','Capture when the page holds still',tog())}
{row('Auto-capture speed','How long to hold still','<div class="chips"><span>Fast</span><span class="on">Normal</span><span>Careful</span></div>')}
{row('Default filter','Applied to new scans','<div class="chips"><span class="on">Enhanced</span></div>')}
{row('Auto-crop imported photos','Camera shots are always auto-cropped',tog(False))}
{row('Storage used','48 MB on this device','<div class="chips"><span>Manage</span></div>')}
{row('Install on home screen','Works offline like an app','<div class="chips"><span>Install</span></div>')}
{row('Privacy','Nothing leaves this device',ic('lock',20))}</div>'''
m_set = mob('Mobile: Settings', f'<div class="hdr"><div class="ib">{ic("back")}</div><h2>Settings</h2><span style="width:42px"></span></div><div style="padding:6px 16px">{body_set}</div><div style="margin-top:auto;padding:12px;text-align:center;font-size:12px" class="mut">Version 1.0 · Licence: to be decided</div>')
d_set = desk('Desktop: Settings', '', f'<b style="font-size:22px;margin-bottom:14px">Settings</b><div style="max-width:560px">{body_set}</div>', 'Settings')
page('mock-8-settings','Settings', m_set, d_set)

# 9 LIGHT THEME -----------------------------------------------------
page('mock-9-light-theme','Light theme', m_home.replace('double-column home','Light: home'), m_pages.replace('your pages (edit mode)','Light: your pages'), m_pdf.replace('Create PDF sheet','Light: Create PDF'), cls='light')

# 10/11 GUIDES, LEVEL, FREE MODE, PAGES SHEET -----------------------
CSS_EXTRA = '''
<style>
.vline{position:absolute;top:150px;height:340px;width:6px;margin-left:-3px;background:#0b0c10;border-left:2px solid #fff;border-right:2px solid #fff;border-radius:2px;box-shadow:0 0 0 1px #0008,0 0 10px #000a}
.vline.g{border-color:#fff}.vline .tag{position:absolute;bottom:-26px;left:50%;transform:translateX(-50%);font-size:11px;background:#000b;color:#fff;border-radius:99px;padding:2px 8px;white-space:nowrap}
.det{position:absolute;border:3px solid var(--ok);background:#34c75922}.det.y{border-color:var(--warn);background:#ffcc0022}
.cam .hdr,.cam .pill,.cam .lvl{position:relative;z-index:2}.lvl{display:inline-flex;gap:8px;align-items:center;background:#000a;color:#fff;border-radius:99px;padding:5px 12px;font-size:12px;font-weight:600}
.bubble{width:46px;height:8px;border-radius:99px;background:#fff3;position:relative}.bubble i{position:absolute;top:-2px;width:12px;height:12px;border-radius:50%;background:var(--ok);left:17px}.bubble.off i{background:var(--warn);left:36px}
.mode3{display:flex;background:#000a;border-radius:99px;padding:3px;color:#fff}.mode3 b{padding:0 12px;height:36px;border-radius:99px;display:grid;place-items:center;font-size:13px;font-weight:600}.mode3 .on{background:#fff;color:#111}
.paper{position:absolute;background:#f6f5f0;overflow:hidden}.paper i{display:block;height:5px;margin:14px 18px 0;background:#9b9ba0;opacity:.55;border-radius:3px}
.sheetcam{position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:24px 24px 0 0;padding:12px 14px 16px;box-shadow:0 -20px 40px #000c;border-top:1px solid var(--line);z-index:5}
.mg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}.mg .c{height:84px;position:relative;background:var(--bg);border-radius:10px;padding:5px}.mg .c .mn{width:18px;height:18px;right:-5px;top:-5px}.mg .c .nb{left:8px;bottom:8px;font-size:10px;padding:1px 6px}.mg .c .dg{right:8px;bottom:8px;padding:0 3px}
</style>'''
def cam2(title, mode_on, top_extra, body, status, status_cls='', level_off=None, auto='Smart', sheet=''):
    m3 = ''.join(f'<b class="{"on" if n==mode_on else ""}">{n}</b>' for n in ['Single','Spread','Free'])
    lv = '' if level_off is None else f'<span class="lvl"><span class="bubble {"off" if level_off else ""}"><i></i></span>{"Tilted 14°: hold flat" if level_off else "Level"}</span>'
    pill = f'<span class="pill" style="{status_cls}"><span class="dot" style="{"background:var(--warn)" if "5b4700" in status_cls else ""}"></span>{status}</span>'
    return f'''<div class="col"><h3>{title}</h3><div class="ph"><div class="sb" style="position:absolute;z-index:6;left:0;right:0;color:#ddd"><span>9:41</span><span></span></div>
<div style="padding-top:18px;display:flex;flex-direction:column;flex:1;min-height:0"><div class="cam" style="background:linear-gradient(#4b5056,#3a3e43)">
<div class="hdr"><div class="ib d">{ic("x",20)}</div><div class="mode3">{m3}</div><div class="ib d">{ic("bolt",20)}</div></div>
<div style="text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center;margin-top:-2px">{pill}{lv}{top_extra}</div>{body}{sheet}</div>
<div class="ctl"><div style="text-align:center"><div style="width:44px;height:56px;border-radius:8px;border:2px solid #fff;background:#f3f1ea;margin:0 auto 3px"></div><span style="font-size:11px;color:#aaa">4 pages</span></div><div class="shut"></div>
<div style="text-align:center"><div class="ib" style="background:#2a2d33;border:2px solid var(--ok);margin:0 auto 4px"><b>A</b></div><span style="font-size:11px;color:#aaa">Auto · {auto}</span></div></div></div></div></div>'''
paper = lambda l,t,w,h,rot=0: f'<div class="paper" style="left:{l}px;top:{t}px;width:{w}px;height:{h}px;transform:rotate({rot}deg)">{L(16)}</div>'
A = cam2('A. Single page: two side lines, page found (green)', 'Single', '', 
  paper(58,160,244,330,-1.5)+'<div class="det" style="left:56px;top:158px;width:248px;height:334px;transform:rotate(-1.5deg)"></div>'
  +'<div class="vline" style="left:40px"><span class="tag">left edge</span></div><div class="vline" style="left:320px"><span class="tag" style="transform:translateX(-80%)">right edge</span></div>',
  'Page found. Hold steady', level_off=False)
B = cam2('B. Page smaller than the lines: yellow, capture anyway', 'Single', '', 
  paper(90,200,180,250,3)+'<div class="det y" style="left:88px;top:198px;width:184px;height:254px;transform:rotate(3deg)"></div>'
  +'<div class="vline" style="left:40px"><span class="tag">left edge</span></div><div class="vline" style="left:320px"><span class="tag" style="transform:translateX(-80%)">right edge</span></div>',
  'Not sure. Move closer, or capture anyway', 'background:#5b4700', level_off=True)
C = cam2('C. Free mode: no lines (receipts, ID cards, anything)', 'Free', '',
  paper(100,230,150,190,-6)+'<div class="det" style="left:98px;top:228px;width:154px;height:194px;transform:rotate(-6deg)"></div>'
  +'<div style="position:absolute;left:30px;right:30px;top:150px;bottom:60px;border:2px dashed #fff5;border-radius:18px"></div>',
  'Page found. Hold steady', level_off=False)
page('mock-10-guides-single','Single page guides', A, B, C)

D = cam2('D. Book spread: one centre line, edges found and shown in green', 'Spread', '<span class="pill" style="background:#fffd;color:#111;font-size:12px">Spread 3 · will be pages 5 &amp; 6</span>',
  '<div class="paper" style="left:30px;top:170px;width:150px;height:300px;box-shadow:inset -18px 0 22px -14px #0007">'+L(14)+'</div><div class="paper" style="left:180px;top:170px;width:150px;height:300px;box-shadow:inset 18px 0 22px -14px #0007">'+L(14)+'</div>'
  +'<div class="det" style="left:28px;top:168px;width:304px;height:304px"></div>'
  +'<div class="vline" style="left:180px;top:160px;height:324px;border-color:#fff"><span class="tag">fold</span></div>',
  'Both pages found. Hold steady', level_off=False)
E = cam2('E. Tap the thumbnail: pages sheet opens over the live camera', 'Single', '',
  paper(58,160,244,200,0),
  'Page found. Hold steady', level_off=False,
  sheet=f'<div class="sheetcam"><div class="grab"></div><div style="display:flex;justify-content:space-between;align-items:center"><b>Your pages</b><span class="mut" style="font-size:12px">14 total · 4 new</span><span style="color:var(--soft);font-weight:700">Done</span></div><div class="mg">'
  + ''.join(f'<div class="c"><div class="mn">{ic("minus",12)}</div>{P(4)}<span class="nb">{n}</span><span class="dg">{ic("drag",12)}</span></div>' for n in range(11,15))
  + f'</div><div class="chips" style="margin-top:10px"><span>{ic("crop",14)} Crop</span><span>{ic("rot",14)} Rotate</span><span>{ic("del",14)} Delete</span></div></div>')
F = cam2('F. Dark room: auto stays off the floor', 'Single', '',
  '<div style="position:absolute;inset:0;background:#000b;z-index:1"></div>',
  'Too dark. Add light. Auto-capture paused', 'background:#5b4700', level_off=None, auto='Smart')
page('mock-11-guides-spread-sheet','Spread, sheet, dark', D, E, F)

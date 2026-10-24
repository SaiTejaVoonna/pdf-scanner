"""Second set of mocks: newer, quieter UI plus the PDF / image size tools. Run: python3 build_mocks2.py (after build_mocks.py helpers exist)."""
src = open('build_mocks.py').read().split('# 1 HOME')[0]
exec(src)

I.update({
 'compress': '<path d="M4 14h5v5M20 10h-5V5M9 14l-5 5M15 10l5-5"/>',
 'resize': '<path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/>',
 'split': '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 9l12 8M8 15L20 7"/>',
 'lock2': '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 15-5 16 0"/>',
 'tools': '<path d="M14 6a4 4 0 0 0-5 5l-6 6 3 3 6-6a4 4 0 0 0 5-5l-3 3-2-2z"/>',
 'up': '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
 'ok': '<path d="M5 12l5 5 9-10"/>',
 'convert': '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
})
CSS2 = '''
body{gap:34px}
.ph,.dk{--r:24px}
.big2{background:linear-gradient(135deg,#3b6cf0,#2457d6);border-radius:28px;padding:22px;color:#fff;display:flex;align-items:center;gap:16px}
.big2 b{font-size:21px}.big2 span{opacity:.85;font-size:13px}
.qa{display:flex;gap:10px;margin:14px 0 4px}.qa div{flex:1;background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:14px 8px;display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12px;font-weight:600}
.qa .ic3{width:42px;height:42px;border-radius:50%;background:var(--pc);color:var(--soft);display:grid;place-items:center}
.tab{margin-top:auto;display:flex;justify-content:space-around;align-items:center;padding:10px 8px 18px;background:#0b0c10;border-top:1px solid var(--line);position:relative}
.tab div{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;color:var(--muted);width:64px}.tab .on{color:#fff}
.tab .fab{color:#fff!important;width:60px;height:60px;border-radius:50%;background:var(--pri);color:#fff;display:grid;place-items:center;margin-top:-30px;border:4px solid #0b0c10;box-shadow:0 8px 20px #2457d680}
.h1{font-size:26px;font-weight:800;padding:6px 16px 2px}.sub2{color:var(--muted);padding:0 16px 8px;font-size:13px}
.rowc{display:flex;gap:12px;padding:6px 16px 4px;overflow:hidden}.dc{width:128px;flex:none}.dc .t{height:150px;background:var(--surface);border-radius:20px;padding:8px;border:1px solid var(--line)}
.dc b{display:block;font-size:13px;margin-top:6px}.dc span{font-size:11px;color:var(--muted)}
.tg2{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:8px 16px}
.tt{background:var(--surface);border:1px solid var(--line);border-radius:24px;padding:16px;display:flex;flex-direction:column;gap:12px;font-weight:700}
.tt .ic3{width:46px;height:46px;border-radius:16px;display:grid;place-items:center}
.drop{margin:10px 16px;border:2px dashed var(--line);border-radius:24px;padding:22px;text-align:center;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:8px}
.ba{display:flex;align-items:center;gap:10px;margin:8px 16px}.ba .c{flex:1;background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:14px;text-align:center}
.ba .c b{display:block;font-size:22px;margin-top:2px}.ba .c span{font-size:12px;color:var(--muted)}
.ba .c.new{border-color:var(--soft);background:#1a2a55}
.pill2{display:inline-flex;gap:6px;align-items:center;background:#16351f;color:#7ee2a0;border-radius:99px;padding:5px 12px;font-weight:700;font-size:13px}
.sec{padding:6px 16px}.sec .lbl{font-size:12px;color:var(--muted);margin:10px 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.btnbig{margin:12px 16px;border-radius:99px;padding:16px;text-align:center;font-weight:800;background:var(--pri);color:#fff;font-size:16px}
.sz{display:flex;gap:10px;align-items:center}.sz .num{flex:1}
.preview{margin:8px 16px;background:var(--surface);border:1px solid var(--line);border-radius:24px;padding:14px;display:flex;gap:14px;align-items:center}
'''
def css2(): return CSS_EXTRA_FALLBACK + CSS2
CSS_EXTRA_FALLBACK = ''
def page2(name, label, *cols):
    open(name+'.html','w').write(f'<!doctype html><meta charset="utf-8"><title>{label}</title><style>{CSS}{CSS2}</style><body>{"".join(cols)}</body>')

def tabbar(active='Home'):
    it = lambda n,i: f'<div class="{"on" if n==active else ""}">{ic(i,22)}{n}</div>'
    return f'<div class="tab">{it("Home","home")}{it("Tools","tools")}<div class="fab">{ic("cam",26)}</div>{it("Files","folder")}{it("Settings","gear")}</div>'
def mob2(title, body, tab='Home'):
    return f'<div class="col"><h3>{title}</h3><div class="ph"><div class="sb"><span>9:41</span><span></span></div>{body}{tabbar(tab) if tab else ""}</div></div>'
def side2(active):
    items=[('home','Home'),('tools','Tools'),('folder','Files'),('gear','Settings')]
    return '<h4>PDF Scanner</h4>'+''.join(f'<div class="{"on" if n==active else ""}">{ic(i,18)}{n}</div>' for i,n in items)
def desk2(title, body, active='Home'):
    return f'<div class="col"><h3>{title}</h3><div class="dk"><div class="chrome"><b></b><b></b><b></b><span>saitejavoonna.github.io/pdf-scanner</span></div><div class="dkb"><div class="side">{side2(active)}</div><div class="main">{body}</div></div></div></div>'
ic3 = lambda n,bg,fg: f'<div class="ic3" style="background:{bg};color:{fg}">{ic(n,22)}</div>'

# 1 NEW HOME -------------------------------------------------------
doccard = lambda n,m: f'<div class="dc"><div class="t">{P(8)}</div><b>{n}</b><span>{m}</span></div>'
m1 = mob2('Home: one big action, quick actions, recent', f'''<div class="h1">Scan</div><div class="sub2">Private. Saved on this device.</div>
<div style="padding:4px 16px"><div class="big2">{ic("cam",36)}<div><b>New scan</b><br><span>Page or book spread</span></div></div></div>
<div class="qa" style="padding:0 16px"><div><div class="ic3">{ic("img",20)}</div>Import</div><div><div class="ic3">{ic("id",20)}</div>ID card</div><div><div class="ic3">{ic("board",20)}</div>Board</div><div><div class="ic3">{ic("compress",20)}</div>Shrink</div></div>
<div style="display:flex;justify-content:space-between;padding:14px 16px 4px"><b>Recent</b><span class="mut">All</span></div>
<div class="rowc">{doccard("Biology notes","3 pages")}{doccard("ID card","2 pages")}{doccard("Receipt","1 page")}</div>''','Home')
d1 = desk2('Desktop: the same, with room to breathe', f'''<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b style="font-size:26px">Scan</b><span class="mut">Private. Saved on this device.</span></div>
<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px"><div class="big2" style="padding:30px">{ic("cam",44)}<div><b style="font-size:24px">New scan</b><br><span>Page or book spread</span></div></div>
<div class="qa" style="margin:0;flex-wrap:wrap"><div style="min-width:90px"><div class="ic3">{ic("img",20)}</div>Import</div><div style="min-width:90px"><div class="ic3">{ic("id",20)}</div>ID card</div><div style="min-width:90px"><div class="ic3">{ic("compress",20)}</div>Shrink</div><div style="min-width:90px"><div class="ic3">{ic("comb",20)}</div>Combine</div></div></div>
<div style="margin:20px 0 8px"><b>Recent</b></div><div class="rowc" style="padding:0">{doccard("Biology notes","3 pages")}{doccard("ID card","2 pages")}{doccard("Receipt","1 page")}{doccard("Lab report","8 pages")}{doccard("Form","2 pages")}</div>''','Home')
page2('new-1-home','New home', m1, d1)

# 2 TOOLS ----------------------------------------------------------
tools = [('compress','Compress PDF','#173f9e','#b4c5ff'),('resize','Resize photo','#3a2a6b','#d0bcff'),('comb','Combine PDFs','#14452e','#7ee2a0'),('split','Split PDF','#5a3a14','#ffcf8a'),('user','Passport photo','#5a1d3a','#ffb0d0'),('sign','Sign','#123b4a','#9fe3ff'),('lock2','Lock PDF','#2f2f2f','#d9d9d9'),('convert','Photos to PDF','#2a3d14','#c6f08a')]
tt = lambda n,i,bg,fg: f'<div class="tt">{ic3(i,bg,fg)}{n}</div>'
m2 = mob2('Tools: icons first, two words at most', f'<div class="h1">Tools</div><div class="sub2">Work on a PDF or a photo.</div><div class="tg2">{"".join(tt(n,i,bg,fg) for i,n,bg,fg in tools)}</div>','Tools')
d2 = desk2('Desktop: four across', f'<b style="font-size:26px;margin-bottom:4px">Tools</b><div class="mut" style="margin-bottom:12px">Work on a PDF or a photo.</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">{"".join(tt(n,i,bg,fg) for i,n,bg,fg in tools)}</div>','Tools')
page2('new-2-tools','Tools', m2, d2)

# 3 COMPRESS PDF ---------------------------------------------------
chips3 = '<div class="chips"><span>100 KB</span><span>500 KB</span><span class="on">1 MB</span><span>2 MB</span><span>Custom</span></div>'
m3 = mob2('Compress PDF: pick a file, pick a size', f'''<div class="hdr"><div class="ib">{ic("back")}</div><h2>Compress PDF</h2><span style="width:42px"></span></div>
<div class="preview"><div style="width:54px;height:70px;flex:none">{P(6)}</div><div style="flex:1"><b>Lab report.pdf</b><div class="mut" style="font-size:12px">8 pages</div></div><div class="mut">Change</div></div>
<div class="ba"><div class="c"><span>Now</span><b>4.2 MB</b></div><div style="color:var(--soft)">{ic("compress",22)}</div><div class="c new"><span>After</span><b>980 KB</b></div></div>
<div class="sec"><div class="lbl">Size</div>{chips3}
<div class="sl" style="margin-top:22px"><b style="width:58%"></b><u style="left:58%"></u></div><div class="lab"><span>Smallest</span><span>Balanced</span><span>Best</span></div></div>
<div style="margin:6px 16px"><span class="pill2">{ic("ok",14)} Readable text kept</span></div>
<div class="btnbig" style="margin-top:auto">Compress</div>''',None)
d3 = desk2('Desktop: drop a file, before and after side by side', f'''<b style="font-size:24px;margin-bottom:10px">Compress PDF</b>
<div style="display:flex;gap:18px;flex:1;min-height:0"><div style="flex:1;display:flex;flex-direction:column;gap:12px">
<div class="drop" style="margin:0;flex:1">{ic("up",34)}<b style="color:var(--text)">Drop a PDF here</b><span style="font-size:13px">or choose a file</span></div>
<div class="preview" style="margin:0"><div style="width:54px;height:70px;flex:none">{P(6)}</div><div style="flex:1"><b>Lab report.pdf</b><div class="mut" style="font-size:12px">8 pages · 4.2 MB</div></div></div></div>
<div style="width:280px;display:flex;flex-direction:column;gap:12px"><div class="ba" style="margin:0"><div class="c"><span>Now</span><b>4.2 MB</b></div><div class="c new"><span>After</span><b>980 KB</b></div></div>
<div class="lbl mut" style="font-size:12px;font-weight:600">SIZE</div>{chips3}<div class="sl" style="margin:14px 4px"><b style="width:58%"></b><u style="left:58%"></u></div><div class="lab"><span>Smallest</span><span>Balanced</span><span>Best</span></div>
<span class="pill2" style="align-self:flex-start">{ic("ok",14)} Readable text kept</span><div class="btnbig" style="margin:auto 0 0">Compress</div></div></div>''','Tools')
page2('new-3-compress','Compress PDF', m3, d3)

# 4 RESIZE PHOTO FOR WEBSITES --------------------------------------------
pres = '<div class="chips"><span class="on">Passport 35×45</span><span>Signature</span><span>Aadhaar</span><span>Under 50 KB</span><span>Under 200 KB</span><span>Custom</span></div>'
m4 = mob2('Resize photo: presets for the forms websites ask for', f'''<div class="hdr"><div class="ib">{ic("back")}</div><h2>Resize photo</h2><span style="width:42px"></span></div>
<div style="margin:6px 16px;height:200px;background:var(--surface);border:1px solid var(--line);border-radius:24px;display:grid;place-items:center"><div style="width:120px;height:154px;border-radius:10px;background:#cfd6e4;border:3px solid var(--soft)"></div></div>
<div class="sec"><div class="lbl">Preset</div>{pres}
<div class="lbl">Size</div><div class="sz"><div class="num" style="flex:1;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;font-weight:700">100</div><div class="un"><span class="on">KB</span><span>MB</span></div></div>
<div class="lbl">Format</div><div class="chips"><span class="on">JPG</span><span>PNG</span><span>PDF</span></div></div>
<div style="margin:6px 16px"><span class="pill2">{ic("ok",14)} 413 × 531 px · 46 KB · meets the limit</span></div>
<div class="btnbig" style="margin-top:auto">Save photo</div>''',None)
d4 = desk2('Desktop: preview on the left, rules on the right', f'''<b style="font-size:24px;margin-bottom:10px">Resize photo</b>
<div style="display:flex;gap:18px;flex:1;min-height:0"><div style="flex:1;background:var(--surface);border:1px solid var(--line);border-radius:24px;display:grid;place-items:center"><div style="width:160px;height:206px;border-radius:12px;background:#cfd6e4;border:3px solid var(--soft)"></div></div>
<div style="width:300px;display:flex;flex-direction:column;gap:6px"><div class="lbl mut" style="font-size:12px;font-weight:600">PRESET</div>{pres}
<div class="lbl mut" style="font-size:12px;font-weight:600;margin-top:8px">LIMITS</div><div class="sz"><div style="flex:1;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;font-weight:700">100</div><div class="un"><span class="on">KB</span><span>MB</span></div></div>
<div class="sz" style="margin-top:6px"><div style="flex:1;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;font-weight:700">413</div><span class="mut">×</span><div style="flex:1;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;font-weight:700">531</div><div class="un"><span class="on">px</span><span>mm</span></div></div>
<div class="chips" style="margin-top:8px"><span class="on">JPG</span><span>PNG</span><span>PDF</span></div>
<span class="pill2" style="align-self:flex-start;margin-top:8px">{ic("ok",14)} 46 KB · meets the limit</span><div class="btnbig" style="margin:auto 0 0">Save photo</div></div></div>''','Tools')
page2('new-4-resize-photo','Resize photo', m4, d4)

# 5 RESULT -----------------------------------------------------------
m5 = mob2('Result: what happened, in numbers, then what next', f'''<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center">
<div style="width:92px;height:92px;border-radius:50%;background:#16351f;display:grid;place-items:center;color:#7ee2a0">{ic("ok",48)}</div>
<b style="font-size:26px">Done</b><div class="ba" style="width:100%"><div class="c"><span>Before</span><b>4.2 MB</b></div><div style="color:var(--soft)">{ic("compress",22)}</div><div class="c new"><span>After</span><b>980 KB</b></div></div>
<div class="mut">Lab report.pdf · 8 pages · text kept</div></div>
<div style="padding:0 16px 8px;display:flex;flex-direction:column;gap:10px"><div class="btnbig" style="margin:0">Download</div><div style="display:flex;gap:10px"><div class="btn" style="flex:1">{ic("share",18)} Share</div><div class="btn" style="flex:1">Done</div></div></div>''',None)
d5 = desk2('Desktop: the result beside the file', f'''<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:40px"><div class="card" style="padding:12px;width:190px;height:250px"><div class="p">{L(16)}</div></div>
<div style="max-width:320px"><div style="width:64px;height:64px;border-radius:50%;background:#16351f;display:grid;place-items:center;color:#7ee2a0;margin-bottom:12px">{ic("ok",34)}</div><b style="font-size:28px">Done</b>
<div class="ba" style="margin:12px 0"><div class="c"><span>Before</span><b>4.2 MB</b></div><div class="c new"><span>After</span><b>980 KB</b></div></div><div class="mut" style="margin-bottom:14px">Lab report.pdf · 8 pages · text kept</div>
<div class="btnbig" style="margin:0 0 10px">Download</div><div style="display:flex;gap:10px"><div class="btn" style="flex:1">Share</div><div class="btn" style="flex:1">Done</div></div></div></div>''','Tools')
page2('new-5-result','Result', m5, d5)

"""Third set: folder-first app, whole UI. Run: python3 build_mocks3.py (needs build_mocks.py + build_mocks2.py helpers)."""
src = open('build_mocks2.py').read().split('# 1 NEW HOME')[0]
exec(src)
I.update({'newf':'<path d="M3 6h7l2 2h9v11H3zM12 11v5M9.5 13.5h5"/>','stack':'<rect x="7" y="3" width="13" height="15" rx="2"/><path d="M4 7v13h13"/>','pages2':'<rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/>','warn':'<path d="M12 4l9 16H3zM12 10v4M12 17v.5"/>','pdf':'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 14h6M9 17h4"/>'})
CSS3 = '''
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:6px 16px}
.fold2{background:var(--surface);border:1px solid var(--line);border-radius:24px;padding:14px;display:flex;flex-direction:column;gap:10px}
.fold2 .tabs{height:74px;position:relative}.fold2 .tabs .p{position:absolute;width:62px;height:74px;border:1px solid #0003}
.fold2 b{font-size:15px}.fold2 span{font-size:12px;color:var(--muted)}
.fcol{width:46px;height:46px;border-radius:15px;display:grid;place-items:center}
.srch{margin:4px 16px 8px;background:var(--surface);border:1px solid var(--line);border-radius:99px;padding:11px 16px;display:flex;gap:10px;color:var(--muted)}
.crumb{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:13px;padding:0 16px}.crumb b{color:var(--text)}
.dlist{padding:6px 16px;display:flex;flex-direction:column;gap:10px}
.drow{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:10px;display:flex;gap:12px;align-items:center}
.drow .th2{width:50px;height:64px;flex:none}.drow b{display:block}.drow span{font-size:12px;color:var(--muted)}
.pg2{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:6px 14px;align-content:start;overflow:hidden;flex:1}
.pc2{background:var(--surface);border-radius:18px;padding:8px;position:relative;height:170px;border:1px solid var(--line)}
.pc2.wide{grid-column:1/3;height:150px;display:flex;gap:4px}.pc2 .p{height:100%}
.pc2 .n{position:absolute;left:14px;bottom:12px;background:#000b;color:#fff;border-radius:99px;padding:1px 9px;font-size:12px}
.pc2 .h{position:absolute;right:12px;bottom:10px;background:#000b;color:#fff;border-radius:8px;padding:2px 5px}
.pc2 .m{position:absolute;right:-6px;top:-6px;width:24px;height:24px;border-radius:50%;background:#e5484d;color:#fff;display:grid;place-items:center;border:2px solid var(--bg);z-index:2}
.pc2 .ck{position:absolute;left:12px;top:12px;width:14px;height:14px;border-radius:50%;background:var(--warn);border:2px solid #000a;z-index:2}
.sp{position:absolute;left:50%;top:8px;bottom:8px;width:2px;background:var(--bg)}
.bar3{display:flex;gap:10px;padding:10px 14px 18px;background:#0b0c10;border-top:1px solid var(--line);align-items:center}
.bar3 .ib{background:var(--surface2)}.bar3 .go{flex:1;border-radius:99px;padding:15px;text-align:center;font-weight:800;background:var(--pri);color:#fff}
.stage3{flex:1;background:#0b0c10;position:relative;min-height:0;margin:0}
.nbk{position:absolute;background:#e9e6dc;border:2px solid transparent}.nbk i{display:block;height:4px;margin:12px 14px 0;background:#6b6b78;opacity:.55;border-radius:2px}
.wchip{position:absolute;left:12px;right:12px;top:10px;background:#3a2c06ee;border:1px solid #8a6a00;color:#ffd666;border-radius:14px;padding:9px 12px;display:flex;gap:8px;align-items:center;font-size:13px}
.wchip u{margin-left:auto;text-decoration:none;font-weight:800;color:#fff;background:#8a6a00;border-radius:99px;padding:3px 10px}
.tools3{display:flex;justify-content:space-around;padding:8px 8px 4px}.tools3 div{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:var(--muted);width:62px}.tools3 .on{color:#fff}
.tools3 .on i{background:var(--pc)}.tools3 i{width:44px;height:44px;border-radius:15px;background:var(--surface2);display:grid;place-items:center;font-style:normal;color:inherit}
.flt{display:flex;gap:10px;padding:6px 14px 8px;overflow:hidden}.flt div{text-align:center;font-size:11px;color:var(--muted)}.flt .t{width:58px;height:58px;border-radius:12px;border:2px solid transparent;margin-bottom:3px;background:#cfc9b8}.flt .on .t{border-color:var(--soft)}.flt .on{color:#fff}
.sheet{margin-top:auto;background:var(--surface);border-radius:28px 28px 0 0;padding:16px;border-top:1px solid var(--line)}
.opt{display:flex;gap:12px;align-items:center;padding:12px;border-radius:18px;background:var(--surface2);margin-top:8px}.opt.on{outline:2px solid var(--soft);background:#1a2a55}
.opt b{display:block}.opt span{font-size:12px;color:var(--muted)}
.target{display:inline-flex;gap:8px;align-items:center;background:#000a;color:#fff;border-radius:99px;padding:8px 14px;font-size:13px;font-weight:600}
.side .dtree{flex-direction:column;padding:0;gap:2px}.side .dtree.b{margin-top:auto}
.dtree div{display:flex;gap:10px;align-items:center;padding:8px 12px;border-radius:10px;color:var(--muted);font-size:14px}.dtree .on{background:var(--pc);color:#fff}
'''
def page3(name,label,*cols):
    open(name+'.html','w').write(f'<!doctype html><meta charset="utf-8"><title>{label}</title><style>{CSS}{CSS2}{CSS3}</style><body>{"".join(cols)}</body>')
def tab3(active):
    it=lambda n,i:f'<div class="{"on" if n==active else ""}">{ic(i,22)}{n}</div>'
    return f'<div class="tab">{it("Folders","folder")}{it("Tools","tools")}<div class="fab">{ic("cam",26)}</div>{it("Search","search")}{it("Settings","gear")}</div>'
def mob3(t,body,tab=None): return f'<div class="col"><h3>{t}</h3><div class="ph"><div class="sb"><span>9:41</span><span></span></div>{body}{tab3(tab) if tab else ""}</div></div>'
def side3(active='Biology'):
    fs=[('Inbox','#9aa0b4'),('Biology','#7ee2a0'),('Receipts','#ffcf8a'),('ID & forms','#ffb0d0'),('College','#9fe3ff')]
    return '<h4>PDF Scanner</h4>'+'<div class="dtree">'+''.join(f'<div class="{"on" if n==active else ""}">{ic("folder",18)}{n}</div>' for n,c in fs)+'<div>'+ic("newf",18)+' New folder</div></div><div class="dtree b"><div>'+ic("tools",18)+' Tools</div><div>'+ic("gear",18)+' Settings</div></div>'
def desk3(t,body,active='Biology'):
    return f'<div class="col"><h3>{t}</h3><div class="dk"><div class="chrome"><b></b><b></b><b></b><span>saitejavoonna.github.io/pdf-scanner</span></div><div class="dkb"><div class="side">{side3(active)}</div><div class="main">{body}</div></div></div></div>'
FOLD=[('Inbox','#2a2f3d','#cbd2ea',4,'Unsorted scans'),('Biology','#14452e','#7ee2a0',3,'17 pages'),('Receipts','#5a3a14','#ffcf8a',12,'12 files'),('ID & forms','#5a1d3a','#ffb0d0',5,'5 files'),('College','#123b4a','#9fe3ff',8,'8 files')]
def fcard(n,bg,fg,c,sub):
    return f'<div class="fold2"><div class="fcol" style="background:{bg};color:{fg}">{ic("folder",24)}</div><div><b>{n}</b><br><span>{c} documents</span></div></div>'

# 1 HOME = FOLDERS
m1=mob3('1 · Home is folders. Nothing floats loose',f'''<div class="h1">Folders</div><div class="sub2">Every scan lives in a folder. Private, on this device.</div>
<div class="srch">{ic("search",18)} Search documents</div>
<div class="fgrid">{"".join(fcard(*f) for f in FOLD)}<div class="fold2" style="border-style:dashed;align-items:center;justify-content:center;color:var(--muted);min-height:116px">{ic("newf",28)}<b style="color:var(--muted)">New folder</b></div></div>
<div style="padding:10px 16px 0;color:var(--muted);font-size:12px">Scans from the camera go to the folder you pick on the camera screen. Last used: Biology.</div>''','Folders')
d1=desk3('1 · Desktop: folder tree on the left, folders as cards',f'''<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><b style="font-size:26px">All folders</b><div class="btn pri" style="padding:11px 18px">{ic("cam",16)} New scan</div></div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">{"".join(fcard(*f) for f in FOLD)}</div>''','Inbox')
page3('v3-1-home','Folders home',m1,d1)

# 2 FOLDER
docs=[('Notes · Chapter 4','17 pages · today',7),('Lab report','8 pages · 2 days ago',5),('Practical sheet','2 pages · last week',2)]
drow=lambda n,m,k:f'<div class="drow"><div class="th2">{P(6)}</div><div style="flex:1"><b>{n}</b><span>{m}</span></div><div class="ib">{ic("more",18)}</div></div>'
m2=mob3('2 · Inside a folder: documents, one row each',f'''<div class="hdr"><div class="ib">{ic("back")}</div><h2>Biology</h2><div class="ib">{ic("more")}</div></div>
<div class="crumb">Folders › <b>Biology</b></div>
<div class="dlist" style="margin-top:12px">{"".join(drow(*d) for d in docs)}</div>
<div style="margin:12px 16px;border:2px dashed var(--line);border-radius:22px;padding:16px;text-align:center;color:var(--muted)">{ic("cam",20)}<br>Scan into Biology</div>''','Folders')
d2=desk3('2 · Desktop',f'''<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:26px">Biology</b><div class="btn pri" style="padding:11px 18px">{ic("cam",16)} Scan into Biology</div></div><div class="mut" style="margin-bottom:12px">3 documents</div>
<div class="dlist" style="padding:0">{"".join(drow(*d) for d in docs)}</div>''')
page3('v3-2-folder','Folder',m2,d2)

# 3 DOCUMENT (pages grid)
def pc(n,extra='',h=''): return f'<div class="pc2">{extra}<div class="m">{ic("minus",13)}</div>{P(9)}<span class="n">{n}</span><span class="h">{ic("drag",15)}</span></div>'
spread=lambda a,chk="":f'<div class="pc2 wide"><div class="m">{ic("minus",13)}</div>{chk}<div style="flex:1">{P(9)}</div><div style="flex:1">{P(9)}</div><span class="n">{a}</span><span class="h">{ic("drag",15)}</span></div>'
m3=mob3('3 · Document: spreads stay ONE tile, pages two across',f'''<div class="hdr"><div class="ib">{ic("back")}</div><div style="flex:1;text-align:center"><b style="font-size:17px">Notes · Chapter 4</b><div class="mut" style="font-size:12px">Biology · 17 pages · 2 to check</div></div><div class="ib">{ic("more")}</div></div>
<div class="pg2">{pc("1")}{pc("2")}{spread("3–4")}{pc("5",'<div class="ck"></div>')}{pc("6")}</div>
<div class="bar3"><div class="ib">{ic("plus")}</div><div class="ib">{ic("search",20)}</div><div class="go">Make PDF</div></div>''')
d3=desk3('3 · Desktop: bigger grid, selection toolbar appears on top',f'''<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div><b style="font-size:24px">Notes · Chapter 4</b><div class="mut" style="font-size:13px">Biology · 17 pages · 2 to check</div></div><div style="display:flex;gap:8px"><div class="btn">{ic("plus",16)} Add pages</div><div class="btn pri">Make PDF</div></div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;overflow:hidden">{"".join(f'<div class="pc2" style="height:150px"><div class="m">{ic("minus",13)}</div>{P(9)}<span class="n">{i}</span></div>' for i in range(1,9))}</div>''')
page3('v3-3-document','Document',m3,d3)

# 4 EDITOR (crop dominates)
nb=lambda l,t,w,h,rot,ac:f'<div class="nbk" style="left:{l}px;top:{t}px;width:{w}px;height:{h}px;transform:rotate({rot}deg);border-color:{ac}">{L(12)}</div>'
hd=lambda x,y,c='var(--soft)':f'<div class="hd" style="left:{x-10}px;top:{y-10}px;background:{c}"></div>'
st1=f'<div class="stage3" style="background:#3b3330">{nb(32,86,284,300,-1,"var(--soft)")}{hd(32,86)}{hd(316,86)}{hd(32,386)}{hd(316,386)}<div class="wchip">{ic("warn",18)} Writing touches the right edge<u>Fix</u></div></div>'
st2=f'<div class="stage3" style="background:#3b3330">{nb(24,100,148,280,0,"#4aa3ff")}{nb(176,96,148,282,0,"#34c759")}{hd(24,100)}{hd(324,96)}{hd(24,380)}{hd(324,378)}<div class="hd" style="left:166px;top:84px;width:20px;height:32px;border-radius:8px;background:#f0a030"></div><div class="hd" style="left:166px;top:362px;width:20px;height:32px;border-radius:8px;background:#f0a030"></div><div class="wchip">{ic("warn",18)} 3 edges touch writing<u>Fix all</u></div></div>'
tl=lambda items:'<div class="tools3">'+''.join(f'<div class="{"on" if o else ""}"><i>{ic(i,22)}</i>{n}</div>' for i,n,o in items)+'</div>'
m4=mob3('4 · Edit page: the photo gets ~60% of the screen',f'''<div class="hdr"><div class="ib">{ic("back")}</div><b style="font-size:18px">Edit page 15</b><div class="btn pri" style="padding:10px 18px">Apply</div></div>{st1}
{tl([("crop","Crop",1),("rot","Rotate",0),("wand","Auto",0),("edit","Look",0)])}
<div class="flt"><div class="on"><div class="t"></div>Original</div><div><div class="t" style="background:#f2efe3"></div>Clean</div><div><div class="t" style="background:#aaa"></div>Gray</div><div><div class="t" style="background:#fff;border-color:#444"></div>B&amp;W</div></div><div style="height:12px"></div>''')
m4b=mob3('4b · Edit spread: same layout, two quads, one hint bar',f'''<div class="hdr"><div class="ib">{ic("back")}</div><b style="font-size:18px">Edit spread 7</b><div class="btn pri" style="padding:10px 18px">Apply</div></div>{st2}
{tl([("crop","Crop",1),("pages2","Each page",0),("wand","Auto",0),("edit","Look",0)])}
<div class="flt"><div class="on"><div class="t"></div>Original</div><div><div class="t" style="background:#f2efe3"></div>Clean</div><div><div class="t" style="background:#aaa"></div>Gray</div><div><div class="t" style="background:#fff;border-color:#444"></div>B&amp;W</div></div><div style="height:12px"></div>''')
d4=desk3('4 · Desktop: big canvas, tools in a right rail',f'''<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:22px">Edit page 15</b><div class="btn pri">Apply</div></div>
<div style="display:flex;gap:16px;flex:1;min-height:0"><div class="stage3" style="border-radius:18px;background:#3b3330;flex:1">{nb(150,24,300,380,0,"var(--soft)")}{hd(150,24)}{hd(450,24)}{hd(150,404)}{hd(450,404)}</div>
<div style="width:200px;display:flex;flex-direction:column;gap:8px">{"".join(f'<div class="btn" style="text-align:left;display:flex;gap:10px;{"background:var(--pc)" if i==0 else ""}">{ic(ic_,18)} {t}</div>' for i,(ic_,t) in enumerate([("crop","Crop"),("rot","Rotate"),("wand","Auto"),("edit","Look")]))}<div class="mut" style="font-size:12px;margin-top:6px">LOOK</div><div class="chips"><span class="on">Original</span><span>Clean</span><span>Gray</span><span>B&amp;W</span></div></div></div>''')
page3('v3-4-edit','Edit',m4,m4b,d4)

# 5 CAMERA
def camv(t,mid,counter):
    return f'''<div class="col"><h3>{t}</h3><div class="ph"><div class="sb" style="color:#fff;position:absolute;top:0;left:0;right:0;z-index:3"><span>9:41</span><span></span></div>
<div class="cam" style="background:linear-gradient(#4b5056,#3a3e43)">
<div style="position:absolute;top:34px;left:12px;right:12px;display:flex;justify-content:space-between;z-index:3"><div class="ib d">{ic("x")}</div><div class="target">{ic("folder",15)} Biology › Chapter 4 {ic("back",12)}</div><div class="ib d">{ic("bolt")}</div></div>
{mid}<div style="position:absolute;bottom:12px;left:0;right:0;text-align:center"><span class="pill"><span class="dot"></span> {counter}</span></div></div>
<div class="ctl"><div style="width:52px;height:52px;border-radius:12px;background:#f3f1ea;border:2px solid #fff"></div><div class="shut"></div><div class="seg"><b class="on">{ic("one",20)}</b><b>{ic("two",20)}</b></div></div></div></div>'''
single=f'<div class="tint" style="left:50px;top:120px;width:244px;height:320px"></div><div class="bk" style="left:54px;top:124px;width:236px;height:312px"><div class="p">{L(12)}</div></div>'
spr=f'<div class="tint" style="left:20px;top:150px;width:304px;height:260px"></div><div class="bk" style="left:24px;top:154px;width:296px;height:252px"><div class="p l">{L(10)}</div><div class="p r">{L(10)}</div></div><div class="fold" style="left:172px;top:128px;height:304px"></div>'
c1=camv('5 · Camera, single page: destination chip on top, tap to change folder',single,'Page 18 · hold steady')
c2=camv('5b · Camera, book spread: one fold bar, pages counted as pairs',spr,'Spread 7 of notes · 14 pages so far')
page3('v3-5-camera','Camera',c1,c2)

# 6 SAVE
m6=mob3('6 · Make PDF: one sheet, three choices',f'''<div class="hdr"><div class="ib">{ic("x")}</div><h2>Make PDF</h2><span style="width:42px"></span></div>
<div style="padding:4px 16px"><div class="preview" style="margin:0"><div style="width:54px;height:70px;flex:none">{P(6)}</div><div style="flex:1"><b>Notes · Chapter 4</b><div class="mut" style="font-size:12px">17 pages · about 3.1 MB</div></div></div></div>
<div class="sheet"><div class="opt on"><div class="i2">{ic("pdf",20)}</div><div><b>One PDF</b><span>All 17 pages, spreads split to single pages</span></div></div>
<div class="opt"><div class="i2">{ic("two",20)}</div><div><b>Keep spreads as wide pages</b><span>Left and right on one sheet</span></div></div>
<div class="opt"><div class="i2">{ic("compress",20)}</div><div><b>Smaller file</b><span>Under 1 MB, text stays readable</span></div></div>
<div class="btnbig" style="margin:14px 0 4px">Save to Biology</div><div style="display:flex;gap:10px"><div class="btn" style="flex:1">{ic("share",18)} Share</div><div class="btn" style="flex:1">{ic("dl",18)} Download</div></div></div>''')
d6=desk3('6 · Desktop',f'''<div style="display:flex;gap:24px;flex:1;align-items:center;justify-content:center"><div class="card" style="padding:12px;width:190px;height:250px"><div class="p">{L(16)}</div></div>
<div style="width:320px"><b style="font-size:24px">Make PDF</b><div class="mut" style="margin-bottom:6px">17 pages · about 3.1 MB</div><div class="opt on"><div class="i2">{ic("pdf",20)}</div><div><b>One PDF</b><span>Spreads split to single pages</span></div></div><div class="opt"><div class="i2">{ic("two",20)}</div><div><b>Keep spreads wide</b><span>Left and right together</span></div></div><div class="opt"><div class="i2">{ic("compress",20)}</div><div><b>Smaller file</b><span>Under 1 MB</span></div></div>
<div class="btnbig" style="margin:14px 0 8px">Save to Biology</div><div style="display:flex;gap:10px"><div class="btn" style="flex:1">Share</div><div class="btn" style="flex:1">Download</div></div></div></div>''')
page3('v3-6-save','Save',m6,d6)

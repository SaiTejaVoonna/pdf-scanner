"""Overall mock set v4: flat PDF list + one auto-saved draft, Material 3 look, plus flow and architecture schemas."""
src = open('build_mocks3.py').read().split('# 1 HOME = FOLDERS')[0]
exec(src)
I.update({'folderopen':'<path d="M3 6h7l2 2h9v3H3zM3 11h18l-2 8H5z"/>','cloud':'<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4.5 4.5 0 0 1 17 18z"/>','trash':'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>','info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'})
CSS4='''
.entry{display:flex;gap:10px;padding:6px 16px 4px}.entry div{flex:1;background:var(--surface);border:1px solid var(--line);border-radius:24px;padding:16px 6px;display:flex;flex-direction:column;align-items:center;gap:8px;font-weight:700;font-size:13px}
.entry .ic3{width:50px;height:50px;border-radius:50%;background:var(--pc);color:var(--soft);display:grid;place-items:center}
.entry .main{background:var(--pri);border-color:transparent;color:#fff}.entry .main .ic3{background:#ffffff30;color:#fff}
.banner{margin:10px 16px 4px;background:#1a2a55;border:1px solid #3d5bb5;border-radius:22px;padding:12px 14px;display:flex;gap:12px;align-items:center}
.banner .th2{width:42px;height:54px;flex:none}.banner b{display:block}.banner span{font-size:12px;color:#b4c5ff}
.banner .go{background:#fff;color:#14213d;border-radius:99px;padding:8px 14px;font-weight:800;font-size:13px}
.dlist{flex:1;overflow:hidden;min-height:0}.ph .h1{flex:none}.lbl2{flex:none}.entry,.banner{flex:none}
.lbl2{padding:14px 16px 4px;display:flex;justify-content:space-between;font-weight:700}
.tabs2{display:flex;gap:8px;padding:2px 16px 6px}.tabs2 span{border:1px solid var(--line);border-radius:99px;padding:6px 13px;font-size:13px;color:var(--muted)}.tabs2 .on{background:var(--pc);color:#fff;border-color:transparent}
.set{margin:8px 16px;background:var(--surface);border:1px solid var(--line);border-radius:22px}.set div{display:flex;gap:12px;align-items:center;padding:14px;border-bottom:1px solid var(--line)}.set div:last-child{border:0}.set b{display:block}.set span{font-size:12px;color:var(--muted)}.sw{margin-left:auto;width:42px;height:24px;border-radius:99px;background:var(--pri);position:relative}.sw:after{content:"";position:absolute;right:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff}.sw.off{background:var(--surface2)}.sw.off:after{right:auto;left:3px;background:var(--muted)}
'''
def page4(name,label,*cols):
    open(name+'.html','w').write(f'<!doctype html><meta charset="utf-8"><title>{label}</title><style>{CSS}{CSS2}{CSS3}{CSS4}</style><body>{"".join(cols)}</body>')
def tab4(a):
    it=lambda n,i:f'<div class="{"on" if n==a else ""}">{ic(i,22)}{n}</div>'
    return f'<div class="tab">{it("PDFs","pdf")}{it("Tools","tools")}<div class="fab">{ic("cam",26)}</div>{it("Search","search")}{it("Settings","gear")}</div>'
def mob4(t,body,tab=None): return f'<div class="col"><h3>{t}</h3><div class="ph"><div class="sb"><span>9:41</span><span></span></div>{body}{tab4(tab) if tab else ""}</div></div>'
def side4(a):
    items=[('pdf','PDFs'),('tools','Tools'),('search','Search'),('gear','Settings')]
    return '<h4>PDF Scanner</h4>'+''.join(f'<div class="{"on" if n==a else ""}">{ic(i,18)}{n}</div>' for i,n in items)
def desk4(t,body,a='PDFs'): return f'<div class="col"><h3>{t}</h3><div class="dk"><div class="chrome"><b></b><b></b><b></b><span>saitejavoonna.github.io/pdf-scanner</span></div><div class="dkb"><div class="side">{side4(a)}</div><div class="main">{body}</div></div></div></div>'
pdfs=[('Biology notes ch4','17 pages · 3.1 MB · today'),('Lab report','8 pages · 980 KB · Oct 22'),('Rent receipt','1 page · 210 KB · Oct 20'),('ID card','2 pages · 450 KB · Oct 18')]
prow=lambda n,m:f'<div class="drow"><div class="th2">{P(6)}</div><div style="flex:1"><b>{n}</b><span>{m}</span></div><div class="ib">{ic("more",18)}</div></div>'
entry=lambda:f'<div class="entry"><div class="main"><div class="ic3">{ic("cam",24)}</div>Scan</div><div><div class="ic3">{ic("img",24)}</div>Import</div><div><div class="ic3">{ic("tools",24)}</div>Tools</div></div>'

def pc(n,extra=''): return f'<div class="pc2">{extra}<div class="m">{ic("minus",13)}</div>{P(9)}<span class="n">{n}</span><span class="h">{ic("drag",15)}</span></div>'
spread=lambda a,chk='':f'<div class="pc2 wide"><div class="m">{ic("minus",13)}</div>{chk}<div style="flex:1">{P(9)}</div><div style="flex:1">{P(9)}</div><span class="n">{a}</span><span class="h">{ic("drag",15)}</span></div>'
hd=lambda x,y,c='var(--soft)':f'<div class="hd" style="left:{x-10}px;top:{y-10}px;background:{c}"></div>'
tl=lambda items:'<div class="tools3">'+''.join(f'<div class="{"on" if o else ""}"><i>{ic(i,22)}</i>{n}</div>' for i,n,o in items)+'</div>'
# 1 HOME
banner=f'<div class="banner"><div class="th2">{P(5)}</div><div style="flex:1"><b>Continue scanning</b><span>Draft · 4 pages · saved automatically</span></div><div class="go">Open</div></div>'
m1=mob4('1 · Home: three ways in, then your PDFs',f'<div class="h1">PDF Scanner</div><div class="sub2">Private. Saved on this device.</div>{entry()}{banner}<div class="lbl2"><span>PDFs</span><span class="mut" style="font-weight:400">Newest</span></div><div class="dlist">{"".join(prow(*p) for p in pdfs)}</div>','PDFs')
d1=desk4('1 · Desktop',f'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:26px">PDFs</b><div class="btn pri">{ic("cam",16)} Scan</div></div>{banner}<div class="dlist" style="padding:0;margin-top:10px">{"".join(prow(*p) for p in pdfs)}</div>')
page4('v4-1-home','Home',m1,d1)
# 2 DRAFT
m2=mob4('2 · Draft: pages being collected (auto-saved). Spread = one tile',f'''<div class="hdr"><div class="ib">{ic("back")}</div><div style="flex:1;text-align:center"><b style="font-size:17px">New scan</b><div class="mut" style="font-size:12px">Draft · 4 pages · saved</div></div><div class="ib">{ic("trash",18)}</div></div>
<div class="pg2">{pc("1")}{pc("2")}{spread("3–4")}</div>
<div class="bar3"><div class="ib">{ic("cam",20)}</div><div class="ib">{ic("img",20)}</div><div class="go">Create PDF</div></div>''')
d2=desk4('2 · Desktop',f'''<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div><b style="font-size:24px">New scan</b><div class="mut" style="font-size:13px">Draft · 4 pages · saved automatically</div></div><div style="display:flex;gap:8px"><div class="btn">Discard</div><div class="btn pri">Create PDF</div></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">{"".join(f'<div class="pc2" style="height:150px"><div class="m">{ic("minus",13)}</div>{P(9)}<span class="n">{i}</span></div>' for i in range(1,5))}</div>''')
page4('v4-2-draft','Draft',m2,d2)
# 3 camera + 4 edit reuse v3 style
def camv4(t,mid,counter,sp=False):
    return f'''<div class="col"><h3>{t}</h3><div class="ph"><div class="sb" style="color:#fff;position:absolute;top:0;left:0;right:0;z-index:3"><span>9:41</span><span></span></div><div class="cam"><div style="position:absolute;top:34px;left:12px;right:12px;display:flex;justify-content:space-between;z-index:3"><div class="ib d">{ic("x")}</div><div class="target">Draft · 4 pages</div><div class="ib d">{ic("bolt")}</div></div>{mid}<div style="position:absolute;bottom:12px;left:0;right:0;text-align:center"><span class="pill"><span class="dot"></span> {counter}</span></div></div><div class="ctl"><div style="width:52px;height:52px;border-radius:12px;background:#f3f1ea;border:2px solid #fff"></div><div class="shut"></div><div class="seg"><b class="on">{ic("one",20)}</b><b>{ic("two",20)}</b></div></div></div></div>'''
single=f'<div class="tint" style="left:50px;top:120px;width:244px;height:320px"></div><div class="bk" style="left:54px;top:124px;width:236px;height:312px"><div class="p">{L(12)}</div></div>'
spr=f'<div class="tint" style="left:20px;top:150px;width:304px;height:260px"></div><div class="bk" style="left:24px;top:154px;width:296px;height:252px"><div class="p l">{L(10)}</div><div class="p r">{L(10)}</div></div><div class="fold" style="left:172px;top:128px;height:304px"></div>'
page4('v4-3-camera','Camera',camv4('3 · Camera: green = auto-captures, same engine as import',single,'Page 5 · hold steady'),camv4('3b · Spread mode: one fold bar',spr,'Spread 3 · 6 pages so far'))
nbk2=lambda l,t,w,h,ac:f'<div class="nbk" style="left:{l}px;top:{t}px;width:{w}px;height:{h}px;border-color:{ac}">{L(12)}</div>'
stage=f'<div class="stage3" style="background:#3b3330">{nbk2(32,86,284,300,"var(--soft)")}{hd(32,86)}{hd(316,86)}{hd(32,386)}{hd(316,386)}<div class="wchip">{ic("warn",18)} Writing touches the right edge<u>Fix</u></div></div>'
page4('v4-4-edit','Edit',mob4('4 · Edit page: photo gets most of the screen',f'<div class="hdr"><div class="ib">{ic("back")}</div><b style="font-size:18px">Edit page 3</b><div class="btn pri" style="padding:10px 18px">Apply</div></div>{stage}{tl([("crop","Crop",1),("rot","Rotate",0),("wand","Auto",0),("edit","Look",0)])}<div class="flt"><div class="on"><div class="t"></div>Original</div><div><div class="t" style="background:#f2efe3"></div>Clean</div><div><div class="t" style="background:#aaa"></div>Gray</div><div><div class="t" style="background:#fff;border-color:#444"></div>B&amp;W</div></div><div style="height:12px"></div>'))
# 5 PDF detail
m5=mob4('5 · A PDF: reopen pages, share, rename, delete with undo',f'''<div class="hdr"><div class="ib">{ic("back")}</div><b style="font-size:18px">Biology notes ch4</b><div class="ib">{ic("more")}</div></div>
<div class="mut" style="padding:0 16px">17 pages · 3.1 MB · Oct 25</div>
<div class="pg2" style="flex:1">{pc("1")}{pc("2")}{spread("3–4")}</div>
<div class="bar3"><div class="ib">{ic("plus")}</div><div class="ib">{ic("share",20)}</div><div class="go">Save changes</div></div>''')
m5b=mob4('5b · More menu',f'''<div class="hdr"><div class="ib">{ic("x")}</div><b style="font-size:18px">Biology notes ch4</b><span style="width:42px"></span></div><div class="set">{"".join(f'<div>{ic(i,22)}<b>{t}</b></div>' for i,t in [("edit","Rename"),("compress","Make smaller"),("share","Share"),("dl","Download"),("cloud","Back up to my Drive"),("trash","Delete")])}</div>''')
page4('v4-5-pdf','PDF',m5,m5b)
# 6 tools + 7 settings
tools=[('compress','Compress PDF','#173f9e','#b4c5ff'),('resize','Resize photo','#3a2a6b','#d0bcff'),('comb','Combine PDFs','#14452e','#7ee2a0'),('split','Split PDF','#5a3a14','#ffcf8a'),('user','Passport photo','#5a1d3a','#ffb0d0'),('sign','Sign','#123b4a','#9fe3ff')]
m6=mob4('6 · Tools: icon plus two words',f'<div class="h1">Tools</div><div class="sub2">Work on a PDF or a photo.</div><div class="tg2">{"".join(f"<div class=tt>{ic3(i,bg,fg)}{n}</div>" for i,n,bg,fg in tools)}</div>','Tools')
m7=mob4('7 · Settings: privacy first, backup is optional and yours',f'''<div class="h1">Settings</div><div class="set"><div>{ic("lock",22)}<div style="display:block"><b>Stays on this device</b><span>Nothing is uploaded unless you back up</span></div></div><div>{ic("cloud",22)}<div style="display:block"><b>Back up to my Google Drive</b><span>Off · your own account</span></div><i class="sw off"></i></div><div>{ic("wand",22)}<div style="display:block"><b>Auto-capture</b><span>When the page is green</span></div><i class="sw"></i></div><div>{ic("two",22)}<div style="display:block"><b>Book reading order</b><span>Right-to-left books</span></div><i class="sw off"></i></div><div>{ic("info",22)}<div style="display:block"><b>Credits and licences</b><span>Open-source parts we use</span></div></div></div>''','Settings')
page4('v4-6-tools-settings','Tools and settings',m6,m7)

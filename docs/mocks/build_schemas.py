"""Flow map and architecture schema as SVG pages. Run: python3 build_schemas.py"""
BG='#121318'
def box(x,y,w,h,t,sub='',c='#1e1f25',s='#45464f',tc='#e3e2e9'):
    lines=t.split('\n'); out=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="{c}" stroke="{s}" stroke-width="1.5"/>'
    n=len(lines)+(1 if sub else 0); y0=y+h/2-(n-1)*10+5
    for i,l in enumerate(lines): out+=f'<text x="{x+w/2}" y="{y0+i*20}" text-anchor="middle" fill="{tc}" font-size="15" font-weight="700">{l}</text>'
    if sub: out+=f'<text x="{x+w/2}" y="{y0+len(lines)*20}" text-anchor="middle" fill="#a9aab5" font-size="12">{sub}</text>'
    return out
def arrow(x1,y1,x2,y2,label='',c='#8aa4ff',dash=False):
    d=' stroke-dasharray="6 5"' if dash else ''
    o=f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="2"{d} marker-end="url(#a)"/>'
    if label: o+=f'<text x="{(x1+x2)/2}" y="{(y1+y2)/2-6}" text-anchor="middle" fill="#cdd3ea" font-size="12">{label}</text>'
    return o
def page(name,title,w,h,body):
    open(name+'.html','w').write(f'<!doctype html><meta charset="utf-8"><title>{title}</title><body style="margin:0;background:{BG};font-family:system-ui,sans-serif"><svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs><marker id="a" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0 0L10 4L0 8z" fill="#8aa4ff"/></marker></defs><text x="30" y="40" fill="#fff" font-size="22" font-weight="800">{title}</text>{body}</svg>')
B='#173f9e';G='#14452e';O='#5a3a14';R='#5a1d3a';V='#3a2a6b'
# FLOW
f=box(40,120,160,70,'Home','3 ways in + PDF list',B,'#b4c5ff')
f+=box(280,60,150,60,'Camera','single or spread',c='#1e1f25')+box(280,140,150,60,'Import','gallery, screenshots')+box(280,220,150,60,'Share Target','from other apps')
f+=box(520,120,170,70,'DRAFT','auto-saved pages',O,'#ffcf8a')
f+=box(520,250,170,60,'Edit page / spread','crop · rotate · look')
f+=box(780,120,170,70,'Create PDF','one sheet, 3 choices',G,'#7ee2a0')
f+=box(1040,120,170,70,'PDF saved','in the PDF list',G,'#7ee2a0')
f+=box(1040,250,170,60,'PDF detail','reopen · add · reorder')
f+=box(1040,360,170,60,'Share · Download\nBack up to my Drive')
f+=box(40,330,160,70,'Tools','compress · resize · merge',V,'#d0bcff')
f+=box(280,350,170,60,'Pick file or photo')+box(520,350,170,60,'Rules / presets','KB, mm, DPI, crop')+box(780,350,170,60,'Result','before and after',G,'#7ee2a0')
f+=box(40,470,200,60,'Settings','privacy · backup · credits')
f+=box(780,250,200,60,'Force close / leave','draft kept, banner on Home',R,'#ffb0d0')
f+=arrow(200,150,280,90)+arrow(200,155,280,170)+arrow(200,165,280,250,'')
f+=arrow(430,90,520,140)+arrow(430,170,520,160)+arrow(430,250,520,175)
f+=arrow(605,190,605,250,'tap page')+arrow(690,150,780,150,'Create PDF')+arrow(950,155,1040,155)
f+=arrow(1125,190,1125,250)+arrow(1125,310,1125,360)+arrow(1040,285,690,170,'save changes',dash=True)
f+=arrow(120,190,120,330,'')+arrow(200,365,280,380)+arrow(450,380,520,380)+arrow(690,380,780,380)+arrow(950,380,1040,160,'Save to PDFs',dash=True)
f+=arrow(690,175,780,262,'',c='#ffb0d0',dash=True)
page('v4-7-flow','Screen flow',1260,570,f)
# ARCHITECTURE
a=''
a+=f'<text x="40" y="80" fill="#8d93a1" font-size="13" font-weight="700">1 · INPUT (all go through the same door)</text>'
for i,(t,s) in enumerate([('Live camera','video frames'),('Shutter','full-res photo'),('Gallery','import'),('Screenshot','import'),('Share Target','from other apps')]):
    a+=box(40+i*190,95,170,56,t,s)
a+=f'<text x="40" y="205" fill="#8d93a1" font-size="13" font-weight="700">2 · ENGINE (Web Worker, offline, on the device)</text>'
a+=box(40,215,200,70,'Normalise','rotation tag · size · colour',B,'#b4c5ff')
a+=box(290,215,200,70,'Detect model','ONNX Runtime Web\nWebGPU / WASM',B,'#b4c5ff')
a+=box(290,300,200,56,'Rule engine','lines · edges (fallback)',B,'#b4c5ff')
a+=box(540,215,200,70,'Agree + confidence','high · medium · low',O,'#ffcf8a')
a+=box(790,215,190,70,'Warp + filters','full-res crop · Clean/Gray/B&W',B,'#b4c5ff')
a+=box(1030,215,170,70,'Page','image + corners + flags',G,'#7ee2a0')
a+=arrow(240,250,290,250)+arrow(490,250,540,250)+arrow(490,328,540,270)+arrow(740,250,790,250)+arrow(980,250,1030,250)
a+=''.join(f'<line x1="{125+i*190}" y1="151" x2="{125+i*190}" y2="178" stroke="#8aa4ff" stroke-width="2"/>' for i in range(5))+'<line x1="125" y1="178" x2="885" y2="178" stroke="#8aa4ff" stroke-width="2"/><line x1="140" y1="178" x2="140" y2="215" stroke="#8aa4ff" stroke-width="2" marker-end="url(#a)"/>'
a+=f'<text x="40" y="420" fill="#8d93a1" font-size="13" font-weight="700">3 · APP (main thread: screens and state)</text>'
a+=box(40,435,200,70,'Screens','Home · Draft · Edit · Tools\nSettings',V,'#d0bcff')
a+=box(290,435,200,70,'Store','draft · PDFs · settings',V,'#d0bcff')
a+=box(540,435,200,70,'Export worker','pdf-lib · size search',V,'#d0bcff')
a+=f'<polyline points="1115,285 1115,395 390,395 390,435" fill="none" stroke="#8aa4ff" stroke-width="2" marker-end="url(#a)"/>'
a+=arrow(240,470,290,470)+arrow(490,470,540,470)
a+=f'<text x="40" y="560" fill="#8d93a1" font-size="13" font-weight="700">4 · STORAGE AND OUTPUT (no server of ours)</text>'
a+=box(40,575,210,70,'IndexedDB','blobs · drafts · PDFs',G,'#7ee2a0')
a+=box(290,575,210,70,'Service worker cache','app + model, works offline',G,'#7ee2a0')
a+=box(540,575,210,70,'Share · Download','files leave only if you choose',G,'#7ee2a0')
a+=box(790,575,260,70,'Optional backup','your own Google Drive app folder',R,'#ffb0d0')
a+=arrow(390,505,150,575)+arrow(640,505,640,575)+arrow(740,490,790,590,'opt-in',c='#ffb0d0',dash=True)
a+=f'<text x="40" y="690" fill="#a9aab5" font-size="13">Nothing is sent to any server during scanning, detecting, cropping or PDF building. The score gate (real photos + stress + junk frames) must pass before any engine change ships.</text>'
page('v4-8-architecture','How it connects',1260,720,a)

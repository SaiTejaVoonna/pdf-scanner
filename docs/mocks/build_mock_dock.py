"""One mock: the bottom dock on Home and on Settings (new look). Run: python3 build_mock_dock.py"""
src = open('build_mocks4.py').read().split('\n# 1 HOME\n')[0]
exec(src)
CSS5 = '''
.tab{padding:8px 6px 16px;background:#14161c;border-top:0;border-radius:24px 24px 0 0;box-shadow:0 -4px 16px #0008}
.tab div{width:58px;font-size:11px;gap:2px;position:relative}
.tab .on{color:#fff}.tab .on:before{content:"";position:absolute;top:-4px;width:52px;height:30px;border-radius:99px;background:#173f9e;z-index:0}
.tab div svg{position:relative;z-index:1}
.sgrp{margin:6px 16px 2px;color:var(--soft);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.set b{font-size:15px}.set div div{border:0;padding:0;flex:1}.set>div{padding:12px 14px}.set span{display:block}
'''
def page5(name,label,*cols):
    open(name+'.html','w').write(f'<!doctype html><meta charset="utf-8"><title>{label}</title><style>{CSS}{CSS2}{CSS3}{CSS4}{CSS5}</style><body>{"".join(cols)}</body>')
banner=f'<div class="banner"><div class="th2">{P(5)}</div><div style="flex:1"><b>Continue scanning</b><span>Draft · 4 pages · auto-saved</span></div><div class="go">Open</div></div>'
home = mob4('Home with the dock', f'<div class="h1">PDF Scanner</div><div class="sub2">Private. Saved on this device.</div>{entry()}{banner}<div class="lbl2"><span>PDFs</span><span class="mut" style="font-weight:400">Newest</span></div><div class="dlist">{"".join(prow(*p) for p in pdfs[:3])}</div>', 'PDFs')
row = lambda i,t,s,sw=None: f'<div>{ic(i,22)}<div style="display:block"><b>{t}</b><span>{s}</span></div>{sw or ""}</div>'
sw = lambda on=True: f'<i class="sw{"" if on else " off"}"></i>'
settings = mob4('Settings with the dock', f'''<div class="h1">Settings</div>
<div class="sgrp">Scanning</div><div class="set">{row("wand","Auto-crop camera photos","Crop the page when you take it",sw(True))}{row("img","Auto-crop imported images","Crop photos you import",sw(False))}{row("two","Book reads right to left","Right page comes first",sw(False))}</div>
<div class="sgrp">Your files</div><div class="set">{row("lock","Stays on this device","Nothing is uploaded unless you back up")}{row("cloud","Back up everything","Save a ZIP of all your PDFs")}</div>
<div class="sgrp">About</div><div class="set">{row("info","Credits and licences","Open-source parts we use")}</div>''', 'Settings')
page5('v5-dock','Dock', home, settings)

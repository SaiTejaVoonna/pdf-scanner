"""Mock screens in the Notebook direction (see DESIGN.md). Run: python3 build_notebook.py && node render.cjs notebook"""
import base64
FONT = base64.b64encode(open('fonts/BricolageGrotesque.woff2', 'rb').read()).decode()
I = lambda d, w=22, c='currentColor': f'<svg width="{w}" height="{w}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{d}</svg>'
IC = {
 'doc': '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>', 'cam': '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.2"/>',
 'tools': '<path d="M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z"/>', 'gear': '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
 'search': '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', 'id': '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8.5" cy="11.5" r="2"/><path d="M13 10h5M13 14h5"/>',
 'book': '<path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5zM12 6v13"/>', 'squeeze': '<path d="M4 12h16M12 3v5M9.5 5.5 12 8l2.5-2.5M12 21v-5M9.5 18.5 12 16l2.5 2.5"/>',
 'photo': '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>', 'face': '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.6"/><path d="M8 17.5c1-2.6 7-2.6 8 0"/>',
 'merge': '<path d="M6 4v5c0 3 6 3 6 6v5M18 4v5c0 3-6 3-6 6"/>', 'split': '<path d="M12 4v6M12 10c0 4-6 3-6 8M12 10c0 4 6 3 6 8"/>', 'order': '<path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3"/>',
 'lock': '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>', 'unlock': '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.5-1.8"/>',
 'sign': '<path d="M4 18c3-6 4-10 6-10s0 8 2 8 2-4 3.5-4 1 3 4.5 3"/>', 'share': '<path d="M12 15V4M8 7.5 12 4l4 3.5M6 12v7h12v-7"/>', 'back': '<path d="M15 6l-6 6 6 6"/>', 'flip': '<path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2M20 4v4h-4M4 20v-4h4"/>',
}
ic = lambda k, w=22, c='currentColor': I(IC[k], w, c)
CSS = f'''
@font-face{{font-family:Bric;src:url(data:font/woff2;base64,{FONT}) format('woff2');font-weight:200 800;font-stretch:75% 100%}}
*{{box-sizing:border-box}} body{{margin:0;background:#D9DCE3;font:16px/1.3 Bric,sans-serif;color:#1B2A8F;font-variation-settings:'opsz' 16}}
.row{{display:flex;gap:44px;padding:44px 44px 34px;align-items:flex-start}} .col{{display:flex;flex-direction:column;gap:14px}}
.cap{{font-size:20px;font-weight:700;color:#1B2A8F}} .sub{{font-size:14.5px;color:#4d5263;max-width:390px;height:38px;margin-top:-10px}}
.phone{{width:390px;height:844px;border-radius:40px;position:relative;overflow:hidden;background:#fff;box-shadow:0 0 0 9px #14161c,0 34px 70px rgba(20,25,50,.28)}}
.phone:before{{content:'';position:absolute;top:0;bottom:0;left:58px;width:1.5px;background:#E58A93;opacity:.75;z-index:1}}
.phone.cam:before{{display:none}}
h1{{font-size:54px;font-weight:800;font-stretch:76%;letter-spacing:-1px;line-height:1;margin:0;padding:64px 20px 14px 74px;font-variation-settings:'opsz' 96}}
.rule{{border-top:1.5px solid #C9D6F2}}
.h{{font-size:14px;font-weight:600;color:#6C7080;padding:16px 20px 6px 74px}}
.r{{display:flex;align-items:center;min-height:62px;padding:8px 18px 8px 0;border-top:1.5px solid #C9D6F2;position:relative}}
.r .m{{width:58px;flex:none;display:grid;place-items:center;color:#1B2A8F}} .r .t{{flex:1;padding-left:16px;min-width:0}}
.r b{{display:block;font-weight:650;font-size:17px}} .r small{{font-size:13.5px;color:#6C7080}}
.sheet{{width:30px;height:39px;background:#fff;border:1.4px solid #1B2A8F;position:relative;clip-path:polygon(0 0,72% 0,100% 22%,100% 100%,0 100%)}}
.sheet:before{{content:'';position:absolute;left:5px;right:5px;top:11px;height:1.3px;background:#9fb0e0;box-shadow:0 5px #9fb0e0,0 10px #9fb0e0,0 15px #9fb0e0,0 20px #9fb0e0}}
.sheet:after{{content:'';position:absolute;right:-1px;top:-1px;width:9px;height:9px;border-left:1.4px solid #1B2A8F;border-bottom:1.4px solid #1B2A8F;background:#fff}}
.hl{{background:#FFE83D;padding:0 .22em;margin:0 -.1em;border-radius:3px 9px 4px 10px/9px 3px 10px 4px;display:inline-block;transform:rotate(-1.2deg)}}
.size{{font-weight:700;font-size:15px;white-space:nowrap}}
.search{{margin:0 18px 12px 74px;height:42px;border:1.5px solid #1B2A8F;border-radius:4px;display:flex;align-items:center;gap:8px;padding:0 12px;color:#6C7080;font-size:16px}}
.two{{display:grid;grid-template-columns:1fr 1fr;border-top:1.5px solid #C9D6F2;margin-left:58px}}
.two a{{display:flex;align-items:center;gap:11px;height:54px;padding-left:16px;font-weight:600;font-size:16px;border-bottom:1.5px solid #C9D6F2}}
.two a:nth-child(odd){{border-right:1.5px solid #C9D6F2}} .two a:nth-last-child(-n+2){{border-bottom:0}}
.dock{{position:absolute;left:0;right:0;bottom:0;height:78px;background:#fff;border-top:1.5px solid #1B2A8F;display:flex;padding:8px 6px 18px;z-index:2}}
.tab{{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:12px;font-weight:500;color:#6C7080}} .tab.on{{color:#1B2A8F;font-weight:750}}
.tab.on span{{border-bottom:2px solid #1B2A8F}}
.nav{{display:flex;align-items:center;gap:10px;padding:58px 18px 12px 0;font-weight:650;font-size:17px}} .nav i{{width:58px;display:grid;place-items:center}}
.btn{{height:54px;border-radius:4px;display:flex;align-items:center;justify-content:center;gap:9px;font-weight:700;font-size:17px;background:#1B2A8F;color:#fff}}
.link{{font-weight:650;font-size:16px;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1.5px}}
.huge{{font-size:104px;font-weight:800;font-stretch:76%;letter-spacing:-3px;line-height:1;font-variation-settings:'opsz' 96}}
.chip{{display:inline-flex;align-items:center;gap:8px;background:#fff;color:#1B2A8F;border-radius:4px;padding:8px 12px;font-size:14px;font-weight:650}}
'''
def dock(on):
    t = [('doc', 'PDFs'), ('cam', 'Scan'), ('tools', 'Tools'), ('gear', 'Settings')]
    return '<div class="dock">' + ''.join(f'<div class="tab {"on" if n == on else ""}">{ic(k, 23)}<span>{n}</span></div>' for k, n in t) + '</div>'
row = lambda margin, title, note, right='': f'<div class="r"><div class="m">{margin}</div><div class="t"><b>{title}</b><small>{note}</small></div>{right}</div>'
sheet = '<div class="sheet"></div>'
size = lambda s: f'<span class="size"><span class="hl">{s}</span></span>'

home = f'''<div class="phone"><h1>PDFs</h1>
<div class="h">For forms</div>
{row(ic("squeeze"), "PDF under 200 KB", "Pick the limit your form asks for")}
{row(ic("face"), "Photo under 50 KB", "Passport size or any size")}
{row(ic("id"), "ID card on one page", "Front and back")}
<div class="rule"></div><div class="h">Still scanning</div>
{row(sheet, "Physics notes", "4 pages, saved as you go", '<span class="link">Open</span>')}
<div class="rule"></div><div class="h">Your PDFs</div>
{row(sheet, "Rent receipt", "1 page, today", size("68 KB"))}
{row(sheet, "Lab report", "2 pages, today", size("135 KB"))}
{row(sheet, "Biology notes ch4", "3 pages, yesterday", size("202 KB"))}
<div class="rule"></div>{dock("PDFs")}</div>'''

grp = lambda name, items: f'<div class="h">{name}</div><div class="two">' + ''.join(f'<a>{ic(k, 21)}{n}</a>' for k, n in items) + '</div>'
tools = f'''<div class="phone"><h1>Tools</h1><div class="search">{ic("search", 18)}Find a tool</div>
{grp("Scan", [("doc", "Document"), ("id", "ID card"), ("book", "Book"), ("face", "Passport photo")])}
<div class="rule"></div>{grp("Make smaller", [("squeeze", "Compress PDF"), ("photo", "Resize photo")])}
<div class="rule"></div>{grp("Organise", [("merge", "Combine"), ("split", "Split"), ("order", "Reorder"), ("doc", "Page numbers")])}
<div class="rule"></div>{grp("Protect", [("unlock", "Remove password"), ("lock", "Add password"), ("sign", "Sign")])}
<div class="rule"></div>{dock("Tools")}</div>'''

result = f'''<div class="phone"><div class="nav"><i>{ic("back")}</i>Compress PDF</div><div class="rule"></div>
<div style="padding:44px 20px 0 74px"><div class="huge"><span class="hl">147 KB</span></div>
<div style="font-size:17px;margin-top:18px;font-weight:600">Under your 200 KB limit.</div>
<div style="font-size:15px;color:#6C7080;margin-top:4px">It was 1.2 MB.</div></div>
<div style="height:40px"></div>
{row(sheet, "Physics notes.pdf", "5 pages, no watermark")}
<div class="rule"></div>
<div style="padding:30px 20px 0 74px"><div class="btn">{ic("share", 20, "#fff")}Share</div>
<div style="display:flex;gap:28px;margin-top:24px"><span class="link">Save to phone</span><span class="link">Do another</span></div></div>
<div style="position:absolute;left:74px;right:20px;bottom:34px;font-size:13.5px;color:#6C7080">Made on this phone. Nothing was uploaded.</div></div>'''

card = lambda label, tilt, done: f'<div style="width:290px;height:182px;border-radius:10px;border:3px {"solid" if done else "dashed"} #fff;background:{"rgba(255,255,255,.2)" if done else "transparent"};transform:rotate({tilt}deg);display:grid;place-items:center;color:#fff;font-weight:650;font-size:17px;margin:0 auto">{label}</div>'
idcard = f'''<div class="phone cam" style="background:linear-gradient(180deg,#3b2e21,#5c4832 45%,#2b2119)">
<div style="position:absolute;top:58px;left:16px;right:16px;display:flex;gap:10px;align-items:center"><span class="chip" style="padding:9px">{ic("back", 20)}</span><span class="chip">Front saved. Now the back.</span></div>
<div style="position:absolute;left:0;right:0;top:170px">{card("Front, saved", -2, True)}</div>
<div style="position:absolute;left:0;right:0;top:410px">{card("Fit the back here", 1.5, False)}</div>
<div style="position:absolute;left:0;right:0;bottom:132px;text-align:center;font-size:14px;color:rgba(255,255,255,.85)">Both sides go on one A4 page</div>
<div style="position:absolute;left:0;right:0;bottom:36px;display:flex;justify-content:center;align-items:center;gap:50px">
 <span class="chip" style="padding:11px">{ic("flip", 22)}</span>
 <span style="width:76px;height:76px;border-radius:50%;border:4px solid #fff;display:grid;place-items:center"><i style="width:60px;height:60px;border-radius:50%;background:#fff;display:block"></i></span>
 <span class="chip">1 of 2</span></div></div>'''

screens = [('home', home, 'Home', 'A notebook page: form shortcuts, then your PDFs with sizes highlighted'), ('tools', tools, 'Tools', 'A plain index on ruled lines, grouped by what you want to do'),
           ('result', result, 'Result', 'The size is the answer, so it gets the highlighter'), ('idcard', idcard, 'ID card mode', 'Front and back on one page')]
body = '<div class="row">' + ''.join(f'<div class="col" id="{k}"><div class="cap">{t}</div><div class="sub">{s}</div>{h}</div>' for k, h, t, s in screens) + '</div>'
open('notebook.html', 'w').write(f'<!doctype html><meta charset="utf-8"><title>Notebook mocks</title><style>{CSS}</style><body>{body}</body>')
print('wrote notebook.html')

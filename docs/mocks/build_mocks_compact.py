"""Compact mock set (smaller type, Google/Material-style layout) and the three navigation options side by side.
Run: python3 build_mocks_compact.py && node render_next.cjs  -> compact-1-nav, compact-2-screens, compact-3-more (.html/.png)."""
exec(open('build_mocks_next.py').read().split('CSS = r"""')[0])
I.update({'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>', 'sort': '<path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3"/>',
          'text': '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', 'id': '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 16c.8-1.6 2-2.3 3.5-2.3s2.7.7 3.5 2.3M14 10h4M14 13h3"/>',
          'sign': '<path d="M3 17c3 0 4-6 6-6s1 6 3 6 3-4 5-4 2 2 4 2M3 21h18"/>', 'lock': '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
          'inbox': '<path d="M4 13l2-8h12l2 8v6H4zM4 13h5l1 2h4l1-2h5"/>'})

CSS = r"""
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Roboto,"Google Sans",-apple-system,"SF Pro Text","Segoe UI",sans-serif;background:#e8e8e6;padding:30px;display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start;-webkit-font-smoothing:antialiased}
.col{display:flex;flex-direction:column;gap:10px}.col>h3{font-size:13.5px;color:#4a4b50;font-weight:600;padding-left:4px}
.col>p.why{font-size:12px;color:#66676d;max-width:300px;padding-left:4px;line-height:1.45}
.ph{--bg:#f7f7f5;--card:#fff;--text:#1f1f1f;--mut:#6f7076;--line:rgba(0,0,0,.08);--acc:#2f54eb;--acc-soft:#e3e9fd;--chip:#eef0f4;
 width:300px;height:640px;border-radius:40px;overflow:hidden;position:relative;color:var(--text);font-size:13.5px;border:7px solid #151515;box-shadow:0 24px 50px rgba(0,0,0,.2);background:var(--bg)}
.ph.dark{--bg:#121316;--card:#1c1d21;--text:#e8e8ea;--mut:#9a9ba2;--line:rgba(255,255,255,.08);--acc:#a4b6ff;--acc-soft:#26304f;--chip:#24262c}
.ph.cam{background:#000;color:#fff}
.sb{height:34px;display:flex;justify-content:space-between;align-items:center;padding:0 22px;font-weight:600;font-size:12px;position:relative;z-index:30}
.sb:after{content:"";position:absolute;left:50%;top:8px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#000}
.scroll{position:absolute;inset:34px 0 0;overflow:hidden}
/* Google-style search bar with the settings button inside */
.sbar{margin:6px 12px 10px;height:46px;border-radius:99px;background:var(--chip);display:flex;align-items:center;gap:10px;padding:0 6px 0 16px;color:var(--mut);font-size:14px}
.sbar .av{margin-left:auto;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--text)}
.h2{font-size:12px;font-weight:600;color:var(--mut);padding:12px 18px 4px;letter-spacing:.2px}
.chips{display:flex;gap:6px;padding:2px 12px 6px;overflow:hidden}
.chip{height:32px;padding:0 9px 0 7px;border-radius:9px;border:1px solid var(--line);display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;white-space:nowrap;background:var(--card)}
.qa{display:flex;justify-content:space-between;padding:0 16px 8px}.qa div{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11.5px;font-weight:500;width:58px}.qa i{width:48px;height:40px;border-radius:14px;display:grid;place-items:center;background:var(--chip);color:var(--acc);font-style:normal}
.chip svg{color:var(--acc)}.chip.on{background:var(--acc-soft);border-color:transparent}
.row{display:flex;align-items:center;gap:12px;padding:8px 14px;min-height:60px}
.row b{font-size:14px;font-weight:500;display:block}.row small{font-size:12px;color:var(--mut)}.row .end{margin-left:auto;color:var(--mut)}
.th{width:34px;height:44px;border-radius:5px;overflow:hidden;flex:none;box-shadow:0 0 0 1px var(--line),0 1px 2px rgba(0,0,0,.1);background:#fbfaf6}
.doc{width:100%;height:100%;background:#fbfaf6;padding:12% 11%;display:flex;flex-direction:column;gap:7%}
.doc i{display:block;height:2px;border-radius:1px;background:#b9b6ae}.doc .h{display:block;height:3.5px;width:70%;border-radius:2px;background:#4b4a46}
.doc.receipt{background:#fff;padding:12% 18%}.doc.hand i{background:#4a63b8;opacity:.55;height:1.6px}.doc.hand{background:#fdfbf2;background-image:repeating-linear-gradient(#fdfbf2 0 9%,#d9e2f3 9% 9.6%)}
.doc .tb{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin:4% 0}.doc .tb s{height:4px;background:#e3e0d8}
.doc .pic{height:28%;border-radius:2px;background:linear-gradient(135deg,#9db4c8,#c9b79a)}
.draft{margin:0 12px 2px;border-radius:16px;background:var(--acc-soft);display:flex;align-items:center;gap:12px;padding:10px 12px}
.draft b{font-size:13.5px;font-weight:600}.draft small{display:block;font-size:12px;color:var(--mut)}.draft .go{margin-left:auto;font-weight:600;color:var(--acc);font-size:13.5px;padding:8px}
/* Material extended FAB */
.fab{position:absolute;right:16px;bottom:22px;height:56px;border-radius:18px;padding:0 20px 0 16px;display:flex;align-items:center;gap:10px;font-weight:600;font-size:14.5px;background:var(--acc);color:#fff;box-shadow:0 6px 16px rgba(47,84,235,.35);z-index:20}
.dark .fab{color:#0f1530}
/* options A and B */
.dock{position:absolute;left:50%;transform:translateX(-50%);bottom:18px;height:58px;border-radius:99px;display:flex;align-items:center;gap:2px;padding:5px;z-index:20;background:rgba(255,255,255,.96);box-shadow:0 8px 24px rgba(0,0,0,.14);border:1px solid var(--line)}
.dock .t{width:64px;height:48px;border-radius:99px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:10px;font-weight:600;color:var(--mut)}
.dock .t.on{color:var(--acc);background:var(--acc-soft)}
.dock .scan{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;color:#fff;background:var(--acc);margin:0 3px}
.round{position:absolute;bottom:18px;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.96);box-shadow:0 8px 24px rgba(0,0,0,.14);border:1px solid var(--line);z-index:20;color:var(--text)}
.lt{font-size:24px;font-weight:600;padding:6px 18px 8px;letter-spacing:-.2px}
.nav{height:52px;display:flex;align-items:center;gap:6px;padding:0 6px}.nav b{font-size:16px;font-weight:500;flex:1}.nav small{display:block;font-size:11.5px;color:var(--mut);font-weight:400}
.ib{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:var(--text)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px 10px;padding:6px 14px}
.tile .paper{aspect-ratio:.75;border-radius:6px;overflow:hidden;box-shadow:0 0 0 1px var(--line),0 1px 3px rgba(0,0,0,.1)}
.tile .lb{display:flex;justify-content:center;align-items:center;gap:4px;font-size:11px;color:var(--mut);margin-top:4px}
.tile .dot{width:6px;height:6px;border-radius:50%;background:#f2a600}
.tile.wide{grid-column:span 2}.tile.wide .paper{aspect-ratio:1.5;display:flex}.tile.wide .paper .doc+.doc{border-left:1px solid #d8d4ca}
.bbar{position:absolute;left:0;right:0;bottom:0;height:76px;display:flex;align-items:center;gap:10px;padding:0 14px 8px;background:var(--bg);border-top:1px solid var(--line)}
.btn{height:44px;border-radius:99px;display:flex;align-items:center;justify-content:center;gap:7px;font-weight:600;font-size:14px;padding:0 18px}
.btn.f{background:var(--acc);color:#fff;flex:1}.dark .btn.f{color:#0f1530}.btn.t{background:var(--acc-soft);color:var(--acc)}.btn.o{border:1px solid var(--line);color:var(--acc)}
/* camera */
.cam .feed{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 30%,#5d5249,#2b2520 70%)}
.cam .sheetp{position:absolute;box-shadow:0 14px 30px rgba(0,0,0,.5)}
.ctop{position:absolute;top:42px;left:10px;right:10px;display:flex;justify-content:space-between;align-items:center;z-index:5}
.cg{background:rgba(20,20,22,.5);backdrop-filter:blur(18px);color:#fff}
.cb{width:38px;height:38px;border-radius:50%;display:grid;place-items:center}
.modes{height:36px;border-radius:99px;display:flex;padding:3px}.modes span{height:30px;padding:0 12px;border-radius:99px;display:flex;align-items:center;font-size:12.5px;font-weight:600;color:rgba(255,255,255,.75)}.modes .on{background:#fff;color:#111}
.hint{position:absolute;left:50%;transform:translateX(-50%);top:88px;height:28px;padding:0 12px;border-radius:99px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;z-index:5;white-space:nowrap}
.hint i{width:7px;height:7px;border-radius:50%;background:#34c759}
.cbot{position:absolute;left:0;right:0;bottom:0;height:120px;display:flex;align-items:center;justify-content:space-between;padding:0 26px 10px;background:linear-gradient(transparent,rgba(0,0,0,.55) 40%);z-index:5}
.shutter{width:64px;height:64px;border-radius:50%;border:3px solid #fff;display:grid;place-items:center}.shutter i{width:52px;height:52px;border-radius:50%;background:#fff;display:block}
.stk{position:relative;width:40px;height:52px}.stk .th{position:absolute;width:38px;height:50px}.stk .th:first-child{transform:rotate(-7deg)}
.badge{position:absolute;right:-7px;top:-7px;min-width:20px;height:20px;border-radius:10px;background:#2f54eb;color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;border:2px solid #000}
.donep{height:40px;padding:0 16px;border-radius:99px;display:flex;align-items:center;font-weight:600;font-size:13.5px;background:#fff;color:#111}
/* edit */
.stage{position:absolute;left:0;right:0;top:86px;bottom:150px;background:#16171a;overflow:hidden}
.edb{position:absolute;left:0;right:0;bottom:0;height:150px;background:var(--bg);padding:10px 8px 0}
.tl{display:flex;justify-content:space-around}.tl div{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:500;color:var(--mut);width:62px}
.tl i{width:52px;height:32px;border-radius:99px;display:grid;place-items:center;font-style:normal;color:var(--text);position:relative}
.tl .on{color:var(--text)}.tl .on i{background:var(--acc-soft);color:var(--acc)}
.tl .on i:after{content:"";position:absolute;right:2px;top:-3px;width:12px;height:12px;border-radius:50%;background:#1e9e4a url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M6 12.5l4 4L18 8' stroke='white' stroke-width='3.6' fill='none' stroke-linecap='round'/></svg>") center/9px no-repeat}
.looks{display:flex;gap:8px;justify-content:center;padding-top:10px}.looks div{text-align:center;font-size:10.5px;color:var(--mut)}
.looks .s{width:40px;height:40px;border-radius:9px;overflow:hidden;margin-bottom:2px;border:2px solid transparent}.looks .on{color:var(--acc);font-weight:600}.looks .on .s{border-color:var(--acc)}
/* sheet */
.scrim{position:absolute;inset:0;background:rgba(0,0,0,.32);z-index:15}
.sheet{position:absolute;left:0;right:0;bottom:0;border-radius:24px 24px 0 0;padding:8px 16px 18px;z-index:16;background:var(--card)}
.grab{width:32px;height:4px;border-radius:9px;background:rgba(120,120,128,.4);margin:0 auto 12px}
.sh{font-size:17px;font-weight:500;padding:0 2px 2px}.shs{font-size:12px;color:var(--mut);padding:0 2px 10px}
.fl{font-size:11.5px;color:var(--mut);font-weight:500;margin:10px 2px 5px}
.inp{height:44px;border-radius:10px;display:flex;align-items:center;padding:0 12px;border:1px solid var(--line);font-size:14px}
.q{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.q div{display:flex;align-items:center;gap:10px;padding:0 12px;height:44px;font-size:13.5px}.q div+div{border-top:1px solid var(--line)}.q small{margin-left:auto;color:var(--mut);font-size:12px}
.q .r{width:18px;height:18px;border-radius:50%;border:2px solid var(--mut)}.q .on .r{border:5px solid var(--acc)}
.item{display:flex;align-items:center;gap:14px;height:50px;font-size:14px;padding:0 4px}.item svg{color:var(--mut)}
/* settings */
.srow{display:flex;align-items:center;gap:14px;padding:0 18px;min-height:56px}.srow b{font-size:14px;font-weight:400;display:block}.srow small{font-size:12px;color:var(--mut)}
.srow svg{color:var(--mut);flex:none}
.sw{margin-left:auto;width:44px;height:26px;border-radius:99px;background:var(--chip);border:2px solid var(--mut);position:relative;flex:none}.sw:after{content:"";position:absolute;left:4px;top:4px;width:14px;height:14px;border-radius:50%;background:var(--mut)}
.sw.on{background:var(--acc);border-color:var(--acc)}.sw.on:after{left:20px;top:2px;width:18px;height:18px;background:#fff}
.segc{display:flex;border:1px solid var(--line);border-radius:99px;overflow:hidden;height:34px;margin-left:auto}.segc span{padding:0 11px;display:grid;place-items:center;font-size:12px;font-weight:500}.segc .on{background:var(--acc-soft);color:var(--acc)}
.tag{font-size:10px;font-weight:700;letter-spacing:.4px;color:var(--acc);background:var(--acc-soft);border-radius:6px;padding:3px 7px;margin-left:auto}
.notes{width:1000px;background:#fff;border-radius:20px;padding:24px 28px;color:#1f1f1f;line-height:1.5;font-size:13.5px;box-shadow:0 16px 40px rgba(0,0,0,.1)}
.notes h2{font-size:19px;margin-bottom:10px}.notes table{border-collapse:collapse;width:100%}.notes td,.notes th{border-bottom:1px solid #eee;padding:8px 9px;text-align:left;vertical-align:top}.notes th{font-size:11.5px;color:#777;text-transform:uppercase;letter-spacing:.4px}
.good{color:#1e7f3c;font-weight:600}.bad{color:#b3261e;font-weight:600}
"""

def phone(title, inner, cls='', why=''):
    return f'<div class="col"><h3>{title}</h3><div class="ph {cls}"><div class="sb"><span>9:41</span><span>▾ ▮</span></div>{inner}</div>{f"<p class=why>{why}</p>" if why else ""}</div>'
def page(name, title, *cols):
    open(name + '.html', 'w').write(f'<!doctype html><meta charset="utf-8"><title>{title}</title><style>{CSS}</style><body>{"".join(cols)}</body>')
def row(n, m, kind='txt'): return f'<div class="row"><div class="th">{doc(kind)}</div><div><b>{n}</b><small>{m}</small></div><span class="end">{ic("more", 18)}</span></div>'
ROWS = row('Rent receipt', '1 page · 68 KB · 19:02', 'receipt') + row('Lab report', '2 pages · 135 KB · 11:40', 'table')
WEEK = row('Biology notes ch4', '17 pages · 3.1 MB · Mon', 'hand') + row('Passport copy', '2 pages · 410 KB · Sun', 'photo') + row('Tax form 2026', '4 pages · 820 KB · Sat', 'table')
DRAFT = f'<div class="draft"><div class="th">{doc("hand")}</div><div><b>Draft · 4 pages</b><small>Not a PDF yet</small></div><span class="go">Continue</span></div>'
TOOLCHIPS = '<div class="qa">' + ''.join(f'<div><i>{ic(i, 20)}</i>{t}</div>' for i, t in [('compress', 'Compress'), ('resize', 'Resize'), ('merge', 'Combine'), ('split', 'Split')]) + '</div>'
def sbar(right='gear'): return f'<div class="sbar">{ic("search", 19)} Search PDFs<span class="av">{ic(right, 20)}</span></div>'
FAB = f'<div class="fab">{ic("cam", 21, 2)}Scan</div>'

# ------------------------------------------------------------- 1 NAVIGATION OPTIONS
A = phone('A · 3-item dock (current mock)', f'<div class="scroll"><div class="lt">PDFs</div>{sbar()}{DRAFT}<div class="h2">Today</div>{ROWS}<div class="h2">This week</div>{WEEK}</div>'
          f'<div class="dock"><div class="t on">{ic("pdf", 20)}PDFs</div><div class="scan">{ic("cam", 22, 2)}</div><div class="t">{ic("tools", 20)}Tools</div></div>',
          why='Tools gets a whole tab for only 4 tools. Two of three places are the same kind of thing (lists).')
B = phone('B · 4 items, search separate (iOS 26 style)', f'<div class="scroll"><div class="lt">PDFs</div>{DRAFT}<div class="h2">Today</div>{ROWS}<div class="h2">This week</div>{WEEK}</div>'
          f'<div class="dock" style="left:14px;transform:none"><div class="t on">{ic("pdf", 20)}PDFs</div><div class="t">{ic("tools", 20)}Tools</div><div class="t">{ic("gear", 20)}Settings</div></div><div class="round" style="right:14px">{ic("search", 22)}</div>',
          why='Apple puts search in its own button for big libraries (Music, Photos). A scanner has tens of PDFs, so it adds a tap without a payoff. Scan would still need a place.')
C = phone('C · Google style (recommended)', f'<div class="scroll">{sbar()}{TOOLCHIPS}{DRAFT}<div class="h2">Today</div>{ROWS}<div class="h2">This week</div>{WEEK}</div>{FAB}',
          why='One screen. Search is always visible (no tap to reach it), the 4 tools are one tap away as quick buttons, Scan is the one big labelled button. Settings sits in the search bar, like Gmail and Drive.')
page('compact-1-nav', 'Compact · Navigation options', A, B, C)

# ------------------------------------------------------------- 2 SCREENS (option C, compact type)
home_dark = phone('Home · dark', f'<div class="scroll">{sbar()}{TOOLCHIPS}{DRAFT}<div class="h2">Today</div>{ROWS}<div class="h2">This week</div>{WEEK}</div>{FAB}', 'dark')
srch = phone('Search', f'<div class="scroll"><div class="sbar" style="background:var(--card);box-shadow:0 1px 4px rgba(0,0,0,.12)">{ic("back", 19)}<span style="color:var(--text)">bio</span><span class="av">{ic("x", 18)}</span></div>'
             f'<div class="chips"><span class="chip on">All</span><span class="chip">This week</span><span class="chip">Over 1 MB</span></div>{row("Biology notes ch4", "17 pages · 3.1 MB · Mon", "hand")}</div>',
             why='Filter chips under the search, like Google Files. One tap back.')
tile = lambda n, k='txt', d=False: f'<div class="tile"><div class="paper">{doc(k)}</div><div class="lb">{"<span class=dot></span>" if d else ""}{n}</div></div>'
wide = lambda n: f'<div class="tile wide"><div class="paper">{doc("hand")}{doc("txt")}</div><div class="lb">{n}</div></div>'
docv = phone('Document (draft)', f'<div class="scroll"><div class="nav"><span class="ib">{ic("back", 21)}</span><b>Biology notes ch4<small>17 pages · draft</small></b><span class="ib">{ic("more", 20)}</span></div>'
             f'<div class="grid">{tile("1", "hand")}{tile("2", "txt", True)}{tile("3", "table")}{wide("4–5")}{tile("6", "photo")}{tile("7")}{tile("8", "hand")}{tile("9", "receipt")}</div></div>'
             f'<div class="bbar"><div class="btn t">{ic("plus", 18, 2.2)}Add</div><div class="btn f">Make PDF</div></div>',
             why='3 pages per row (was 2), so more fits on screen. A plain bottom bar instead of a floating capsule.')
edit = phone('Edit page · Auto applied', f'<div class="scroll"><div class="nav"><span class="ib">{ic("x", 21)}</span><b>Page 2</b><span class="btn" style="color:var(--acc);padding:0 12px">Save</span></div></div>'
             f'<div class="stage"><div style="position:absolute;inset:0;background:#5e554c"></div><div style="position:absolute;left:46px;top:30px;width:196px;height:262px;transform:rotate(-3deg);box-shadow:0 8px 20px rgba(0,0,0,.5)">{doc("txt", 14)}</div>'
             f'<svg style="position:absolute;inset:0" viewBox="0 0 286 374" preserveAspectRatio="none"><polygon points="46,36 240,24 254,286 60,298" fill="none" stroke="#a4b6ff" stroke-width="2"/>'
             + ''.join(f'<circle cx="{x}" cy="{y}" r="8" fill="#fff" stroke="#2f54eb" stroke-width="2.5"/>' for x, y in ((46, 36), (240, 24), (254, 286), (60, 298))) +
             f'</svg></div><div class="edb"><div class="tl"><div><i>{ic("crop", 20)}</i>Crop</div><div class="on"><i>{ic("wand", 20)}</i>Auto</div><div><i>{ic("rot", 20)}</i>Rotate</div><div><i>{ic("look", 20)}</i>Look</div></div>'
             f'<div class="looks"><div class="on"><div class="s">{doc("txt")}</div>Original</div><div><div class="s" style="filter:contrast(1.4)">{doc("txt")}</div>Clear</div><div><div class="s" style="filter:grayscale(1)">{doc("txt")}</div>Gray</div><div><div class="s" style="filter:grayscale(1) contrast(3)">{doc("txt")}</div>B&amp;W</div></div></div>',
             why='Material-style tool pills: the one in use is tinted, Auto keeps a small green tick until you move a corner.')
cam = phone('Camera', f'<div class="feed"></div><div class="sheetp" style="left:44px;top:170px;width:196px;height:262px;transform:rotate(-4deg)">{doc("txt", 14)}</div>'
            f'<svg style="position:absolute;inset:0;z-index:4" viewBox="0 0 286 626" preserveAspectRatio="none"><polygon points="44,168 236,156 250,418 58,432" fill="#34c759" fill-opacity=".1" stroke="#34c759" stroke-width="2.5"/></svg>'
            f'<div class="ctop"><span class="cb cg">{ic("x", 18, 2.2)}</span><div class="modes cg"><span class="on">Page</span><span>Book</span></div><span class="cb cg">{ic("flash", 17)}</span></div>'
            f'<div class="hint cg"><i></i>Hold still</div><div class="cbot"><div class="stk"><div class="th">{doc("txt")}</div><div class="th">{doc("hand")}</div><span class="badge">4</span></div><div class="shutter"><i></i></div><div class="donep">Done</div></div>',
            'cam', why='Smaller controls, the picture gets the screen. Same layout as the Google and Apple camera apps.')
mk = phone('Make PDF', f'<div class="scroll"><div class="nav"><span class="ib">{ic("back", 21)}</span><b>Biology notes ch4<small>17 pages · draft</small></b></div><div class="grid">{tile("1", "hand")}{tile("2")}{tile("3", "table")}</div></div><div class="scrim"></div>'
           f'<div class="sheet"><div class="grab"></div><div class="sh">Make PDF</div><div class="shs">17 pages</div><div class="fl">Name</div><div class="inp">Biology notes ch4</div><div class="fl">Quality</div>'
           f'<div class="q"><div><span class="r"></span>Best<small>6.2 MB</small></div><div class="on"><span class="r"></span>Balanced<small>3.1 MB</small></div><div><span class="r"></span>Small<small>1.4 MB</small></div><div><span class="r"></span>Smallest<small>0.8 MB</small></div></div>'
           f'<div style="display:flex;gap:10px;margin-top:14px"><div class="btn o" style="flex:1">{ic("share", 17)}Share</div><div class="btn f">Save PDF</div></div></div>',
           why='A list with radio buttons is shorter than 4 big cards. Two buttons side by side.')
sett = phone('Settings', f'<div class="scroll"><div class="nav"><span class="ib">{ic("back", 21)}</span><b>Settings</b></div><div class="h2">Scanning</div>'
             f'<div class="srow">{ic("wand", 20)}<b>Auto-crop</b><span class="sw on"></span></div><div class="srow">{ic("cam", 20)}<b>Auto-capture</b><span class="sw"></span></div>'
             f'<div class="srow">{ic("book", 20)}<b>Right-to-left books</b><span class="sw"></span></div><div class="srow">{ic("look", 20)}<b>New pages</b><span class="segc"><span class="on">Original</span><span>Clear</span></span></div>'
             f'<div class="h2">Your files</div><div class="srow">{ic("shield", 20)}<div><b>Stored on this device</b><small>Nothing is uploaded</small></div></div><div class="srow">{ic("archive", 20)}<b>Back up everything</b></div><div class="srow">{ic("trash", 20)}<b>Recently deleted</b></div>'
             f'<div class="h2">About</div><div class="srow">{ic("info", 20)}<div><b>PDF Scanner</b><small>Version 1.0</small></div><span class="tag">PROTOTYPE</span></div></div>',
             why='Plain list, no coloured icon squares, 56 px rows. Opened from the gear in the search bar.')
page('compact-2-screens', 'Compact · Screens', home_dark, srch, docv, edit, cam, mk, sett)

# ------------------------------------------------------------- 3 MISSING FEATURES + NOTES
more = phone('Home · PDF menu (what is new)', f'<div class="scroll">{sbar()}{TOOLCHIPS}<div class="h2">Today</div>{ROWS}</div><div class="scrim"></div>'
             f'<div class="sheet"><div class="grab"></div><div style="display:flex;align-items:center;gap:12px;padding:0 2px 8px"><div class="th">{doc("table")}</div><div><b style="font-weight:500">Lab report</b><small style="display:block;color:var(--mut);font-size:12px">2 pages · 135 KB</small></div></div>'
             + ''.join(f'<div class="item">{ic(i, 20)}{t}</div>' for i, t in [('share', 'Share'), ('edit' if 'edit' in I else 'crop', 'Edit pages'), ('text', 'Copy text (new)'), ('sign', 'Sign (new)'), ('lock', 'Add password (new)'), ('trash', 'Delete')]) + '</div>',
             why='Things people expect from Google Drive scan, Adobe Scan and Microsoft Lens that the app does not have yet.')
notes = '''<div class="notes"><h2>Which navigation, and why</h2><table>
<tr><th style="width:17%">Rule</th><th>What it says</th><th style="width:12%">A · 3 dock</th><th style="width:12%">B · 4 items</th><th style="width:12%">C · Google</th></tr>
<tr><td>Hick's law</td><td>Fewer choices on screen = faster decisions.</td><td>3</td><td>4 + scan</td><td class="good">1 main button</td></tr>
<tr><td>Fitts's law</td><td>Big targets close to the thumb are faster and miss less.</td><td>Scan centre, 54 px</td><td>no Scan slot</td><td class="good">Scan bottom right, labelled, 56 px tall</td></tr>
<tr><td>Navigation bars (Material and Apple guidelines)</td><td>Use a tab bar for 3–5 places of equal weight. Fewer than 3 → no tab bar.</td><td class="bad">Tools is not equal to PDFs (4 tools)</td><td class="bad">Settings and Search are not places you visit often</td><td class="good">1 place → no bar needed</td></tr>
<tr><td>Search visibility</td><td>A visible search field is used more than a search icon (Nielsen Norman Group).</td><td>field, scrolls away</td><td class="bad">behind a button</td><td class="good">always visible</td></tr>
<tr><td>Recognition over recall</td><td>Show options instead of making people remember where they are.</td><td>tools hidden in a tab</td><td>tools hidden in a tab</td><td class="good">tools visible as quick buttons</td></tr>
<tr><td>Size</td><td>Material body text 14 px, titles 16–22 px, list rows 56–72 px.</td><td colspan="2">current mocks: 15–32 px, rows 70+ px (feels bulky)</td><td class="good">13.5–16 px, rows 56–60 px</td></tr>
</table>
<p style="margin-top:12px"><b>Recommendation: C.</b> It is how Google Drive, Gmail and Files by Google work: search bar on top with the settings button in it, the 4 tools as quick buttons, one Scan button. On desktop the same buttons sit next to the search and Scan is a button at the top right.</p>
<h2 style="margin-top:18px">What is missing (compared with Google Drive scan, Adobe Scan, Microsoft Lens)</h2><table>
<tr><th style="width:24%">Feature</th><th>Why people want it</th><th style="width:16%">Effort</th></tr>
<tr><td>Copy text / searchable PDF (OCR)</td><td>Search inside scans, copy a number from a receipt. Can run on the phone (Tesseract in WebAssembly), nothing uploaded.</td><td>Large</td></tr>
<tr><td>Open from other apps</td><td>Share a photo or PDF from Gallery or WhatsApp straight into the app (installed app only).</td><td>Small</td></tr>
<tr><td>ID card mode</td><td>Front and back of a card on one A4 page.</td><td>Medium</td></tr>
<tr><td>Sign</td><td>Draw a signature once, place it on a page.</td><td>Medium</td></tr>
<tr><td>Password-protect PDF</td><td>Send a document safely.</td><td>Medium</td></tr>
<tr><td>Paper size on export</td><td>A4 / Letter / fit to image.</td><td>Small</td></tr>
<tr><td>Select many PDFs on Home</td><td>Delete or share several at once.</td><td>Small</td></tr>
</table></div>'''
open('compact-3-more.html', 'w').write(f'<!doctype html><meta charset="utf-8"><title>Compact · Notes</title><style>{CSS}</style><body>{more}{notes}</body>')
print('ok')

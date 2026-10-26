"""Option D: one uniform 4-item dock (PDFs · Tools · Settings · Scan) in the compact style, plus ideas taken from open-source scanners.
Run: python3 build_mocks_uniform.py && node render_next.cjs  -> compact-4-dock (.html/.png)."""
exec(open('build_mocks_compact.py').read())

CSS += r"""
.udock{position:absolute;left:12px;right:12px;bottom:16px;height:62px;border-radius:99px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:5px;z-index:20;
 background:rgba(255,255,255,.94);backdrop-filter:blur(20px) saturate(170%);box-shadow:0 8px 26px rgba(0,0,0,.13);border:1px solid var(--line)}
.dark .udock{background:rgba(34,35,40,.94)}
.udock div{border-radius:99px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:10.5px;font-weight:600;color:var(--mut)}
.udock .on{background:var(--acc-soft);color:var(--acc)}
.udock .go{background:var(--acc);color:#fff;box-shadow:0 4px 12px rgba(47,84,235,.35)}.dark .udock .go{color:#0f1530}
.tbar{position:absolute;left:12px;right:12px;bottom:16px;height:62px;border-radius:99px;display:flex;align-items:center;gap:4px;padding:5px;z-index:20;
 background:rgba(255,255,255,.94);backdrop-filter:blur(20px);box-shadow:0 8px 26px rgba(0,0,0,.13);border:1px solid var(--line)}
.dark .tbar{background:rgba(34,35,40,.94)}
.tbar .i{width:52px;height:52px;border-radius:99px;display:grid;place-items:center;color:var(--text)}
.tbar .m{flex:1;height:52px;border-radius:99px;display:flex;align-items:center;justify-content:center;gap:7px;font-weight:600;font-size:14px;background:var(--acc);color:#fff}.dark .tbar .m{color:#0f1530}
.loupe{position:absolute;width:86px;height:86px;border-radius:50%;border:3px solid #fff;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.45);z-index:6}
.edge{position:absolute;width:26px;height:8px;border-radius:4px;background:#fff;border:2px solid #2f54eb;z-index:5}
"""

def udock(active='PDFs'):
    it = lambda i, n, cls='': f'<div class="{cls or ("on" if n == active else "")}">{ic(i, 20, 2 if cls else 1.9)}{n}</div>'
    return f'<div class="udock">{it("pdf", "PDFs")}{it("tools", "Tools")}{it("gear", "Settings")}{it("cam", "Scan", "go")}</div>'
SB = f'<div class="sbar">{ic("search", 19)} Search PDFs</div>'
home_body = f'<div class="scroll"><div class="lt">PDFs</div>{SB}{DRAFT}<div class="h2">Today</div>{ROWS}<div class="h2">This week</div>{WEEK}</div>'
D1 = phone('D · one uniform dock (4 items)', home_body + udock(), why='All four the same size and shape in one capsule. Scan is the filled one, at the right end where the right thumb rests (Apple puts its main action there in iOS 26, Google puts the Scan button there in Drive).')
D2 = phone('D · dark', home_body + udock(), 'dark')
tc = lambda i, n, s: f'<div class="row"><div class="th" style="display:grid;place-items:center;background:var(--acc-soft);color:var(--acc);box-shadow:none;border-radius:12px;width:40px;height:40px">{ic(i, 20)}</div><div><b>{n}</b><small>{s}</small></div><span class="end">{ic("chev", 16, 2.2)}</span></div>'
D3 = phone('D · Tools tab', f'<div class="scroll"><div class="lt">Tools</div>{tc("compress", "Compress PDF", "Make a PDF smaller")}{tc("resize", "Resize photo", "Pixels or file size")}{tc("merge", "Combine PDFs", "Join into one")}{tc("split", "Split PDF", "Keep some pages")}'
           f'<div class="h2">Coming next</div><div style="opacity:.5">{tc("text", "Copy text", "Read text from a scan").replace(ic("chev", 16, 2.2), "")}{tc("id", "ID card", "Both sides on one page").replace(ic("chev", 16, 2.2), "")}</div></div>' + udock('Tools'),
           why='A short list instead of big cards: the tab has room to grow (Copy text, ID card) without redesign.')
tile = lambda n, k='txt', d=False: f'<div class="tile"><div class="paper">{doc(k)}</div><div class="lb">{"<span class=dot></span>" if d else ""}{n}</div></div>'
D4 = phone('D · inside a document', f'<div class="scroll"><div class="nav"><span class="ib">{ic("back", 21)}</span><b>Biology notes ch4<small>17 pages · draft</small></b><span class="ib">{ic("more", 20)}</span></div>'
           f'<div class="grid">{tile("1", "hand")}{tile("2", "txt", True)}{tile("3", "table")}{tile("4", "photo")}{tile("5")}{tile("6", "hand")}{tile("7", "receipt")}{tile("8", "table")}{tile("9")}</div></div>'
           f'<div class="tbar"><span class="i">{ic("plus", 22, 2.2)}</span><span class="i">{ic("cam", 21)}</span><span class="m">Make PDF</span></div>',
           why='Same capsule, now a toolbar for this page (Material rule: tabs on main pages, a toolbar on the pages under them). Uniform shape everywhere.')
D5 = phone('Edit · ideas from open-source scanners', f'<div class="scroll"><div class="nav"><span class="ib">{ic("x", 21)}</span><b>Page 2</b><span class="btn" style="color:var(--acc);padding:0 12px">Save</span></div></div>'
           f'<div class="stage"><div style="position:absolute;inset:0;background:#5e554c"></div><div style="position:absolute;left:46px;top:30px;width:196px;height:262px;transform:rotate(-3deg);box-shadow:0 8px 20px rgba(0,0,0,.5)">{doc("txt", 14)}</div>'
           f'<svg style="position:absolute;inset:0" viewBox="0 0 286 374" preserveAspectRatio="none"><polygon points="46,36 240,24 254,286 60,298" fill="none" stroke="#a4b6ff" stroke-width="2"/>'
           + ''.join(f'<circle cx="{x}" cy="{y}" r="8" fill="#fff" stroke="#2f54eb" stroke-width="2.5"/>' for x, y in ((46, 36), (240, 24), (254, 286), (60, 298))) +
           '</svg><div class="edge" style="left:130px;top:26px;transform:rotate(-3deg)"></div><div class="edge" style="left:144px;top:288px;transform:rotate(-3deg)"></div>'
           '<div class="edge" style="left:234px;top:150px;transform:rotate(87deg)"></div><div class="edge" style="left:40px;top:162px;transform:rotate(87deg)"></div>'
           f'<div class="loupe" style="left:150px;top:40px"><div style="position:absolute;inset:0;background:#5e554c"></div><div style="position:absolute;left:-100px;top:43px;width:143px;height:200px;background:#fbfaf6;transform:rotate(-3deg);transform-origin:100% 0"><div style="position:absolute;left:30px;right:14px;top:22px;height:2px;background:#b9b6ae"></div><div style="position:absolute;left:30px;right:14px;top:36px;height:2px;background:#b9b6ae"></div></div>'
           f'<svg style="position:absolute;inset:0" viewBox="0 0 80 80"><circle cx="40" cy="40" r="7" fill="none" stroke="#2f54eb" stroke-width="2.5"/></svg></div></div>'
           f'<div class="edb"><div class="tl"><div><i>{ic("crop", 20)}</i>Crop</div><div class="on"><i>{ic("wand", 20)}</i>Auto</div><div><i>{ic("rot", 20)}</i>Rotate</div><div><i>{ic("look", 20)}</i>Look</div></div></div>',
           why='Two ideas worth taking: a magnifier while you drag a corner (OSS Document Scanner), and handles on the middle of each edge to move a whole side at once (MakeACopy). Both make fixing a bad crop much easier.')
page('compact-4-dock', 'Compact · Uniform dock', D1, D2, D3, D4, D5)
print('ok')

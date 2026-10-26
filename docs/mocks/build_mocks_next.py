"""Next-gen mock set: one dock (Scan inside it), camera in the same glass language, 'Prototype' label, fixes from the UI audit.
Run: python3 build_mocks_next.py  -> next-1-home.html ... next-4-notes.html (render PNGs with render_next.mjs)."""

I = {
 'pdf': '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
 'tools': '<path d="M14.7 6.3a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="M5 5l4 4"/>',
 'gear': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
 'cam': '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
 'search': '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
 'plus': '<path d="M12 5v14M5 12h14"/>', 'x': '<path d="M6 6l12 12M18 6L6 18"/>', 'back': '<path d="M15 5l-7 7 7 7"/>',
 'chev': '<path d="M9 5l7 7-7 7"/>', 'more': '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
 'check': '<path d="M5 12.5l4.5 4.5L19 7"/>', 'img': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l5-5 4 4 2-2 5 5"/>',
 'one': '<rect x="7" y="4" width="10" height="16" rx="1.5"/>', 'book': '<path d="M3 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h7z"/>',
 'flash': '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', 'crop': '<path d="M7 3v14h14M3 7h14v14"/>', 'rot': '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
 'wand': '<path d="M5 19L15 9M14 5v2M19 10h-2M17.5 6.5L16 8M12 4l.5 1M20 12l-1 .5"/>', 'look': '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
 'share': '<path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7"/>', 'compress': '<path d="M4 14h6v6M20 10h-6V4M10 14l-6 6M14 10l6-6"/>',
 'resize': '<path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/>', 'merge': '<path d="M6 3v5a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v5M18 3v5a4 4 0 0 1-4 4"/>',
 'split': '<path d="M12 3v7M12 10l-6 4v7M12 10l6 4v7"/>', 'trash': '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
 'shield': '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>', 'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
 'archive': '<path d="M4 5h16v4H4zM5 9v10h14V9M10 13h4"/>', 'undo': '<path d="M9 8H4V3M4 8a9 9 0 1 1-1 7"/>', 'auto': '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/>',
}
def ic(n, s=22, w=1.9): return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">{I[n]}</svg>'

# Page thumbnails that look like different real documents.
def doc(kind='txt', n=9):
    if kind == 'receipt':
        body = '<b class="h" style="width:46%;margin:0 auto 5px"></b>' + ''.join(f'<i style="width:{w}%"></i>' for w in (80, 70, 76, 64, 72)) + '<b class="h" style="width:86%;height:2px;margin:5px 0"></b><i style="width:50%;margin-left:auto"></i>'
    elif kind == 'table':
        body = '<b class="h" style="width:56%"></b>' + '<div class="tb">' + '<s></s>' * 12 + '</div>' + ''.join('<i></i>' for _ in range(3))
    elif kind == 'photo':
        body = '<b class="h" style="width:62%"></b><div class="pic"></div>' + ''.join('<i></i>' for _ in range(4))
    elif kind == 'hand':
        body = ''.join(f'<i class="hw" style="width:{w}%"></i>' for w in (88, 92, 75, 90, 84, 93, 70, 88, 80))
    else:
        body = '<b class="h"></b>' + ''.join('<i></i>' for _ in range(n))
    return f'<div class="doc {kind}">{body}</div>'

CSS = r"""
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;background:#e7e6e2;padding:34px;display:flex;gap:30px;flex-wrap:wrap;align-items:flex-start;-webkit-font-smoothing:antialiased}
.col{display:flex;flex-direction:column;gap:12px}.col>h3{font-size:14px;color:#55565c;font-weight:600;padding-left:6px}
.col>p.why{font-size:12.5px;color:#6b6c72;max-width:330px;padding-left:6px;line-height:1.45}
.ph{--bg:#f5f4f1;--card:#fff;--text:#1d1d1f;--mut:#86868b;--line:rgba(60,60,67,.12);--acc:#2f54eb;--acc-soft:rgba(47,84,235,.10);
 --glass:rgba(255,255,255,.62);--gline:rgba(255,255,255,.9);--bar:rgba(250,250,248,.72);--shadow:0 10px 30px rgba(30,40,80,.10);
 width:330px;height:714px;border-radius:50px;overflow:hidden;position:relative;color:var(--text);font-size:15px;border:9px solid #111;box-shadow:0 30px 60px rgba(0,0,0,.22);
 background:radial-gradient(90% 45% at 0% 0%,#dfe7ff 0%,transparent 60%),radial-gradient(80% 40% at 100% 0%,#fdebdc 0%,transparent 62%),var(--bg)}
.ph.dark{--bg:#0e0f11;--card:#1c1c1e;--text:#f5f5f7;--mut:#8e8e93;--line:rgba(255,255,255,.09);--acc:#8aa4ff;--acc-soft:rgba(138,164,255,.14);
 --glass:rgba(40,40,44,.55);--gline:rgba(255,255,255,.10);--bar:rgba(28,28,30,.7);--shadow:0 10px 30px rgba(0,0,0,.4);
 background:radial-gradient(90% 45% at 0% 0%,#1b2340 0%,transparent 60%),radial-gradient(80% 40% at 100% 0%,#2a1d18 0%,transparent 62%),var(--bg)}
.ph.cam{background:#000;color:#fff}
.sb{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 28px;font-weight:600;font-size:14px;position:relative;z-index:30}
.sb:after{content:"";position:absolute;left:50%;top:9px;width:96px;height:26px;margin-left:-48px;border-radius:20px;background:#000}
.scroll{position:absolute;inset:44px 0 0;overflow:hidden;padding-bottom:120px}
.glass{background:var(--glass);border:1px solid var(--gline);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%)}
.lt{display:flex;align-items:flex-end;justify-content:space-between;padding:6px 18px 10px}.lt h1{font-size:32px;font-weight:700;letter-spacing:-.6px}
.cbtn{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:var(--acc)}
.search{margin:0 16px 14px;height:38px;border-radius:12px;display:flex;align-items:center;gap:7px;padding:0 11px;color:var(--mut);background:rgba(118,118,128,.12)}
.sec{font-size:13px;font-weight:600;color:var(--mut);padding:10px 22px 7px;letter-spacing:.1px}
.group{margin:0 16px;border-radius:18px;overflow:hidden;box-shadow:var(--shadow)}
.row{display:flex;align-items:center;gap:12px;padding:10px 12px;position:relative}.row+.row:before{content:"";position:absolute;left:66px;right:0;top:0;height:1px;background:var(--line)}
.row b{font-size:15.5px;font-weight:600;display:block}.row small{font-size:12.5px;color:var(--mut)}.row .end{margin-left:auto;color:var(--mut)}
.th{width:42px;height:54px;border-radius:7px;overflow:hidden;flex:none;box-shadow:0 1px 3px rgba(0,0,0,.18),0 0 0 .5px rgba(0,0,0,.12);background:#fbfaf6}
.doc{width:100%;height:100%;background:#fbfaf6;padding:12% 11%;display:flex;flex-direction:column;gap:7%}
.doc i{display:block;height:2px;border-radius:1px;background:#b9b6ae}.doc .h{display:block;height:4px;width:70%;border-radius:2px;background:#4b4a46}
.doc.receipt{background:#fff;padding:12% 18%}.doc.hand i{background:#4a63b8;opacity:.55;height:1.6px;transform:rotate(-.6deg)}.doc.hand{background:#fdfbf2;background-image:repeating-linear-gradient(#fdfbf2 0 9%,#d9e2f3 9% 9.6%)}
.doc .tb{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin:4% 0}.doc .tb s{height:5px;background:#e3e0d8;border:0}
.doc .pic{height:28%;border-radius:2px;background:linear-gradient(135deg,#9db4c8,#c9b79a)}
.cont{margin:0 16px 4px;border-radius:20px;padding:12px;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow)}
.cont .stack{position:relative;width:46px;height:58px}.cont .stack .th{position:absolute;width:40px;height:52px}.cont .stack .th:first-child{transform:rotate(-6deg);left:-2px}.cont .stack .th:last-child{left:4px;top:2px}
.pill{height:34px;padding:0 15px;border-radius:99px;display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:14px;background:var(--acc);color:#fff}.dark .pill{color:#0e1430}
.tag{font-size:11px;font-weight:700;letter-spacing:.3px;color:var(--mut);border:1px solid var(--line);border-radius:99px;padding:2px 8px}
/* ONE dock: tabs and Scan in the same capsule */
.dock{background:rgba(252,252,250,.95)!important;position:absolute;left:50%;transform:translateX(-50%);bottom:24px;height:66px;border-radius:99px;display:flex;align-items:center;gap:4px;padding:6px;z-index:20;box-shadow:0 14px 34px rgba(20,30,70,.18)}
.dock .t{width:76px;height:54px;border-radius:99px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:10.5px;font-weight:600;color:var(--mut)}
.dock .t.on{color:var(--acc);background:var(--acc-soft)}
.dock .scan{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(160deg,#4d6ff5,#2f54eb);box-shadow:0 6px 16px rgba(47,84,235,.38),inset 0 1px 0 rgba(255,255,255,.35);margin:0 4px}
.dark .dock{background:rgba(32,32,36,.95)!important}.dark .dock .scan{background:linear-gradient(160deg,#a3b6ff,#7f98f5);color:#0e1430}
.bar{position:absolute;left:14px;right:14px;bottom:24px;height:66px;border-radius:99px;display:flex;align-items:center;gap:8px;padding:6px;z-index:20;box-shadow:0 14px 34px rgba(20,30,70,.18)}
.bar .c{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;color:var(--acc);background:var(--acc-soft)}
.bar .main{flex:1;height:54px;border-radius:99px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;color:#fff;background:linear-gradient(160deg,#4d6ff5,#2f54eb);box-shadow:0 6px 16px rgba(47,84,235,.3)}
.toast{position:absolute;left:20px;right:20px;bottom:104px;height:50px;border-radius:99px;display:flex;align-items:center;gap:10px;padding:0 8px 0 18px;font-size:14.5px;z-index:19;background:rgba(30,30,32,.82);color:#fff;backdrop-filter:blur(20px);box-shadow:0 10px 26px rgba(0,0,0,.25)}
.toast .ok{color:#34c759}.toast b{margin-left:auto;color:#a8bbff;padding:8px 12px}
.nav{position:absolute;top:44px;left:0;right:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;z-index:10}
.nav .ttl{text-align:center}.nav .ttl b{font-size:16px;display:block}.nav .ttl small{font-size:12px;color:var(--mut)}
.nb{min-width:40px;height:40px;border-radius:99px;display:grid;place-items:center;color:var(--acc);font-weight:600;padding:0 10px}
.nb.g{background:var(--glass);border:1px solid var(--gline);backdrop-filter:blur(20px)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 14px;padding:4px 18px}
.tile{position:relative}.tile .paper{aspect-ratio:.76;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.1)}
.tile .lb{display:flex;justify-content:center;align-items:center;gap:5px;font-size:12px;color:var(--mut);margin-top:6px;font-weight:600}
.tile .dot{width:7px;height:7px;border-radius:50%;background:#ffb300}
.tile.wide{grid-column:span 2}.tile.wide .paper{aspect-ratio:1.52;display:flex;gap:0}.tile.wide .paper .doc+.doc{border-left:1px solid #d8d4ca}
.tile.sel .paper{box-shadow:0 0 0 3px var(--acc),0 4px 12px rgba(47,84,235,.25)}
.tile .ck{position:absolute;right:8px;top:8px;width:24px;height:24px;border-radius:50%;background:var(--acc);color:#fff;display:grid;place-items:center;border:2px solid #fff}
/* Camera */
.cam .feed{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 30%,#5d5249,#2b2520 70%)}
.cam .table{position:absolute;inset:0;background:repeating-linear-gradient(95deg,rgba(255,255,255,.025) 0 3px,transparent 3px 11px)}
.cam .sheetp{position:absolute;box-shadow:0 18px 40px rgba(0,0,0,.55)}
.cam .top{position:absolute;top:52px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:center;z-index:5}
.cg{background:rgba(30,30,32,.45);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(24px) saturate(160%);color:#fff}
.cam .rb{width:42px;height:42px;border-radius:50%;display:grid;place-items:center}
.modes{height:42px;border-radius:99px;display:flex;padding:4px;gap:2px}.modes span{height:34px;padding:0 13px;border-radius:99px;display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600;color:rgba(255,255,255,.75)}
.modes .on{background:#fff;color:#111}
.hint{position:absolute;left:50%;transform:translateX(-50%);top:108px;height:34px;padding:0 14px;border-radius:99px;display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;z-index:5;white-space:nowrap}
.hint .d{width:8px;height:8px;border-radius:50%;background:#34c759;box-shadow:0 0 0 4px rgba(52,199,89,.25)}.hint.warn .d{background:#ffcc00;box-shadow:0 0 0 4px rgba(255,204,0,.25)}
.outline{position:absolute;inset:0;z-index:4}
.camdock{position:absolute;left:14px;right:14px;bottom:24px;height:92px;border-radius:46px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;z-index:6}
.shutter{width:72px;height:72px;border-radius:50%;border:4px solid #fff;display:grid;place-items:center}.shutter i{display:block;width:58px;height:58px;border-radius:50%;background:#fff}
.camdock .stk{position:relative;width:52px;height:64px}.camdock .stk .th{position:absolute;width:44px;height:58px;border-radius:7px}.camdock .stk .th:first-child{transform:rotate(-7deg)}
.camdock .badge{position:absolute;right:-6px;top:-6px;min-width:22px;height:22px;border-radius:11px;background:#2f54eb;color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center;border:2px solid #000;padding:0 5px}
.donebtn{height:48px;padding:0 20px;border-radius:99px;display:flex;align-items:center;font-weight:700;background:#fff;color:#111}
/* Edit */
.stage{position:absolute;left:0;right:0;top:96px;bottom:190px;background:#16171a;overflow:hidden}
.edtools{position:absolute;left:14px;right:14px;bottom:24px;border-radius:30px;padding:10px 8px 12px;z-index:9}
.tl{display:flex;justify-content:space-around}.tl div{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--mut);width:64px}
.tl i{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-style:normal;color:var(--text);position:relative}
.tl .on{color:var(--acc)}.tl .on i{background:var(--acc);color:#fff}.tl .done{color:var(--acc)}.tl .done i{background:var(--acc-soft);color:var(--acc)}
.tl .done i:after{content:"";position:absolute;right:-3px;top:-3px;width:14px;height:14px;border-radius:50%;background:#34c759 url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M6 12.5l4 4L18 8' stroke='white' stroke-width='3.4' fill='none' stroke-linecap='round'/></svg>") center/10px no-repeat;border:2px solid var(--card)}
.looks{display:flex;gap:10px;justify-content:center;padding:10px 0 0;border-top:1px solid var(--line);margin-top:10px}.looks div{text-align:center;font-size:10.5px;color:var(--mut);font-weight:600}
.looks .lsw{width:46px;height:46px;border-radius:12px;overflow:hidden;margin-bottom:3px;border:2px solid transparent}.looks .on{color:var(--acc)}.looks .on .lsw{border-color:var(--acc)}
/* Sheet */
.scrim{position:absolute;inset:0;background:rgba(0,0,0,.3);z-index:15}
.sheet{position:absolute;left:8px;right:8px;bottom:8px;border-radius:38px;padding:10px 16px 18px;z-index:16;box-shadow:0 -10px 40px rgba(0,0,0,.18)}
.ph:not(.dark) .sheet{background:rgba(250,250,248,.86)}
.grab{width:36px;height:5px;border-radius:9px;background:rgba(120,120,128,.35);margin:0 auto 12px}
.sh{display:flex;justify-content:space-between;align-items:center;padding:0 2px 10px}.sh b{font-size:19px}.sh small{display:block;font-size:13px;color:var(--mut);font-weight:500}
.q{display:grid;grid-template-columns:1fr 1fr;gap:8px}.q div{border-radius:16px;padding:11px 12px;border:1.5px solid var(--line);background:var(--card)}
.q div b{display:block;font-size:14.5px}.q div small{font-size:12.5px;color:var(--mut)}.q .on{border-color:var(--acc);background:var(--acc-soft)}.q .on small{color:var(--acc)}
.fieldl{font-size:12.5px;color:var(--mut);font-weight:600;margin:12px 4px 5px}
.inp{height:46px;border-radius:14px;display:flex;align-items:center;padding:0 14px;background:var(--card);border:1px solid var(--line)}
.btnp{height:54px;border-radius:99px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:16px;color:#fff;background:linear-gradient(160deg,#4d6ff5,#2f54eb);box-shadow:0 8px 20px rgba(47,84,235,.3);margin-top:14px}
.btnt{height:46px;display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--acc)}
/* Tools */
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px}
.tcard{height:118px;border-radius:22px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:var(--shadow)}
.tcard .ti{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:#fff}.tcard b{font-size:15px;display:block}.tcard small{font-size:12.5px;color:var(--mut)}
.seg{display:flex;padding:3px;border-radius:12px;background:rgba(118,118,128,.14)}.seg span{flex:1;text-align:center;height:38px;display:grid;place-items:center;font-size:13.5px;font-weight:600;border-radius:10px;color:var(--mut)}.seg .on{background:var(--card);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.14)}
.srow{display:flex;align-items:center;gap:12px;padding:11px 12px;position:relative;min-height:52px}.srow+.srow:before{content:"";position:absolute;left:54px;right:0;top:0;height:1px;background:var(--line)}
.srow .si{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#fff;flex:none}.srow b{font-size:15px;font-weight:500;display:block}.srow small{font-size:12.5px;color:var(--mut)}
.sw{margin-left:auto;width:51px;height:31px;border-radius:99px;background:rgba(120,120,128,.28);position:relative;flex:none}.sw:after{content:"";position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.2)}
.sw.on{background:#34c759}.sw.on:after{left:22px}
.chips{display:flex;gap:8px;flex-wrap:wrap}.chips span{height:38px;padding:0 14px;border-radius:99px;display:inline-flex;align-items:center;font-size:14px;font-weight:600;background:var(--card);border:1px solid var(--line)}.chips .on{background:var(--acc);color:#fff;border-color:transparent}
/* notes page */
.notes{width:1100px;background:#fff;border-radius:24px;padding:28px 32px;color:#1d1d1f;line-height:1.5;font-size:14.5px;box-shadow:0 20px 50px rgba(0,0,0,.12)}
.notes h2{font-size:22px;margin-bottom:12px}.notes table{border-collapse:collapse;width:100%}.notes td,.notes th{border-bottom:1px solid #eee;padding:9px 10px;text-align:left;vertical-align:top}.notes th{font-size:12.5px;color:#86868b;text-transform:uppercase;letter-spacing:.4px}
.mini{display:flex;gap:28px;align-items:center;margin:4px 0 18px}.mini .lbl{font-size:12.5px;color:#86868b;font-weight:600;margin-bottom:6px}
"""

def phone(title, inner, cls='', why=''):
    w = f'<p class="why">{why}</p>' if why else ''
    return f'<div class="col"><h3>{title}</h3><div class="ph {cls}"><div class="sb"><span>9:41</span><span>●●●</span></div>{inner}</div>{w}</div>'
def page(name, title, *cols):
    open(name + '.html', 'w').write(f'<!doctype html><meta charset="utf-8"><title>{title}</title><style>{CSS}</style><body>{"".join(cols)}</body>')
def dock(active='PDFs'):
    t = lambda i, n: f'<div class="t{" on" if n == active else ""}">{ic(i, 22)}{n}</div>'
    return f'<div class="dock glass">{t("pdf", "PDFs")}<div class="scan">{ic("cam", 26, 2)}</div>{t("tools", "Tools")}</div>'
def row(n, m, kind='txt', end=None):
    return f'<div class="row"><div class="th">{doc(kind)}</div><div><b>{n}</b><small>{m}</small></div><span class="end">{end or ic("more", 20)}</span></div>'
def nav(title, sub='', left=ic('back', 22, 2.2), right=''):
    return f'<div class="nav"><div class="nb g">{left}</div><div class="ttl"><b>{title}</b>{f"<small>{sub}</small>" if sub else ""}</div><div class="nb g">{right}</div></div>' if right else \
           f'<div class="nav"><div class="nb g">{left}</div><div class="ttl"><b>{title}</b>{f"<small>{sub}</small>" if sub else ""}</div><div class="nb"></div></div>'

# ------------------------------------------------------------------------- 1 HOME
def home(cls='', toast=False):
    cont = f'<div class="cont glass"><div class="stack"><div class="th">{doc("hand")}</div><div class="th">{doc("txt")}</div></div><div style="flex:1"><b style="font-size:15.5px">Draft · 4 pages</b><small style="display:block;color:var(--mut);font-size:12.5px">Today 19:16</small></div><span class="pill">Open</span></div>'
    today = row('Rent receipt', '1 page · 68 KB', 'receipt') + row('Lab report', '2 pages · 135 KB', 'table')
    week = row('Biology notes ch4', '17 pages · 3.1 MB', 'hand') + row('Passport copy', '2 pages · 410 KB', 'photo') + row('Tax form 2026', '4 pages · 820 KB', 'table')
    t = '<div class="toast"><span class="ok">' + ic('check', 18, 2.6) + '</span>4 pages added<b>Undo</b></div>' if toast else ''
    return (f'<div class="scroll"><div class="lt"><h1>PDFs</h1><div class="cbtn glass" style="border-radius:50%">{ic("gear", 21)}</div></div>'
            f'<div class="search">{ic("search", 17)} Search</div>{cont}<div class="sec">Today</div><div class="group glass">{today}</div>'
            f'<div class="sec">This week</div><div class="group glass">{week}</div></div>{t}{dock()}')
h1 = phone('Home', home(), why='One dock: PDFs · Scan · Tools. Settings moves to the gear (like Apple apps). Real page thumbnails, Today / This week groups.')
h2 = phone('Home · dark', home('dark'), 'dark', why='Same layout in dark. Glass only on bars, cards and the dock; pages stay solid paper.')
h3 = phone('One message at a time', home(toast=True), why='A single pill above the dock. It replaces the previous one and fades after 3 s, so messages never pile up.')
empty = phone('First run', f'<div class="scroll"><div class="lt"><h1>PDFs</h1><div class="cbtn glass" style="border-radius:50%">{ic("gear", 21)}</div></div>'
              f'<div style="text-align:center;padding:90px 34px 0"><div class="glass" style="width:96px;height:96px;border-radius:30px;margin:0 auto 18px;display:grid;place-items:center;color:var(--acc);box-shadow:var(--shadow)">{ic("pdf", 44, 1.6)}</div>'
              f'<b style="font-size:21px;display:block;margin-bottom:6px">No PDFs yet</b><span style="color:var(--mut)">Scan a page or import photos.</span>'
              f'<div class="btnt" style="margin-top:14px">{ic("img", 20)}&nbsp;Import photos</div></div></div>{dock()}',
              why='Two short lines. The Scan button in the dock is the main action, so the empty screen does not repeat it.')
page('next-1-home', 'Next · Home', h1, h2, h3, empty)

# ------------------------------------------------------------------------- 2 CAMERA
def outline(pts, col='#34c759'):
    return f'<svg class="outline" viewBox="0 0 312 696" preserveAspectRatio="none"><polygon points="{pts}" fill="{col}" fill-opacity=".12" stroke="{col}" stroke-width="3" stroke-linejoin="round"/></svg>'
def camdock(n=4):
    return (f'<div class="camdock cg"><div class="stk"><div class="th">{doc("txt")}</div><div class="th">{doc("hand")}</div><span class="badge">{n}</span></div>'
            f'<div class="shutter"><i></i></div><div class="donebtn">Done</div></div>')
def camtop(book=False):
    return (f'<div class="top"><div class="rb cg">{ic("x", 20, 2.2)}</div><div class="modes cg"><span class="{"" if book else "on"}">{ic("one", 17)} Page</span><span class="{"on" if book else ""}">{ic("book", 17)} Book</span></div><div class="rb cg">{ic("flash", 19)}</div></div>')
c1 = phone('Camera · page found', f'<div class="feed"></div><div class="table"></div><div class="sheetp" style="left:50px;top:190px;width:212px;height:290px;transform:rotate(-4deg)">{doc("txt", 14)}</div>'
          + outline('52,186 256,176 270,466 62,482') + camtop() + '<div class="hint cg"><span class="d"></span>Hold still</div>' + camdock(),
          'cam', why='Same glass as the app: the controls are one capsule (pages · shutter · Done), the mirror of the home dock. Mode switch says Page / Book in words.')
c2 = phone('Camera · book', f'<div class="feed"></div><div class="table"></div><div class="sheetp" style="left:18px;top:210px;width:276px;height:230px;display:flex">{doc("txt", 11)}<div style="width:1px;background:#cfcabd"></div>{doc("table")}</div>'
          + outline('16,206 296,206 296,444 16,444') + '<svg class="outline" viewBox="0 0 312 696" preserveAspectRatio="none"><line x1="156" y1="196" x2="156" y2="454" stroke="#34c759" stroke-width="3" stroke-dasharray="6 5"/></svg>'
          + camtop(True) + '<div class="hint cg"><span class="d"></span>2 pages found</div>' + camdock(6),
          'cam', why='Book mode: one dashed fold line, green when both pages are seen. No extra bars or text on the picture.')
c3 = phone('Camera · needs help', f'<div class="feed" style="filter:brightness(.45)"></div><div class="table"></div><div class="sheetp" style="left:60px;top:220px;width:200px;height:270px;transform:rotate(8deg);opacity:.6">{doc("txt", 12)}</div>'
          + camtop() + '<div class="hint cg warn"><span class="d"></span>Too dark · turn on the light</div>' + camdock(0).replace('<span class="badge">0</span>', ''),
          'cam', why='One short hint at the top, amber dot. Never a paragraph on top of the camera.')
page('next-2-camera', 'Next · Camera', c1, c2, c3)

# ------------------------------------------------------------------------- 3 DOCUMENT, EDIT, MAKE PDF
tile = lambda n, kind='txt', check=False, sel=False: f'<div class="tile{" sel" if sel else ""}"><div class="paper">{doc(kind)}</div><div class="lb">{"<span class=dot></span>" if check else ""}{n}</div>{"<span class=ck>" + ic("check", 14, 3) + "</span>" if sel else ""}</div>'
wide = lambda n: f'<div class="tile wide"><div class="paper">{doc("hand")}{doc("txt")}</div><div class="lb">{n}</div></div>'
pages_inner = (nav('Biology notes ch4', '17 pages · draft', right=ic('more', 20)) +
               f'<div class="scroll" style="top:100px"><div class="grid">{tile("1", "hand")}{tile("2", "txt", True)}{wide("3–4")}{tile("5", "table")}{tile("6", "photo")}</div></div>'
               f'<div class="bar glass"><div class="c">{ic("plus", 24, 2.2)}</div><div class="main">Make PDF</div></div>')
d1 = phone('Document', pages_inner, why='Every page is the same paper tile with the number under it. A spread is one wide tile. Amber dot = check this page. Bottom bar is the same capsule shape as the dock.')
ed = phone('Edit page · Auto applied', nav('Page 2', '', left='<span style="font-size:15px">Cancel</span>', right='<span style="font-size:15px;font-weight:700">Save</span>') +
          f'<div class="stage"><div style="position:absolute;inset:0;background:#5e554c"></div><div style="position:absolute;left:44px;top:34px;width:220px;height:300px;transform:rotate(-3deg);box-shadow:0 10px 24px rgba(0,0,0,.5)">{doc("txt", 14)}</div>'
          f'<svg style="position:absolute;inset:0" viewBox="0 0 312 428" preserveAspectRatio="none"><polygon points="44,40 262,28 276,326 58,340" fill="none" stroke="#8aa4ff" stroke-width="2.5"/>'
          + ''.join(f'<circle cx="{x}" cy="{y}" r="10" fill="#fff" stroke="#2f54eb" stroke-width="3"/>' for x, y in ((44, 40), (262, 28), (276, 326), (58, 340))) +
          f'</svg></div><div class="edtools glass"><div class="tl"><div>{"<i>" + ic("crop", 22) + "</i>"}Crop</div><div class="done"><i>{ic("wand", 22)}</i>Auto</div><div><i>{ic("rot", 22)}</i>Rotate</div><div><i>{ic("look", 22)}</i>Look</div></div>'
          f'<div class="looks"><div class="on"><div class="lsw">{doc("txt")}</div>Original</div><div><div class="lsw" style="filter:contrast(1.4)">{doc("txt")}</div>Clear</div><div><div class="lsw" style="filter:grayscale(1)">{doc("txt")}</div>Gray</div><div><div class="lsw" style="filter:grayscale(1) contrast(3)">{doc("txt")}</div>B&amp;W</div></div></div>',
          'dark', why='Auto shows it was applied (tinted with a green tick) until you move a corner. Tools and looks sit in one glass panel, not two bars.')
mk = phone('Make PDF', pages_inner.replace('class="bar glass"', 'class="bar glass" style="display:none"') + '<div class="scrim"></div>' +
          f'<div class="sheet glass"><div class="grab"></div><div class="sh"><div><b>Make PDF</b><small>17 pages</small></div></div>'
          f'<div class="fieldl" style="margin-top:0">Name</div><div class="inp">Biology notes ch4</div><div class="fieldl">Quality</div>'
          f'<div class="q"><div><b>Best</b><small>≈ 6.2 MB</small></div><div class="on"><b>Balanced</b><small>≈ 3.1 MB</small></div><div><b>Small</b><small>≈ 1.4 MB</small></div><div><b>Smallest</b><small>≈ 0.8 MB</small></div></div>'
          f'<div class="btnp">Save PDF</div><div class="btnt">Share</div></div>',
          why='Plain names: Best · Balanced · Small · Smallest, with the size. One main button. No long notes.')
page('next-3-document', 'Next · Document, edit, make PDF', d1, ed, mk)

# ------------------------------------------------------------------------- 4 TOOLS AND SETTINGS
tc = lambda col, i, n, s: f'<div class="tcard glass"><div class="ti" style="background:{col}">{ic(i, 22, 2)}</div><div><b>{n}</b><small>{s}</small></div></div>'
tools = phone('Tools', f'<div class="scroll"><div class="lt"><h1>Tools</h1></div><div class="tgrid">{tc("#2f54eb", "compress", "Compress", "Shrink a PDF")}{tc("#8e5cf7", "resize", "Resize photo", "Size or file size")}{tc("#34a853", "merge", "Combine", "Join PDFs")}{tc("#f29900", "split", "Split", "Pick pages")}</div></div>{dock("Tools")}',
              why='Four equal cards, one-line descriptions, icons aligned. No subtitle line.')
rs = phone('Resize photo', nav('Resize photo') + f'<div class="scroll" style="top:100px;padding:0 16px">'
           f'<div class="cont glass" style="margin:0 0 14px"><div class="th">{doc("photo")}</div><div style="flex:1"><b>IMG_2041.jpg</b><small style="display:block;color:var(--mut);font-size:12.5px">4032 × 3024 · 3.4 MB</small></div><span style="color:var(--acc);font-weight:600">Change</span></div>'
           f'<div class="seg" style="margin-bottom:12px"><span class="on">By size</span><span>Exact pixels</span></div>'
           f'<div class="chips"><span>Large</span><span class="on">Medium</span><span>Small</span><span>Custom</span></div>'
           f'<div class="fieldl">Max file size</div><div style="display:flex;gap:8px"><div class="inp" style="flex:1">200</div><div class="seg" style="width:120px"><span class="on">KB</span><span>MB</span></div></div>'
           f'<div class="btnp" style="margin-top:22px">Resize</div></div>', why='"Max file size" with a KB / MB switch instead of two KB boxes and a sentence.')
st = phone('Settings', nav('Settings') + f'<div class="scroll" style="top:100px"><div class="sec" style="padding-top:2px">Scanning</div><div class="group glass">'
           f'<div class="srow"><span class="si" style="background:#2f54eb">{ic("wand", 18, 2)}</span><div><b>Auto-crop</b></div><span class="sw on"></span></div>'
           f'<div class="srow"><span class="si" style="background:#34a853">{ic("cam", 18, 2)}</span><div><b>Auto-capture</b></div><span class="sw"></span></div>'
           f'<div class="srow"><span class="si" style="background:#f29900">{ic("book", 18, 2)}</span><div><b>Right-to-left books</b></div><span class="sw"></span></div>'
           f'<div class="srow"><span class="si" style="background:#8e5cf7">{ic("look", 18, 2)}</span><div><b>Look for new pages</b></div><span class="end" style="margin-left:auto;color:var(--mut)">Original</span></div></div>'
           f'<div class="sec">Your files</div><div class="group glass"><div class="srow"><span class="si" style="background:#34c759">{ic("shield", 18, 2)}</span><div><b>Stored on this device</b><small style="display:block">Nothing is uploaded</small></div></div>'
           f'<div class="srow"><span class="si" style="background:#5ac8fa">{ic("archive", 18, 2)}</span><div><b>Back up everything</b></div><span class="end" style="margin-left:auto;color:var(--mut)">{ic("chev", 16, 2.2)}</span></div>'
           f'<div class="srow"><span class="si" style="background:#ff3b30">{ic("trash", 18, 2)}</span><div><b>Recently deleted</b></div><span class="end" style="margin-left:auto;color:var(--mut)">{ic("chev", 16, 2.2)}</span></div></div>'
           f'<div class="sec">About</div><div class="group glass"><div class="srow"><span class="si" style="background:#8e8e93">{ic("info", 18, 2)}</span><div><b>PDF Scanner</b><small style="display:block">Version 1.0</small></div><span class="tag" style="margin-left:auto">PROTOTYPE</span></div></div></div>',
           why='Opened from the gear on PDFs. Auto-capture speed appears only after Auto-capture is turned on. "beta" becomes "Prototype".')
st2 = phone('Settings · auto-capture on', nav('Settings') + f'<div class="scroll" style="top:100px"><div class="sec" style="padding-top:2px">Scanning</div><div class="group glass">'
           f'<div class="srow"><span class="si" style="background:#2f54eb">{ic("wand", 18, 2)}</span><div><b>Auto-crop</b></div><span class="sw on"></span></div>'
           f'<div class="srow"><span class="si" style="background:#34a853">{ic("cam", 18, 2)}</span><div><b>Auto-capture</b></div><span class="sw on"></span></div>'
           f'<div class="srow" style="display:block;padding-left:54px"><div class="seg"><span>Fast</span><span class="on">Normal</span><span>Careful</span></div></div>'
           f'<div class="srow"><span class="si" style="background:#f29900">{ic("book", 18, 2)}</span><div><b>Right-to-left books</b></div><span class="sw"></span></div></div></div>',
           'dark', why='The speed choice slides in under its switch, so every visible setting does something.')
page('next-4-tools-settings', 'Next · Tools and settings', tools, rs, st, st2)

# ------------------------------------------------------------------------- 5 NOTES
old_dock = '<div style="display:flex;gap:10px;align-items:center"><div style="height:58px;width:220px;border-radius:30px;background:#f1f1f3;border:1px solid #e3e3e6;display:flex;justify-content:space-around;align-items:center;color:#86868b;font-size:11px">PDFs&nbsp;&nbsp;Tools&nbsp;&nbsp;Settings</div><div style="width:58px;height:58px;border-radius:50%;background:#3552d9"></div></div>'
new_dock = '<div class="ph" style="width:auto;height:auto;border:0;box-shadow:none;background:none;border-radius:0"><div class="dock glass" style="position:static;transform:none;background:#f1f1f3;border-color:#e3e3e6">' + dock()[len('<div class="dock glass">'):]
notes = f'''<div class="notes"><h2>Next-gen UI: what changes and why</h2>
<div class="mini"><div><div class="lbl">NOW · two docks</div>{old_dock}</div><div style="font-size:26px;color:#c7c7cc">→</div><div><div class="lbl">NEXT · one dock</div>{new_dock}</div></div>
<table><tr><th style="width:26%">Change</th><th>Why</th></tr>
<tr><td><b>One dock</b>: PDFs · Scan · Tools</td><td>Tab bar and Scan button were two floating shapes. One capsule is calmer and Scan sits in the middle where the thumb is. Settings is used rarely, so it moves to a gear on PDFs (like Photos, Files and Notes).</td></tr>
<tr><td><b>Camera blends in</b></td><td>The camera uses the same glass: one capsule for pages · shutter · Done (it mirrors the dock), Page / Book in words, one short hint pill. Fewer separate buttons on the picture.</td></tr>
<tr><td><b>"Prototype" instead of beta</b></td><td>Settings › About shows "Prototype · version 1.0" with a small tag. No other place shows a version.</td></tr>
<tr><td><b>One message at a time</b></td><td>Messages used to pile up (four stacked toasts covering Settings). Now: one pill above the dock, replaces the last one, fades after 3 s.</td></tr>
<tr><td><b>Auto shows it was applied</b></td><td>Tinted with a green tick until you move a corner. Tools and looks share one glass panel.</td></tr>
<tr><td><b>Real thumbnails, date groups</b></td><td>Home shows the actual first page and groups Today / This week / Earlier, so it is easy to find a PDF without reading.</td></tr>
<tr><td><b>One tile style</b></td><td>Every page is the same paper tile with its number below; a spread is one wide tile; amber dot = check.</td></tr>
<tr><td><b>Plain words</b></td><td>Best · Balanced · Small · Smallest. "Max file size" with KB / MB. Tools cards have one-line descriptions and equal height.</td></tr>
<tr><td><b>Settings only show what works</b></td><td>Auto-capture speed appears only when Auto-capture is on.</td></tr>
<tr><td><b>Desktop</b></td><td>Unchanged structure: sidebar PDFs · Tools · Settings and a Scan button at the top right.</td></tr>
</table></div>'''
open('next-5-notes.html', 'w').write(f'<!doctype html><meta charset="utf-8"><title>Next · Notes</title><style>{CSS}</style><body>{notes}</body>')
print('ok')

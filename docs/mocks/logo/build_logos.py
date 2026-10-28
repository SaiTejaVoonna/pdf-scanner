"""StashScan logo concepts (SVG) and a comparison sheet at app-icon sizes. Run: python3 build_logos.py && node render.cjs"""
ACC, ACC2, INK, PAPER = '#3552d9', '#5b78f0', '#1c1c1e', '#ffffff'
BG = f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{ACC2}"/><stop offset="1" stop-color="{ACC}"/></linearGradient></defs><rect width="512" height="512" rx="114" fill="url(#g)"/>'

# 1 Pocket: a page sliding down into a pocket (the "stash").
pocket = BG + f'''
<g transform="translate(256 250) rotate(-8)"><rect x="-96" y="-150" width="192" height="236" rx="18" fill="{PAPER}"/>
<path d="M44 -150 h34 a18 18 0 0 1 18 18 v34 z" fill="#d9e0fb"/>
<rect x="-62" y="-104" width="108" height="14" rx="7" fill="#c7d0f5"/><rect x="-62" y="-74" width="124" height="14" rx="7" fill="#dbe1f8"/><rect x="-62" y="-44" width="92" height="14" rx="7" fill="#dbe1f8"/></g>
<path d="M118 262 h276 v104 a62 62 0 0 1 -62 62 h-152 a62 62 0 0 1 -62 -62 z" fill="#1d2f8f"/>
<path d="M118 262 h276" stroke="#8ea6ff" stroke-width="10" stroke-linecap="round"/>
<path d="M200 330 q56 34 112 0" stroke="#8ea6ff" stroke-width="12" fill="none" stroke-linecap="round"/>'''

# 2 Scan corners around a folded page: classic scanner frame, calm.
frame = BG + f'''
<g fill="none" stroke="{PAPER}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" opacity=".95">
<path d="M104 176 v-52 a20 20 0 0 1 20 -20 h52"/><path d="M336 104 h52 a20 20 0 0 1 20 20 v52"/>
<path d="M408 336 v52 a20 20 0 0 1 -20 20 h-52"/><path d="M176 408 h-52 a20 20 0 0 1 -20 -20 v-52"/></g>
<path d="M176 150 h120 l46 46 v150 a16 16 0 0 1 -16 16 h-150 a16 16 0 0 1 -16 -16 v-180 a16 16 0 0 1 16 -16 z" fill="{PAPER}"/>
<path d="M296 150 v30 a16 16 0 0 0 16 16 h30 z" fill="#c7d0f5"/>
<rect x="196" y="230" width="112" height="14" rx="7" fill="#c7d0f5"/><rect x="196" y="262" width="122" height="14" rx="7" fill="#dbe1f8"/><rect x="196" y="294" width="86" height="14" rx="7" fill="#dbe1f8"/>'''

# 3 Page with a small lock: privacy said directly.
lock = BG + f'''
<path d="M150 104 h140 l72 72 v212 a20 20 0 0 1 -20 20 h-192 a20 20 0 0 1 -20 -20 v-264 a20 20 0 0 1 20 -20 z" fill="{PAPER}"/>
<path d="M290 104 v52 a20 20 0 0 0 20 20 h52 z" fill="#c7d0f5"/>
<rect x="172" y="200" width="120" height="14" rx="7" fill="#c7d0f5"/><rect x="172" y="232" width="96" height="14" rx="7" fill="#dbe1f8"/>
<circle cx="330" cy="356" r="82" fill="#1d2f8f" stroke="{ACC}" stroke-width="10"/>
<path d="M300 352 v-22 a30 30 0 0 1 60 0 v22" fill="none" stroke="{PAPER}" stroke-width="15" stroke-linecap="round"/>
<rect x="284" y="346" width="92" height="66" rx="14" fill="{PAPER}"/><circle cx="330" cy="374" r="9" fill="#1d2f8f"/><rect x="326" y="376" width="8" height="18" rx="4" fill="#1d2f8f"/>'''

# 4 "S" monogram made of two folded pages (stash + scan), simplest shape.
mono = BG + f'''
<path d="M342 150 h-136 a54 54 0 0 0 0 108 h100 a54 54 0 0 1 0 108 h-136" fill="none" stroke="{PAPER}" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M342 150 l-30 -30" stroke="#c7d0f5" stroke-width="0"/>
<circle cx="370" cy="150" r="27" fill="#8ea6ff"/>'''

CONCEPTS = [('pocket', 'Pocket', 'A page slips into a pocket: your scans are stashed with you.', pocket),
            ('frame', 'Scan frame', 'Scanner corners around a page: instantly reads as "scanner".', frame),
            ('lock', 'Locked page', 'A page with a small lock: privacy, said directly.', lock),
            ('mono', 'S monogram', 'A bold S: simplest, most brand-like, says least.', mono)]
for key, _, _, body in CONCEPTS:
    open(f'{key}.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{body}</svg>')

cards = ''
for key, name, note, _ in CONCEPTS:
    cards += f'''<div class="card"><div class="row"><img src="{key}.svg" width="168"><div class="small"><img src="{key}.svg" width="64"><img src="{key}.svg" width="40"><img src="{key}.svg" width="24"></div></div>
<div class="lockup"><img src="{key}.svg" width="56"><span>StashScan</span></div><div class="lockup dark"><img src="{key}.svg" width="56"><span>StashScan</span></div>
<b>{name}</b><p>{note}</p></div>'''
open('logos.html', 'w').write(f'''<!doctype html><meta charset="utf-8"><style>
body{{margin:0;padding:34px;background:#ecebe7;font-family:Inter,-apple-system,Roboto,sans-serif;display:flex;gap:22px}}
.card{{background:#fff;border-radius:22px;padding:22px;width:300px;box-shadow:0 10px 30px rgba(0,0,0,.08)}}
.row{{display:flex;gap:18px;align-items:center}}.small{{display:flex;flex-direction:column;gap:12px;align-items:center}}
.lockup{{display:flex;align-items:center;gap:12px;margin-top:16px;padding:12px;border-radius:14px;background:#f4f3f0}}
.lockup span{{font-size:30px;font-weight:800;letter-spacing:-.8px;color:#1c1c1e}}.dark{{background:#121316}}.dark span{{color:#f2f2f3}}
b{{display:block;margin-top:16px;font-size:18px}}p{{margin:6px 0 0;color:#6f7076;font-size:14px;line-height:1.45}}</style><body>{cards}</body>''')
print('ok')

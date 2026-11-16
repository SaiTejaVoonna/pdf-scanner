"""Downloads the CC0 backgrounds gen.py needs from Poly Haven: surface textures into tex/ and room and street panoramas into hdri/
(next to gen.py; neither folder is stored in the repository).
Usage: python3 -I fetch_polyhaven.py [TEXTURES] [PANORAMAS]   (defaults 80 and 40)"""
import concurrent.futures as cf, json, pathlib, random, sys, urllib.request
here = pathlib.Path(__file__).resolve().parent.parent
def get(url): return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=120).read()
def names(kind, n): a = sorted(json.loads(get(f'https://api.polyhaven.com/assets?t={kind}'))); random.Random(7).shuffle(a); return a[:n]
def tex(name):
    dst = here / 'tex' / f'{name}.jpg'
    if dst.exists(): return 1
    try: dst.write_bytes(get(f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{name}/{name}_diff_1k.jpg')); return 1
    except Exception: return 0
def pano(name):
    dst = here / 'hdri' / f'{name}.jpg'
    if dst.exists(): return 1
    try:
        import cv2, numpy as np   # the originals are 8192 px wide; half that is plenty for 384 px views
        im = cv2.imdecode(np.frombuffer(get(f'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/{name}.jpg'), np.uint8), 1)
        cv2.imwrite(str(dst), cv2.resize(im, (4096, 2048), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 90]); return 1
    except Exception: return 0
(here / 'tex').mkdir(exist_ok=True); (here / 'hdri').mkdir(exist_ok=True)
nt = int(sys.argv[1]) if len(sys.argv) > 1 else 80; nh = int(sys.argv[2]) if len(sys.argv) > 2 else 40
with cf.ThreadPoolExecutor(6) as ex:
    print(sum(ex.map(tex, names('textures', nt))), 'textures', sum(ex.map(pano, names('hdris', nh))), 'panoramas')

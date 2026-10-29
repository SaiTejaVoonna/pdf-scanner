"""A phone-camera view of the report page with desk around it (portrait 9:19.5), for Chromium's fake camera.
Run: python3 -I make_cam.py -> cam/report-cam.jpg, then ffmpeg turns it into cam/report.y4m"""
import sys; sys.path.insert(0, '.')
from PIL import Image
import make_docs as m
r1 = Image.open('docs/page-report.png')
# Page about 70% of the frame width, slightly tilted, with desk on every side
m.photo(r1, [[250, 760], [1110, 700], [1180, 1960], [170, 2020]], 21, size=(1350, 2925)).save('cam/report-cam.jpg', quality=93)

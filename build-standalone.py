#!/usr/bin/env python3
"""Build standalone.html — a single-file version of the site with all CSS,
JS and images inlined. Use it for quick previews anywhere (double-click,
e-mail, sandboxed viewers): no sibling files needed.

    python3 build-standalone.py
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
html = (ROOT / 'index.html').read_text(encoding='utf-8')

# 1) stylesheet -> <style>
css = (ROOT / 'css' / 'main.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="css/main.css" />',
                    '<style>\n' + css + '\n</style>')

# 2) drop icon/manifest links that need sibling files (favicon becomes data uri)
fav = (ROOT / 'favicon.svg').read_bytes()
fav_b64 = base64.b64encode(fav).decode()
html = html.replace('<link rel="icon" type="image/svg+xml" href="favicon.svg" />',
                    '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,' + fav_b64 + '" />')
html = re.sub(r'<link rel="apple-touch-icon"[^>]*>\n?', '', html)
html = re.sub(r'<link rel="icon" type="image/png"[^>]*>\n?', '', html)
html = re.sub(r'<link rel="manifest"[^>]*>\n?', '', html)

# 3) images -> data uris
def inline_img(m):
    path = ROOT / m.group(1)
    if not path.exists():
        return m.group(0)
    b64 = base64.b64encode(path.read_bytes()).decode()
    return m.group(0).replace(m.group(1), 'data:image/webp;base64,' + b64)

html = re.sub(r'src="(images/[^"]+\.webp)"', inline_img, html)

# 4) scripts -> inline, same order, end of body so DOM exists
def inline_script(m):
    src = m.group(1)
    path = ROOT / src
    if not path.exists():
        return m.group(0)
    js = path.read_text(encoding='utf-8')
    js = js.replace('</script', '<\\/script')   # safety, never present today
    return '<script>\n' + js + '\n</script>'

html = re.sub(r'<script src="(js/[^"]+)" defer></script>', inline_script, html)

out = ROOT / 'standalone.html'
out.write_text(html, encoding='utf-8')
print('wrote', out, out.stat().st_size, 'bytes')

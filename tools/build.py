#!/usr/bin/env python3
"""Inline css, body, logic, ui, assets and bars into the two deliverables."""
import json, pathlib
B = pathlib.Path(__file__).resolve().parent
src, out = B / 'src', B / 'out'
A = json.loads((B / 'assets/assets.json').read_text())
bars = json.loads((B / 'assets/bars.json').read_text())
anim = json.loads((B / 'assets/anim.json').read_text())
import gen_skymask
gen_skymask.build(B)
skymask = 'data:image/png;base64,' + __import__('base64').b64encode((B / 'assets/skymask.png').read_bytes()).decode()
lamps = json.loads((B / 'assets/lamps.json').read_text())
pantry = json.loads((B / 'assets/pantry.json').read_text())
fonts = A.pop('fonts'); A.pop('spriteFacing', None)
def js(o): return json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
VIE = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'
ff = ''.join(f'@font-face{{font-family:"VT323";font-style:normal;font-weight:400;font-display:swap;'
             f'src:url({fonts[k]}) format("woff2");unicode-range:{r}}}\n' for k, r in (('latin', LAT), ('vietnamese', VIE)))
css = (src / 'game.css').read_text().replace('/*FONTS*/', ff)
mit = (src / 'LICENSE.pixel-agents').read_text().strip()
body = (src / 'body.html').read_text().replace('__MIT_PIXEL__', mit)
script = f"const BARS={js(bars)};\nconst ASSETS={js(A)};\nconst ANIM={js(anim)};\nconst PANTRY={js(pantry)};\nconst SKYMASK={js(skymask)};\nconst LAMPS={js(lamps)};\n" + (src / 'logic.js').read_text() + '\n' + (src / 'ui.js').read_text()
assert '</script' not in script.lower()
frag = ('<title>Quant Fun</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
        f'<style>\n{css}</style>\n{body}\n<script>\n{script}</script>\n')
doc = ('<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       + frag.replace('<style>', '<style>\nhtml,body{margin:0}', 1).replace('</style>\n', '</style>\n</head><body>\n', 1).rstrip('\n')
       + '\n</body></html>\n')
for sub, text in (('artifact', frag), ('download', doc)):
    p = out / sub / 'quant-fun.html'; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text)
    print(p, p.stat().st_size)

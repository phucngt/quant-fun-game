"""Measure floor contact quads once; generate padded floor and navigation grid.

Coordinates in room-layout.json are percentages of the 1600x1195 room.
One tile is 32 room pixels; distances are isotropic in room pixels.
The debug image shows actual furniture, red footprints, amber clearance,
green walkable floor, station feet and numbered desk ownership.
"""
import base64
import io
import json
import math
from collections import deque

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


def build(root):
    layout = json.loads((root / 'tools/room-layout.json').read_text(encoding='utf-8'))
    assets = json.loads((root / 'assets/assets.json').read_text(encoding='utf-8'))
    w, h, tile, step = (layout[k] for k in ('width', 'height', 'tilePixels', 'gridPixels'))
    scale = 2
    size = (w // scale, math.ceil(h / scale))
    def polygon_mask(polygons):
        im = Image.new('L', size)
        draw = ImageDraw.Draw(im)
        for polygon in polygons:
            draw.polygon([(x * w / 100 / scale, y * h / 100 / scale) for x, y in polygon], fill=255)
        return np.asarray(im) > 0
    obstacles = list(layout['obstacles'])
    for desk in layout['desks']:
        dh = h * layout['deskHeightPercent'] / 100
        dw = dh * assets['desks'][desk['kind'] + '_ratio']
        ax, ay = desk['at']
        polygon = [[round(ax + (x / 100 - .5) * dw / w * 100, 4),
                    round(ay + (y / 100 - 1) * dh / h * 100, 4)]
                   for x, y in layout['deskFootprints'][desk['kind']]]
        obstacles.append({'id': desk['id'], 'polygon': polygon})
    floor = polygon_mask([layout['floor']])
    occupied = polygon_mask([o['polygon'] for o in obstacles])
    # Outside padding also prevents walking along a wall or off the floor.
    clearance = ndimage.distance_transform_edt(floor & ~occupied) * scale
    walkable = clearance >= layout['paddingTiles'] * tile
    cols, rows = w // step, math.ceil(h / step)
    points = {}
    for y in range(rows):
        for x in range(cols):
            px, py = (x + .5) * step, (y + .5) * step
            if py < h and clearance[min(size[1]-1, int(py / scale)), int(px / scale)] >= layout['paddingTiles'] * tile + step * .71:
                points[y * cols + x] = [round(px / w * 100, 6), round(py / h * 100, 6)]
    # Keep the connected office floor; isolated pixels never become destinations.
    first = min(points, key=lambda k: math.dist(points[k], [50,65]))
    connected, queue = {first}, deque([first])
    while queue:
        n = queue.popleft()
        for m in (n-1,n+1,n-cols,n+cols):
            if m in points and abs(m % cols - n % cols) <= 1 and m not in connected:
                connected.add(m); queue.append(m)
    points = {k:v for k,v in points.items() if k in connected}
    def distance(a,b):
        return math.hypot((a[0]-b[0])*w/100,(a[1]-b[1])*h/100)/tile
    def nearest(near, exclude=()):
        candidates = [(distance(p,near),k) for k,p in points.items()
                      if all(distance(p,q) >= 1.55 for q in exclude)]
        _, k = min(candidates)
        if distance(points[k],near) > 3:
            raise ValueError(f'No usable floor near {near}')
        return k
    stations, named = {}, {}
    for role, station in layout['stations'].items():
        node = nearest(station['near'], [v['spot'] for v in stations.values()])
        stations[role] = {'desk':station['desk'], 'spot':points[node], 'look':station['look']}
        named['H'+role[0]] = points[node]
    for name, near in layout['spots'].items():
        named[name] = points[nearest(near, [v['spot'] for v in stations.values()])]
    # Visitors stand beside their host, on the floor, with room for two bodies.
    chat = {}
    for role, station in stations.items():
        host = station['spot']
        near = [host[0]-2.4, host[1]+2.0]
        node = nearest(near, [v['spot'] for v in stations.values()])
        if not 1.5 <= distance(points[node],host) <= 4:
            raise ValueError(f'No meeting point beside {role}')
        chat[role] = points[node]
        named['V'+role[0]] = points[node]
    named['STOP'] = chat['boss']
    maskrows = [''.join('1' if y*cols+x in points else '0' for x in range(cols)) for y in range(rows)]
    nav = {'width':w,'height':h,'tilePixels':tile,'stepPixels':step,'cols':cols,'rows':rows,
           'paddingTiles':layout['paddingTiles'],'floor':layout['floor'],'obstacles':obstacles,
           'mask':maskrows,'stations':stations,'spots':named,'chat':chat,'desks':layout['desks'],'door':layout['door']}
    (root/'assets/navigation.json').write_text(json.dumps(nav,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    # Include props in the measurement overlay, using exactly the CSS dimensions.
    room = Image.open(io.BytesIO(base64.b64decode(assets['room'].split(',')[1]))).convert('RGBA')
    for desk in layout['desks']:
        dh=round(h*layout['deskHeightPercent']/100); dw=round(dh*assets['desks'][desk['kind']+'_ratio'])
        im=Image.open(io.BytesIO(base64.b64decode(assets['desks'][desk['kind']].split(',')[1]))).convert('RGBA').resize((dw,dh))
        x,y=desk['at']; room.alpha_composite(im,(round(x*w/100-dw/2),round(y*h/100-dh)))
    debug=room.resize(size)
    tint=np.zeros((size[1],size[0],4),dtype='uint8')
    tint[floor & ~walkable]=(255,180,20,80); tint[occupied]=(255,40,60,135); tint[walkable]=(30,240,120,55)
    debug=Image.alpha_composite(debug,Image.fromarray(tint))
    draw=ImageDraw.Draw(debug)
    for i,(role,s) in enumerate(stations.items(),1):
        x,y=s['spot']; x*=w/100/scale; y*=h/100/scale
        draw.ellipse((x-4,y-4,x+4,y+4),fill='cyan',outline='black')
        draw.text((x+5,y),str(i)+' '+role,fill='white',stroke_width=1,stroke_fill='black')
        look=s['look']; draw.line((x,y,look[0]*w/100/scale,look[1]*h/100/scale),fill='cyan',width=1)
    for name,p in named.items():
        if name.startswith('H'): continue
        x,y=p[0]*w/100/scale,p[1]*h/100/scale
        draw.ellipse((x-2,y-2,x+2,y+2),fill='yellow'); draw.text((x+3,y),name,fill='white',stroke_width=1,stroke_fill='black')
    (root/'gen').mkdir(exist_ok=True)
    debug.convert('RGB').save(root/'gen/navigation-overlay.png')
    Image.fromarray((walkable*255).astype('uint8')).save(root/'gen/walkable-floor.png')
    print(f'Navigation: {len(points)} floor nodes, {len(obstacles)} footprints, {len(stations)} distinct desks')
    return nav


if __name__ == '__main__':
    from pathlib import Path
    build(Path(__file__).resolve().parents[1])

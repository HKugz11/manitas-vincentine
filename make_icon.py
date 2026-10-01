# Generates icon.svg in the flat element-mark style (same layout as iridium-mark.svg / xenon-mark.svg):
# dark tile, flat orb, soft highlight dot, dark symbol. The orb is a top-down soft-serve swirl:
# white cream with one light-yellow spiral band, confined to the circle.
import math
CX, CY, R = 48, 48, 28

def spiral(turns=2.25, step=0.04):
    pts, tmax, t = [], turns * 2 * math.pi, 0.0
    while t <= tmax:
        r = (R + 6) * t / tmax
        a = t - math.pi / 2
        pts.append((CX + r * math.cos(a), CY + r * math.sin(a)))
        t += step
    return 'M ' + ' L '.join(f'{x:.2f} {y:.2f}' for x, y in pts)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="Hl">
<style>
.tile{{fill:#0b0f14}} .edge{{fill:none;stroke:none}} .orb{{fill:#fffdf4;stroke:none}} .swirl{{fill:none;stroke:#f6e08a;stroke-width:6.4;stroke-linecap:round;stroke-linejoin:round}}
.hi{{fill:#fff;fill-opacity:.55}} .sym{{fill:#0b0f14;font:500 22px "Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif}}
.ring{{fill:none;stroke:none}} .ell{{fill:none;stroke:#0b0f14;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}}
@media (prefers-color-scheme: light){{
  .tile{{fill:#ffffff}} .edge{{stroke:#d6dbe1;stroke-width:1.5}} .ring{{stroke:#c99a1e;stroke-width:2}}
}}
</style>
<defs><clipPath id="orb"><circle cx="{CX}" cy="{CY}" r="{R}"/></clipPath></defs>
<rect class="tile" width="96" height="96" rx="22"/>
<rect class="edge" x="0.75" y="0.75" width="94.5" height="94.5" rx="21.25"/>
<circle class="orb" cx="{CX}" cy="{CY}" r="{R}"/>
<path class="swirl" clip-path="url(#orb)" d="{spiral()}"/>
<circle class="ring" cx="{CX}" cy="{CY}" r="{R}"/>
<circle class="hi" cx="39" cy="38" r="7"/>
<text class="sym" x="44" y="56" text-anchor="middle">H</text>
<path class="ell" d="M54.6 38.6 V52.6 Q54.6 55.9 57.9 55.9 H58.6"/>
</svg>
'''
open('icon.svg', 'w', newline='\n').write(svg)
print('ok')

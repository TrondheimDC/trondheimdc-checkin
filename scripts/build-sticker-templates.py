"""Generate rotated (landscape) printer + stasjon sticker templates for DK-11208.

Paper stays portrait (107.7 x 255.1 pt) like badge.lbx; the label is read with the
paper's right edge as "up". Layout is written in reader coords (u right, v down,
255.1 x 107.7) and mapped to paper coords. Text objects rotate with angle=90;
art is pre-rotated bitmaps at angle=0.

    python3 scripts/build-sticker-templates.py . public/templates

Needs Pillow. Reads the QR object from the current printer.lbx, so it is safe to
re-run over its own output.
"""
import io
import re
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw

REPO = Path(sys.argv[1])
OUT = Path(sys.argv[2])
PAPER_W = 107.7
PX_PER_PT = 300 / 72  # QL-820NWB is 300 dpi

src = zipfile.ZipFile(REPO / "public/templates/printer.lbx")
BASE_XML = src.read("label.xml").decode()
PROP_XML = src.read("prop.xml").decode()
HEAD, _, rest = BASE_XML.partition("<pt:objects>")
_, _, TAIL = rest.partition("</pt:objects>")
QR_XML = re.search(r"<barcode:barcode>.*</barcode:barcode>", BASE_XML).group(0)


def paper_box(u, v, w, h):
    """Reader box -> paper objectStyle box (x, y, width, height)."""
    return PAPER_W - (v + h), u, h, w


def f(n):
    return f"{round(n, 1)}pt"


def text_obj(name, u, v, w, h, data, size, bold=False, align="LEFT"):
    x, y, pw, ph = paper_box(u, v, w, h)
    weight = 700 if bold else 400
    font = (
        f'<text:ptFontInfo><text:logFont name="Helsinki" width="0" italic="false" weight="{weight}" '
        f'charSet="0" pitchAndFamily="34"/><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" '
        f'size="{size}pt" orgSize="{size}pt" textColor="#000000" textPrintColorNumber="1"/></text:ptFontInfo>'
    )
    return (
        f'<text:text><pt:objectStyle x="{f(x)}" y="{f(y)}" width="{f(pw)}" height="{f(ph)}" '
        'backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="90" anchor="TOPLEFT" flip="NONE">'
        '<pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/>'
        '<pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/>'
        f'<pt:expanded objectName="{name}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" '
        'templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle>'
        f"{font}"
        '<text:textControl control="FIXEDFRAME" clipFrame="false" aspectNormal="true" shrink="true" autoLF="false" avoidImage="false"/>'
        f'<text:textAlign horizontalAlignment="{align}" verticalAlignment="CENTER" inLineAlignment="BASELINE"/>'
        f'<text:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="0" orgPoint="{size}pt" combinedChars="false"/>'
        f"<pt:data>{escape(data)}</pt:data>"
        f'<text:stringItem charLen="{len(data)}">{font}</text:stringItem></text:text>'
    )


def image_obj(name, file, u, v, w, h):
    # angle=0 with a pre-rotated bitmap: no guessing how Smooth Print rotates images.
    x, y, pw, ph = paper_box(u, v, w, h)
    box = f'x="{f(x)}" y="{f(y)}" width="{f(pw)}" height="{f(ph)}"'
    return (
        f'<image:image><pt:objectStyle {box} backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" '
        'angle="0" anchor="TOPLEFT" flip="NONE">'
        '<pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/>'
        '<pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/>'
        f'<pt:expanded objectName="{name}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" '
        'templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle>'
        f'<image:imageStyle originalName="{name.lower()}.png" alignInText="NONE" firstMerge="true" IpName="" fileName="{file}">'
        '<image:transparent flag="false" color="#FFFFFF"/>'
        '<image:trimming flag="false" shape="RECTANGLE" trimOrgX="0pt" trimOrgY="0pt" trimOrgWidth="0pt" trimOrgHeight="0pt"/>'
        f'<image:orgPos {box}/>'
        '<image:effect effect="MONO" brightness="50" contrast="50" photoIndex="4"/>'
        '<image:mono operationKind="ERRORDIFFUSION" reverse="0" ditherKind="MESH" threshold="128" gamma="100" '
        'ditherEdge="0" rgbconvProportionRed="30" rgbconvProportionGreen="59" rgbconvProportionBlue="11" '
        'rgbconvProportionReversed="0"/></image:imageStyle></image:image>'
    )


def qr_obj():
    # Known-good QR frame from printer.lbx (paper x=1 centers it on the 38 mm edge).
    # Reader: top-left of the label, full height.
    return QR_XML.replace('y="30.0pt"', 'y="8.4pt"')


# ---- art ----------------------------------------------------------------------

def duck_image(cells_px, dot=2):
    """12x12 pixel duck from 8bit-duck-dither.png, cells filled with an ordered dither."""
    src = Image.open(REPO / "public/badge/8bit-duck-dither.png").convert("RGBA")
    bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    size = 12 * cells_px
    out = Image.new("1", (size, size), 1)
    for py in range(size):
        for px in range(size):
            r, g, b, a = src.getpixel(((px // cells_px) * 10 + 5, (py // cells_px) * 10 + 5))
            if a < 128:
                continue
            ink = 1 - r / 255 * 0.8  # darken so the light body still reads on thermal paper
            if ink * 16 > bayer[(py // dot) % 4][(px // dot) % 4] + 0.5:
                out.putpixel((px, py), 0)
    return out


def tdc_mark(height_px):
    """TDC wordmark (tdc-logo.tsx) in black, drawn at 4x then downsampled."""
    ss = 4
    s = height_px * ss / 52
    gap = 7.28
    width_units = 40 + gap + 154 + gap + 40
    im = Image.new("L", (round(width_units * s), round(52 * s)), 255)
    d = ImageDraw.Draw(im)
    P = lambda pts, ox: [(ox * s + x * s, y * s) for x, y in pts]
    # T
    d.polygon(P([(10.1, 17.33), (0, 17.33), (0, 0), (39.81, 0), (39.81, 17.33), (29.72, 17.33), (29.72, 52), (10.1, 52)], 0), fill=0)
    # D (pill on the right)
    ox = 40 + gap
    d.rounded_rectangle([ox * s, 0, (ox + 153.73) * s, 52 * s], radius=17.33 * s, fill=0, corners=(False, True, True, False))
    # C
    ox = 40 + gap + 154 + gap
    d.rounded_rectangle([ox * s, 0, (ox + 39.81) * s, 52 * s], radius=17.33 * s, fill=0, corners=(True, False, False, True))
    d.rectangle([(ox + 19.91) * s, 17.33 * s, (ox + 39.81) * s + 1, 34.67 * s], fill=255)
    im = im.resize((im.width // ss, im.height // ss), Image.LANCZOS)
    return im.point(lambda p: 0 if p < 128 else 255, "1")


def bmp_bytes(reader_img):
    paper = reader_img.convert("RGBA").rotate(-90, expand=True)  # reader top -> paper right
    buf = io.BytesIO()
    paper.save(buf, "BMP")
    return buf.getvalue()


def pt_size(img):
    return img.width / PX_PER_PT, img.height / PX_PER_PT


# ---- layouts ------------------------------------------------------------------

PANEL_U = 116.0
PANEL_R = 244.0
PANEL_W = PANEL_R - PANEL_U


SITE = "innsjekk.trondheimdc.no"


def bottom_row(duck, mark, bottom):
    """Duck in the lower-left of the panel, TDC mark in the lower-right corner, bottoms aligned."""
    dw, dh = pt_size(duck)
    mw, mh = pt_size(mark)
    return [
        ("DUCK", duck, PANEL_U, bottom - dh, dw, dh),
        ("TDC", mark, PANEL_R - mw, bottom - mh, mw, mh),
    ]


def site_above(mark, bottom, size):
    """The URL right-aligned just above the TDC mark."""
    _, mh = pt_size(mark)
    return ("SITE", PANEL_U, bottom - mh - 11, PANEL_W, 9, SITE, size, False, "RIGHT")


def build(kind):
    objs = [qr_obj()]
    files = {}
    preview = []  # (type, u, v, w, h, payload) for the PNG mock

    if kind == "printer":
        duck = duck_image(16)  # 192 px = 46 pt
        mark = tdc_mark(58)  # ~14 pt tall
        texts = [
            ("NAME", PANEL_U, 17, PANEL_W, 22, "Koble til · Printer 1", 15, True, "LEFT"),
        ]
        images = bottom_row(duck, mark, bottom=100)
        texts.append(site_above(mark, bottom=100, size=6.5))
    else:
        duck = duck_image(16)  # same as the front sticker
        mark = tdc_mark(58)
        texts = [
            ("MODEL", 150, 5, PANEL_R - 150, 9, "Model QL-820NWBc", 6.5, True, "RIGHT"),
            ("NAME", PANEL_U, 17, PANEL_W, 22, "Logg inn · Printer 1", 15, True, "LEFT"),
        ]
        images = bottom_row(duck, mark, bottom=100)
        texts.append(site_above(mark, bottom=100, size=6.5))

    for i, (name, img, u, v, w, h) in enumerate(images):
        file = f"Object{i}.bmp"
        files[file] = bmp_bytes(img)
        objs.insert(0, image_obj(name, file, u, v, w, h))
        preview.append(("img", u, v, w, h, img))
    for t in texts:
        objs.append(text_obj(*t))
        preview.append(("text",) + t[1:])

    xml = HEAD + "<pt:objects>" + "".join(objs) + "</pt:objects>" + TAIL
    title = "TDC printer sticker" if kind == "printer" else "TDC stasjon sticker"
    prop = re.sub(r"<dc:title>.*?</dc:title>", f"<dc:title>{title}</dc:title>", PROP_XML)
    prop = re.sub(r"<dc:description>.*?</dc:description>", "<dc:description>DK-11208 landscape: QR left, name right</dc:description>", prop)

    lbx = OUT / f"{'printer' if kind == 'printer' else 'stasjon'}.lbx"
    with zipfile.ZipFile(lbx, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("label.xml", xml)
        z.writestr("prop.xml", prop)
        for name, data in files.items():
            z.writestr(name, data)
    return preview


if __name__ == "__main__":
    for kind in ("printer", "stasjon"):
        build(kind)
    print("ok")

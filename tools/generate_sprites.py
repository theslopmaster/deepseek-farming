#!/usr/bin/env python3
"""Generate the pixel-art PNGs used by Tiny Farm.

Every sprite is a 16x16 character grid rendered with Pillow.
Run:  python3 tools/generate_sprites.py
      python3 tools/generate_sprites.py --preview   # also writes tools/preview.png
"""

from pathlib import Path
from PIL import Image, ImageColor, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CROPS_DIR = ROOT / "assets" / "crops"
ICONS_DIR = ROOT / "assets" / "icons"

# ---------------------------------------------------------------- palettes

CROP_PALETTES = {
    "wheat": {
        "s": "#8ba74f", "S": "#bdd486",
        "l": "#97b75a", "L": "#c8df93",
        "u": "#94b25b", "U": "#c3d98a",
        "f": "#c69a3f", "F": "#f0c968", "h": "#ffedab",
        "w": "#fff6d2",
    },
    "carrot": {
        "s": "#6d9a45", "S": "#a3c96f",
        "l": "#80ad51", "L": "#b6d987",
        "r": "#bd5720", "R": "#f08f43", "h": "#ffc07a",
        "w": "#ffe8c4",
    },
    "corn": {
        "s": "#6e9c41", "S": "#a6ca6e",
        "l": "#83b253", "L": "#bade86",
        "u": "#90b75a", "U": "#c6df90",
        "f": "#d5a22c", "F": "#ffd95c", "h": "#fff2a6",
        "t": "#d0bc8b", "w": "#fff4ba",
    },
    "strawberry": {
        "s": "#6c9b49", "S": "#a5c86f",
        "l": "#6c9b49", "L": "#a5c86f",
        "f": "#cc3b4d", "F": "#f2636b", "h": "#ffa39a",
        "y": "#ffe28c", "c": "#f0c94f", "w": "#f4f2e6",
        "k": "#ffe4de",
    },
    "pumpkin": {
        "s": "#6c9b47", "S": "#a4c86d",
        "l": "#77a84e", "L": "#add680",
        "g": "#699844", "G": "#a6c96b",
        "o": "#b4571f", "O": "#f08a35", "h": "#ffb867",
        "t": "#a18a50", "w": "#ffdba4",
    },
    "sunflower": {
        "s": "#6e9c43", "S": "#a8cc71",
        "l": "#84b353", "L": "#bce08a",
        "g": "#74a249", "G": "#a8ce6f",
        "f": "#d9a52b", "Y": "#ffd551", "F": "#ffe476", "h": "#fff5ac",
        "C": "#7d5734", "c": "#9e7444",
        "w": "#fff6c8",
    },
}

# ---------------------------------------------------------------- crops
# Four growth stages each: sprout, young, mature (unripe) and ripe.
# All plants are bottom-anchored on row 15 so they sit still while growing.

BLANK = "................"

CROPS = {
    "wheat": [
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            BLANK, BLANK,
            ".......L........",
            "......LlL.......",
            ".......l........",
            ".......s........",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            ".....L....L.....",
            "....LlL..LlL....",
            ".....l....l.....",
            "......l..l......",
            ".......ll.......",
            ".......s........",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK,
            ".......u........",
            "......uUu.......",
            "...u..uUu..u....",
            "..uUu.uUu.uUu...",
            "...u...u...u....",
            "...s...s...s....",
            "..Ls..Ls..Ls....",
            "...s...s...s....",
            "....s.s.s.s.....",
            ".....s.s.s......",
            "......sSs.......",
            ".......S........",
            ".......s........",
        ],
        [
            BLANK,
            ".......h........",
            "......fFf.......",
            "...h..fFf..h....",
            "..fFf.fFf.fFf...",
            "..fFf.fFf.fFf...",
            "...f...f...f..w.",
            "...s...s...s....",
            "..Ls..Ls..Ls....",
            "...s...s...s....",
            "....s.s.s.s.....",
            ".....s.s.s......",
            "......sSs.......",
            ".......s........",
            ".......s........",
            ".......s........",
        ],
    ],
    "carrot": [
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            BLANK, BLANK, BLANK,
            ".......L........",
            "......LlL.......",
            ".......s........",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            ".......S........",
            "......SSS.......",
            ".....S.S.S......",
            "....S..S..S.....",
            ".....S.S.S......",
            "......sSs.......",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK,
            ".......S........",
            "......SSS.......",
            ".....S.S.S......",
            "....S..S..S.....",
            "...S...S...S....",
            "....S..S..S.....",
            ".....S.S.S......",
            "......SSS.......",
            "....rrrrrr......",
            "...rRRRRRRr.....",
            "....rrrrrr......",
        ],
        [
            BLANK,
            ".......S........",
            "......SSS.......",
            ".....S.S.S......",
            "....S..S..S.....",
            "...S...S...S....",
            "....S..S..S.....",
            ".....S.S.S......",
            "......SSS....w..",
            "......lSl.......",
            ".....rrrrr......",
            "....rRRRRRr.....",
            "....rRhRRRr.....",
            "....rRRRRRr.....",
            ".....rRRRr......",
            "......rr........",
        ],
    ],
    "corn": [
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            BLANK, BLANK, BLANK,
            ".......L........",
            "......LlL.......",
            ".......l........",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            ".......L........",
            "......LlL.......",
            ".....L.l........",
            "....L..l..L.....",
            "......sSs.......",
            "......sSs.......",
            "......sSs.......",
            "......sSs.......",
        ],
        [
            BLANK, BLANK, BLANK, BLANK,
            "..LL..sSs..LL...",
            "...LL.sSs.LL....",
            "....LLsSsLL.....",
            "......sSs.......",
            ".....LsSsL......",
            "......sSs.......",
            "......sSs.uuu...",
            "......sSuUUUu...",
            "......sSs.uuu...",
            "......sSs.......",
            "......sSs.......",
            "......sSs.......",
        ],
        [
            BLANK,
            ".......t........",
            ".....t.t.t......",
            "......sSs.......",
            "..LL..sSs..LL...",
            "...LL.sSs.LL....",
            "....LLsSsLL.....",
            "......sSs.......",
            ".....LsSsL......",
            "......sSs.llll..",
            "......sSlFhFF...",
            "......sSlhFhF...",
            "......sSlFhFF...",
            "......sSs.llll..",
            "......sSs.......",
            "......sSs.......",
        ],
    ],
    "strawberry": [
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            BLANK, BLANK, BLANK,
            ".....l...l......",
            "....lLl.lLl.....",
            ".....l...l......",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            ".....l..l.......",
            "...lLlLlLlLl....",
            "..l.l.l.l.l.l...",
            "...l.l.l.l.l....",
            "....l.l.l.l.....",
            ".....l.l.l......",
            ".......s........",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            ".....l..l.......",
            "...lLlLlLlLl....",
            "..l.l.ww.l.ww...",
            "...l.lcl.lcl....",
            "....l.l.l.l.....",
            ".....l.l.l......",
            ".......s........",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            ".....l..l.......",
            "...lLlLlLlLl....",
            "..l.l.l.l.l.l...",
            "..l.fFf..fFf.l..",
            "...fFFyf.fyFFf..",
            "...fFFFFffFFFf..",
            "....fFFf..fFFf..",
            ".....ff....ff...",
            ".......s........",
        ],
    ],
    "pumpkin": [
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            BLANK, BLANK, BLANK, BLANK,
            ".....l...l......",
            "....lLl.lLl.....",
            ".....l...l......",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            ".....l....l.....",
            "....lLl..lLl....",
            ".....l....l.....",
            "...l..l.l..l....",
            "....l.l.l.l.....",
            ".....l.l.l......",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            ".....l....l.....",
            "....lLl..lLl....",
            "......gGg.......",
            ".....gggggg.....",
            "...ggGGGGGGgg...",
            ".gGGgGGGgGGGgGg.",
            ".gGGgGGGgGGGgGg.",
            ".gGGgGGGgGGGgGg.",
            "...ggGGGGGGgg...",
            ".....gggggg.....",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            ".....l....l.....",
            "....lLl..lLl....",
            ".....l..tt.l....",
            ".....oooooo.....",
            "...ooOOOOOOoo...",
            ".oOOhOOOhOOOhOo.",
            ".oOOhOOOhOOOhOo.",
            ".oOOhOOOhOOOhOo.",
            "...ooOOOOOOoo...",
            ".....oooooo.....",
        ],
    ],
    "sunflower": [
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            BLANK, BLANK, BLANK,
            ".......L........",
            "......LlL.......",
            ".......s........",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
            ".......L........",
            "......LlL.......",
            ".......s........",
            "....L..s..L.....",
            ".....L.s.L......",
            ".......s........",
            ".......s........",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK, BLANK, BLANK,
            ".......g........",
            "......gGg.......",
            ".....gGGGg......",
            "......gGg.......",
            ".......s........",
            "..L....s....L...",
            "...L...s...L....",
            "....L..s..L.....",
            ".......s........",
            ".......s........",
            ".......s........",
            ".......s........",
            ".......s........",
        ],
        [
            BLANK,
            "....w.....w.....",
            "...YYYYYYYYY....",
            "..YYYYCcCYYYY...",
            ".YYYYCCcCCYYYY..",
            ".YYYYCCcCCYYYY..",
            "..YYYYCcCYYYY...",
            "...YYYYYYYYY....",
            ".....YYYYY......",
            ".......s........",
            "..L....s....L...",
            "...L...s...L....",
            "....L..s..L.....",
            ".....L.s.L......",
            ".......s........",
            ".......s........",
        ],
    ],
}

# ---------------------------------------------------------------- icons

ICONS = {
    "coin": (
        {
            "g": "#8a6416", "G": "#e2b347", "h": "#ffe8a3",
        },
        [
            BLANK, BLANK,
            ".....gggggg.....",
            "...ggGGGGGGgg...",
            "..gGGGGGGGGGGg..",
            ".gGGGGGGGGGGGGg.",
            ".gGGGGGhhGGGGGg.",
            ".gGGGGhhhhGGGGg.",
            ".gGGGGhhhhGGGGg.",
            ".gGGGGGhhGGGGGg.",
            ".gGGGGGGGGGGGGg.",
            "..gGGGGGGGGGGg..",
            "...ggGGGGGGgg...",
            ".....gggggg.....",
            BLANK, BLANK,
        ],
    ),
    "lock": (
        {
            "g": "#5c626b", "G": "#aab0b9",
        },
        [
            BLANK, BLANK, BLANK,
            ".....gggg.......",
            "....g....g......",
            "....g....g......",
            "....g....g......",
            "...gggggggg.....",
            "...gGGGGGGg.....",
            "...gGGggGGg.....",
            "...gGGggGGg.....",
            "...gGGGGGGg.....",
            "...gGGGGGGg.....",
            "...gggggggg.....",
            BLANK, BLANK,
        ],
    ),
    "fert": (
        {
            "g": "#6b7178", "G": "#b9c0c7", "l": "#8fbc53", "L": "#c1e087",
        },
        [
            BLANK, BLANK,
            "......gg........",
            "......gg........",
            ".....gGGg.......",
            ".....gGGg.......",
            "....gggggg......",
            "....gGGGGg......",
            "....gGllGg......",
            "....gGlLGg......",
            "....gGllGg......",
            "....gGlLGg......",
            "....gGGGGg......",
            "....gggggg......",
            BLANK, BLANK,
        ],
    ),
    "tools": (
        {
            "g": "#aab0b8", "G": "#d7dde3", "t": "#a87f4e",
        },
        [
            BLANK,
            "............gggg",
            "...........gggg.",
            "..........gg....",
            ".........tt.....",
            "........tt......",
            ".......tt.......",
            "......tt........",
            ".....tt.........",
            "....tt..........",
            "...tt...........",
            "..tt............",
            ".tt.............",
            "tt..............",
            BLANK, BLANK,
        ],
    ),
    "market": (
        {
            "w": "#e9e5dc", "r": "#b95545", "g": "#8b9099", "G": "#c3c8cf",
        },
        [
            BLANK, BLANK, BLANK,
            "..wwrrwwrrww....",
            "..wwrrwwrrww....",
            "..wwrrwwrrww....",
            "..gggggggggg....",
            "..g........g....",
            "..g..GGGG..g....",
            "..g..G..G..g....",
            "..g..GGGG..g....",
            "..g........g....",
            "..gggggggggg....",
            BLANK, BLANK, BLANK,
        ],
    ),
    "auto": (
        {
            "g": "#5c626b", "G": "#aab0b9", "l": "#8fbc53", "L": "#c1e087",
        },
        [
            BLANK, BLANK,
            ".......gg.......",
            "......gGGg......",
            "....gggggggg....",
            "...gGGGGGGGGg...",
            "...gGggggggGg...",
            "...gGgllllgGg...",
            "...gGggggggGg...",
            "...gGGGGGGGGg...",
            "....gggggggg....",
            "...g..g..g..g...",
            "..ggg.ggg.ggg...",
            BLANK, BLANK, BLANK,
        ],
    ),
    "sound-on": (
        {
            "g": "#c3c8cf",
        },
        [
            BLANK, BLANK,
            "......g.........",
            ".....gg...g.....",
            "....ggg..g.g....",
            "...gggg.g.g.g...",
            "...gggg.g.g.g...",
            "...gggg.g.g.g...",
            "....ggg..g.g....",
            ".....gg...g.....",
            "......g.........",
            BLANK, BLANK, BLANK, BLANK, BLANK,
        ],
    ),
    "sound-off": (
        {
            "g": "#c3c8cf", "r": "#d9695c",
        },
        [
            BLANK, BLANK,
            "......g.........",
            ".....gg.........",
            "....ggg.r...r...",
            "...gggg..r.r....",
            "...gggg...r.....",
            "...gggg..r.r....",
            "....ggg.r...r...",
            ".....gg.........",
            "......g.........",
            BLANK, BLANK, BLANK, BLANK, BLANK,
        ],
    ),
    "reset": (
        {
            "g": "#5c626b", "G": "#aab0b9",
        },
        [
            BLANK, BLANK,
            ".....gggggg.....",
            "...gggggggggg...",
            "....gGGGGGGg....",
            "....gGgGgGGg....",
            "....gGgGgGGg....",
            "....gGgGgGGg....",
            "....gGgGgGGg....",
            "....gGgGgGGg....",
            "....gGgGgGGg....",
            "....gGGGGGGg....",
            "....gggggggg....",
            BLANK, BLANK, BLANK,
        ],
    ),
    "logo": (
        {
            "f": "#c99a25", "F": "#f2ca45", "h": "#ffe788",
            "C": "#6b4a2e", "c": "#8a623c", "w": "#fff4c2",
        },
        [
            BLANK, BLANK,
            "....w..F..w.....",
            "...FFFFFFFF.....",
            "..FFFFCCCFFFF...",
            "..FFFCCCCCFFF...",
            "..FFFCCCCCFFF...",
            "..FFFFCCCFFFF...",
            "...FFFFFFFF.....",
            "....w..F..w.....",
            BLANK, BLANK, BLANK, BLANK, BLANK, BLANK,
        ],
    ),
}


def render(rows, palette):
    if len(rows) != 16:
        raise ValueError(f"expected 16 rows, got {len(rows)}")
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        if len(row) != 16:
            raise ValueError(f"row {y} has {len(row)} columns: {row!r}")
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            color = palette.get(ch)
            if not color:
                raise ValueError(f"row {y} uses undefined color {ch!r}")
            px[x, y] = ImageColor.getrgb(color) + (255,)
    return img


def build(preview=False):
    CROPS_DIR.mkdir(parents=True, exist_ok=True)
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    for crop, stages in CROPS.items():
        for index, rows in enumerate(stages):
            render(rows, CROP_PALETTES[crop]).save(CROPS_DIR / f"{crop}-{index}.png")

    for name, (palette, rows) in ICONS.items():
        render(rows, palette).save(ICONS_DIR / f"{name}.png")

    print(f"wrote {len(CROPS) * 4} crop frames and {len(ICONS)} icons")

    if preview:
        write_preview()


def write_preview():
    items = []
    for crop, stages in CROPS.items():
        for index, rows in enumerate(stages):
            items.append((f"{crop} {index}", render(rows, CROP_PALETTES[crop])))
    for name, (palette, rows) in ICONS.items():
        items.append((name, render(rows, palette)))

    cols = 6
    cell_w, cell_h = 116, 124
    sheet = Image.new("RGBA", (cols * cell_w, ((len(items) + cols - 1) // cols) * cell_h), (44, 47, 52, 255))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/TTF/DejaVuSans.ttf", 11)
    except OSError:
        font = ImageFont.load_default()

    for index, (label, img) in enumerate(items):
        cx = (index % cols) * cell_w
        cy = (index // cols) * cell_h
        big = img.resize((80, 80), Image.NEAREST)
        draw.rectangle([cx + 10, cy + 6, cx + 106, cy + 102], fill=(52, 56, 62, 255))
        sheet.alpha_composite(big, (cx + 18, cy + 14))
        draw.text((cx + 12, cy + 108), label, font=font, fill=(225, 229, 234, 255))

    out = ROOT / "tools" / "preview.png"
    sheet.save(out)
    print(f"preview: {out}")


if __name__ == "__main__":
    import sys
    build(preview="--preview" in sys.argv)

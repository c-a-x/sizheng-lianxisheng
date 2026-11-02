# -*- coding: utf-8 -*-
"""生成小程序头像候选方案（1024 画布，导出 512 / 144）"""
import os
from PIL import Image, ImageDraw, ImageFont

S = 1024
INK = (17, 17, 17)
BLUE = (11, 83, 148)
PAPER = (255, 255, 255)
SONG = r"C:\Windows\Fonts\simsun.ttc"
KAI = r"C:\Windows\Fonts\simkai.ttf"

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "icon")
os.makedirs(OUT, exist_ok=True)


def canvas(bg=PAPER):
    img = Image.new("RGB", (S, S), bg)
    return img, ImageDraw.Draw(img)


def glyph(draw, text, size, center, color=INK, font_path=SONG):
    font = ImageFont.truetype(font_path, size)
    draw.text(center, text, font=font, fill=color, anchor="mm")


def check(draw, box, color=BLUE, width=26):
    """在 box=(x0,y0,x1,y1) 内画对勾"""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    pts = [
        (x0 + w * 0.08, y0 + h * 0.55),
        (x0 + w * 0.38, y0 + h * 0.84),
        (x0 + w * 0.95, y0 + h * 0.12),
    ]
    draw.line(pts, fill=color, width=width, joint="curve")
    r = width / 2
    for px, py in (pts[0], pts[2]):
        draw.ellipse([px - r, py - r, px + r, py + r], fill=color)


# A：墨框 + 宋体「思」+ 双线
img, d = canvas()
d.rectangle([36, 36, S - 36, S - 36], outline=INK, width=14)
glyph(d, "思", 560, (S // 2, S // 2 - 40))
d.rectangle([36, S - 190, S - 36, S - 158], fill=INK)
d.rectangle([36, S - 128, S - 36, S - 112], fill=BLUE)
img.save(os.path.join(OUT, "a.png"))

# B：墨底反白 + 蓝线
img, d = canvas(INK)
glyph(d, "思", 580, (S // 2, S // 2 - 30), color=PAPER)
d.rectangle([S // 2 - 150, S - 210, S // 2 + 150, S - 190], fill=BLUE)
img.save(os.path.join(OUT, "b.png"))

# C：答题卡四格，一格填蓝打勾
img, d = canvas()
box = 300
gap = 44
left = (S - box * 2 - gap) // 2
top = (S - box * 2 - gap) // 2
for row in range(2):
    for col in range(2):
        x = left + col * (box + gap)
        y = top + row * (box + gap)
        if row == 0 and col == 0:
            d.rectangle([x, y, x + box, y + box], fill=BLUE)
            check(d, (x + 60, y + 46, x + box - 60, y + box - 46), color=PAPER, width=30)
        else:
            d.rectangle([x, y, x + box, y + box], outline=INK, width=18)
img.save(os.path.join(OUT, "c.png"))

# D：宋体「思」+ 右下蓝色角标打勾
img, d = canvas()
glyph(d, "思", 600, (S // 2 - 10, S // 2 - 30))
badge = 250
bx, by = S - badge - 40, S - badge - 40
d.rectangle([bx, by, bx + badge, by + badge], fill=BLUE)
check(d, (bx + 52, by + 40, bx + badge - 52, by + badge - 40), color=PAPER, width=24)
img.save(os.path.join(OUT, "d.png"))

# E：楷体「思」+ 细框 + 蓝点（克制版）
img, d = canvas()
d.rectangle([30, 30, S - 30, S - 30], outline=INK, width=10)
glyph(d, "思", 540, (S // 2, S // 2 - 20), font_path=KAI)
d.ellipse([S // 2 - 34, S - 210, S // 2 + 34, S - 142], fill=BLUE)
img.save(os.path.join(OUT, "e.png"))

# 导出尺寸
for name in ["a", "b", "c", "d", "e"]:
    src = Image.open(os.path.join(OUT, f"{name}.png"))
    for size in (512, 144):
        src.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f"{name}-{size}.png"))

print("done", OUT)

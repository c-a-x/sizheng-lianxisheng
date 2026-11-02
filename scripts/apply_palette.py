# -*- coding: utf-8 -*-
"""给单色界面补一套克制的配色：主色蓝 + 语义色（正确绿/错误红/收藏琥珀）。"""

import pathlib
import re

ROOT = pathlib.Path(r"E:\workbuddySessions\2026-10-31-11-26-25")


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")


def rule_span(css, selector):
    """返回 selector 规则体的 (start, end)，selector 需精确匹配行首。"""
    pattern = re.compile(r"(^|\n)" + re.escape(selector) + r"\s*\{")
    match = pattern.search(css)
    if not match:
        return None
    start = match.end()
    end = css.index("}", start)
    return start, end


def set_prop(css, selector, prop, value):
    span = rule_span(css, selector)
    if not span:
        # 规则不存在时追加到文件末尾
        return css.rstrip() + "\n\n%s {\n    %s: %s;\n}\n" % (selector, prop, value)
    start, end = span
    body = css[start:end]
    line = re.compile(r"(?m)^(\s*)" + re.escape(prop) + r"\s*:\s*[^;]+;")
    if line.search(body):
        body = line.sub(lambda m: "%s%s: %s;" % (m.group(1), prop, value), body, count=1)
    else:
        body = body.rstrip() + "\n    %s: %s;\n" % (prop, value)
    return css[:start] + body + css[end:]


def apply(path, edits):
    css = read(path)
    for selector, prop, value in edits:
        css = set_prop(css, selector, prop, value)
    write(path, css)
    print("updated", path, len(edits))


BRAND = "#2A5CE0"
BRAND_TINT = "#EAF0FF"
BRAND_LINE = "#CBDAFF"
OK = "#17A34A"
OK_TINT = "#E9F7EF"
OK_LINE = "#C9EDD8"
BAD = "#D64545"
BAD_TINT = "#FDEEEE"
BAD_LINE = "#F5D2D2"
AMBER = "#E0A106"
AMBER_TINT = "#FFFAEC"
AMBER_LINE = "#F2E3BE"

# 1) 全局按钮
apply("app.wxss", [
    (".primary-button", "background", BRAND),
    (".secondary-button", "background", BRAND_TINT),
    (".secondary-button", "color", BRAND),
    (".ghost-button", "color", BRAND),
])

# 2) 首页
apply("pages/index/index.wxss", [
    (".hero", "background", BRAND),
    (".hero", "border-color", BRAND),
    (".brand-mark", "background", "rgba(255, 255, 255, 0.18)"),
    (".brand-mark", "border-color", "rgba(255, 255, 255, 0.38)"),
    (".eyebrow", "color", "#D6E0FF"),
    (".subject-tab-active", "background", BRAND),
    (".subject-tab-active .subject-tab-total", "color", "#D6E0FF"),
    (".progress-value", "background", BRAND),
    (".icon-blue", "background", BRAND_TINT),
    (".icon-blue", "color", BRAND),
    (".icon-blue", "border-color", BRAND_LINE),
    (".icon-purple", "background", "#F1EAFF"),
    (".icon-purple", "color", "#6D4AC7"),
    (".icon-purple", "border-color", "#DED0FA"),
    (".icon-green", "background", OK_TINT),
    (".icon-green", "color", OK),
    (".icon-green", "border-color", OK_LINE),
    (".icon-orange", "background", "#FFF3E0"),
    (".icon-orange", "color", "#C77700"),
    (".icon-orange", "border-color", "#FBDFB2"),
    (".wrong-icon", "background", BAD_TINT),
    (".wrong-icon", "color", BAD),
    (".wrong-icon", "border-color", BAD_LINE),
    (".favorite-icon", "background", "#FFF6E3"),
    (".favorite-icon", "color", "#C58600"),
    (".favorite-icon", "border-color", "#F6E2B8"),
    (".data-icon", "background", BRAND_TINT),
    (".data-icon", "color", BRAND),
    (".data-icon", "border-color", BRAND_LINE),
])

# 3) 答题页
apply("pages/practice/practice.wxss", [
    (".option-selected", "border-color", BRAND),
    (".option-selected", "background", "#EDF2FF"),
    (".option-selected .option-marker", "border-color", BRAND),
    (".option-selected .option-marker", "background", BRAND),
    (".option-correct", "border-color", OK),
    (".option-correct", "background", OK_TINT),
    (".option-correct .option-marker", "border-color", OK),
    (".option-correct .option-marker", "background", OK),
    (".option-wrong", "border-color", BAD),
    (".option-wrong", "background", BAD_TINT),
    (".option-wrong .option-marker", "border-color", BAD),
    (".option-wrong .option-marker", "background", BAD),
    (".feedback-correct", "border-left", "6rpx solid %s" % OK),
    (".feedback-correct", "background", OK_TINT),
    (".feedback-wrong", "border", "2rpx dashed %s" % BAD_LINE),
    (".feedback-wrong", "background", "#FFF7F7"),
    (".memory-tip", "border-left", "6rpx solid %s" % AMBER),
    (".memory-tip", "border-color", AMBER_LINE),
    (".memory-tip", "background", AMBER_TINT),
    (".memory-tip-icon", "background", AMBER),
    (".memory-tip-title", "color", "#8A5A00"),
    (".progress-value", "background", BRAND),
])

# 4) 题库目录
apply("pages/catalog/catalog.wxss", [
    (".filter-active", "background", BRAND),
    (".filter-active", "border-color", BRAND),
    (".filter-active .filter-count", "color", "#D6E0FF"),
    (".status-done", "background", OK_TINT),
    (".status-done", "color", "#12813F"),
    (".status-done", "border-color", OK_LINE),
    (".status-wrong", "background", BAD_TINT),
    (".status-wrong", "color", BAD),
    (".status-wrong", "border-color", BAD_LINE),
    (".favorite-mark", "color", AMBER),
])

# 5) 章节页
apply("pages/chapters/chapters.wxss", [
    (".progress-value", "background", BRAND),
    (".chapter-label", "color", BRAND),
])

print("DONE")

# -*- coding: utf-8 -*-
"""生成小程序备案用《情况说明》单页文档。"""
import os
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
os.makedirs(OUT_DIR, exist_ok=True)
OUT = os.path.join(OUT_DIR, "小程序备案-情况说明.docx")

TITLE = "情况说明"

PARA1 = (
    "本人开发并运营的微信小程序「思政练习生」，系个人日常学习辅助工具，"
    "用于高校思想政治理论课题库的练习与自测。小程序包含顺序练习、随机练习、"
    "单选专项练习、多选专项练习、章节练习、错题重练等功能，可查看答题解析与记忆提示、"
    "收藏题目、查看练习统计。小程序无收费项目，不涉及交易、社交及内容发布功能，"
    "不向任何服务器上传数据，学习记录仅保存在用户本机。"
)

PARA2 = (
    "本人承诺所提交的备案信息及材料均真实、合法、有效，所备案的小程序为本人合法经营并负责管理，"
    "如有违反，自愿承担相应的法律责任并接受注销备案；如小程序内容存在违规，愿意接受相应处罚结果。"
)


def set_font(run, name, size, bold=False):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)


doc = Document()

# 页面：A4 + 公文页边距
section = doc.sections[0]
section.page_width = Cm(21.0)
section.page_height = Cm(29.7)
section.top_margin = Cm(3.7)
section.bottom_margin = Cm(3.5)
section.left_margin = Cm(2.8)
section.right_margin = Cm(2.6)

# 默认样式
normal = doc.styles["Normal"]
normal.font.name = "仿宋"
normal.font.size = Pt(16)
normal._element.rPr.rFonts.set(qn("w:eastAsia"), "仿宋")

# 标题
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(0)
p.paragraph_format.space_after = Pt(24)
r = p.add_run(TITLE)
set_font(r, "宋体", 22, bold=True)

# 正文
for text in (PARA1, PARA2):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.first_line_indent = Pt(32)   # 首行缩进两字（三号=16pt）
    p.paragraph_format.line_spacing = Pt(30)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run(text)
    set_font(r, "仿宋", 16)

# 落款空两行
for _ in range(3):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = Pt(30)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY

# 签名行
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
p.paragraph_format.right_indent = Pt(16)
p.paragraph_format.line_spacing = Pt(36)
p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY
r = p.add_run("承诺人（签字）：")
set_font(r, "仿宋", 16)

# 日期行
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
p.paragraph_format.right_indent = Pt(16)
p.paragraph_format.line_spacing = Pt(36)
p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY
r = p.add_run("　　　　年　　月　　日")
set_font(r, "仿宋", 16)

doc.save(OUT)
print("已生成:", OUT)
print("字数统计: 第一段 %d 字，第二段 %d 字" % (len(PARA1), len(PARA2)))

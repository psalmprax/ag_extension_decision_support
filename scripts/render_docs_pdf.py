#!/usr/bin/env python3
"""Render a markdown document from docs/ into a paginated PDF.

Supports the subset used by the repository docs: H1/H2/H3, paragraphs,
bullet and numbered lists, fenced code, pipe tables, block quotes and
horizontal rules. H1/H2 headings become table-of-contents entries.

Usage:
    python3 scripts/render_docs_pdf.py docs/SOMETHING.md docs/SOMETHING.pdf \
        --title "Document Title" --subtitle "Subtitle line"
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

ACCENT = colors.HexColor("#166534")
ACCENT_SOFT = colors.HexColor("#dcfce7")
INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#4b5563")
RULE = colors.HexColor("#d1d5db")
CODE_BG = colors.HexColor("#f3f4f6")

PAGE_W, PAGE_H = A4
MARGIN_X = 20 * mm
MARGIN_TOP = 22 * mm
MARGIN_BOTTOM = 20 * mm


def build_styles():
    styles = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold",
            fontSize=30, leading=36, textColor=ACCENT, spaceAfter=10, alignment=TA_LEFT,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle", parent=styles["Normal"], fontName="Helvetica",
            fontSize=14, leading=20, textColor=MUTED, spaceAfter=6, alignment=TA_LEFT,
        ),
        "cover_meta": ParagraphStyle(
            "CoverMeta", parent=styles["Normal"], fontName="Helvetica",
            fontSize=10, leading=15, textColor=MUTED,
        ),
        "h1": ParagraphStyle(
            "H1", parent=styles["Heading1"], fontName="Helvetica-Bold",
            fontSize=20, leading=25, textColor=ACCENT, spaceBefore=6, spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
            fontSize=14, leading=18, textColor=INK, spaceBefore=14, spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "H3", parent=styles["Heading3"], fontName="Helvetica-Bold",
            fontSize=11.5, leading=15, textColor=INK, spaceBefore=10, spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body", parent=styles["BodyText"], fontName="Helvetica",
            fontSize=9.8, leading=14.2, textColor=INK, spaceAfter=7,
        ),
        "bullet": ParagraphStyle(
            "Bullet", parent=styles["BodyText"], fontName="Helvetica",
            fontSize=9.8, leading=14, textColor=INK, leftIndent=14, bulletIndent=3,
            spaceAfter=3,
        ),
        "code": ParagraphStyle(
            "Code", parent=styles["Code"], fontName="Courier",
            fontSize=8.2, leading=10.8, textColor=INK,
        ),
        "cell": ParagraphStyle(
            "Cell", parent=styles["BodyText"], fontName="Helvetica",
            fontSize=8.6, leading=11.4, textColor=INK,
        ),
        "cell_head": ParagraphStyle(
            "CellHead", parent=styles["BodyText"], fontName="Helvetica-Bold",
            fontSize=8.6, leading=11.4, textColor=colors.white,
        ),
        "quote": ParagraphStyle(
            "Quote", parent=styles["BodyText"], fontName="Helvetica-Oblique",
            fontSize=9.4, leading=13.4, textColor=INK,
        ),
        "toc_heading": ParagraphStyle(
            "TOCHeading", parent=styles["Heading1"], fontName="Helvetica-Bold",
            fontSize=20, leading=25, textColor=ACCENT, spaceAfter=10,
        ),
        "toc1": ParagraphStyle(
            "TOC1", fontName="Helvetica-Bold", fontSize=10.5, leading=16,
            textColor=INK, spaceBefore=4,
        ),
        "toc2": ParagraphStyle(
            "TOC2", fontName="Helvetica", fontSize=9.6, leading=14,
            textColor=MUTED, leftIndent=14,
        ),
    }


INLINE_CODE = re.compile(r"`([^`]+)`")
BOLD = re.compile(r"\*\*([^*]+)\*\*")
ITALIC = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")
LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def inline(text: str) -> str:
    """Escape a markdown line and apply the inline markup reportlab understands."""
    text = html.escape(text, quote=False)
    text = INLINE_CODE.sub(
        lambda m: '<font name="Courier" size="8.8" color="#111827">%s</font>' % m.group(1), text
    )
    text = LINK.sub(lambda m: '%s (%s)' % (m.group(1), m.group(2)), text)
    text = BOLD.sub(lambda m: "<b>%s</b>" % m.group(1), text)
    text = ITALIC.sub(lambda m: "<i>%s</i>" % m.group(1), text)
    return text


def split_row(line: str) -> list[str]:
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    return cells


SEPARATOR = re.compile(r"^\|?[\s:|-]+\|[\s:|-]*$")


def parse_blocks(md: str):
    """Yield (kind, payload) tuples from the supported markdown subset."""
    lines = md.splitlines()
    i = 0
    paragraph: list[str] = []
    out: list[tuple[str, object]] = []

    def add(kind: str, payload):
        out.append((kind, payload))

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            if paragraph:
                add("p", " ".join(paragraph)); paragraph = []
            lang = stripped[3:].strip()
            i += 1
            code: list[str] = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i].rstrip())
                i += 1
            add("code", (lang, "\n".join(code)))
            i += 1
            continue

        if stripped.startswith("|") and i + 1 < len(lines) and SEPARATOR.match(lines[i + 1].strip()):
            if paragraph:
                add("p", " ".join(paragraph)); paragraph = []
            header = split_row(stripped)
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(split_row(lines[i]))
                i += 1
            add("table", (header, rows))
            continue

        if stripped.startswith("### "):
            if paragraph:
                add("p", " ".join(paragraph)); paragraph = []
            add("h3", stripped[4:].strip()); i += 1; continue

        if stripped.startswith("## "):
            if paragraph:
                add("p", " ".join(paragraph)); paragraph = []
            add("h2", stripped[3:].strip()); i += 1; continue

        if stripped.startswith("# "):
            if paragraph:
                add("p", " ".join(paragraph)); paragraph = []
            add("h1", stripped[2:].strip()); i += 1; continue

        if stripped in ("---", "***", "___"):
            if paragraph:
                add("p", " ".join(paragraph)); paragraph = []
            # A rule directly above a chapter heading is structural noise: the
            # chapter break already separates it, and an orphaned rule would be
            # pushed onto a page of its own.
            rest = [l.strip() for l in lines[i + 1:] if l.strip()]
            if not (rest and rest[0].startswith("# ")):
                add("rule", None)
            i += 1
            continue

        if stripped.startswith("> "):
            if paragraph:
                add("p", " ".join(paragraph)); paragraph = []
            quote: list[str] = []
            while i < len(lines) and lines[i].strip().startswith("> "):
                quote.append(lines[i].strip()[2:].strip())
                i += 1
            add("quote", " ".join(quote))
            continue

        bullet = re.match(r"^(\s*)[-*]\s+(.*)$", line)
        if bullet:
            if paragraph:
                add("p", " ".join(paragraph)); paragraph = []
            indent = len(bullet.group(1))
            add("bullet", (indent, bullet.group(2).strip()))
            i += 1
            continue

        numbered = re.match(r"^(\s*)(\d+)\.\s+(.*)$", line)
        if numbered:
            if paragraph:
                add("p", " ".join(paragraph)); paragraph = []
            add("numbered", (len(numbered.group(1)), numbered.group(2), numbered.group(3).strip()))
            i += 1
            continue

        if not stripped:
            if paragraph:
                add("p", " ".join(paragraph)); paragraph = []
            i += 1
            continue

        paragraph.append(stripped)
        i += 1

    if paragraph:
        add("p", " ".join(paragraph))
    return out


class ManualDoc(BaseDocTemplate):
    def __init__(self, path, *, title, footer, **kwargs):
        self.doc_title = title
        self.footer_text = footer
        super().__init__(path, **kwargs)

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name in ("H1", "H2"):
            level = 0 if flowable.style.name == "H1" else 1
            text = flowable.getPlainText()
            key = "toc-%d-%s" % (level, re.sub(r"\W+", "-", text.lower()))
            self.canv.bookmarkPage(key)
            self.notify("TOCEntry", (level, text, self.page, key))

    def draw_page_decor(self, canv, doc):
        if doc.page == 1:
            return
        canv.saveState()
        canv.setStrokeColor(RULE)
        canv.setLineWidth(0.4)
        canv.line(MARGIN_X, PAGE_H - MARGIN_TOP + 8 * mm, PAGE_W - MARGIN_X, PAGE_H - MARGIN_TOP + 8 * mm)
        canv.setFont("Helvetica", 7.8)
        canv.setFillColor(MUTED)
        canv.drawString(MARGIN_X, PAGE_H - MARGIN_TOP + 10 * mm, self.doc_title)
        canv.drawRightString(PAGE_W - MARGIN_X, PAGE_H - MARGIN_TOP + 10 * mm, self.footer_text)
        canv.line(MARGIN_X, MARGIN_BOTTOM - 6 * mm, PAGE_W - MARGIN_X, MARGIN_BOTTOM - 6 * mm)
        canv.drawString(MARGIN_X, MARGIN_BOTTOM - 12 * mm, "GPEXTS  |  Agricultural Extension Decision Support")
        canv.drawRightString(PAGE_W - MARGIN_X, MARGIN_BOTTOM - 12 * mm, "Page %d" % doc.page)
        canv.restoreState()


def cover(title: str, subtitle: str, meta_lines: list[str], styles) -> list:
    story = [Spacer(1, 55 * mm)]
    story.append(Paragraph(inline(title), styles["cover_title"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(inline(subtitle), styles["cover_subtitle"]))
    story.append(Spacer(1, 12 * mm))
    story.append(Table([[""]], colWidths=[45 * mm], rowHeights=[1.4], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
    ])))
    story.append(Spacer(1, 12 * mm))
    for line in meta_lines:
        story.append(Paragraph(inline(line), styles["cover_meta"]))
        story.append(Spacer(1, 1.2 * mm))
    story.append(PageBreak())
    return story


def table_flowable(header: list[str], rows: list[list[str]], styles):
    width = PAGE_W - 2 * MARGIN_X
    cols = max(len(header), *(len(r) for r in rows)) if rows else len(header)
    data = [[Paragraph(inline(c), styles["cell_head"]) for c in header]]
    for row in rows:
        padded = row + [""] * (cols - len(row))
        data.append([Paragraph(inline(c), styles["cell"]) for c in padded])
    col_widths = [width / cols] * cols
    table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return [table, Spacer(1, 5 * mm)]


def build_story(blocks, styles) -> list:
    story: list = []
    for kind, payload in blocks:
        if kind == "h1":
            story.append(PageBreak())
            story.append(Paragraph(inline(payload), styles["h1"]))
            story.append(Table([[""]], colWidths=[30 * mm], rowHeights=[1.2], style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
            ])))
            story.append(Spacer(1, 4 * mm))
        elif kind == "h2":
            story.append(Paragraph(inline(payload), styles["h2"]))
        elif kind == "h3":
            story.append(Paragraph(inline(payload), styles["h3"]))
        elif kind == "p":
            story.append(Paragraph(inline(payload), styles["body"]))
        elif kind == "bullet":
            indent, text = payload
            style = ParagraphStyle(
                "BulletL%d" % indent, parent=styles["bullet"],
                leftIndent=14 + (indent // 2) * 10, bulletIndent=3 + (indent // 2) * 10,
            )
            story.append(Paragraph(inline(text), style, bulletText="\u2022"))
        elif kind == "numbered":
            indent, number, text = payload
            style = ParagraphStyle(
                "NumL%d" % indent, parent=styles["bullet"],
                leftIndent=16 + (indent // 2) * 10, bulletIndent=3 + (indent // 2) * 10,
            )
            story.append(Paragraph(inline(text), style, bulletText="%s." % number))
        elif kind == "code":
            _lang, code = payload
            block = Preformatted(code, styles["code"], maxLineLength=110)
            table = Table([[block]], colWidths=[PAGE_W - 2 * MARGIN_X], hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(table)
            story.append(Spacer(1, 4 * mm))
        elif kind == "table":
            header, rows = payload
            story.extend(table_flowable(header, rows, styles))
        elif kind == "quote":
            para = Paragraph(inline(payload), styles["quote"])
            box = Table([[para]], colWidths=[PAGE_W - 2 * MARGIN_X], hAlign="LEFT")
            box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), ACCENT_SOFT),
                ("LINEBEFORE", (0, 0), (0, -1), 2.2, ACCENT),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(KeepTogether([box, Spacer(1, 4 * mm)]))
        elif kind == "rule":
            story.append(Spacer(1, 2 * mm))
            story.append(Table([[""]], colWidths=[PAGE_W - 2 * MARGIN_X], rowHeights=[0.6], style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), RULE),
            ])))
            story.append(Spacer(1, 3 * mm))
    return story


def render(md_path: Path, pdf_path: Path, title: str, subtitle: str, version: str) -> None:
    styles = build_styles()
    blocks = parse_blocks(md_path.read_text(encoding="utf-8"))

    today = dt.date.today().strftime("%d %B %Y")
    meta = [
        "Version %s" % version,
        "Issued %s" % today,
        "Source: `%s`" % md_path.as_posix(),
    ]

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    footer = "Agricultural Extension Decision Support"

    doc = ManualDoc(
        str(pdf_path), title=title, footer=footer,
        pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM,
        author="GPEXTS", subject=subtitle,
    )
    frame = Frame(
        MARGIN_X, MARGIN_BOTTOM, PAGE_W - 2 * MARGIN_X, PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
        id="body", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )
    doc.addPageTemplates([
        PageTemplate(id="page", frames=[frame], onPage=doc.draw_page_decor),
    ])

    story = cover(title, subtitle, meta, styles)
    story.append(Paragraph("Contents", styles["toc_heading"]))
    toc = TableOfContents()
    toc.levelStyles = [styles["toc1"], styles["toc2"]]
    story.append(toc)
    story.extend(build_story(blocks, styles))

    doc.multiBuild(story)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--title", required=True)
    parser.add_argument("--subtitle", default="")
    parser.add_argument("--version", default="1.0")
    args = parser.parse_args()

    for arg in (args.source, args.output):
        if ".." in arg.parts:
            print("Paths must stay inside the repository", file=sys.stderr)
            return 2
    if not args.source.is_file():
        print("Source not found: %s" % args.source, file=sys.stderr)
        return 2

    render(args.source, args.output, args.title, args.subtitle, args.version)
    print("Wrote %s" % args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

DOCS = Path(r"D:\STOR\docs\android-plan")
PAGES = {
    "technical": DOCS / "technical-stack.html",
    "plan": DOCS / "implementation-plan.html",
    "pm": DOCS / "product-manager-guide.html",
}


class TextExtract(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0
        self.ids = []
        self.anchors = []
        self.labelledby = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style", "noscript"):
            self.skip += 1
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "a" and attrs.get("href", "").startswith("#"):
            self.anchors.append(attrs["href"][1:])
        if "aria-labelledby" in attrs:
            self.labelledby.append(attrs["aria-labelledby"])

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def norm(text):
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("**", "").replace("`", "")
    text = re.sub(r"^\s*(?:[-*]|\d+\.)\s+", "", text)
    text = text.replace("|", "")
    text = re.sub(r"\s+", "", text)
    return text


def source_segments(md_path):
    segments = []
    for lineno, raw in enumerate(md_path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#") or re.match(r"^\|?\s*-{2,}", line):
            continue
        if line.startswith("|"):
            for cell in line.strip("|").split("|"):
                cell = cell.strip()
                if len(norm(cell)) >= 12:
                    segments.append((lineno, cell))
        else:
            text = re.sub(r"^[-*]\s+", "", line)
            text = re.sub(r"^\d+\.\s+", "", text)
            if len(norm(text)) >= 12:
                segments.append((lineno, text))
    return segments


def check_page(name, path, md_path):
    html = path.read_text(encoding="utf-8")
    parser = TextExtract()
    parser.feed(html)
    text = norm("".join(parser.parts))

    dup_ids = sorted({i for i in parser.ids if parser.ids.count(i) > 1})
    missing_anchors = sorted({a for a in parser.anchors if a and a not in set(parser.ids)})
    missing_labelledby = [x for x in set(parser.labelledby) if x not in set(parser.ids)]
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    syntax_errors = []
    for idx, script in enumerate(scripts):
        try:
            compile(script, f"<{name}-script-{idx}>", "exec")
        except Exception as exc:  # noqa: BLE001
            syntax_errors.append(str(exc))

    quizzes = re.findall(r"var quizData = (\[.*?\]);\s*\n\s*var quizList", scripts[0], re.S) if scripts else []
    quiz_count = 0
    if quizzes:
        quiz_count = len(json.loads(quizzes[0]))

    missing = []
    for lineno, segment in source_segments(md_path):
        key = norm(segment)
        if key and key not in text:
            missing.append((lineno, segment[:110]))

    print(f"\n=== {name} ===")
    print(f"html bytes: {len(html):,}; ids: {len(set(parser.ids))}; dup ids: {dup_ids or 'none'}")
    print(f"broken anchors: {missing_anchors or 'none'}; missing aria-labelledby: {missing_labelledby or 'none'}")
    print(f"script syntax: {'OK' if not syntax_errors else syntax_errors}; quiz questions: {quiz_count}")
    print(f"source segments not found: {len(missing)}")
    for lineno, segment in missing[:40]:
        print(f"  L{lineno}: {segment}")

    print("required markers:", {k: (k in html) for k in [
        "id=\"progress\"", "id=\"readout\"", "id=\"toc-dialog\"", "id=\"toc-open\"",
        "id=\"rail-list\"", "id=\"quiz-list\"", "id=\"quiz-score\"", "id=\"quiz-reset\"",
        "class=\"print-toc\"", "class=\"doc-switch\"",
    ]})


check_page("technical", PAGES["technical"], DOCS / "technical-stack.md")
check_page("plan", PAGES["plan"], DOCS / "implementation-plan.md")

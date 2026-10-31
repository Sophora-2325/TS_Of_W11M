import re
from pathlib import Path
from html.parser import HTMLParser

DOCS = Path(r"D:\STOR\docs\android-plan")


class TextExtract(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.skip += 1

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


def html_text(path):
    parser = TextExtract()
    parser.feed(path.read_text(encoding="utf-8"))
    return norm("".join(parser.parts))


out = []
tech = html_text(DOCS / "technical-stack.html")
tech_src = (DOCS / "technical-stack.md").read_text(encoding="utf-8").splitlines()
plan = html_text(DOCS / "implementation-plan.html")
plan_src = (DOCS / "implementation-plan.md").read_text(encoding="utf-8").splitlines()

for src_lines, text, label, wanted in [
    (tech_src, tech, "tech", [3, 5, 76, 93, 95, 118, 149]),
    (plan_src, plan, "plan", [3, 5, 129]),
]:
    for n in wanted:
        key = norm(src_lines[n - 1])
        found = key in text
        out.append(f"=== {label} L{n} found={found}")
        out.append("SRC: " + key[:500])
        if not found:
            # locate longest matching prefix
            lo, hi = 0, len(key)
            while lo < hi:
                mid = (lo + hi + 1) // 2
                if key[:mid] in text:
                    lo = mid
                else:
                    hi = mid - 1
            out.append(f"longest prefix {lo}: {key[:lo][-120:]}")
            if lo < len(key):
                needle = key[lo : lo + 60]
                pos = text.find(needle)
                out.append("next source fragment: " + needle)
                out.append("html around: " + (text[max(0, pos - 60) : pos + 120] if pos >= 0 else "NOT FOUND"))

report = "\n".join(out)
Path(r"D:\STOR\.cache\guides\diff-report.txt").write_text(report, encoding="utf-8")
print("wrote diff report")

from html.parser import HTMLParser
from pathlib import Path

DOCS = Path(r"D:\STOR\docs\android-plan")
PAGES = ["product-manager-guide.html", "technical-stack.html", "implementation-plan.html"]


class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.hrefs = []
        self.anchors = []
        self.tables = 0
        self.table_rows = []
        self.quizzes = 0
        self.lang = ""
        self.has_viewport = False
        self.labelledby = []
        self.title = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang", "")
        if tag == "meta" and a.get("name") == "viewport":
            self.has_viewport = True
        if tag == "title":
            self.in_title = True
        if "id" in a:
            self.ids.append(a["id"])
            if a["id"] == "quiz-list":
                self.quizzes += 1
        if tag == "a":
            href = a.get("href", "")
            self.hrefs.append(href)
            if href.startswith("#"):
                self.anchors.append(href[1:])
        if tag == "table":
            self.tables += 1
            self.table_rows.append(0)
        if tag == "tr":
            self.table_rows[-1] += 1
        if "aria-labelledby" in a:
            self.labelledby.append(a["aria-labelledby"])

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


lines = []
for name in PAGES:
    path = DOCS / name
    html = path.read_text(encoding="utf-8")
    p = P()
    p.feed(html)
    ids = set(p.ids)
    dup = sorted({i for i in p.ids if p.ids.count(i) > 1})
    broken = sorted({a for a in p.anchors if a and a not in ids})
    bad_labelled = sorted({x for x in p.labelledby if x not in ids})
    missing_files = []
    local_links = []
    for href in p.hrefs:
        if not href or href.startswith("#") or href.startswith("http") or href.startswith("mailto:"):
            continue
        target = (path.parent / href.split("#")[0]).resolve()
        local_links.append(href)
        if not target.exists():
            missing_files.append(href)
    external_css = "@import" in html or '<link rel="stylesheet"' in html
    lines.append(f"=== {name}")
    lines.append(f"title: {p.title.strip()}")
    lines.append(f"lang={p.lang} viewport={p.has_viewport} ids={len(ids)} dup={dup or 'none'}")
    lines.append(f"tables={p.tables} rows={p.table_rows} quizzes={p.quizzes}")
    lines.append(f"broken anchors={broken or 'none'} bad labelledby={bad_labelled or 'none'} missing local files={missing_files or 'none'}")
    lines.append(f"local links={sorted(set(local_links))}")
    lines.append(f"external css/import={external_css}")

report = "\n".join(lines)
Path(r"D:\STOR\.cache\guides\final-report.txt").write_text(report, encoding="utf-8")
print(report)

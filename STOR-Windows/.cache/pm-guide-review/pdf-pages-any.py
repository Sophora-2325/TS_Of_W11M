import sys
from pypdf import PdfReader

pdf = sys.argv[1]
out = sys.argv[2]
reader = PdfReader(pdf)
rows = []
for i, page in enumerate(reader.pages):
    text = (page.extract_text() or "").strip().replace("\n", " ")
    rows.append(f"[{i+1:02d}] chars={len(text):4d}  {text[:70]}")
with open(out, "w", encoding="utf-8") as fh:
    fh.write("\n".join(rows))
print("pages", len(reader.pages))

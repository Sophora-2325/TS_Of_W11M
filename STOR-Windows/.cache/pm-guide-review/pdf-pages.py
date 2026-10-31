from pypdf import PdfReader

pdf = r"D:\STOR\.cache\pm-guide-review\shots\guide-print2.pdf"
reader = PdfReader(pdf)
rows = []
for i, page in enumerate(reader.pages):
    text = (page.extract_text() or "").strip()
    first = text.replace("\n", " ")[:70]
    rows.append(f"[{i+1:02d}] chars={len(text):4d}  {first}")
out = r"D:\STOR\.cache\pm-guide-review\pdf-pages.txt"
with open(out, "w", encoding="utf-8") as fh:
    fh.write("\n".join(rows))
print("pages", len(reader.pages))

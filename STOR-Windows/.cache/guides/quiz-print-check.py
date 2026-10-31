import json
import re
from pathlib import Path
from pypdf import PdfReader

DOCS = Path(r"D:\STOR\docs\android-plan")
OUT = Path(r"D:\STOR\.cache\guides")
lines = []

for name in ["technical-stack.html", "implementation-plan.html"]:
    html = (DOCS / name).read_text(encoding="utf-8")
    script = re.search(r"<script>(.*?)</script>", html, re.S).group(1)
    arr = re.search(r"var quizData = (\[.*?\]);\s*\n\s*var quizList", script, re.S).group(1)
    data = json.loads(arr)
    lines.append(f"=== {name} quiz={len(data)}")
    for i, item in enumerate(data, 1):
        answer = item["answer"]
        correct = item["options"][answer]
        lines.append(f"Q{i} answer={answer} len={len(item['options'])} correct={correct[:40]}")
    bad = [i for i, item in enumerate(data, 1) if item["answer"] not in range(len(item["options"]))]
    lines.append(f"bad answers: {bad or 'none'}")

for name in ["tech-print.pdf", "plan-print.pdf"]:
    reader = PdfReader(OUT / name)
    text = "\n".join((p.extract_text() or "") for p in reader.pages)
    lines.append(f"=== {name} pages={len(reader.pages)} chars={len(text)}")
    for needle in ["学完自测", "目录", "推荐结论", "本轮决定", "技术选择与对应价值", "开发顺序与放行条件", "自测"]:
        lines.append(f"  {needle}: {needle in text}")

(OUT / "quiz-print-report.txt").write_text("\n".join(lines), encoding="utf-8")
print("wrote report")

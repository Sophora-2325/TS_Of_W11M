import json
from pypdf import PdfReader

pdf = r"D:\STOR\.cache\pm-guide-review\shots\guide-print.pdf"
reader = PdfReader(pdf)
pages = [(p.extract_text() or "") for p in reader.pages]
text = "\n".join(pages)

needles = [
    "产品经理讲解书",
    "这个产品替用户完成什么",
    "把三个愿望变成可验收要求",
    "技术词汇对应什么产品决定",
    "用户实际会怎么用",
    "系统限制应怎样进入产品体验",
    "首版范围与后续顺序",
    "如何定义",
    "你在每个阶段怎样判断是否继续",
    "技术栈方案",
    "开发计划",
    "配套文档",
    "学完自测",
    "学习示意",
    "指标计算器",
    "置信分 0.99",
    "首版暂缓",
    "平台与主流程中已知需要处理的状态",
    "这个产品替用户完成什么",
]

lines = [f"pages={len(pages)} chars={len(text)}"]
for n in needles:
    lines.append(f"{n} -> {n in text}")
lines.append("\n--- per page first 80 chars ---")
for i, page in enumerate(pages):
    lines.append(f"[{i+1}] " + page.strip().replace("\n", " ")[:80])
lines.append("\n--- page 1 ---")
lines.append(pages[0][:1200])
lines.append("\n--- page 12 ---")
lines.append(pages[-1][:1200])

out = r"D:\STOR\.cache\pm-guide-review\pdf-report.txt"
with open(out, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))
print("wrote", out)

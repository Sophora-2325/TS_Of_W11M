from pathlib import Path
import re

for f in ["technical-stack.html", "implementation-plan.html"]:
    html = Path(r"D:\STOR\docs\android-plan") .joinpath(f).read_text(encoding="utf-8")
    m = re.search(r"<script>(.*?)</script>", html, re.S)
    js = m.group(1)
    lines = js.splitlines()
    print("====", f, "script lines", len(lines))
    for i, line in enumerate(lines[:12], 1):
        print(i, repr(line[:160]))
    try:
        compile(js, "x", "exec")
        print("compile ok")
    except SyntaxError as exc:
        print("SyntaxError", exc.lineno, exc.msg)
        idx = exc.lineno - 1
        print("line:", repr(lines[idx][:240]))

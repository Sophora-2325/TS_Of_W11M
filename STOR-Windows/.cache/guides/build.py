import json
import pathlib
import re

BASE = pathlib.Path(r"D:\STOR\.cache\guides")
OUT = pathlib.Path(r"D:\STOR\docs\android-plan")

css = (BASE / "shared.css").read_text(encoding="utf-8")
extra = (BASE / "extra.css").read_text(encoding="utf-8")
js = (BASE / "shared.js").read_text(encoding="utf-8")

FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
    "%3Crect width='32' height='32' fill='%23EDEFEB'/%3E"
    "%3Crect x='7' y='7' width='13' height='13' fill='none' stroke='%23B2431F' stroke-width='2'/%3E"
    "%3Crect x='18' y='18' width='7' height='7' fill='%23B2431F'/%3E%3C/svg%3E"
)

TECH_QUIZ = [
    {
        "q": "先验证的两个最大未知数是什么？",
        "options": [
            "Google Play 审核时间，以及应用商店封面",
            "跨应用取图是否顺手，以及现有模型在手机上的完整识别速度和准确率",
            "Compose 主题颜色，以及设置页的排版",
            "云端翻译服务供应商的账号体系",
        ],
        "answer": 1,
        "why": "技术栈方案明确先验证跨应用取图是否顺手，以及现有模型在手机上的完整识别速度和准确率；通过后再打磨完整界面。",
        "ref": "#recommend",
        "refLabel": "第 1 章",
    },
    {
        "q": "关于 PP-OCRv6 small 在 Android 上的状态，哪种说法准确？",
        "options": [
            "ORT 官方支持 Android，所以模型在手机上一定和桌面一样准",
            "模型格式和运行时路线有依据，但还不能说 Android 端已跑通或达到桌面精度",
            "现有桌面 OCR 目录可以原封不动搬到 Android",
            "只要模型能加载，就算完成手机端验收",
        ],
        "answer": 1,
        "why": "文中说可以作为优先适配的同一套模型，但还不能说 Android 端已跑通或达到了桌面精度；模型加载不等于整包兼容，也不等于输出一致。",
        "ref": "#ocr",
        "refLabel": "第 4 章",
    },
    {
        "q": "会话结束、锁屏或系统停止投屏后，浮键和授权应该怎样？",
        "options": [
            "保留浮键，后台静默恢复旧授权",
            "只隐藏浮键，投屏继续运行",
            "结束投屏并移除浮键；重新开启需要新授权",
            "解锁后自动沿用之前的捕获结果",
        ],
        "answer": 2,
        "why": "一次授权只对应一个活跃会话；锁屏、系统停止或进程结束后需要重新开启。首版结束投屏就结束悬浮会话，不保留永久驻留的浮键服务。",
        "ref": "#constraints",
        "refLabel": "第 3 章",
    },
    {
        "q": "手机上的 127.0.0.1 指什么？",
        "options": [
            "运行 LM Studio 的电脑",
            "手机自身",
            "路由器的管理地址",
            "Google 的翻译服务",
        ],
        "answer": 1,
        "why": "手机上的 127.0.0.1 指手机自身，不能照搬桌面 LM Studio / Ollama 地址；连接电脑局域网服务是后续独立功能。",
        "ref": "#network",
        "refLabel": "第 6 章",
    },
    {
        "q": "发布前对原生库的检查，哪项符合文中的要求？",
        "options": [
            "只确认模型文件能被加载",
            "只在模拟器上安装一次",
            "用了原生栈就说明体积和兼容性没问题",
            "检查所有 .so 的 ABI 与 16 KB page size 支持，并在对应环境实际启动",
        ],
        "answer": 3,
        "why": "ORT、OpenCV 含原生库，必须检查所有 .so 的 ABI 与 16 KB page size 支持，并在对应环境实际启动；模型能加载不等于整包兼容。",
        "ref": "#baseline",
        "refLabel": "第 7 章",
    },
]

PLAN_QUIZ = [
    {
        "q": "开发顺序上，应该先保证什么？",
        "options": [
            "先完成全部视觉界面，再验证截图和模型",
            "P1 和 P2 的证据，再补完整闭环和界面",
            "先把商店上架资料准备好",
            "先接入账号后台和云同步",
        ],
        "answer": 1,
        "why": "文中明确优先保证 P1 和 P2 的证据；不要先完成全部视觉界面，再验证能否顺手截图和跑模型。",
        "ref": "#stages",
        "refLabel": "第 2 章",
    },
    {
        "q": "20–32 个工作日这个估算，应该怎么理解？",
        "options": [
            "任何团队都能在 4–7 周内完成",
            "已经扣除商店审核等待",
            "在给定前提下的估算，P1/P2 后要依据实测重估，不是交付承诺",
            "包含自研翻译模型和账号后台",
        ],
        "answer": 2,
        "why": "估算前提是一名熟悉 Android 的开发者持续投入、能获得测试机、翻译服务已可用；不包含广泛兼容、商店审核、账号后台或自研模型，P1/P2 后重估。",
        "ref": "#stages",
        "refLabel": "第 2 章",
    },
    {
        "q": "P1 应该交付哪些证据？",
        "options": [
            "一张成功的截图和构建成功的日志",
            "商店审核通过截图",
            "只有模拟器运行结果",
            "设备 / 系统 / 安装包版本、真实录屏、操作结果、待命内存与投屏待命耗电初步基线",
        ],
        "answer": 3,
        "why": "P1 交付证据是设备 / 系统 / 安装包版本、真实录屏、操作结果、待命内存与投屏待命耗电初步基线。",
        "ref": "#p0p1",
        "refLabel": "第 3 章",
    },
    {
        "q": "拟定体验目标里的数字（如 p95、CER ≤ 3%）是什么性质？",
        "options": [
            "已经过真机验证的发布门槛",
            "用于 PoC 的初始目标，不是已测结果或对全部设备的承诺",
            "对所有低端机和高端机都成立",
            "由翻译服务商保证的固定速度",
        ],
        "answer": 1,
        "why": "文中明确下表是用于 PoC 的初始目标，不是已测结果或对全部设备的承诺；未达标时先出瓶颈证据再取舍。",
        "ref": "#targets",
        "refLabel": "第 5 章",
    },
    {
        "q": "开发计划里的“完成定义”是什么？",
        "options": [
            "签名 APK 构建成功",
            "模拟器能启动应用",
            "用户在已支持场景中，不需要开发者陪同，能开启会话、框选、修正、得到译文、回到原任务并明确结束",
            "商店审核通过",
        ],
        "answer": 2,
        "why": "完成定义强调用户独立跑通闭环；签名 APK、构建成功和模拟器运行各是不同证据，均不单独代表通用真机体验通过。",
        "ref": "#delivery",
        "refLabel": "第 8 章",
    },
]


def page_js(quiz):
    payload = json.dumps(quiz, ensure_ascii=False, indent=2)
    pattern = re.compile(r"var quizData = \[.*?\n  \];", re.S)
    new_js, count = pattern.subn("var quizData = " + payload + ";", js, count=1)
    if count != 1:
        raise SystemExit("quizData array was not found")
    return new_js


def build(filename, title, description, body_filename, quiz):
    body = (BASE / body_filename).read_text(encoding="utf-8")
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{title}</title>
<link rel="icon" href="{FAVICON}">
<meta name="description" content="{description}">
<style>
{css}
{extra}
</style>
</head>
<body>
{body}
<script>
{page_js(quiz)}
</script>
</body>
</html>
"""
    path = OUT / filename
    path.write_text(html, encoding="utf-8")
    print(f"{filename}: {len(html):,} bytes")


build(
    "technical-stack.html",
    "Android 屏幕翻译 · 技术栈方案（学习版）",
    "Android 屏幕翻译技术栈方案学习版：Kotlin 原生、MediaProjection、ONNX Runtime、PP-OCRv6 small、数据流、发布基线与证据清单。",
    "technical-body.html",
    TECH_QUIZ,
)
build(
    "implementation-plan.html",
    "Android 屏幕翻译 · 开发计划与验收（学习版）",
    "Android 屏幕翻译开发计划与验收学习版：P0–P5 阶段、工期估算、放行条件、体验目标、适配矩阵与交付清单。",
    "implementation-body.html",
    PLAN_QUIZ,
)

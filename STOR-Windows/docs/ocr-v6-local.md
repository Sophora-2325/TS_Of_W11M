# PP-OCRv6 small 本地识别

STOR 使用官方 `PP-OCRv6_small_det` 检测文字框，使用 `PP-OCRv6_small_rec` 识别文字。
主程序通过匿名管道与 `stor-ocr.exe` 通信，截图只在内存中传递。没有 OCR HTTP 服务或监听端口。
翻译 API 与 OCR 分开，仍需用户主动点击翻译。

## 运行结构

- Rust `OcrService` 负责唯一子进程、启动预热、请求串行化、请求编号、响应大小限制和超时。
- `ocr-service/worker.py` 使用 RapidOCR 3.10.0 的检测后处理、透视裁剪、CTC 解码和排序流程。
- 推理使用 ONNX Runtime CPU，最多 4 个计算线程；关闭方向分类、文档矫正、GPU 模块。
- 保留截图原始尺寸及颜色，检测阶段限制最长边为 1280，识别阶段使用 `[3, 48, 320]` 输入配置。
- 检测模型的归一化和 DB 参数来自官方 `det.yml`，不套用 RapidOCR 的默认归一化。
- 原 `ocrLanguage` 配置字段为兼容旧配置保留；统一多语种模型不依赖该设置。

启动后后台预热两个模型。首次加载最多等待 60 秒，每次识别最多等待 30 秒。
无文字、选区无效等请求错误会保留进程；推理异常、协议错误、断线或超时会终止进程，下一次框选重新启动。
Windows Job Object 保证主程序退出或崩溃时终止其 OCR 子进程。
模型缺失时显示错误，不会静默切回 Windows OCR。

## 构建

需要 Windows x64、Node.js、Rust、Visual Studio Build Tools 和 uv。

```powershell
npm run ocr:prepare
npm run ocr:check
npm run tauri -- build --bundles nsis -- --offline
```

`ocr:prepare` 首次会联网安装锁定的 Python 依赖并下载官方模型。Python 只在构建时需要。
后续模型与依赖校验通过会复用缓存。使用 `-SkipInstall` 可跳过依赖同步后重新打包：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/prepare-ocr.ps1 -SkipInstall
```

构建资源位于 `src-tauri/resources/ocr/`，由 Tauri 映射到发布目录中的 `ocr/`。
发布时需保留整个 `ocr/` 目录，不能单独复制 `stor.exe`。使用 NSIS 安装包会自动部署所有资源。
OCR 组件是目录打包，避免每次启动解压整个运行环境。组件运行时不下载模型、字体或其他文件。

两个模型固定到官方仓库提交，SHA-256 校验值记录在 `ocr-service/model-sources.json`。
下载配置和模型卡使用对应 Git blob 校验，字典从识别模型的官方配置生成并校验。
`requirements.lock` 固定构建依赖及下载哈希。构建检查会拒绝缺失、损坏或源代码已经变化的 OCR 资源。
运行时还会复核模型、字典、前处理配置，损坏时显示重新安装提示。

## 定向验证

```powershell
npm run ocr:test
cargo test --manifest-path src-tauri/Cargo.toml --offline --lib ocr::paddle::tests
cargo test --manifest-path src-tauri/Cargo.toml --offline --lib capture::preprocess::tests
cargo test --manifest-path src-tauri/Cargo.toml --offline --lib ocr::paddle::tests::packaged_worker_recognizes_en_zh_ja_and_restarts_after_exit -- --ignored --nocapture
```

最后一条测试使用打包后的可执行程序，对 `audit/evidence/ocr-en.png`、`ocr-zh.png`、`ocr-ja.png`
做实际识别，检查请求失败后的继续使用及子进程重新启动。其他测试覆盖协议编号、损坏响应、
模型损坏、无文字错误、异常信息脱敏、图片尺寸限制、原始颜色和零透明度截图。

模型文件合计约 31 MB，完整 OCR 运行目录约 199 MiB，包含 OpenCV、ONNX Runtime、Python 和依赖许可。
这不是安装包压缩体积，也不是运行内存占用。当前交付优先使用成熟图像处理流程；若后续需要进一步
缩小分发体积，可以保留模型和协议，替换成原生推理进程。

当前样例覆盖基础中、英、日印刷体，不能代表游戏花体、小字号、描边、竖排、多栏等场景的总体准确率。
后续应在真实失败截图集上统计错字率、漏行率、冷启动、连续识别时间和内存，按结果调参。

官方来源：

- https://huggingface.co/PaddlePaddle/PP-OCRv6_small_det_onnx
- https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx
- https://github.com/RapidAI/RapidOCR

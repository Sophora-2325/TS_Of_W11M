# GGUF 自动运行：实施与定向验证

日期：2026-10-27。

## 已实现

- 新增本地 GGUF 连接方案，保留现有外部 API 方案。
- 首次选择已有模型或下载模型；导入只记录原路径。设置保留更换模型入口。
- 推荐 Hy-MT2 Q8_0 / Q4_K_M，下载前展示大小与目录并确认；已有目标文件可校验复用，不自动覆盖。
- 模型与引擎分别下载、校验。固定引擎 b11669 Windows x64 Vulkan，安装包不包含引擎或模型。
- 本地请求启动隐藏 llama-server，监听回环地址并等待健康检查，复用现有翻译客户端。
- 请求租约保留进程，保存切换后等待请求完成再释放；草稿测试不改变生效方案。
- 托盘退出路径调用本地服务 shutdown；复用 Windows Job Object 清理自有子进程。
- 稳定模型配置参与缓存标识，临时端口不入缓存键。

## 自动与模拟服务验证

`npm.cmd run build`：TypeScript 与 Vite 构建通过。

`cargo test --manifest-path src-tauri/Cargo.toml --offline --lib -- --skip capture:: --skip ocr:: --skip hotkey::`：16 passed，0 failed，1 ignored（真实模型用例单独执行）。

覆盖：旧配置兼容、本地配置序列化、路径与 GGUF 文件头、导入不复制文件、模型缓存隔离、ZIP 越界路径拒绝、模拟下载进度与校验失败清理、已有文件拒绝覆盖、请求期间切换等待与自有进程释放，以及原有兼容接口/SSE/凭据用例。

添加原生文件对话框后，单元测试程序曾因缺少 Common Controls v6 清单报 TaskDialogIndirect 入口点错误；已补齐 debug 程序清单，之后测试正常执行。正式安装版使用 Tauri 的应用清单。

## 真实模型后端冒烟

LM Studio 未运行，直接读取：

`D:\LMStudioModels\tencent\Hy-MT2-1.8B-GGUF\Hy-MT2-1.8B-Q8_0.gguf`

显式执行 `local_model::tests::real_gguf_smoke`（ignored 用例）：1 passed。

- 通过生产服务代码下载、校验、解压官方引擎（约 31 MiB）；使用 GPU 模式和上下文 4096。
- 翻译 `Hello, adventurer!` 得到 `你好，冒险者！`。
- 对 `adventurer` 返回中文语境解释。
- 连续请求复用 PID 24992，切换云端后释放；再次启动后 shutdown 结束 PID 23144。
- 引擎测试安装目录为 `audit/local-runtime`，未复制或重新下载 1.9 GB 模型。

这是直接调用生产后端服务的真实模型验证；没有将其记为完整 GUI 翻译、托盘点击或安装升级验证。

## 原生设置页检查

启动路径已确认是 `D:\STOR\src-tauri\target\release\stor.exe`。

- 新增本地方案，显示两个模型来源入口；API 地址与认证字段隐藏。
- 下载页显示推荐文件大小、默认目录和确认按钮；未点击实际大模型下载。
- 未选择模型时保存失败，错误明确，草稿保留。
- 原生 Windows 对话框过滤 GGUF，成功选入现有 Hy-MT2，显示原路径及更换入口。
- 上述 UI 检查未保存测试方案，原有 hunyuan 连接保持不变。

截图：`evidence/gguf-first-use.png`、`evidence/gguf-download-options.png`、`evidence/gguf-imported-model.png`。

## 待用户验证

- 安装包覆盖安装，以及实际保存、重启后恢复方案的完整操作。
- GUI 中从翻译浮窗到托盘退出的完整流程。
- 推荐大模型文件的真实下载与复用完整流程（本次以模拟下载和校验测试覆盖，避免重复下载）。
- 仅 CPU、其他模型和其他显卡；长文本、长时间运行及全量 OCR/截图回归。

没有付费云端生成调用。

## 安装包

`npm.cmd run tauri -- build --bundles nsis -- --offline` 已成功。

- 文件：`src-tauri/target/release/bundle/nsis/STOR_0.1.0_x64-setup.exe`
- 大小：76,775,124 字节。
- SHA-256：`05033471D6215B8DF24F0DF84D9C37A884AB3B35F53A04EBA1FE0DD41E9A1E36`
- 未自动执行安装。

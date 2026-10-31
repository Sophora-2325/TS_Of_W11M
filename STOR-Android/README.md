# STOR Android

Android 屏幕翻译开发版，已在 P0–P2 原型上接入 P3 翻译功能代码。单 app 模块，Kotlin / Compose 主界面，原生悬浮窗口，MediaProjection 截图，PP-OCRv6 small 本地 OCR。

当前内测版本为 `0.2.0-internal.1` / versionCode 3，专用证书签名 release APK 约 92.9 MB，见 [P5 交付记录](docs/p5-delivery-20261029.md)。最终包已在当前手机通过干净安装、同版本覆盖重装保留配置、OCR、真实翻译与结束会话检查；更高版本升级和多设备验收仍未完成。

## 本轮范围

- 主动开始和结束会话，悬浮权限、通知权限与屏幕捕获同意。
- 前台服务、可拖动吸边浮键，切回主应用时隐藏浮键。
- 新帧获取、冻结截图、矩形框选、四角调整、全选、取消。
- 本地 OCR、可编辑原文、复制、在同一截图调选区、重新截图。
- 中英日三张合成样本、桌面参考结果及可执行设备对照测试。
- 翻译设置：HTTPS 地址、模型、API Key、默认语言；DataStore 保存配置，Keystore AES-GCM 加密保存 Key。
- 用户主动触发的流式翻译、取消、手动重试、部分译文保留与复制。
- 原文/语言变化取消当前请求并清空旧译文；成功结果进入最多 20 条的会话内存缓存。
- 可从结果卡片打开设置，返回时恢复当前原文和译文状态。

P3 当前版本 `0.2.0-dev`。2026-10-29 重点测试发现并修复流式请求参数、横屏按钮裁切和设置入口被系统拦截三个问题；本地 15 项、真机存储 2 次运行及设置往返通过，见 [测试记录](docs/p3-validation-20261029.md)。随后真实服务补测的中文／日语翻译、复制、缓存及立即取消通过，范围与剩余边界见 [真实服务记录](docs/p3-real-service-20261029.md)。APK 申请 Internet 权限以执行翻译，ORT 遥测初始化器继续移除。

真实服务补测另发现结束会话时主线程关闭 TLS 连接导致崩溃，已改用现有后台执行器清理；真实请求后结束会话回归通过，最新修复包已装到手机。

P4 已在当前 Android 16 手机检查通知、锁屏、系统停止与重新授权；启用 release 代码/资源压缩，内测候选包约 92.9 MB，配置读取和 OCR 检查通过。多机型与正式签名验收未完成，见 [P4 单机记录](docs/p4-validation-20261029.md)。

## 构建

Windows 请放在英文路径，例如 `D:\STOR\STOR-Android`。安装 JDK 17+（当前使用 Android Studio 自带 JDK 25）、Android SDK 36、Build Tools 36。`local.properties` 设置本机 `sdk.dir`。

```powershell
$env:JAVA_HOME='D:\Android Studio\jbr'
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

原型包：`app/build/outputs/apk/debug/app-debug.apk`。debug 证书签名，只供内测；仅包含 `arm64-v8a` 原生库。

P0–P2 OCR 设备对照测试命令（本轮未重复执行）：

```powershell
adb install -r app/build/outputs/apk/debug/app-debug.apk
.\gradlew.bat :app:connectedDebugAndroidTest
adb shell run-as com.stor.android cat files/ocr-baseline.json
```

设备对照测试会运行真实 Android ONNX / OpenCV，并比较三张固定样本的桌面输出；未连接设备时不能将它记为通过。

## 使用

打开 STOR → 翻译设置中填写自己的服务地址、模型与 Key → 开始屏幕翻译并授权 → 切到阅读应用 → 点侧边“译” → 框选并确认识别 → 可修改原文、选择语言 → 点击翻译 → 复制译文。主页面或通知可结束会话。锁屏或系统停止捕获后需重新开启。

服务地址可以是 `https://example.com/v1` 或完整的 `/chat/completions` 地址。请求只发送文字，不发送截图；不自动重试或跟随跳转。取消时服务可能已经计费。用户未配置服务时仍可使用本地 OCR。

当前捕获优先整屏；系统/OEM 可能仍提供捕获范围选择。部分页面禁止截图或悬浮层。冻结图片不会暂停底下的游戏。

## 验证边界

此前 `0.1.0-poc` 在 realme RMX5200 / Android 16 上验证过固定样本 OCR、跨应用框选、原文编辑/复制与基础横屏流程，时间戳修正版连续中英日截图识别通过。该证据不等于当前 P3 的真机验收。详细记录见 [真机记录](docs/device-validation-20261028.md) 与 [验证记录](docs/validation.md)。三张合成样本不能代表真实场景总体准确率。

选型、资源所有权及剩余工作见 [实现说明](docs/implementation.md)。

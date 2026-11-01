# 见译 · STOR Android

免费、开源的 Android 屏幕 OCR 翻译工具。使用 Kotlin / Compose 主界面、原生悬浮窗口、MediaProjection 截图和 PP-OCRv6 small 本地 OCR；翻译通过用户配置的 HTTPS Chat Completions 服务完成。第三方 API 可能收费。

当前工程版本为 `0.2.0-internal.3` / versionCode `5`，应用显示名为「见译」，应用 ID 为 `com.stor.android`。最低 Android 9，仅 ARM64。当前签名内测 APK 约 105.10 MB，位于本地 `releases/0.2.0-internal.3/Jianyi-0.2.0-internal.3-arm64.apk`；该输出目录不随源码提交。

## 已实现功能

- 主动开始和结束会话，悬浮权限、通知权限与屏幕捕获同意。
- 前台服务、可拖动吸边浮键，切回主应用时隐藏浮键。
- 新帧获取、冻结截图、矩形框选、四角调整、全选、取消。
- 本地 OCR、可编辑原文、复制、在同一截图调选区、重新截图。
- 中英日三张合成样本、桌面参考结果及可执行设备对照测试。
- 翻译设置：HTTPS 地址、模型、API Key、默认语言；DataStore 保存配置，Keystore AES-GCM 加密保存 Key。
- 用户主动触发的流式翻译、取消、手动重试、部分译文保留与复制。
- 原文/语言变化取消当前请求并清空旧译文；成功结果进入最多 20 条的会话内存缓存。
- 可从结果卡片打开设置，返回时恢复当前原文和译文状态。

APK 申请 Internet 权限以执行翻译，ORT 遥测初始化器已移除。当前尚未集成端侧翻译模型和上下文查词；两端功能对比见 [项目 README](../README.md#功能对比)。

## 构建

Windows 请放在英文路径，例如 `D:\STOR\STOR-Android`。安装 JDK 17+（当前使用 Android Studio 自带 JDK 25）、Android SDK 36、Build Tools 36。`local.properties` 设置本机 `sdk.dir`。

```powershell
$env:JAVA_HOME='D:\Android Studio\jbr'
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

Debug APK：`app/build/outputs/apk/debug/app-debug.apk`。使用 Debug 证书签名，仅包含 `arm64-v8a` 原生库，不能直接覆盖项目专用证书签名的内测包。

### 签名发布

`tools/build-release.ps1` 接收 `-JavaHome`、`-AndroidSdk` 和 `-InitializeSigning` 参数。使用本机 JDK 与 SDK 路径运行，例如：

```powershell
# 首次为自己的分发创建签名资料；已有签名时不要添加此参数。
.\tools\build-release.ps1 -JavaHome $env:JAVA_HOME -AndroidSdk "$env:LOCALAPPDATA\Android\Sdk" -InitializeSigning

# 后续构建复用同一签名。
.\tools\build-release.ps1 -JavaHome $env:JAVA_HOME -AndroidSdk "$env:LOCALAPPDATA\Android\Sdk"
```

脚本在 `.signing/` 保存本机私有签名资料，在 `releases/<版本>/` 输出签名 APK、摘要与公开证书。私钥和密码不得提交到仓库。现有项目应恢复原签名资料，以保持覆盖更新能力，详见 [签名维护](docs/release/SIGNING_MAINTENANCE.md)。

P0–P2 OCR 设备对照测试命令（本轮未重复执行）：

```powershell
adb install -r app/build/outputs/apk/debug/app-debug.apk
.\gradlew.bat :app:connectedDebugAndroidTest
adb shell run-as com.stor.android cat files/ocr-baseline.json
```

设备对照测试会运行真实 Android ONNX / OpenCV，并比较三张固定样本的桌面输出；未连接设备时不能将它记为通过。

## 使用

打开见译 → 翻译设置中填写自己的服务地址、模型与 Key → 开始屏幕翻译并授权 → 切到阅读应用 → 点侧边“译” → 框选并确认识别 → 可修改原文、选择语言 → 点击翻译 → 复制译文。主页面或通知可结束会话。锁屏或系统停止捕获后需重新开启。

服务地址可以是 `https://example.com/v1` 或完整的 `/chat/completions` 地址。请求只发送文字，不发送截图；不自动重试或跟随跳转。取消时服务可能已经计费。用户未配置服务时仍可使用本地 OCR。

当前捕获优先整屏；系统/OEM 可能仍提供捕获范围选择。部分页面禁止截图或悬浮层。冻结图片不会暂停底下的游戏。

## 验证边界

当前验证主要来自 realme RMX5200 / Android 16 单机。OCR、真实翻译、取消、缓存和生命周期检查分散在历次交付记录中；最新 `internal.3` 品牌更新只重新验证构建/lint、签名、覆盖安装及名称图标，没有重跑完整功能回归。

- [品牌更新验证](docs/release/BRANDING_VERIFICATION.md)：当前版本的验证范围。
- [真实服务记录](docs/p3-real-service-20261029.md)：此前翻译与取消的真机证据。
- [P4 单机记录](docs/p4-validation-20261029.md)：此前生命周期与发布构建检查。
- [P5 交付记录](docs/p5-delivery-20261029.md)：此前签名内测包的安装、OCR 与翻译检查。
- [内测边界](docs/release/KNOWN_LIMITATIONS.md)：多机型、16 KB 页、耗电和未覆盖场景。

三张合成样本不能代表真实场景总体识别准确率，历史证据也不代表当前版本已完整复测。

选型、资源所有权及剩余工作见 [实现说明](docs/implementation.md)。

## 许可证

本项目原创代码采用 **GPL-3.0-or-later**，完整条款见根目录 [LICENSE](../LICENSE)。第三方依赖、模型、字体和图标适用各自许可证，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。本项目免费提供；GPL 允许商业使用和收费分发，分发衍生版本须遵守相应源码提供义务。

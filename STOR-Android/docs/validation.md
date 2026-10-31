# 验证记录

最新日期：2026-10-29。

P5 的 `0.2.0-internal.1` 专用证书签名 APK 已在当前手机通过干净安装、同版本覆盖重装保留配置、OCR、真实翻译与结束会话检查；签名、模型哈希、ELF 与 ZIP 对齐检查通过。更高版本升级和多设备验证仍未覆盖，见 [P5 交付记录](p5-delivery-20261029.md)。

P4 当前机型的通知结束、锁屏、系统停止及重新授权检查通过；release 候选包压缩至 92.9 MB，并完成覆盖升级保留配置与 OCR 检查。完整范围与未测项见 [P4 单机记录](p4-validation-20261029.md)。多机型、耗电、长时稳定性和正式签名交付仍未完成。

真实翻译闭环补测：中文／日语真实译文、译文复制粘贴、会话缓存、编辑清空旧译文及立即取消保留原文通过；另发现并修复结束会话时主线程关闭 TLS 连接导致崩溃，真实 HTTPS 请求后结束会话的回归通过，见 [真实服务记录](p3-real-service-20261029.md)。运行中修改触发取消、部分译文后取消等专项场景仍未覆盖。

P3 `0.2.0-dev` 已执行重点测试并修复流式参数省略、横屏操作裁切、设置后台启动被阻止三个问题，见 [2026-10-29 测试记录](p3-validation-20261029.md)。本地 15 项、真机存储 2 次运行通过；真实翻译服务与缓存等集成流程仍未验证。下文保留 2026-10-28 的 P0–P2 历史证据。

## 环境与当前证据

- SDK 36、本机 Gradle 9.3.1、Android Studio JDK 25 可用。
- 首轮构建时无设备；随后已连接 realme RMX5200 / Android 16 并执行单机验证，见 [真机记录](device-validation-20261028.md)。
- 三张英文、中文、日文合成图片已生成；现有桌面 PP-OCRv6 small 对三张图的输出与预期一致。参考及图片 SHA-256 在 `app/src/androidTest/assets/fixtures/reference.json`。
- 最终构建：`:app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest :app:lintDebug`，`BUILD SUCCESSFUL`。
- JVM 单元测试：8 项，0 失败，0 错误；覆盖显示留边、横竖屏坐标映射、反向框选、边缘取整、检测归一化/尺寸、识别动态宽度和 CTC。
- lint：0 errors / 16 warnings。保留的提示包括依赖新版本、ARM64 首发不覆盖 ChromeOS、平台备份配置、运行时 View 构造与 KTX/物理屏幕坐标写法；没有通过全局禁用 lint 或基线文件掩盖问题。
- 主 APK 与 Android 设备对照测试 APK 均已打出；设备 OCR 对照测试通过，后续 UI 修正版也完成中英日实际截图识别。
- 中文会话目录被 AGP 路径校验拦截；项目应在既定英文路径构建。

## 首轮 APK 静态检查

产物：`app/build/outputs/apk/debug/app-debug.apk`，版本 `0.1.0-poc`，包名 `com.stor.android`。

- 120,741,285 B，约 120.74 MB / 115.15 MiB。这是未压缩优化的 debug 原型，不能与计划中的 release 体积门槛混用；release 体积未测。
- SHA-256：`2a4f536516b38ca8b996557c0eb0ac2c273ade88becb4c7775642fcc8c0ba716`。
- minSdk 28 / targetSdk 36 / ABI `arm64-v8a`。
- `apksigner verify --verbose` 通过，v2 签名；Android Debug 证书，仅供内测。
- `zipalign -c -P 16 4` 返回 0；5 个原生 ELF 的所有 PT_LOAD 段均满足 16 KB 静态对齐。未在 16 KB 设备上启动。
- 两个模型、识别字典的包内 SHA-256 与锁定清单一致。完整记录见 `evidence/apk-inspection.json`。
- 已核对最终权限清单：没有 INTERNET / ACCESS_NETWORK_STATE；合并清单中不含 ORT 的 TelemetryInitializer。

单元测试曾复现 fit-center 坐标换算把左边界 240 算成 239；已改为使用实际绘制矩形进行 Double 比例换算，原测试现已通过。

## 未验证

多厂商/多系统、实际字体与显示缩放矩阵、锁屏及系统停止入口、150 张真实样本总体精度、内存/耗电/OEM 行为和 release 性能。最终截图时序修正版未再追加横屏复测。

P0 工程、依赖与初始固定样本已落地；P1/P2 在本机完成基础平台闭环和 OCR 证据，完整验收尚未满足。用户要求停止重复测试后已停止追加测试；现有证据、修正与限制见 [真机记录](device-validation-20261028.md)。

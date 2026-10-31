# P4 单机适配与包体积记录

日期：2026-10-29。范围：当前 realme RMX5200、Android 16 / API 36、ARM64、4 KB 页设备。仅做关键生命周期检查、单次内存采样和 release 体积优化；不是 P4 全矩阵验收。

## 生命周期结果

| 路径 | 本次观察 |
|---|---|
| 通知栏展开 STOR 通知，点击“结束会话” | 服务移除，返回首页显示“开始屏幕翻译”，随后可重新授权开启 |
| 会话期间锁屏，再由用户正常解锁 | 系统结束捕获，服务清理；首页为停止状态，重开出现新的屏幕捕获授权 |
| 系统“正在录屏或投屏”对话框停止 STOR | MediaProjection 与服务均移除，首页恢复；重开要求新授权 |
| 取消新的系统捕获授权 | 返回首页，提示“未开启截屏授权，可随时重试”；没有自动循环请求 |
| 压缩候选包开启、OCR、结束 | 模型就绪、英文识别匹配、结束正常；该次进程没有新增崩溃记录 |

本次没有发现新的生命周期功能缺陷，未加入额外恢复机制或广播监听。`cmd media_projection` 在该设备没有 shell 实现，系统停止检查通过 OEM 系统通知及其明确显示 STOR 的确认对话框完成。

证据目录：`evidence/p4-20261029/`。通知停止见 `notification-stop-services.txt`、`notification-stopped-home.xml`；锁屏恢复见 `unlocked-services.txt`、`unlocked-home.xml`；系统停止见 `system-stop-services.txt`、`system-stopped-home.xml`；授权取消见 `consent-cancelled-home.xml`。

## 包体积修改

仅在 `app/build.gradle.kts` 的 release 构建启用 R8 和资源裁剪，使用标准 `proguard-android-optimize.txt`。`app/proguard-rules.pro` 保留 ORT Java/JNI 边界名称；不改变模型、字典、原生库和 debug 行为。

| 产物 | 字节数 | 说明 |
|---|---:|---|
| 原 debug APK | 123,901,657 | 已完成此前真实翻译闭环的版本 |
| 未压缩 release 基线 | 115,215,463 | 本轮构建的未签名基线 |
| 压缩 release 未签名包 | 92,915,834 | 构建成功，包含模型与 ARM64 库 |
| 压缩 release 内测候选包 | 92,930,209 | 使用已有 Android Debug 证书，供验证，不是正式发布签名 |

按 release 基线比较，候选包减少约 22.3 MB / 19.3%。DEX 从 24,376,628 字节降至 2,471,336 字节；原生库仍为 59,075,936 字节，模型资源约 31.1 MB，均未替换。MB 按十进制计算。

基线和压缩构建均 `BUILD SUCCESSFUL`，执行 release 的 lintVital 检查；没有重复无关单元测试。原始记录：`release-baseline-build.txt`、`release-optimized-build.txt`、`release-apk-breakdown.json`、`release-minified-breakdown.json`。

候选包路径：`evidence/p4-20261029/app-p4-release-smoke.apk`。

SHA256：`43D7C8F5B01E4F714641B9A10A697A8CF84740E9955A1B41B3F3AC93AB96EC0F`。

覆盖安装候选包后检查设置成功读取、Key 仍遮蔽；没有把配置或凭据写入证据。初始化 ORT/OpenCV 并识别合成句子 `Read the words on your screen.`，结果与参考一致，随后正常结束会话。见 `minified-smoke.txt`、`minified-ocr.xml`、`minified-crash-buffer.txt`。本轮没有调用翻译服务，因此压缩包的翻译网络链路尚未验证；不能将原 debug 包的完整闭环结果当作压缩包验收。

## 内存观察

下表为 `dumpsys meminfo` 的单次 PSS 快照，单位 KiB。不同包、选区和采样时机不完全相同，不是严格性能对照，也不是持续峰值。

| 状态 | PSS KiB | 约 MiB |
|---|---:|---:|
| debug 冷启动首页 | 118,681 | 115.9 |
| debug 模型刚就绪 | 295,447 | 288.5 |
| debug 全选 OCR 结果 | 263,226 | 257.1 |
| debug 结束后 | 211,065 | 206.1 |
| 压缩包单句 OCR 结果 | 187,096 | 182.7 |
| 压缩包结束后 | 172,741 | 168.7 |

结束后服务已移除，PSS 未回到冷启动值。单次采样不足以判断泄漏或证明连续使用稳定，因此没有据此增加内存管理逻辑或调整模型线程；长时趋势与真正峰值留待专项验证。原始快照保留为 `memory-*.txt`。

## 支持范围与剩余工作

| 维度 | 已验证 | 未验证 |
|---|---|---|
| 设备与系统 | realme RMX5200 / Android 16 | 其他厂商、较低性能设备、Android 9–15 |
| 核心流程 | 当前机型通知结束、锁屏结束、系统停止、再次授权及取消 | 各厂商后台回收策略、长时间后台、被系统杀进程后的用户恢复 |
| 页面与显示 | 此前合成图中英日、横竖屏和键盘记录；本轮压缩包英文单句 | 真实游戏复杂背景、禁止截图页面、最大字号、主题专项 |
| 性能 | 单次 PSS、release 体积拆分 | 连续 30 分钟、耗电与温升、分层准确率、p50/p95 |
| 安装与分发 | 同证书覆盖升级保留配置；ARM64 候选包安装 | 正式 release 签名、干净安装、压缩包真实翻译、真实 16 KB 页设备 |

P4 当前结论仅覆盖这台手机的重点项目。后续 P5 需要对待交付的签名包补齐必要验证，并明确多设备未测范围。

## 手机最终状态

候选包测试结束后已恢复此前完成真实翻译验证的 debug 包，SHA256 `8CB6B2B43E02EC94C4513512EE036131EF1782C06C47FD871A1497A059DB1E5E`；服务配置保留，首页为停止状态，屏幕会话已结束。见 `final-home.xml`、`final-services.txt`。

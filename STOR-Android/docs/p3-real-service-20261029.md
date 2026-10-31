# 0.2.0-dev 真实翻译闭环补测

日期：2026-10-29。设备：realme RMX5200 / Android 16。先使用本日重点测试修复后已安装的 0.2.0-dev，真实请求完成后在结束会话时发现崩溃，已做针对性修复。

用户在手机填写配置并保存后授权继续。没有提取 API Key，没有在报告或证据中记录服务凭据；仅发送合成测试句子。

## 已通过

- 开启屏幕会话，在独立样例应用中框选，OCR 得到 `Read the words on your screen.`；最终选区识别 178 ms，单次观察值。开始时自动化框选到了标题，随后调整；调整首次遇到界面切换尚未稳定，待框选界面稳定后正确识别，没有将错误识别内容发送至服务。
- 真实中文翻译完成：`阅读你屏幕上的文字。`。从截图、识别到译文完成的闭环通过。
- 相同原文、配置和目标语言再次点击翻译，界面显示“已使用本次会话缓存”，译文一致。
- 点击“复制译文”，在原文编辑框全选后粘贴，内容与中文译文逐字一致；恢复英文测试原文后，旧译文清空，显示等待用户主动翻译的提示。
- 切换目标语言到日本語，真实翻译完成：`画面に表示されている言葉を読んでください。`。该请求在 UI 自动化读取取消按钮前已经完成，不能算作取消通过。
- 再切换到未缓存的 English，点击翻译后立即取消。界面显示“已取消，可手动重试；服务可能已计费”，英文原文保留，按钮变为“重试”。后续再次读取仍保持取消状态，没有被旧结果覆盖。

闭环测试的真实服务操作包括中文完成、日语完成和英语立即取消；另有一次界面确认的缓存命中。随后为崩溃修复回归增加一次真实翻译再结束会话。不以客户端界面推断服务端实际接收或计费次数。

## 验证边界

没有直接观测到真实服务的中间增量帧，因此不将本次完成结果描述为已验证逐字流式显示。SSE 分片解析沿用此前本地客户端测试证据。

立即取消验证了真机交互及状态保留，没有验证已收到部分译文之后取消的真机场景。本轮也没有重复请求来专项测试运行中编辑／切换语言触发取消、手动重试的完整请求链、取消结果不缓存、网络异常、多设备或长时后台。

## 结束会话崩溃

真实翻译测试本身通过，但 14:12:41 点击结束屏幕会话时，STOR 发生 `NetworkOnMainThreadException`。栈指向 `CaptureSessionService.onDestroy` → `TranslationClient.close` → `ConnectionPool.evictAll` → Conscrypt TLS socket close/write。此前只测试本地 HTTP 或未调用真实服务，没有覆盖真实 HTTPS 连接池的清理。

修复将 `translationClient.close()` 放入已有后台执行器的资源清理任务，避免在服务的主线程关闭 TLS 连接；没有增加线程、重试或异常吞噬。应用构建和 lint 通过；未重复运行无关单元测试。

修复后重新安装 APK，使用保存的配置完成真实 HTTPS 翻译，再点击结束屏幕会话：前后进程 PID 均为 18581，服务移除，该 PID 的 crash buffer 无 `FATAL EXCEPTION`。原始失败有完整崩溃栈，修复后同一路径通过；证据 `tls-close-fix-translation.xml`、`tls-close-fix-stopped.xml`、`tls-close-fix-crash-buffer.txt`、`tls-close-fix-summary.txt`。

最终 APK 仍为 `0.2.0-dev` / versionCode 2，已安装到手机；SHA256 为 `8CB6B2B43E02EC94C4513512EE036131EF1782C06C47FD871A1497A059DB1E5E`。配置保留，屏幕会话已结束。

真实服务配置保留。崩溃前证据保存在 `real-crash-buffer.txt`，不得将其当作无崩溃证据。

## 证据

目录：`evidence/device-20261029/`。

- `real-before-request.xml`：正确识别后的测试原文。
- `real-translation.xml`：中文真实完成结果。
- `real-cache.xml`：缓存命中提示。
- `real-copy-paste.xml`：译文粘贴校验。
- `real-edited-source.xml`：恢复原文后旧译文清空。
- `real-language-change.xml`、`real-before-cancel.xml`：语言切换、日语完成结果。
- `real-before-immediate-cancel.xml`、`real-cancelled.xml`、`real-cancel-retained.xml`：英语立即取消及状态保留。
- `real-final-services.txt`、`real-crash-buffer.txt`：最终服务状态及本轮读取的崩溃缓冲区。

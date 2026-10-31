# 见译 Android 内测安装说明

版本：0.2.0-internal.3（versionCode 5），仅 ARM64。最低 Android 9。本版目标适配设备 realme RMX5200 / Android 16。

安装 Jianyi-0.2.0-internal.3-arm64.apk，覆盖现有项目专用证书的 internal.1 / internal.2，保留翻译配置。不要卸载旧版或更换签名密钥。如系统报告证书不一致，先停止安装并核对旧版来源。

1. 在翻译设置中配置兼容 Chat Completions 的 HTTPS 服务地址、模型及 API Key，显式保存。
2. 点击“开始屏幕翻译”，按系统提示允许悬浮窗、通知和屏幕捕获。
3. 切到目标应用，点击侧边浮键，框选文字并识别。
4. 检查或编辑原文，手动点击翻译；可复制、调整选区和重新截图。
5. 从首页、系统通知或投屏管理结束会话。系统结束会话后重新开启需要授权。

截图与识别在本机完成，只有点击翻译后才向配置的服务发送原文。密钥通过 Android Keystore 加密保存。
安装包摘要见 SHA256SUMS.txt，证书见 SIGNATURE.txt。反馈时请提供设备和复现步骤，勿附带密钥。


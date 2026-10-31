# 见译名称与 Logo 更新验收

日期：2026-10-29。版本：0.2.0-internal.3 / versionCode 5。
设备：realme RMX5200 / Android 16。应用 ID 保持 com.stor.android。

## 本次改动

- 应用显示名及首页品牌文字改为“见译”，屏幕识别通知标题同步更名。
- 桌面图标使用已确认的 jianyi-logo-concept.png；原图复制到 drawable-nodpi，通过 inset/bitmap 和 adaptive-icon 适配系统蒙版。
- 通知栏使用对应的单色矢量标志；API 33 专用图标资源包含 monochrome 定义。
- 安装包名改为 Jianyi-0.2.0-internal.3-arm64.apk。
- 保留代码包名、专用签名密钥、配置格式及请求行为。

## 已验证

- assembleRelease 与 lintRelease 成功：0 错误，21 条提示。
- 提示包含 minSdk 28 下 v26 目录可合并建议及基础图标资源未包含 monochrome 的提示；API 33 专用资源已定义 monochrome。本机未切换主题图标开关，不把资源声明算作实机验收。
- APK 签名验证通过，复用证书 SHA-256：855393c144979d0691f144d27cae6d91cfa867ff8ce91d8a59589f240d467cd0。
- aapt2 检查：application-label 为“见译”，版本 0.2.0-internal.3，versionCode 5，应用 ID com.stor.android。
- 同证书覆盖安装成功，未卸载应用。
- 更新前后服务地址及模型显示逐项一致；Key 继续遮蔽，遮蔽显示一致。未读取或记录真实密钥。
- 手机桌面快捷方式、系统应用详情及应用首页均显示新名称；已查看实机截图，桌面和应用详情中的 Logo 正常，无裁切。
- 本次没有开启截图会话、发送翻译请求或重复 OCR/生命周期测试。通知标题与单色通知图标仅做资源、源码及构建检查。

## 交付与证据

APK：Jianyi-0.2.0-internal.3-arm64.apk。
大小：105,100,481 字节（105.10 MB）。
SHA-256：bd8649e7637727d6a025aca254e1cdfccb99387685b851cdfe4fbe77cce57735。

实机截图及更新摘要：D:/UI实现展示/STOR-Android/evidence/branding-20261029/。
构建及签名日志：D:/STOR/STOR-Android/evidence/branding-20261029/。

本版继承 internal.2 界面；UI_REFRESH_VERIFICATION.md 是前一版紧凑 UI 的历史验收记录，不代表本次重跑。

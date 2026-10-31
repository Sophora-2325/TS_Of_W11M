# 签名维护与后续构建

项目专用签名资料保存在正式工程的 `.signing/` 目录：

- `stor-release.p12`：私钥和证书，别名 `stor-release`。
- `signing-password.txt`：本机私有恢复密码文件；构建脚本读取后仅经进程环境变量交给签名工具，不输出到日志。

请将整个目录单独离线备份。它包含私钥和密码，不应放入 APK 分发目录或发送给测试者。该目录已加入 Git 忽略和源码同步排除规则；通用源码备份不包含它。

后续版本保持应用 ID `com.stor.android` 和同一密钥，增加 `app/build.gradle.kts` 中的 versionCode，更新版本说明，然后在 PowerShell 7 执行：

```powershell
& 'D:\STOR\STOR-Android\tools\build-release.ps1'
```

默认工具链位置为 `D:\Android Studio\jbr`、当前用户的 Android SDK；不同环境可用脚本的 `-JavaHome` 和 `-AndroidSdk` 参数指定。

产物写入 `releases/<versionName>/`，含签名 APK、SHA-256、公开证书、签名记录、混淆映射和交付说明。`mapping.txt` 用于解析崩溃堆栈，应随版本留存。

`-InitializeSigning` 只供首次创建。现有密钥不会被替换，后续构建不要使用该参数。恢复工程时应恢复原密钥和密码文件；生成另一把密钥不能保持已有正式安装的更新链。

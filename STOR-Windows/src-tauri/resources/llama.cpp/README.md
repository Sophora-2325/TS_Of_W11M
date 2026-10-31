# STOR 内置 llama.cpp 引擎

此目录随安装包映射为 `llama.cpp/`。运行时从内置 ZIP 离线部署到 `%LOCALAPPDATA%\STOR\engines\llama.cpp`，不会直接从安装资源目录启动引擎，也不会因缺少引擎自动联网。

## 固定资源

- 版本：`b11669-vulkan-x64`（Windows x64 Vulkan）。
- 上游原文件：`llama-b11669-bin-win-vulkan-x64.zip`。
- 官方地址：https://github.com/ggml-org/llama.cpp/releases/download/b11669/llama-b11669-bin-win-vulkan-x64.zip
- 此目录文件名：`b11669-vulkan-x64.zip`。
- 大小：`32182350` 字节。
- SHA-256：`2c07574e7bde71321cb785282b20cc821e951132149eeceeea32ddebdbf0598e`。
- 清单来源：`src-tauri/local-runtime.json`，实际执行文件为 `llama-server.exe`。

ZIP 体积较大，未纳入 Git。构建机器必须先放入这份固定 ZIP，保留官方压缩包内容不变。可复用此前已经下载且校验通过的同版本 ZIP：

```powershell
Copy-Item -LiteralPath 'audit/local-runtime/engines/llama.cpp/b11669-vulkan-x64.zip' -Destination 'src-tauri/resources/llama.cpp/b11669-vulkan-x64.zip'
npm run engine:check
```

没有现成文件时，从上述官方地址取得固定资源，按此目录文件名保存，再执行 `npm run engine:check`。构建前会校验版本、大小与 SHA-256；缺失或不符时终止打包。不会自动改用最新版本或重新下载。

## 来源与许可证

llama.cpp 来源：https://github.com/ggml-org/llama.cpp ，项目许可证为 MIT，上游许可证：https://github.com/ggml-org/llama.cpp/blob/b11669/LICENSE 。

此分发保持官方 ZIP 原样，其中的 `LICENSE-LLVM-OpenMP` 等第三方许可证文件随包保留，运行时解压也保留所有文件。没有删除或重新打包内部 DLL 与许可证。

## 用户删除与恢复

设置中的“删除引擎”只移除用户数据目录中的运行副本和下载缓存，保留本目录内置恢复包及用户 GGUF 模型。删除标记会持久化，重启后不会自动恢复；用户可选择“恢复内置引擎”离线恢复，或“重新下载”明确联网获取同一固定版本。

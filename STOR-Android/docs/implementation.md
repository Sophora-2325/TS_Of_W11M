# P0–P2 实现说明

## 已锁定的基线

AGP 9.1.0 / Gradle 9.3.1 / Kotlin 与 Compose 编译插件 2.4.0；Compose BOM 2025.10.00；Activity 1.11.0；Lifecycle 2.9.4；Coroutines 1.10.2；ORT Android 1.31.1；OpenCV 4.12.0；JTS Core 1.20.0。minSdk 28，compileSdk / targetSdk 36，ARM64。

P3 新增：Kotlin Serialization 编译插件 2.4.0、kotlinx.serialization-json 1.9.0、OkHttp 4.12.0、DataStore Preferences 1.1.7。

JTS 用于多边形扩张，许可证 EDL-1.0 / EPL-2.0；模型与 OpenCV 为 Apache-2.0，ORT 为 MIT，按各发布包实际 NOTICE 保留。模型原始说明、配置、revision、SHA-256 存于 `app/src/main/assets/models/`。当前不对这些模型重新量化或精简。

ORT 1.31.1 的 AAR 会自动加入联网权限与遥测 ContentProvider；P3 为用户主动翻译恢复 Internet 权限，继续移除 ACCESS_NETWORK_STATE 与初始化器，并在创建环境时关闭 ORT telemetry。

## 资源与调用边界

- `MainActivity`：Compose 首页、权限链、系统捕获同意；不持有 Bitmap 或模型。
- `CaptureSessionService`：唯一 MediaProjection / VirtualDisplay / ImageReader，系统停止回调、通知、冻结图和当前操作。旋转更新同一 VirtualDisplay 与 Surface，不重复使用授权建显示。
- `OverlayController`：同一时刻仅一个浮层；浮键、框选、可编辑结果。非编辑窗口不获取键盘焦点；结果窗口可获取焦点。
- 截图前同步移除浮层并记录单调时钟；ImageReader 忽略时间戳不晚于该时刻的已排队帧。保持同一 Surface 连续连接，不通过反复断开/重连取图。浮键保留吸附方向，在旋转后重新定位。
- `SelectionView` / `ImageCoordinates`：绘制与选区采用同一个 fit-center 映射，裁剪原图；显示区域可有留边。
- `PaddleOcr`：模型与字典在加载边界校验。完整检测 / 扩框 / 透视裁剪 / 按比例识别 / CTC 解码，使用专用串行线程，取消操作不强行中断 JNI；关闭排在已有调用之后。

最小状态顺序：停止 → 就绪 → 取图 → 框选 → 识别 → 结果 → 就绪。结束会话从任意状态释放资源并移除窗口。当前模型加载期间允许会话开启，但浮键提示等待，尚不能触发识别。

## 与桌面对齐的内容

相同模型与字典；BGR；检测最长边 1280、32 倍数缩放、ImageNet mean/std；DB 阈值 0.2 / 框分 0.45 / 扩张比例 1.4 / 候选上限 3000；识别高度 48、基线宽 320、长文本动态扩宽、零 padding；置信度过滤 0.5。未启用方向分类与文档矫正。

## 必须进一步核对的差异

- 桌面用 Pyclipper，Android 暂用 JTS buffer 扩框，轮廓边缘可能有像素差异；需在设备上记录裁剪和文本输出，不能先宣称等价。
- Android 当前逐行识别，桌面按宽高比最多四行一批；各行 padding 宽度和浮点计算可能不同。先比较样本输出，再按证据决定是否对齐批次。
- 初始三张普通印刷体样本只用于接线与正确性检查；不能替代规划中的 150 张真实样本、留出集和逐语言 CER / 漏行评估。

## 真机检查顺序

1. 安装、开启、拒绝权限、再开启、结束。
2. 竖屏与横屏截图；确认浮键未拍入、画面是新帧，选区裁剪与手指一致。
3. 结果浮层输入、中文/日文键盘、滚动、复制、关闭与回到目标应用。
4. 系统停止、锁屏、旋转及再次开启。
5. 运行固定样本对照，记录设备和系统；差异定位后再扩充真实样本。
6. 冷加载、暖 OCR、内存、温升、待命耗电及连续使用；多厂商覆盖另行扩展。

P1 / P2 完整验收仍以设备证据为准。P3 已在单机基本闭环证据上推进功能代码，测试范围按用户最新要求安排。

## P3 翻译链路

- `TranslationSettingsStore`：保存/读取设置；用户输入和持久化数据在进入请求配置时校验，之后传递 `TranslationConfig`。普通配置保存在 DataStore，Key 以 Android Keystore AES-GCM 密文和随机 IV 保存。
- `TranslationClient`：一次点击创建一次请求；OkHttp 后台回调解析 SSE，Okio 处理网络分片与 UTF-8；Serialization 解码协议边界。支持常规 JSON 完整响应。只有正常结束且有非空白正文时完成 Flow；取消会取消底层 Call。
- `CaptureSessionService`：拥有当前编辑原文、目标语言、译文状态与翻译 Job。输入改变、重选、重新截图、关闭和结束会话取消当前请求；从设置返回可恢复当前结果。
- 缓存只存在当前 Service 会话，最多 20 条；键含服务地址、模型、Key、原文与目标语言。提示词固定，应用更新/会话结束清空缓存；失败、截断和取消不缓存。
- 翻译卡片固定头部和底部操作，中部原文/译文滚动；保留复制原文、调整选区与重新截图。

当前 P3 的编译证据与明日待测项见 [P3 交付记录](p3-delivery-20261028.md)。

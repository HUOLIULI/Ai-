# 检查与真机验收

GitHub 更新检查与 APK 安装验收见[应用更新](app-updates.md)。

在frontend目录执行：

```powershell
npx tsc --noEmit
```

[JSON v3协议与执行流程](camera-guidance-protocol.md)。

## 灵感与相册

灵感内置 AI 生成的人像、风景、夜景图片各 3 张，支持分类筛选和大图预览；图片及生成提示词在 `assets/inspiration/`。相册除当前拍摄和已保存照片外，还会在挂载时用 `expo-media-library` 加载设备真实相册最近 60 张（`loadDevicePhotos`，按拍摄时间倒序），合并去重后展示——本次未保存的置顶、已保存与设备照片去重不重复显示；读权限首次使用时申请，被拒或出错 fail-open 为空数组、仍显示本次拍摄。未保存照片只保留在当前会话。原生端保存时复制到应用文档目录并写入系统相册，Web 端用 IndexedDB 在当前浏览器内保存相机的 data URL（无设备相册，`loadDevicePhotos` 返回空），并迁移旧的相册记录。点击保存后，等待照片与相册记录写入成功，再自动进入相机继续拍摄；失败时保留预览，可重试。真机需检查拍摄、保存、重启后查看、收藏和拒绝相册权限的流程。

## AI配置

从“我的 → AI配置”保存视觉模型的地址、名称、密钥。连接测试只验证文本请求，不能证明图片能力。手机使用SecureStore保存密钥，Web仅存于内存。开启指导会发送本轮压缩图片，可能产生服务商调用费用。

## 分步指导

- 开启指导只请求一轮JSON方案，完成本地动作直接显示可拍效果，不定时轮询。收到ready后停止请求，提示“可以拍照了”。
- 取景框随页面剩余空间调整尺寸，原生预览使用居中等比铺满（不指定 Android `ratio`，避免切换到 FIT 后出现黑边）。AI 样本与成片使用实测取景框比例进行居中裁剪，并叠加相同数字变焦；网格与提示覆盖在取景框内。
- JSON包含直线终点、800ms稳定要求、绝对数字变焦倍率、flash。TS校验后执行；变焦1–1.9倍且每步最多改变0.3倍，约600ms完成。手动变焦支持1–4倍；关闭自动变焦后需手动达到方案倍率才能可拍。
- 入圈、参数到位且稳定800ms后，本地标记可拍，不再联网。未到位时等多久都不请求。纯平移、前后距离或无传感器时，完成后点“已调整，确认到位”。
- 低置信度、等待状态、零变化方案、错误JSON均不自动重复请求。不支持的相机参数明确拒绝；手动ISO、快门不开放；光圈保留系统管理，对比度/白平衡预设按原生能力执行。
- 拍照和取样共用串行队列。指导样本临时文件会删除，不写入相册。数字裁剪统一用于预览、AI样本和最终照片。

## Android真机清单

取景适配：在华为及其他 Android 手机、不同屏幕比例和显示缩放下，检查前后镜头的 1x、2x、4x 画面填满圆角取景框，两侧及上下无黑边、人物无拉伸。把物体放在网格线和四边附近，核对拍照预览、保存成片与 AI 样本的裁剪范围；切换镜头、后台恢复后重复检查。已有 APK 需重新打包安装才能验证此次修复。

1. 开启指导后保持不动两分钟，确认只收到一轮方案，无后台定时调用。
2. 缓慢按虚线调整，目标未入圈时不请求；入圈停稳后本地标记ready，等五分钟也不继续调用。
3. 返回1.15倍与flash=auto的方案，确认倍率平滑到位、闪光灯状态更新，随后本地完成。返回越界倍率或ISO字段应报错。
4. 纯平移/远近动作先按提示完成，再点“已调整，确认到位”；连点不能产生重复请求。关闭自动变焦时确认不能跳过未完成的倍率。
5. ready后明显移动应撤回可拍提示；有传感器的路线再次对准停稳后恢复，无需联网。小幅手抖仍在圈内时不应反复振动或闪烁。
6. 返回错误JSON、接口报错或超时后不会自动重试；明确显示原因，点“重新规划”才再请求。
   模拟服务30秒返回时应正常显示指导；等待10秒、25秒有本地提示，45秒仍未返回才超时。等待中关闭指导后不得继续更新提示或执行迟到参数。
7. 前后镜头连续切换20次及快速连点：切换复用同一个CameraView，不能把facing作为key。等待onCameraReady再允许拍照、切换和取样；超过10秒提示退出重试。
8. 自动调整中关闭指导、退出、进入后台应取消动画和后续完成回调；前台恢复需重新开启。检查前后非镜像预览的目标方向、预览与成片裁剪一致、控件不覆盖画面。

开发版可重启Metro并清缓存后加载；已安装的独立APK需要重新打包安装。模拟测试不能替代真实模型和真机验证。

## 原生参数验收

点击“相机实时参数”右侧的“微调”，在底部面板选择参数并左右拨动实体风格的刻度滚轮，金色指针对应当前值，松手吸附档位并应用。触摸滚轮不跳值，可连续多次拨动，也可用两侧按钮逐格调整。变焦范围1–4倍，对比度范围0.80–1.20；白平衡和光圈按镜头支持的档位选择。固定光圈、缺少原生模块或不支持的参数显示为不可调整。手动应用后AI指导关闭，避免覆盖手动设置；需要时可重新开启。检查应用失败时仍显示上次成功值、应用期间不能拍照或切换镜头。

本次新增modules/camera-tuning，需要重新构建Android开发包或APK，Expo Go不支持原生设置。检查本机支持的白平衡和对比度、设置失败不显示可拍、关闭指导后迟到回执不能亮起特效。可拍状态检查四角、中心环、快门、文字和短振动；系统减少动态效果时不做呼吸动画。原生代码尚需Android SDK编译和真机验收。

## 插件架构验收

摄影能力（模式、风格、滤镜、端侧检测器）由 `src/plugin` 的 `PluginRegistry` 统一注册。内置能力在 `src/plugin/builtin`，通过 `registerBuiltinPlugins()` 注册。CI 已包含 `tsc + eslint + jest` 三道质量门。

### 自动化验证（本地或 CI）

1. `npm run typecheck`（tsc strict 0 错误）。
2. `npm run lint`（eslint 0 error）。
3. `npm test`（jest 全绿，覆盖协议、执行、构图、插件运行时、滤镜、检测器）。

### 插件运行时

- `PluginRegistry` 注册/去重/按类型枚举（modes/styles/filters/detectors）。
- 模式与风格插件的 prompt、preset、LUT 数值可被插件覆盖。
- 第三方可在运行时 `registry.register(plugin)` 增加能力，无需改核心代码。

### 端侧自动增强（离线，零网络）

围绕"随手一拍都能成片"的两道端侧兜底，都不依赖大模型 API：

- **离线快门决策器**（`src/lib/shutterDecision.ts`）：按下快门那一刻，用端侧信号（gyro 抖动 + 采样帧 lighting 检测）本地确定性算出白平衡/风格/曝光提示/手稳提示。纯函数 `decideShutter`，接进 `useCameraGuidance`，快门时冻结决策，`ShutterDecisionCard` 在快门区上方展示。即使没开 AI 指导也生效。
- **决策自动落地（自动出片）**：`autoStyle` 开启时，决策建议的风格经 `changeStyle(style, true)` 自动应用（连带 `styleTuning` 落白平衡/对比度），实现完整的"点一下就出片"。风格条首位有"自动"档；手动点具体风格会关掉 autoStyle 把控制权还给用户。刷新回调经 ref 稳定身份，避免 effect 每渲染重跑。
- **暗光自动补光**：`autoFlash` 开启时，决策判暗光且后置摄像头自动开闪光（前置无闪光，按 facing 守卫）。手动切闪光会关掉 autoFlash；快门决策卡上方有"自动补光"chip 显示状态、可在手动覆盖后重新开启。
- **防抖快门（等手稳再拍）**：模糊是随手拍头号废片原因。快门触发时若实时陀螺仪抖动值超阈（`!isShakeStable(shakeRef.current)`，阈值 `STABLE_SHAKE=0.4`），`capture()` 经 `waitForStability` 轮询、等手稳再拍，上限 `STABILITY_WAIT_MS=1200ms`——读数未知/无效不阻塞、手一直晃到点也照拍，绝不卡死快门。门读实时抖动而非冻结决策（决策要等下次 render 才进闭包），且抖动值无条件更新，关掉 AI 指导时防抖仍生效。
- **成片质量守护**（`src/lib/photoQuality.ts` + `photoQualityGuard.ts`）：拍完立刻对成片跑模糊（相邻像素梯度）/曝光（亮度+高光）/闭眼检测，明显废片在回顾页提示重拍。纯函数 `assessQuality`，采集侧 `analyzePhotoQuality`（Web canvas 解码），原生/canvas 缺失时降级为不提示、绝不阻塞保存。`PhotoReview` 挂载时跑并显示重拍横幅。

验收：`decideShutter` / `assessQuality` / `computeQualityStats` / `eyeStateFromProbabilities` 纯函数单测覆盖暗光/过曝/正常/人像/手抖/闭眼/信号缺失各分支；真机需标定阈值（`DARK_MEAN`、`BRIGHT_HIGHLIGHTS`、`BLUR_SHARPNESS`、`SHAKY_SHAKE`、`EYE_OPEN_THRESHOLD`）。闭眼采集端已接：`eyeStateFromProbabilities` 从 MLKit 双眼开合概率判定（任一开即视为开，缺概率安全降级），Android 上 `analyzePhotoQuality` 跑 MLKit 取眼睛状态、Web 上 canvas 出模糊/曝光，平台维度互补、各自 fail-open。注意 MLKit 闭眼概率需 `classificationMode`，`analyzePhotoQuality` 的闭眼路径已懒初始化开启它（幂等，对只读人脸框的 faceBox 无害；若重初始化失败则沿用原配置、闭眼维度安全跳过）。

### AI 增强（在线，复用 qwen-vl 通路）

三项在线增强均**复用现有 LUT 引擎与 aiClient 通路**，纯参数、可单测、可开关，全部 fail-open（模型失败保留原图，绝不阻塞拍照）。

- **三分法构图建议**（`src/lib/ruleOfThirds.ts`）：`nearestThirdPoint` 把 AI aimPoint 吸附到最近的三分网格交点，`thirdsAdjustment` 给出把主体落到该点的水平/垂直微调与像素偏移。纯函数、无 DOM/网络依赖，可作为构图引导的补充（接 UI 待后续）。
- **AI 自动调色**（`src/lib/colorGrade.ts` + `colorGradeAi.ts`）：视觉模型分析画面返回五个有界参数（色温/曝光/对比/饱和/色调），`colorGradeParamsToLut` 编译成 LutSpec（矩阵+曲线+色温）套进 LUT 引擎。捕获流经 `autoColorGrade` 开关触发，复用快门照片的 base64（不二次采样），套在风格滤镜之上。UI："AI 调色"开关。
- **AI 美颜**（`src/lib/beauty.ts` + `beautyAi.ts`）：模型返回三个有界参数（磨皮/提亮/暖肤），映射到调色空间（磨皮→负对比柔化、提亮→曝光、暖肤→色温）编译成 LutSpec。捕获流经 `autoBeauty` 开关触发，套在调色之上。**空间效果（真·皮肤模糊、眼部提亮）超出 LUT 引擎能力，留待 GPU 后端**。UI："AI 美颜"开关。

验收：调色/美颜的参数归一化与 LUT 编译纯函数单测覆盖越界/缺省/非有限值/中性各分支；`buildXxxMessages`/`parseXxx` 测构造与解析（含格式非法抛错、缺字段降级中性）；controls 测开关渲染/状态/点击/无 handler 隐藏。真机需验证：模型返回参数的观感标定、两次模型往返（调色+美颜同时开）的延迟、以及 `base64: true` 对快门照片体积的影响。

### AI 场景识别与自然语言修图（在线，复用 qwen-vl 通路）

- **AI 智能场景识别**（`src/lib/sceneRecognition.ts` + `sceneAi.ts`）：视觉模型把画面分类到固定场景集（人像/风景/夜景/美食/逆光/微距），`sceneToRecommendation` 纯映射到模式/风格/曝光提示，采样阶段经 `autoScene` 开关在置信度 ≥ `SCENE_CONFIDENCE_MIN=0.6` 时自动切模式与风格（复用现有 `changeMode`/`changeStyle`，fail-open）。UI："AI 场景"开关。
- **自然语言修图**（`src/lib/nlEdit.ts`）：用户输入一句话（如"把天空调蓝一点"）+ 画面喂给视觉模型，返回调色+美颜两套参数，`applyNlEditToPhoto` 编译成 LUT 依次套到成片（fail-open，绝不毁原图）。回顾页 `PhotoReview` 加"一句话修图"输入框 + 应用按钮，预览图换成修图结果。这是大模型时代的新交互范式，复用现有调色/美颜编译器。
- **参考图复刻色调**（`src/lib/refColorMatch.ts`）：用户在回顾页从设备最近照片（复用 `loadDevicePhotos`，expo-media-library 已装）挑一张参考图，`buildReferenceGradeMessages` 把原图（index0）+ 参考图（index1）作为两张 `image_url` 放进同一条 user 消息（`AIMessage.content` 数组天然支持多图，模型层零改动），`analyzeReferenceGrade` 复用 `COLOR_GRADE_SCHEMA` 返回五参数，`applyReferenceGradeToPhoto` 复用 `colorGradeParamsToLut`+`applyLutSpecToPhoto` 把参考图色调套到当前预览（可叠加在一句修图之上，fail-open）。UI：回顾页"参考图匹配"入口 + 缩略图条点选 + "应用匹配"。
- **自动校正白平衡**（`src/lib/wbCorrection.ts`）：校正性通路（区别于审美调色）。视觉模型读图返回色偏（偏暖/偏冷/偏绿/偏品红/无）+ 曝光问题（过曝/欠曝/正常）+ severity，`wbReadingToGrade` 纯映射成反向修正参数（暖↔冷用 temperature、绿↔品红用 tint、过曝压/欠曝提），contrast/saturation 恒为 0（只校正不重塑），`CORRECTION_GAIN=0.8` 防过冲引入反向偏色；`applyWbCorrectionToPhoto` 经强度回调后编译 LUT 套到当前预览（fail-open）。UI：回顾页"自动校正白平衡"按钮，叠加在当前预览之上。
- **AI 场景建议**（`src/lib/sceneAdvice.ts`）：把拍摄流里被动的场景→风格推荐，变成回顾页主动的一键建议。`getSceneAdvice` 复用 `recognizeScene`+`sceneToRecommendation` 分类已拍照片并取回匹配风格与理由（组合既有件，非新模型输出），`applySceneAdviceToPhoto` 走 `applyStyleFilterToPhoto` 套推荐风格 LUT（fail-open，第三方覆盖该风格优先）。UI：回顾页"AI 场景建议"按钮 + 理由文案 + "应用{风格}"。
- **一键智能增强**（`src/lib/autoEnhance.ts`）：旗舰"一键成片"动作，编排两个已验证通路而非新增模型输出。`planAutoEnhance` 用 `Promise.all` 并行跑 `getSceneAdvice`（场景风格）+ `analyzeWhiteBalance`（白平衡/曝光校正），两读互相独立只需同一帧；`applyAutoEnhanceToPhoto` 先套风格 LUT、再把校正 grade 按强度叠加其上（fail-open）。UI：回顾页醒目的"一键智能增强"主按钮，受同一强度控件约束。
- 落地边界（诚实声明）：调研清单里 **HDR/夜景降噪/超分辨率/AI 消除/人像虚化(抠图)/Live Photo** 需要**原生计算摄影管线 + 图像生成/分割模型**，纯 JS + LUT 通路做不出真效果，硬做是假象，留待原生计算摄影/分割模型。已建成的 `modules/image-filter` 是逐像素 LUT bitmap 后端（覆盖调色/美颜/风格滤镜），做不了空间/生成式效果。本轮落地的是视觉模型 + LUT 引擎能覆盖的部分。

验收：场景识别的场景→模式/风格映射覆盖全部场景标签、`normalizeScene` 越界/未知标签/置信度钳制、controls 开关；自然语言修图的 `parseNlEdit` 全量/缺省/越界/格式非法、`applyNlEditToPhoto` fail-open、回顾页输入框渲染与按钮显隐；参考图匹配的 `buildReferenceGradeMessages` 两图顺序与文本、`analyzeReferenceGrade` 成功/失败、`applyReferenceGradeToPhoto` 编译 LUT 调 backend 与 fail-open、回顾页选参考图→应用匹配→预览替换与失败保留原图；强度调节（`src/lib/intensity.ts`）的 `scaleColorGrade`/`scaleBeauty` 在 strength=1 原样、=0 归中性、中间值保号缩放、`-0` 折叠为 `0`，回顾页强度分段控件渲染与选中切换；白平衡校正（`src/lib/wbCorrection.ts`）的 `wbReadingToGrade` 覆盖五种色偏×三态曝光与 severity 缩放、contrast/saturation 恒为 0、`parseWbReading` 越界枚举降级为无问题、`applyWbCorrectionToPhoto` 编译 LUT 调 backend 与 fail-open、回顾页校正按钮成功/失败两路；场景建议（`src/lib/sceneAdvice.ts`）的 `getSceneAdvice` 分类映射到风格并透传置信度、`applySceneAdviceToPhoto` 调风格滤镜、回顾页建议按钮成功取建议→应用风格与失败提示两路；一键增强（`src/lib/autoEnhance.ts`）的 `planAutoEnhance` 并行跑场景+白平衡两读、任一失败即整体失败、`applyAutoEnhanceToPhoto` 先风格后校正的串联顺序与强度透传、回顾页一键按钮成功/失败两路。真机需验证：场景分类准确率、一句话指令与参考图匹配与白平衡校正与场景建议与一键增强的观感、强度回调的实际效果、并行两读的延迟、以及模型往返延迟。

### 对外分发插件（expo-drama）

`plugins/expo-drama` 是可发布的 Expo config plugin，负责自动链接不覆盖的两项原生配置：

- 合并 `REQUEST_INSTALL_PACKAGES` 权限（app-installer 更新安装所需）。
- 向 `android/app/build.gradle` 注入 MLKit 人脸检测依赖（faceBox 检测器所需）。

结构：纯函数（`permissions.ts`、`gradle.ts`）+ 薄 mod 接线（`withDramaNative.ts`），`createRunOncePlugin` 包裹保证幂等（重复 prebuild 不重复注入）。camera-tuning 与 app-installer 模块本身由 `expo-module.config.json` 自动链接，插件只补齐权限与依赖。已注册进 `app.json`，`expo config` 解析通过。

验收：`npx expo prebuild --platform android` 后核对生成的 `AndroidManifest.xml` 含 `REQUEST_INSTALL_PACKAGES`、`app/build.gradle` 含 `com.google.mlkit:face-detection`（需 EAS/本地 Android 构建，本环境无法执行）。

### LUT 滤镜引擎

- `applyLutToImageData`（在 `src/plugin/builtin/lutMath.ts`）：像素级 RGBA LUT（3×3 矩阵 + 曲线 + 色温 + 颗粒），纯函数可单测，被 canvas 后端和原生 bitmap 后端共用。
- `canvasFilterBackend` + `applyLutToImageUri`（`canvasBackend.ts`）：Web 端把成片加载进 canvas、逐像素套 LUT、写回 JPEG data URL。无 canvas 环境安全透传原图。
- `nativeFilterBackend` + `applyLutToImageUri`（`nativeBackend.ts`）+ `modules/image-filter`（Android Kotlin Expo 模块）：原生端把成片解码成 Bitmap、逐像素套与 `lutMath.ts` 对齐的同一套数学（matrix→temperature→curve→grain→clamp）、写 JPEG 到 cache 返回 `file://` uri；curve 展平成 `[x0,y0,x1,y1,...]` 过桥。原生模块缺失（Expo Go/iOS）或处理失败时 fail-open 透传原图。惰性解析原生模块，晚注册也能拿到。
- `defaultFilterBackend`（`defaultBackend.ts`）：平台自适应选择器——Android→native bitmap、web/iOS→canvas。`applyLutSpecToPhoto`、`applyStyleFilterToPhoto`、回顾页 NL 修图都经它渲染，原生端真正出图，无后端时保留原图。调用方仍可显式传后端覆盖。
- fail-open：滤镜加载或处理失败一律返回原图 uri，绝不阻塞拍照；`applyStyleFilterToPhoto` 从 registry 取滤镜，第三方同 id 覆盖生效。
- `styleFilter()` / `jsFilterBackend`：JS 后端入口，统一 `FilterBackend` 接口；原生走 gpu 类型。
- LUT 数值预置：清透、奶杏、薄荷、胶片四套风格。

### 应用更新完整性

- `parseRelease` 从 GitHub Release 的 asset `digest`（`sha256:<64hex>`）提取 APK sha256，写入 `asset.sha256`；同时回填真实 `id`/`name`/`size`。
- 非 APK asset、缺失或格式非法的 digest 一律保持 `sha256: null`，原生 `verifyPackage` 跳过哈希校验、降级为包名+构建版本检查。
- 真机验收：Release 带 digest 时篡改 APK 应报“安装包校验失败”；Release 不带 digest 时仅跳过哈希、不报错。

### 端侧视觉检测器

- `sceneChangeDetector`：基于 base64 帧头采样做画面变化判断（阈值 0.3，真机需标定）。
- `lightingDetector` + `analyzeFrame`：均值 < 40 判暗帧、高光 > 0.15 判过曝；JS 兜底仅解码 base64 前 4096 字符做亮度样本，真 RGBA 解码由原生后端替换。
- `faceBoxDetector`（仅 Android，MLKit）：返回最大人脸归一化坐标；iOS/Web 安全 no-op。依赖 `@infinitered/react-native-mlkit-face-detection`。

### 真机待办（本轮未完成）

- 滤镜引擎像素后端已接入 Web canvas（`canvasFilterBackend`）与 Android 原生 bitmap（`modules/image-filter` + `nativeFilterBackend`，经平台自适应 `defaultFilterBackend`）；成片需真机比对四套风格 + AI 调色/美颜的色偏、对比、颗粒强度，并确认原生 `ImageFilter` 模块在 APK 中链接、`requireOptionalNativeModule('ImageFilter')` 拿得到（Expo Go 不支持，需重新构建 Android 开发包或 APK）。
- `modules/image-filter` Android bitmap 后端、`plugins/expo-drama` 对外插件、MLKit 真机人脸框精度，均需 Android SDK 编译与真机验证。

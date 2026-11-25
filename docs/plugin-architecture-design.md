# Drama Camera 插件化与功能增强设计

日期：2026-11-23
状态：待审批

## 意图

Drama 的核心是「一次取景 → 视觉模型出 JSON 方案 → 本地对准执行」。当前短板：

1. 摄影模式、风格、提示词硬编码在 `src/constants/`，新增模式要改核心代码
2. 风格（清透/奶杏/薄荷/胶片）只影响提示词，没有成片后处理，用户看不到差异
3. 陀螺仪积分假设 60° FOV，镜头切换后积分漂移；主体移动、光线变化无检测
4. `CameraCapture.tsx` 900 行混杂 UI/状态/样式，维护成本高
5. 无测试框架、无 CI（已在 P0 落地）

目标：把「摄影能力」抽成可插拔的插件，把「风格」落地为可预览/可保存的后处理滤镜，补端侧视觉检测增强对准精度，并把 900 行组件拆干净。同时把 Drama 自身做成 Expo 插件，方便其他 RN 项目一行接入。

## 非目标

- 不上 NPU 大模型；视觉检测只做轻量（人脸框/姿态/光流/亮度）
- 不做 iOS 原生相机模块（仅 Android 扩展），iOS 走 JS 滤镜兜底
- 不重做相机栈（不用 VisionCamera 替换 expo-camera，保持 Expo 生态）
- 不做账号体系与云端同步

## 方案（Approaches）

### 插件运行时

**A. 自研轻量 Registry（推荐）**
- `src/plugin/` 定义 `DramaPlugin` 接口 + `PluginRegistry`（纯 TS，零依赖）
- 内置插件：`modes`（3 个摄影模式）、`styles`（4 个风格 + LUT 参数）、`postprocess`（滤镜引擎）、`detectors`（视觉检测）
- 第三方插件：独立 npm 包，导出 `DramaPlugin`，宿主 `registerPlugin()` 注入
- 优点：类型安全、可测试、无运行时反射；Web/原生统一
- 代价：需要宿主提供沙箱约定（能力白名单，沿用现有 capabilities 机制）

**B. 动态 import + Metro 分包**
- 插件作为独立 entry，按需加载
- 缺点：Expo Web 与原生加载语义不一致，构建复杂；与「一行接入」目标冲突

**C. Expo Config Plugin（仅宿主侧）**
- 只解决「其他项目接入 Drama」，不解决应用内摄影能力扩展
- 与 A 不互斥：A 做应用内插件，C 做分发插件

结论：A + C。应用内摄影能力走 Registry，分发能力用 Expo Config Plugin 打包 Drama 核心（相机 + 引导 + 滤镜）为 `expo-drama`。

### 后处理

**JS 滤镜引擎（兜底，全平台）**
- `src/lib/filters/`：`LutEngine`（3×3 矩阵 + 曲线 + 色温 + 对比度 + 颗粒）
- 4 个内置 LUT 与 `CAMERA_STYLE_PRESETS` 对应（清透/奶杏/薄荷/胶片），参数即 Canon/Fuji 约定的数值化
- 实现：`expo-image-manipulator` 的 `manipulateAsync` 对像素操作做封装（Web 走 canvas）
- 预览：取景器叠加 `Image` 滤镜预览层（低分辨率），快门用原片 + 滤镜落盘

**原生 shader 加速（可选插件）**
- `modules/image-filter/`（Android）：GPU/`BitmapShader` 级 LUT 查找表，性能 ~10×
- 作为 `postprocess` 插件的 backend 之一；Web/iOS 自动回退 JS 引擎
- 接口与 JS 引擎一致（`FilterBackend: { apply(uri, lut): Promise<uri> }`）

### 端侧视觉检测

- `detectors` 插件接口：`detect(frame): Promise<FrameAnalysis>`
- 内置实现：
  1. `face-box`：端侧人脸检测（expo 无原生 face API，走 `MLKit` Android 插件，iOS/Web 回退「无检测」）
  2. `scene-change`：帧间光流/亮度差，触发 `pause` + 自动 replan（解决「主体走动无感知」）
  3. `lighting`：亮度直方图 + 高光占比，增强夜景模式的 light 建议
- 检测结果喂给 `GuidanceExecution`：`noteVision(event)` 作为新的撤回源，与 `noteMotion` 并列
- 全部本地运行，不出数据（隐私卖点）

### 架构重构

- `CameraCapture.tsx` 拆为：
  - `useCameraSession`（相机 ref 生命周期）
  - `ViewfinderOverlay`（虚线/目标圈/特效，纯展示）
  - `ParameterStrip`（变焦/闪光灯/白平衡/对比度滚轮）
  - `GuidanceBanner`（状态文案）
  - `CameraCapture` 只编排
- `constants/` 里 `CAMERA_MODE_PROMPTS`、`CAMERA_STYLES`、`CAMERA_STYLE_PRESETS` 迁入内置插件包，宿主通过 Registry 读取

## 目录设计

```
src/
  plugin/
    types.ts            # DramaPlugin / ModePlugin / StylePlugin / FilterBackend / Detector
    registry.ts         # PluginRegistry（单例 + 测试可注入）
    builtin/
      modes/            # 人像/风景/夜景 插件（提示词 + 校验 + 默认参数）
      styles/           # 4 风格插件（LUT 参数 + 白平衡/对比度预设）
      postprocess/
        lut.ts          # LUT 数据与 3×3 矩阵
        jsEngine.ts     # JS 滤镜引擎（expo-image-manipulator）
      detectors/
        faceBox.ts      # MLKit 封装（Android 可用，其他平台 no-op）
        sceneChange.ts  # 光流/亮度差
        lighting.ts     # 直方图
  lib/
    filters/            # 后处理管线（取样 → 滤镜 → 预览/保存）
  components/business/
    ViewfinderOverlay.tsx
    ParameterStrip.tsx
    GuidanceBanner.tsx
    CameraCapture.tsx   # 瘦身后的编排层
plugins/
  expo-drama/           # Expo Config Plugin（对外分发）
    expo-module.config.json
    src/index.ts        # 注册相机/引导/滤镜插件
modules/
  image-filter/         # Android LUT GPU 后端（可选）
```

## 验收

- 新增一个摄影模式/风格：只加插件包，核心代码零改动
- 4 个风格在取景器有可见的滤镜预览差异；保存照片带滤镜
- 主体快速移动 / 光线突变 → 自动撤回可拍并提示 replan
- `CameraCapture.tsx` < 300 行
- 全部插件可单测（Registry + 每个内置插件）
- `expo-drama` 能在空 Expo 项目里 `npx expo install expo-drama` 后接入取景器组件

## 交付顺序

1. `src/plugin/` Registry + types + 内置 modes/styles 插件（核心可单测）
2. 后处理 JS 引擎 + 4 个 LUT + 取景预览
3. detectors（sceneChange + lighting，faceBox 标 Android-only）
4. 组件拆分
5. `modules/image-filter`（可选，时间允许）
6. `plugins/expo-drama` 对外插件
7. CI 补插件单测

# 插件架构与功能增强 实施计划

> **执行方式**：本计划逐任务执行，每任务 TDD。任务间接口通过 Interfaces 块交接。

**目标**：把 Drama 的摄影模式/风格/后处理/视觉检测抽成插件，落地 4 个风格 LUT 滤镜与端侧检测（MLKit 人脸 + 场景变化 + 光照），拆分 900 行组件。

**架构**：`PluginRegistry`（纯 TS）+ 内置插件包 + 可选 Android 原生后端。

**依赖**：`@infinitered/react-native-mlkit-face-detection`（Expo 本地模块，仅 Android 生效，其他平台 no-op）。

**Spec**：`docs/plugin-architecture-design.md`

## 全局约束

- 所有新代码 TypeScript strict，0 lint error，0 类型错误
- 测试用 jest（已有），新增测试放 `src/**/__tests__/`
- 插件接口放 `src/plugin/`，内置实现放 `src/plugin/builtin/`
- 原生模块仅 Android；Web/iOS 自动回退 no-op 或 JS 引擎
- 不改动现有 JSON v3 协议 schema

## 任务

### Task 1: 插件运行时

**Files**
- Create: `src/plugin/types.ts`
- Create: `src/plugin/registry.ts`
- Test: `src/plugin/__tests__/registry.test.ts`

**Interfaces**
- Produces:
  - `type DramaPlugin = { id: string; modes?: ModePlugin[]; styles?: StylePlugin[]; filters?: FilterPlugin[]; detectors?: DetectorPlugin[] }`
  - `type ModePlugin = { id: string; label: string; prompt: string; validate?(g: Guidance): string | null }`
  - `type StylePlugin = { id: CameraStyle; label: string; description: string; preset: { whiteBalance: WhiteBalance; contrast: number | null }; lut: LutSpec }`
  - `type LutSpec = { name: string; matrix: number[]; curve?: [number, number][]; temperature?: number; grain?: number }`
  - `type FilterPlugin = { id: string; apply(backend: FilterBackend, uri: string): Promise<string> }`
  - `type DetectorPlugin = { id: string; detect(frame: FrameData): Promise<VisionEvent | null> }`
  - `type VisionEvent = { type: 'face' | 'sceneChange' | 'lighting'; data: unknown }`
  - `type FrameData = { width: number; height: number; dataUrl: string; capturedAt: number }`
  - `type FilterBackend = { kind: 'js' | 'gpu'; name: string; available(): boolean }`
  - `class PluginRegistry`：`register(plugin: DramaPlugin)`、`modes()`、`styles()`、`filter(id: string)`、`detectors()`、`reset()`（测试用）

**Steps**
1. 写 registry 测试：注册 → 查询 modes/styles/filters/detectors；重复 id 覆盖；reset 后为空
2. 运行确认失败（模块不存在）
3. 实现 types.ts + registry.ts
4. 运行测试通过
5. 提交

### Task 2: 内置 modes/styles 插件

**Files**
- Create: `src/plugin/builtin/modes.ts`
- Create: `src/plugin/builtin/styles.ts`
- Create: `src/plugin/builtin/index.ts`（注册全部内置插件）
- Modify: `src/constants/photographyPrompts.ts`（保留原导出以兼容，标记 deprecated，读 registry）
- Test: `src/plugin/builtin/__tests__/builtin.test.ts`

**Interfaces**
- Consumes: Task 1 的 `PluginRegistry`、`ModePlugin`、`StylePlugin`
- Produces:
  - `MODE_PLUGINS: ModePlugin[]`（3 个，prompt 直接搬 `CAMERA_MODE_PROMPTS` 内容）
  - `STYLE_PLUGINS: StylePlugin[]`（4 个，preset 搬 `CAMERA_STYLE_PRESETS`，lut 来自 Task 3）
  - `registerBuiltinPlugins(reg: PluginRegistry): void`

**Steps**
1. 写测试：`registerBuiltinPlugins` 后 registry 有 3 modes + 4 styles；mode prompt 非空且含关键词（人像/人物）
2. 运行失败
3. 实现三个文件
4. 测试通过
5. 提交

### Task 3: LUT 引擎 + 4 风格滤镜

**Files**
- Create: `src/plugin/builtin/lut.ts`（4 个 LutSpec 数值）
- Create: `src/plugin/builtin/filters.ts`（`jsFilterBackend` + 内置 `FilterPlugin`）
- Modify: `src/types/guidance.ts`（加 `LutSpec` 导出如需要）
- Test: `src/plugin/builtin/__tests__/filters.test.ts`

**Interfaces**
- Consumes: Task 1 `FilterPlugin`、`FilterBackend`
- Produces:
  - `export const LUTS: Record<string, LutSpec>`：`清透`、`奶杏`、`薄荷`、`胶片`
  - `jsFilterBackend: FilterBackend`（kind: 'js'，`available()` 在 Web/原生都 true）
  - `styleFilter(style: CameraStyle): FilterPlugin`：apply 调 `expo-image-manipulator` 的 `manipulateAsync`（曲线/色温/对比度参数化）
  - `applyFilter(uri: string, style: CameraStyle): Promise<string>`（顶层 API）

**LUT 数值约定**（Canon/Fuji 参考，写入 lut.ts 注释）
- 清透：matrix 近单位（R+2%, G+1%, B-1%），curve 提亮暗部，temperature -150
- 奶杏：R+6%, G+3%, B-4%，curve 柔和，temperature +250
- 薄荷：R-3%, G+4%, B+2%，curve 提亮，temperature -80
- 胶片：R+4%, G+1%, B-5%，curve S 型 + 暗角 grain 0.15，temperature +120

**Steps**
1. 写测试：`LUTS` 四键存在且 matrix 长度 9；`applyFilter` 对 fake uri 返回 promise（mock manipulateAsync）
2. 运行失败
3. 实现 lut.ts（数值 + 注释）与 filters.ts
4. 测试通过
5. 提交

### Task 4: detectors sceneChange + lighting

**Files**
- Create: `src/plugin/builtin/detectors/sceneChange.ts`
- Create: `src/plugin/builtin/detectors/lighting.ts`
- Test: `src/plugin/builtin/detectors/__tests__/detectors.test.ts`

**Interfaces**
- Consumes: Task 1 `DetectorPlugin`、`FrameData`、`VisionEvent`
- Produces:
  - `sceneChangeDetector(prev: FrameData | null): DetectorPlugin`：两帧 base64 尺寸/头 8 字节哈希差 + 时间差；变化 > 0.3 返回 `{ type: 'sceneChange', data: { delta } }`，否则 null；无 prev 时 null
  - `lightingDetector(): DetectorPlugin`：对 768px 样本做亮度均值 + 高光(>240)占比；暗帧（均值<40）或高光>0.15 返回 `{ type: 'lighting', data: { mean, highlights } }`
  - 帧分析纯函数 `analyzeFrame(bytes: Uint8Array): { mean: number; highlights: number }` 可单测

**实现说明**：JS 端拿不到像素级数据（base64 大），用「base64 前 512 字节采样 + 帧尺寸 + 时间戳」做 sceneChange；lighting 在 Android 真机可用 `expo-image` 取样，JS 兜底只算可用时。纯函数 `analyzeFrame` 直接吃 Uint8Array 方便单测。

**Steps**
1. 写 `analyzeFrame` 单测（全黑/全白/均匀灰帧）
2. 写 sceneChange 单测（同帧→null，不同帧→event）
3. 运行失败 → 实现 → 通过
4. 提交

### Task 5: MLKit faceBox（Android）

**Files**
- Create: `src/plugin/builtin/detectors/faceBox.ts`
- Modify: `package.json`（加 `@infinitered/react-native-mlkit-face-detection`）
- Test: `src/plugin/builtin/detectors/__tests__/faceBox.test.ts`

**Interfaces**
- Produces:
  - `faceBoxDetector(available: () => boolean): DetectorPlugin`：Android 且可用时调 MLKit `detectFace`，返回最大脸框归一化坐标 `{ type: 'face', data: { x, y, w, h } }`；其他平台 no-op 返回 null
  - 检测间隔由宿主控制（每轮 guidance sample 一次，不轮询）

**Steps**
1. `npm i @infinitered/react-native-mlkit-face-detection`
2. 写测试：mock 模块，Android + available 返回 face event；非 Android 返回 null
3. 实现 faceBox.ts（动态 require 模块，Web 兜底）
4. 测试通过
5. 提交

### Task 6: 拆 CameraCapture 组件

**Files**
- Create: `src/components/business/ViewfinderOverlay.tsx`
- Create: `src/components/business/ParameterStrip.tsx`
- Create: `src/components/business/GuidanceBanner.tsx`
- Create: `src/hooks/useCameraSession.ts`
- Modify: `src/components/business/CameraCapture.tsx`（瘦身到 < 300 行，只编排）
- Test: `src/components/business/__tests__/CameraCapture.test.tsx`（渲染冒烟）

**Interfaces**
- `useCameraSession(cameraRef)` → `{ viewfinder, aspect, capture(): Promise<uri> }`
- `ViewfinderOverlay` props：`{ target, ready, message }`
- `ParameterStrip` props：`{ params, blocked, onOpen }`
- `GuidanceBanner` props：`{ enabled, message, light }`

**Steps**
1. 抽 `useCameraSession`，迁移 viewfinder 尺寸逻辑
2. 抽三个子组件，CameraCapture 变编排层
3. 冒烟测试：渲染不崩
4. 提交

### Task 7: 全量验证

- `npm run typecheck && npm run lint && npm test`
- 更新 `docs/testing.md`：插件 + 滤镜 + 检测器验收清单
- CI 已含三命令，无需改

## Review Focus（未直接测试的失败模式）

1. 非 Android 平台加载 faceBox → 必须 no-op 不崩（Task 5 测试覆盖 Web）
2. LUT 数值越界（matrix 非 9 元素 / curve 非单调）→ Task 3 测试校验
3. 插件重复注册（宿主 + builtin 都调 register）→ Task 1 测试 id 覆盖语义
4. 滤镜失败（manipulateAsync 抛错）→ 返回原 uri 不阻塞拍摄（Task 3 测试 mock 抛错路径）
5. 场景检测误报（正常手持抖动触发 sceneChange）→ delta 阈值 0.3 需真机标定，docs/testing.md 标注

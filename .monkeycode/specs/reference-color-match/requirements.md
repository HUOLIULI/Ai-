# Requirements Document — 参考图复刻色调（AI 调色匹配）

## Introduction

让用户在拍摄完成后，选一张"参考图"（另一张有想要的色调的照片），由视觉模型分析原图与参考图的色彩差异，输出一组有界调色参数，复用现有 LUT 引擎把参考图的色调套到当前照片上。这是把行业 2026 的"参考图复刻色调 / Generative Match"能力，以 Drama 已有的"视觉模型返回有界参数 → 纯函数编译成 LutSpec → LUT 引擎渲染"范式落地，无需新原生依赖或生成式模型。

## Glossary

- **原图（source）**: 用户刚拍摄、正在回顾页查看的照片。
- **参考图（reference）**: 用户从设备最近照片中挑选的、其色调希望被复刻到原图上的一张照片。
- **调色参数（ColorGradeParams）**: 五个 [-1, 1] 有界数值：temperature / exposure / contrast / saturation / tint。
- **LutSpec / LUT 引擎**: 项目现有的颜色查找表规格与应用引擎（`colorGradeParamsToLut` 编译、`applyLutSpecToPhoto` 渲染）。
- **fail-open**: AI 或选图任一环节失败时保留原图、给出可读提示，绝不破坏原图或阻塞保存。

## Requirements

### Requirement 1 — 选择参考图

**User Story:** AS 用户，I want 从设备最近照片中挑一张参考图，so that 把它的色调复刻到当前照片。

#### Acceptance Criteria

1. WHEN 用户在回顾页点击"参考图匹配"入口，系统 SHALL 请求媒体库权限并加载设备最近照片（复用 `loadDevicePhotos`）。
2. WHILE 参考图列表已加载，系统 SHALL 以缩略图形式展示最近照片供用户点选。
3. WHEN 用户点选一张缩略图，系统 SHALL 将其标记为当前参考图并在 UI 上高亮选中项。
4. IF 媒体库权限被拒或加载失败，系统 SHALL 隐藏参考图选择区并提示"无法读取相册"，原图保持不变。

### Requirement 2 — 分析并复刻色调

**User Story:** AS 用户，I want 一键把参考图的色调套到原图，so that 原图呈现与参考图相近的色彩风格。

#### Acceptance Criteria

1. WHEN 用户已选中参考图并点击"应用匹配"，系统 SHALL 把原图与参考图作为两张图像、以有界调色参数 JSON Schema 约束，交给视觉模型分析。
2. WHEN 视觉模型返回五个调色参数，系统 SHALL 将参数编译为 LutSpec 并通过 LUT 引擎应用到原图，得到匹配后的预览图。
3. WHEN 匹配成功，系统 SHALL 用匹配结果替换回顾页预览图。
4. WHILE 视觉模型仅看到图像与参数 Schema，系统 SHALL 要求模型只返回五个有界数值、不返回文字或像素值。

### Requirement 3 — 叠加与可回退

**User Story:** AS 用户，I want 匹配结果能叠加在已有修图之上且不破坏原图，so that 我可以放心尝试。

#### Acceptance Criteria

1. WHEN 回顾页已存在一句修图结果，系统 SHALL 把参考图匹配作用在该结果之上（以当前预览 uri 为基准）。
2. IF 视觉模型调用失败、返回不完整参数或超时，系统 SHALL 保留当前预览图并显示"匹配未生效"提示。
3. IF 未选中参考图就点击"应用匹配"，系统 SHALL 不发起模型请求。

### Requirement 4 — 通用约束

**User Story:** AS 用户，I want 该功能遵守项目既有的在线 AI 增强约束，so that 体验一致且安全。

#### Acceptance Criteria

1. THE 系统 SHALL 复用统一的 `requestAICompletion` 通路与 `GuidanceConfig`（API key 不是问题）。
2. THE 系统 SHALL 复用现有 LUT 引擎渲染，模型只产出有界参数，绝不产出像素值。
3. THE 系统 SHALL 在模型调用期间显示加载态并禁止重复提交。
4. THE 系统 SHALL 提供 web / 无 `expo-media-library`（Expo Go）环境下的降级行为：隐藏入口或提示不可用，fail-open。

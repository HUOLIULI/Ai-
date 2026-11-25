# AI 多构图 (photo-compositions)

## 背景

「随手一拍成片」的第一步是取景。很多用户拍完才发现主体居中呆板、地平线歪、留白失衡。现有的「AI 智能裁剪」一次只给一个方案，用户没有选择余地。多构图让模型一次返回多个明显不同的构图方案，用户点选预览后再应用，把「裁哪里」变成可探索的选项而不是单次赌注。

## 范围

- 复用视觉模型（qwen-vl），模型只返回**有界数值参数**（归一化裁剪框 + 标签 + 理由），不返回像素。
- 复用现有裁剪管线（`photoCrop` 的 `cropBoxToRect` + `applyCropToPhoto`），纯参数、可单测、可开关。
- 预览图上叠加裁剪框，点选变体实时预览，应用后裁剪。
- fail-open：模型失败保留原图，绝不阻塞保存。

## 需求（EARS / INCOSE）

### 建议
- [UTC-1] When 用户点击「AI 多构图」入口, the system shall 调用视觉模型，返回 1–3 个明显不同的构图变体。
- [UTC-2] When 视觉模型成功返回变体, the system shall 以色块 chips 展示各变体标签，并在预览图上叠加第一个变体的裁剪框。
- [UTC-3] When 用户点选某个变体 chip, the system shall 将预览图裁剪框切换到该变体，并展示该变体的构图理由。
- [UTC-4] When 用户点击「应用此构图」, the system shall 将选中变体的归一化裁剪框编译为像素 rect 并裁剪预览图。

### 约束
- [UTC-5] 模型输出经 `outputSchema` 约束为固定 schema（`photo_compositions_v1`），最多 3 个变体（`MAX_VARIANTS`）。
- [UTC-6] 归一化裁剪框的 `width`/`height` 不得低于 `MIN_CROP`（0.3），防止裁出过小碎片。
- [UTC-7] 归一化裁剪框超出 [0,1] 时 shall 夹取；畸形输入 shall 经 `normalizeCompositions` 降级。
- [UTC-8] 变体标签缺失时 shall 用「方案 N」占位；理由缺失时 shall 用中性占位。

### 失败处理
- [UTC-9] When 视觉模型调用失败, the system shall 保留原图，显示「未能生成构图方案，请检查 AI 配置或稍后再试。」，绝不动预览图。
- [UTC-10] When 应用裁剪失败, the system shall 保留原图，显示「未能应用构图，请稍后再试。」。
- [UTC-11] When 模型返回空或全废变体, the system shall 经 `normalizeCompositions` 降级为一个默认全图变体。

### 交互
- [UTC-12] When 用户点击「取消」, the system shall 清空变体与裁剪框叠加，回到原图预览。
- [UTC-13] 应用成功后 shall 清空变体面板与裁剪框叠加，预览图显示裁剪结果。

## 不做

- 不做多裁剪结果并排展示（保持单一预览 + 裁剪框叠加，控件已拥挤）。
- 不做构图评分排序（模型返回顺序即建议顺序）。
- 不做自动应用（必须用户点选确认）。

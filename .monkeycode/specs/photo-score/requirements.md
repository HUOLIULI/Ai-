# Requirements Document — AI 照片评分与点评

Feature Name: photo-score
Updated: 2026-11-24

## Introduction

拍完即评：视觉模型对成片打五维分数（构图 / 光线 / 色彩 / 锐度 / 美学，各 0–100），给一句总评和 1–3 条可执行的改进建议，帮用户在相册里快速判断"哪张值得留 / 要不要重拍"。复用现有 qwen-vl 通路与 JSON schema 约束，纯参数、可单测、fail-open（模型失败保留原图、仅显示提示，绝不阻塞选片或保存）。

## Glossary

- **五维分数**：构图（主体位置/三分法/平衡）、光线（曝光/光影/方向）、色彩（白平衡/色调/饱和）、锐度（对焦/清晰度）、美学（整体观感）。
- **总分 overall**：五维分数的算术平均，四舍五入到整数，0–100。
- **总评 summary**：一句面向用户的中文点评。
- **改进建议 tips**：1–3 条可执行的中文建议。
- **评分解读 PhotoScore**：overall + 五维分数 + summary + tips 的纯数据结构。

## Requirements

### Requirement 1 — 生成照片评分

**User Story:** AS 拍照用户，I want 拍完后对成片打分并给改进建议，so that 我能快速判断哪张值得留。

#### Acceptance Criteria

1. WHEN 用户在回顾页点"AI 评分"，THE system SHALL 调用视觉模型对当前成片返回五维分数（各 0–100）、一句总评、1–3 条建议。
2. THE system SHALL 用 JSON schema（`photo_score_v1`）约束模型输出，五维分数与建议均落在规定范围内。
3. THE system SHALL 派生总分 overall 为五维分数的算术平均并四舍五入到整数。

### Requirement 2 — 容错归一

**User Story:** AS 拍照用户，I want 模型偶发乱值时不看到破图或崩溃，so that 评分功能始终可用。

#### Acceptance Criteria

1. IF 模型某维分数缺失、非数字或越界，THE system SHALL 将该维夹取/降级为 0 并继续出总分。
2. IF 总评缺失或为空白，THE system SHALL 用占位文案"暂无点评。"
3. IF 建议数组含非字符串或空项，THE system SHALL 过滤并最多保留前 3 条。

### Requirement 3 — fail-open 与可关闭

**User Story:** AS 拍照用户，I want 模型不可用时评分不阻塞选片，so that 我仍能正常保存/分享。

#### Acceptance Criteria

1. IF 视觉模型调用失败或超时，THE system SHALL 保留原图、显示可见提示，绝不阻塞选片与保存。
2. WHEN 用户点过评分，THE system SHALL 缓存结果且不重复请求，直到换新照片。

## References

- 复用范式：`src/lib/sceneAi.ts`（schema + parse）、`src/lib/sceneRecognition.ts`（normalize）。
- 像素守卫：`src/lib/photoQuality.ts`（技术性布尔守卫，与本模型美学评分互补）。

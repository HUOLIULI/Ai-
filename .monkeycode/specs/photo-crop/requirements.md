# Requirements Document — AI 智能裁剪

Feature Name: photo-crop
Updated: 2026-11-24

## Introduction

拍完即重构图：视觉模型分析成片，返回一个归一化裁剪框（中心 + 宽高），客户端用 expo-image-manipulator 裁剪，"盘活"构图欠佳的照片。补齐"评分 → 裁剪 → 调色"的相册旧照重塑闭环。纯参数、可单测、fail-open（模型失败保留原图，绝不阻塞选片/保存）。

## Glossary

- **裁剪框 crop box**：归一化 `{ centerX, centerY, width, height }`，各 0–1，center 为框中心，width/height 为框占原图比例。
- **裁剪矩形 crop rect**：像素 `{ originX, originY, width, height }`，喂给 `manipulateAsync`。
- **裁剪解读 CropSuggestion**：归一化 crop box + 一句理由 rationale。

## Requirements

### Requirement 1 — 生成裁剪建议

**User Story:** AS 拍照用户，I want AI 帮我把构图欠佳的照片裁到更出片，so that 旧照也能重构图。

#### Acceptance Criteria

1. WHEN 用户在回顾页点"AI 裁剪"，THE system SHALL 调用视觉模型对当前成片返回归一化裁剪框（centerX/centerY/width/height，各 0–1）+ 一句理由。
2. THE system SHALL 用 JSON schema（`photo_crop_v1`）约束模型输出。
3. THE system SHALL 把归一化 crop box 编译成像素 crop rect 并经 `manipulateAsync` 裁剪，产出新预览。

### Requirement 2 — 容错归一

1. IF 某字段缺失/非数字/越界，THE system SHALL 夹取到 0–1（宽高额外保证 ≥ 最小比例）并继续。
2. IF 理由缺失/空白，THE system SHALL 用占位文案。

### Requirement 3 — fail-open 与可关闭

1. IF 模型调用失败或裁剪失败，THE system SHALL 保留原图、显示可见提示，绝不阻塞选片与保存。
2. WHEN 换新照片，THE system SHALL 重置裁剪建议与结果。

## References

- 范式：`src/lib/photoScore.ts`（schema + normalize + fail-open）。
- 裁剪依赖：`expo-image-manipulator` `manipulateAsync`（已在 `cameraSample.ts` 使用 crop）。

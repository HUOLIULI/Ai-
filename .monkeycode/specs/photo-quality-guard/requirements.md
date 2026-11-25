# Requirements Document

Feature: photo-quality-guard
Updated: 2026-11-23

## Introduction

"随手一拍都能成片"的第二道兜底：按下快门后立刻对成片做端侧质量检测（模糊 / 过曝 / 偏暗 / 人脸闭眼），发现明显废片就在回顾页提示"刚才那张可能糊了 / 过曝了，建议重拍"。它复用特性 1 的端侧信号路线，纯 TS 纯函数可单测，模糊与曝光判定走像素统计，闭眼检测在 Android 上复用 MLKit faceBox 的 landmarks。

## Glossary

- **成片质量守护 (PhotoQualityGuard)**: 对已捕获照片做端侧质量评估，输出是否建议重拍及原因。
- **质量报告 (QualityReport)**: 评估输出，含模糊、曝光、闭眼三个维度与整体建议。
- **模糊 (Blur)**: 像素梯度偏低，画面细节不足。
- **重拍建议 (RetakeHint)**: 当某维度明显不合格时，提示用户重拍的可读文案。

## Requirements

### Requirement 1 — 成片模糊检测

**User Story:** AS 用户，我希望拍糊了被提醒，所以不会存下一张模糊废片。

#### Acceptance Criteria

1. WHEN 成片像素梯度低于模糊阈值，THE 质量守护 SHALL 在质量报告里标记"模糊"。
2. WHEN 成片像素梯度达到清晰阈值，THE 质量守护 SHALL 标记"清晰"。
3. THE 模糊判定 SHALL 为纯函数，给定相同像素统计 SHALL 输出相同结果。

### Requirement 2 — 成片曝光检测

**User Story:** AS 用户，我希望过曝或死黑的成片被提醒。

#### Acceptance Criteria

1. WHEN 成片平均亮度低于暗光阈值，THE 质量守护 SHALL 标记"偏暗"。
2. WHEN 成片高光占比超过过曝阈值，THE 质量守护 SHALL 标记"过曝"。
3. WHILE 成片亮度在正常区间，THE 质量守护 SHALL 标记"曝光正常"。

### Requirement 3 — 闭眼检测（Android）

**User Story:** AS 自拍用户，我希望闭眼的成片被提醒，避免拍到眨眼瞬间。

#### Acceptance Criteria

1. WHEN Android 上 faceBox 检测到人脸且判定闭眼，THE 质量守护 SHALL 标记"闭眼"。
2. IF 平台不支持人脸检测或无人脸，THE 质量守护 SHALL 跳过闭眼维度，不影响其余判定。

### Requirement 4 — 重拍建议可解释、可降级

**User Story:** AS 用户，我希望知道为什么建议重拍，并且检测能力不足时不误报。

#### Acceptance Criteria

1. WHEN 质量报告含任一不合格维度，THE 质量守护 SHALL 输出一条对应可读的重拍建议文案。
2. WHEN 所有维度合格，THE 质量守护 SHALL 给出"成片正常"的结论，不提示重拍。
3. IF 某维度无法评估（如缺像素数据、平台不支持），THE 质量守护 SHALL 跳过该维度并按其余维度给结论，绝不阻塞保存。

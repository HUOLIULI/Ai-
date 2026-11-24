# Requirements Document

Feature: offline-shutter-decision
Updated: 2026-11-23

## Introduction

今天要拿到调整方案，必须先配置云端大模型 API，再等 `analyzeCameraSample` 返回构图/参数建议（`src/lib/aiGuidance.ts`）。模式与风格全靠手动点。这把"随手一拍就能成片"卡在两处：决策慢（要等模型）、决策要联网要 key。

离线快门决策器（本地 auto 预设）在按下快门那一刻，用已有端侧信号（lighting / sceneChange / faceBox detectors + 陀螺仪）本地确定性算出一组拍摄调整：白平衡、风格预设、曝光提示、是否提示手稳。不发起网络请求、不依赖 API key、不等模型。它把"配了 key 才有的成片能力"变成"装了就有"，是纯 TS 纯函数，可接进现有 `cameraTuning` 与 LUT 预设。

## Glossary

- **快门决策器 (ShutterDecision)**: 按下快门时本地运行的纯函数，输入端侧信号，输出一组拍摄调整建议。
- **端侧信号 (Signals)**: 采样帧统计（亮度/高光）、sceneChange、faceBox、陀螺仪读数的聚合。
- **快门决策 (ShutterDecision)**: 决策器输出，含白平衡、风格、曝光提示、手稳提示。
- **离线**: 全程不发起网络请求、不读取大模型配置。

## Requirements

### Requirement 1 — 本地决策，零网络依赖

**User Story:** AS 一个想随手就拍的用户，我希望按下快门立刻得到一组拍摄调整，所以我不用联网、配 key、等模型。

#### Acceptance Criteria

1. WHEN 用户按下快门，THE 快门决策器 SHALL 在本地根据端侧信号计算出一组拍摄调整，不发起任何网络请求。
2. WHEN 端侧信号可用，THE 快门决策器 SHALL 输出一个完整的快门决策，含白平衡、风格预设、曝光提示与手稳提示。
3. IF 大模型 API 未配置或网络不可用，THE 快门决策器 SHALL 仍正常输出快门决策。

### Requirement 2 — 亮度驱动的曝光提示

**User Story:** AS 用户，我希望在过暗或过曝的场景被提醒，所以我成片不至于死黑或死白。

#### Acceptance Criteria

1. WHEN 采样帧平均亮度低于暗光阈值，THE 快门决策器 SHALL 在曝光提示中标记"偏暗"并建议开闪光或补光。
2. WHEN 采样帧高光占比超过过曝阈值，THE 快门决策器 SHALL 在曝光提示中标记"过曝"并建议降低曝光或避开强光。
3. WHILE 采样帧亮度在正常区间，THE 快门决策器 SHALL 给出"曝光正常"的曝光提示。

### Requirement 4 — 稳定性提示（陀螺仪）

**User Story:** AS 用户，我希望手抖时被提醒稳住，所以成片不会糊。

#### Acceptance Criteria

1. WHEN 陀螺仪读数显示设备明显晃动，THE 快门决策器 SHALL 给出"手持不稳，请稳住"的手稳提示。
2. WHILE 设备平稳，THE 快门决策器 SHALL 给出"可稳拍"的手稳提示。
3. IF 陀螺仪不可用，THE 快门决策器 SHALL 给出中性的手稳提示，不阻塞拍摄。

### Requirement 5 — 自动风格与白平衡建议

**User Story:** AS 用户，我希望相机根据场景自动选好风格和白平衡，所以我不用手动点。

#### Acceptance Criteria

1. WHEN 端侧信号指示人像场景，THE 快门决策器 SHALL 建议人像风格并选用与之匹配的白平衡。
2. WHEN 端侧信号指示暗光场景，THE 快门决策器 SHALL 建议偏暖/提亮的风格预设。
3. IF 决策器无法判定场景，THE 快门决策器 SHALL 回退到当前用户已选的风格与白平衡。

### Requirement 6 — 决策可解释、可降级

**User Story:** AS 用户，我希望知道相机为什么这么建议，并且在能力不足时它不乱来。

#### Acceptance Criteria

1. WHEN 快门决策器输出决策，THE 决策 SHALL 携带触发该建议的可读原因，供 UI 展示。
2. IF 某类端侧信号缺失（如无人脸、无陀螺仪），THE 快门决策器 SHALL 仅基于可用信号给出决策，缺失维度回退到安全默认值。
3. THE 快门决策器 SHALL 为纯函数，给定相同端侧信号 SHALL 输出相同决策（可单测、可复现）。

# Requirements Document — 胶片质感自定义（颗粒/暗角）

Feature Name: film-texture
Updated: 2026-11-24

## Introduction

把固定的 8 套风格变成"风格 × 质感"的组合空间：在选定风格后，让用户微调**胶片颗粒强度**与**暗角幅度**，复刻伯虎光影"胶片参数自定义"的核心卖点。颗粒字段 LutSpec 已有但未暴露给用户；暗角（vignette）是 LutSpec 新增字段，需扩展 lutMath 像素逻辑 + canvas 后端 + 原生 Kotlin 后端 + 桥接层。纯位置/数值运算、可单测，暗角沿既有 fail-open 通路。

## Glossary

- **颗粒 grain**：LutSpec 既有字段，0–1，胶片颗粒噪点强度（亮度通道单色起伏）。
- **暗角 vignette**：LutSpec 新增字段，0–1，四角压暗幅度（径向位置衰减，中心不变、边角最暗）。
- **质感控件**：回顾页新增的颗粒/暗角滑杆，叠加在所选风格 LUT 之上。

## Requirements

### Requirement 1 — 暗角像素渲染

**User Story:** AS 拍照用户，I want 给照片加暗角营造胶片氛围，so that 成片更有质感。

#### Acceptance Criteria

1. THE system SHALL 在 LutSpec 增加 `vignette`（0–1）字段，lutMath 按像素到中心的归一化径向距离衰减亮度（中心不变、四角最暗）。
2. WHEN vignette 为 0 或缺省，THE system SHALL 不改变像素（与现状一致）。
3. THE system SHALL 在 canvas 后端与 Android 原生 bitmap 后端渲染出一致的暗角（同一公式）。

### Requirement 2 — 质感控件

**User Story:** AS 拍照用户，I want 在回顾页调颗粒和暗角，so that 我能定制胶片质感。

1. WHEN 用户调整颗粒/暗角滑杆，THE system SHALL 把所选风格 LUT 的对应字段覆盖为滑杆值并重新渲染预览。
2. THE system SHALL 复用现有强度范式（0 关闭、1 足量），滑杆值夹取 0–1。

### Requirement 3 — fail-open 与跨端一致

1. IF 原生后端不可用或渲染失败，THE system SHALL 保留原图（既有 fail-open），暗角缺失降级为无暗角。
2. THE system SHALL 保证 canvas 与原生暗角公式一致（同一径向衰减），真机与 web 观感对齐。

## References

- LUT 引擎：`src/plugin/builtin/lutMath.ts`（matrix→temperature→curve→grain 管线）。
- 双后端：`canvasBackend.ts`、`nativeBackend.ts` + `modules/image-filter` Kotlin。
- 强度范式：`src/lib/intensity.ts`。

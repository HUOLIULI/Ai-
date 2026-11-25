# AI 多构图 — 技术设计

## 架构定位

复用既有「在线模型 → 有界参数 → 纯函数 → 引擎」范式，与 AI 智能裁剪共用裁剪管线。模型只输出归一化裁剪框 + 标签 + 理由，无像素、无渲染。

```
取景/回顾页 ──点击「AI 多构图」──▶ suggestCompositions(config, dataUrl, signal)
                                        │  复用 qwen-vl + outputSchema(photo_compositions_v1)
                                        ▼
                                  CompositionVariant[]（1–3 个，已归一化夹取）
                                        │
                          PhotoReview 状态：compositions / compositionIndex
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        预览图裁剪框叠加                        「应用此构图」
   (归一化百分比定位,无需像素尺寸)      cropBoxToRect(box, w, h) → applyCropToPhoto
```

## 数据契约

### CompositionVariant
```ts
type CompositionVariant = {
  label: string;      // 方案名，如「三分法」「特写」「留白」
  box: CropBox;       // 归一化 { centerX, centerY, width, height }，复用 photoCrop
  rationale: string;  // 为什么这样构图
};
```

### 模型输出 schema（photo_compositions_v1）
```json
{
  "type": "object",
  "properties": {
    "compositions": {
      "type": "array",
      "maxItems": 3,
      "items": {
        "type": "object",
        "properties": {
          "label":     { "type": "string" },
          "centerX":   { "type": "number" },
          "centerY":   { "type": "number" },
          "width":     { "type": "number" },
          "height":    { "type": "number" },
          "rationale": { "type": "string" }
        },
        "required": ["centerX", "centerY", "width", "height", "rationale"]
      }
    }
  },
  "required": ["compositions"]
}
```
`label` 非 required（缺失时占位「方案 N」）；`rationale` required（INCOSE 可测）。

## 纯函数（photoCompositions.ts）

### normalizeCompositions(raw): CompositionVariant[]
- 非数组 → `[]`。
- 逐项：丢弃非对象 / 数值非有限；`width`/`height` 经 `clamp` 夹到 `[MIN_CROP, 1]`（`MIN_CROP=0.3` 沿用 photoCrop）；`centerX`/`centerY` 夹到 `[0,1]`。
- `label` 缺失/空 → `方案 ${i+1}`；`rationale` 缺失/空 → `收紧构图，突出主体。`。
- `slice(0, MAX_VARIANTS)` 截断（`MAX_VARIANTS=3`）。
- 全部被丢弃 → `[]`。

### suggestCompositions(config, imageDataUrl, signal): Promise<CompositionVariant[]>
- `requestAICompletion` + `responseFormat.outputSchema = COMPOSITION_SCHEMA`。
- `parseModelJSON` → `normalizeCompositions`。
- 空数组 → 降级为**默认全图变体** `[{ label:'原图', box:{centerX:0.5,centerY:0.5,width:1,height:1}, rationale:'保留原始构图。' }]`，保证始终有一个可应用项。
- 上游抛错 → 透传，调用方 fail-open。

## UI（PhotoReview.tsx）

### 状态
- `compositions: CompositionVariant[] | null` — null=未加载，[]=降级，非空=有变体。
- `compositionIndex: number` — 当前选中的变体下标。
- `imageDims: {width,height} | null` — 预览图像素尺寸（应用裁剪用 `cropBoxToRect`）。
- `busyComposition: boolean`。
- `compositionError: string | null`。

### 生命周期
- `uri` 变化 → 重置 `compositions=null` / `compositionIndex=0` / `compositionError=null`。
- `uri` 变化 → `getImageSize(uri)` 加载 `imageDims`（fail-open 到 null；应用时若 null 则现场 `getImageSize(displayUri)`）。

### 生成 / 应用
- `loadCompositions()`：`getActiveAIConfig` → `toDataUrl(displayUri)` → `suggestCompositions` → `setCompositions` + `setCompositionIndex(0)`；catch → `compositionError`。
- `applyComposition()`：取 `compositions[compositionIndex]` → `cropBoxToRect(box, dims)` → `applyCropToPhoto(displayUri, rect)` → `setEditedUri(out)` → 重置 `textureBaseRef.current=null`（后续质感叠在裁剪结果之上）→ 清空 `compositions`。

### 裁剪框叠加
- 预览图 `imageWrap` 内绝对定位一个 `compositionCropBox`，用**归一化百分比**定位（`left=(centerX-width/2)*100%`、`top=(centerY-height/2)*100%`、`width/height=*100%`），无需像素尺寸即可预览。
- 选中变体切换 → 叠加框实时更新。

### 控件
- 入口按钮「AI 多构图」（grid 图标）；加载中「构图分析中」；有变体后显示「构图方案 N/M」。
- 横向 `ScrollView` 变体 chips，选中高亮。
- 变体理由文案。
- 「应用此构图」+「取消」按钮。

## 边界与 fail-open

| 场景 | 行为 |
|---|---|
| 模型失败 | 保留原图 + `compositionError` |
| 返回空/全废 | 降级为默认全图变体 |
| 裁剪框越界 | `clamp` 到 `[0,1]` |
| 裁剪过小 | `width/height` 夹到 `≥MIN_CROP` |
| 应用裁剪失败 | 保留原图 + `compositionError` |
| `imageDims` 未就绪 | 应用时现场 `getImageSize` |

## 测试策略
- `photoCompositions.test.ts`：`normalizeCompositions`（夹取/cap/占位/降级）+ `suggestCompositions`（成功解析/上游失败透传）。
- `PhotoReview.test.tsx`：入口按钮渲染、加载变体选 chip 应用裁剪、失败提示。

## 不引入
- 不新增依赖（复用 photoCrop 的 `CropBox`/`cropBoxToRect`/`applyCropToPhoto`/`getImageSize`）。
- 不引入新渲染路径（变体即裁剪框，走既有裁剪管线）。

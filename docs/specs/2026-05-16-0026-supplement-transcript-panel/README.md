# 补充录音转录区

## 时间

2026-05-16 00:26 America/Los_Angeles

## 目标

在 Memory Studio 的 SegmentSupplement audio panel 中，紧接播放行下方显示该补充录音自己的转录文本（只读），与 Segment transcript tab 共用一个 feature-local `SegmentTranscriptView` 组件，避免转录展示逻辑在两处分叉。

## 当前事实

- 补充录音的 transcript 已经由录音流程写入 `supplement.md` 正文：`workspace:saveSegmentSupplementTranscript` → `writeSupplementTranscriptInRecordingDirectory`（src/main/recordingDrafts.ts:1882）。
- 投影层已派生 `supplements[].transcript.exists`：`extractSegmentTranscript` 对 supplement.md 同样适用（src/main/memoryFiles.ts:2613）。
- 但 `readFinalizedAudioSegmentSupplementContent`（src/main/recordingDrafts.ts:1425-1519）与对应 contract schema `workspaceReadFinalizedAudioSegmentSupplementResponseSchema`（src/workspace-contract/workspace-contract.ts:698-715）只返回 `audio + audioByteLength`，不返回 transcript text。
- Renderer 的 `SegmentSupplementAudioPlayer`（src/renderer/src/workspace/MemoryStudio.tsx:570-895）只渲染播放行，没有转录区。
- Segment transcript tab 的 4 态 inline JSX 位于 MemoryStudio.tsx:1856-1883（loading / error / exists / empty）。
- `docs/current/frontend.md:105` 与 `docs/current/data.md:92` 当前明确写"不展示 transcript"、"不返回 transcript text"，必须同步更新。

## 范围

仅做"补充录音 panel 显示已有 transcript（只读）"。不包含：
- 任何转录编辑/重录/复制按钮。
- supplement 转录之外的内容（注释、标签、视频/图片占位等）。
- 任何 schema 之外的字段扩展。
- 不抽到 `components/ui`——`SegmentTranscriptView` 留在 `src/renderer/src/workspace/`，因为它绑定 Segment/Supplement transcript 数据形状，没有 design-system primitive 不变量。

## 设计

### 组件结构

新增 `src/renderer/src/workspace/SegmentTranscriptView.tsx`：

- Props：

  ```ts
  type SegmentTranscriptViewProps = {
    readonly status: 'loading' | 'error' | 'ready';
    readonly transcript: { readonly exists: boolean; readonly text: string } | null;
    readonly copy: {
      readonly loading: string;
      readonly error: string;
      readonly empty: string;
    };
  };
  ```

- 输出 4 态：loading → muted 文案；error → muted 文案；ready + exists → `<p class="select-text max-w-[820px] text-body leading-[1.78] text-foreground">{text}</p>`；ready + !exists → muted empty 文案。
- 不持有 scroll surface、不持有标题；调用方保留 `edge-fade-y scrollbar-hover` 滚动容器和 `reo-content-tab-panel-motion` 动效。

### 两个消费方

1. **Segment transcript tab**（src/renderer/src/workspace/MemoryStudio.tsx:1856-1883）
   把现有 4 态 inline JSX 替换为：

   ```tsx
   <SegmentTranscriptView
     status={segmentContentQuery.isLoading ? 'loading' : segmentContentQuery.isError ? 'error' : 'ready'}
     transcript={segmentContent?.transcript ?? null}
     copy={{
       loading: '正在载入片段内容。',
       error: '片段内容加载失败，请重试。',
       empty: '这段录音还没有转录。',
     }}
   />
   ```

2. **SegmentSupplement audio panel**（`SegmentSupplementAudioPlayer`，MemoryStudio.tsx:848-894）
   在播放行下方、`<audio>` 元素之前插入：

   ```tsx
   <SegmentTranscriptView
     status={supplementContentQuery.isLoading ? 'loading' : supplementContentQuery.isError ? 'error' : 'ready'}
     transcript={supplementContent?.transcript ?? null}
     copy={{
       loading: '正在载入补充录音内容。',
       error: '补充录音转录加载失败，请重试。',
       empty: '这段补充录音还没有转录。',
     }}
   />
   ```

   外部 `<article className="py-12">` 不变；TranscriptView wrapper 用 `mt-12` 与播放行间隔，不画分隔线，沿用同平面灰度。`补充录音加载失败。` 短提示（MemoryStudio.tsx:870-874）保留，因为它是 audio 行 inline error，与 TranscriptView 同步出现不冗余。

### 数据契约

`src/workspace-contract/workspace-contract.ts:698-715` 扩展 `workspaceReadFinalizedAudioSegmentSupplementResponseSchema.value`：

```ts
value: z.strictObject({
  requestId: z.string().min(1),
  workspaceId: z.string().min(1),
  memoryId: memoryIdSchema,
  segmentId: segmentIdSchema,
  supplementId: supplementIdSchema,
  audio: z.instanceof(Uint8Array),
  audioByteLength: z.number().int().nonnegative(),
  transcript: z.strictObject({
    exists: z.boolean(),
    text: z.string(),
  }),
});
```

字段顺序、命名与 `workspaceReadFinalizedAudioSegmentResponseSchema`（line 679-696）镜像。

### Main process

`src/main/recordingDrafts.ts`：

- 把现有 `readOptionalFinalizedTranscript`（line 1297-1334）通用化，提取一个内部 helper 接受 `{ markdownFileName, objectType }`：

  ```ts
  async function readOptionalFinalizedTranscriptFile(
    directory: string,
    directoryIdentity: DirectoryIdentity,
    markdownFileName: 'segment.md' | 'supplement.md',
    objectType: 'segment' | 'supplement',
  ): Promise<{ readonly exists: boolean; readonly text: string }>;
  ```

  `parseWorkspaceMarkdownObject` 和 `extractSegmentTranscript` 已分别支持 `objectType: 'supplement'` 与 supplement.md 正文，是直链复用，不重写。
- `readFinalizedAudioSegmentSupplementContent`（line 1425-1519）在拿到 audio bytes、最终 `assertSameDirectory` 之前调用该 helper 读取 `supplement.md`，将 `transcript` 加进返回值；保留现有 ENOENT → `{ exists: false, text: '' }` 兜底。
- `readFinalizedAudioSegmentContent`（line 1336-1423）改为通过同一 helper 调用，行为不变（segment.md/objectType='segment'）。

### Renderer query 与缓存

- `WorkspaceFinalizedAudioSegmentSupplementContent` 类型自动从 schema 推导得到 `transcript`。
- `segmentSupplementContentQueryOptions`（src/renderer/src/workspace/workspaceQueries.ts:194-242）逻辑不动；identity 校验已覆盖。
- `handleSegmentSupplementFinalized`（src/renderer/src/App.tsx:1554-1601）末尾追加：

  ```ts
  void queryClient.invalidateQueries({
    exact: true,
    queryKey: segmentSupplementContentQueryKey({
      workspaceId: activeWorkspaceSession.workspaceId,
      memoryId: finalized.memory.memoryId,
      segmentId: finalized.segment.segmentId,
      supplementId: finalized.supplement.supplementId,
    }),
  });
  ```

  对齐 `handleRecordingContentSaved`（App.tsx:3134-3141）的 segment 行为；同一 handler 同时服务 Recording overlay 路径（RecordingOverlay.tsx:2355）和 Recovery save 路径（App.tsx:1665），两者自动受益。

## 错误与边缘

- audio 已加载但 `transcript.exists=false`：TranscriptView 显示 empty 文案，不影响 audio 播放。
- query loading / error：audio 与 transcript 由同一 response 驱动，两者状态同步。
- supplement 切换、删除、`file-written-index-stale`、workspace 切换：现有 supplement content cache 清理逻辑（App.tsx:2613 / 2650 / 2705 / 2792）已覆盖，TranscriptView 是无副作用展示，不需新增。
- workspace handle 错配：response identity 校验（workspaceQueries.ts:227-234）已存在，View 无独立 handle 处理。

## 测试

- **`src/main/recordingDrafts.test.ts`**：新增覆盖 `readFinalizedAudioSegmentSupplementContent` 返回 `transcript: { exists: true, text }`（supplement.md 正文非空）、`{ exists: false, text: '' }`（正文空 / 文件缺失）；现有 audio 覆盖不变。
- **`src/workspace-contract/*` schema 测试**：补 supplement response schema 的 transcript 字段断言（若已有 supplement response schema 用例则就地扩展）。
- **新增 `src/renderer/src/workspace/SegmentTranscriptView.test.tsx`**：4 态文案、`max-w-[820px]`、`select-text` 类目。
- **`src/renderer/src/workspace/MemoryStudio.test.tsx`** 现有渲染测试：补 supplement active tab 下的 transcript 4 态断言；segment transcript tab 测试不改文案断言，仅确认 inline 替换为 TranscriptView 后渲染不变。
- **`src/renderer/src/App.test.tsx`**：`handleSegmentSupplementFinalized` 成功后 `segmentSupplementContentQueryKey` 被 invalidate。

## 文档同步

- `docs/current/frontend.md:105`：把"不展示 transcript"改成"在播放行下方显示该 supplement 的 transcript，使用与 Segment transcript 同一 feature-local `SegmentTranscriptView`，loading/error/empty/exists 四态文案按 supplement 语境写明"。
- `docs/current/data.md:92`：把"response 返回同 requestId、identity、audio bytes 和 audioByteLength，不返回 transcript text"更新为"返回 transcript text（exists+text）"；补一句"transcript save 成功后对应 supplement content Query 会被 invalidate"，对齐第 107 行 segment 描述。
- 其余 current 文档不动。

## 验证

- `npm run verify:quick`（CLAUDE.md 硬约束）。
- Dev server 内手动验证 4 态：empty / 有 transcript / 长 transcript（确认滚动复用 supplement panel 既有 `overflow-y-auto` surface）/ loading / error；截图存入 `verification.md` 与 `artifacts/`。

## 范围外

- 不引入转录编辑、重录、复制按钮、reflection 编辑。
- 不改 supplement 录音生命周期或恢复流程。
- 不改 supplement title / 重命名 / 删除 / 恢复行为。
- 不改 Segment transcript tab 行为，仅替换其渲染来源。

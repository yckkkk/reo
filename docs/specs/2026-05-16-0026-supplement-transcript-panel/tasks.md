# 补充录音转录区 — 执行清单

| 阶段                       | 状态   | 说明                                                                                                                                                |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract: 扩展 supplement read response schema | pending | `workspaceReadFinalizedAudioSegmentSupplementResponseSchema.value` 增加 `transcript: { exists, text }`，镜像 segment response。                       |
| Main: 通用化 transcript reader | pending | 抽出 `readOptionalFinalizedTranscriptFile({ markdownFileName, objectType })`，让 segment 与 supplement 共用；行为不变。                                  |
| Main: supplement read 返回 transcript | pending | `readFinalizedAudioSegmentSupplementContent` 在 audio 读取后调用 helper，把 transcript 加入返回；保留 ENOENT 兜底。                                      |
| Main TDD                   | pending | `src/main/recordingDrafts.test.ts` 覆盖 supplement read 的 transcript exists / empty / 缺失 三态；segment 既有覆盖不变。                                  |
| Renderer: 新组件 SegmentTranscriptView | pending | `src/renderer/src/workspace/SegmentTranscriptView.tsx`，4 态 + props 化文案，无内部 scroll surface。                                                |
| Renderer: 替换 Segment transcript tab | pending | MemoryStudio.tsx:1856-1883 inline JSX 改为调用 SegmentTranscriptView，传 Segment 文案。                                                                  |
| Renderer: supplement panel 接入 | pending | `SegmentSupplementAudioPlayer` 内播放行下方插入 SegmentTranscriptView，传 supplement 文案与 `mt-12` 节奏。                                              |
| Renderer: cache invalidate | pending | `handleSegmentSupplementFinalized`（App.tsx:1554-1601）末尾 invalidate exact supplementContentQueryKey。                                              |
| Renderer TDD               | pending | 新增 `SegmentTranscriptView.test.tsx`；MemoryStudio.test.tsx 补 supplement 转录 4 态；App.test.tsx 补 invalidate 断言。                                     |
| 文档同步                   | pending | 更新 `docs/current/frontend.md:105` 与 `docs/current/data.md:92` 为当前事实。                                                                       |
| 验证                       | pending | 运行 `npm run verify:quick`；dev server 验证 4 态视觉；截图与命令输出存入 `verification.md` 与 `artifacts/`。                                       |
| 收口                       | pending | 全部验证通过后归档 spec；本次新事实压缩回 `frontend.md` / `data.md`，不在 archive 之外留历史叙述。                                                   |

## 不在范围

- 不引入转录编辑、重录、复制按钮或 reflection 编辑。
- 不改补充录音录制 / 暂停 / 恢复 / 删除 / 重命名行为。
- 不改 Segment transcript tab 行为，仅替换渲染来源。

# 追踪矩阵

| 要求                        | 设计产物                             | 数据/协议产物                              | 验证证据                                      | 状态                                       |
| --------------------------- | ------------------------------------ | ------------------------------------------ | --------------------------------------------- | ------------------------------------------ |
| PR-001 非玩具化交付         | `ui-blueprint.md` 当前范围高保真章节 | `architecture-views.md`                    | reference 截图、RTL、运行时验证               | 已转交 implementation plan 和后续 UI tasks |
| PR-002 文件真源             | `data-contracts.md`                  | `filesystem-transactions.md`               | 文件 hash、reopen、rebuild、transaction tests | 任务 1 执行中收口                          |
| PR-003 录音闭环             | Record Audio Drawer                  | `protocol-contracts.md` recording channels | recording lifecycle RED/GREEN 和 Computer Use | 后续 recording capability tasks            |
| PR-004 不显示未实现能力     | future wireframes                    | capability gating                          | forbidden capability tests                    | 任务 1/后续 renderer 任务 持续验证         |
| PR-005 全参考图映射         | `reference-map.md`                   | 不适用                                     | visual comparison evidence                    | 后续 UI/reference verification             |
| UX-001 当前范围高保真       | `ui-blueprint.md`                    | 不适用                                     | desktop/mobile screenshots                    | 后续 UI tasks                              |
| UX-002 非当前范围 wireframe | `ui-blueprint.md` future sections    | future activation gates                    | docs review                                   | 已纳入 implementation plan                 |
| UX-003 Reo design system    | `ui-blueprint.md` token rules        | 不适用                                     | token audit、无 emoji、lucide icon check      | 后续 UI tasks                              |
| UX-004 录音视觉             | Record Audio Drawer                  | MediaRecorder、waveform adapter            | waveform cleanup 和 reference 对照            | 后续 recording UI task                     |
| UX-005 组件可复用           | `reuse-decisions.md`                 | `architecture-views.md`                    | component tests                               | 后续 UI system tasks                       |
| UX-006 Practical UI         | `external-research.md`               | 不适用                                     | accessibility matrix                          | 已纳入 UI acceptance gates                 |
| OS-001 开源优先             | `reuse-decisions.md`                 | 不适用                                     | review checks                                 | 已纳入 plan/review gate                    |
| OS-002 自研最后             | `reuse-decisions.md`                 | 不适用                                     | reviewer BLOCKER gate                         | 已纳入 plan/review gate                    |
| OS-003 ElevenLabs UI        | `reuse-decisions.md`                 | recording UI adapter                       | waveform、voice、audio tests                  | 后续 recording UI task                     |
| OS-004 Drawer/Vaul          | `reuse-decisions.md`                 | close/cancel rules                         | focus、escape、drag tests                     | 后续 drawer task                           |
| OS-005 wavesurfer 评估      | `external-research.md`               | future playback contract                   | long audio/scrubber spike                     | 后续 playback task 触发时执行              |
| DA-001 概念模型             | `data-contracts.md`                  | 不适用                                     | schema review                                 | 任务 1 执行中收口                          |
| DA-002 DB schema gate       | `data-contracts.md`                  | Drizzle migration plan                     | migration tests                               | DB activation task 触发时执行              |
| DA-003 数据获取             | `data-contracts.md`                  | Query key protocol                         | query invalidation tests                      | 任务 1/后续 renderer data 任务             |
| DA-004 文件夹结构           | `filesystem-transactions.md`         | path containment                           | file transaction tests                        | 任务 1 执行中收口                          |
| DA-005 错误处理             | `state-machines.md`                  | error envelopes                            | failure-state tests                           | 任务 1/后续 IPC tasks                      |
| EL-001 Renderer 边界        | 不适用                               | `protocol-contracts.md`                    | restricted import、preload tests              | 任务 1 持续验证                            |
| EL-002 禁止 generic bridge  | `code-simplicity.md`                 | explicit channels only                     | code review                                   | 任务 1 持续验证                            |
| EL-003 权限                 | `security-threat-model.md`           | Electron permission policy                 | runtime permission test                       | recording runtime task                     |
| EL-004 本地文件边界         | 不适用                               | `filesystem-transactions.md`               | containment、lock tests                       | 任务 1 执行中收口                          |
| EL-005 可观测性隐私         | 不适用                               | `security-threat-model.md`                 | redaction、retention review                   | logging/observability task                 |
| QA-001 真实 TDD             | `qa-matrix.md`                       | 不适用                                     | RED/GREEN/REFACTOR logs                       | 每个 implementation task 必填              |
| QA-002 UI reference         | `reference-map.md`                   | 不适用                                     | screenshot comparison                         | UI tasks 必填                              |
| QA-003 运行时操作           | `qa-matrix.md`                       | 不适用                                     | Computer Use evidence                         | runtime tasks 必填                         |
| QA-004 审查门禁             | `review.md`                          | 不适用                                     | 无未解决 BLOCKER/MAJOR                        | 已通过 design、plan、任务 1 持续复审       |
| QA-005 静态验证             | `verification.md`                    | 不适用                                     | verify:quick、diff、spec-dir checks           | 每个 implementation task 必填              |

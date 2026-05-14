# 商业化基础设施长期任务

## 状态

- 状态：active
- 类型：商业化横切长期轨道
- 当前阶段：AI 产品经理求职路线与商业化基础设施规划

## 并行规则

本 initiative 可以与一个产品或代码开发 active initiative 并行，不计入默认单 active initiative 限额。

并行只作用于 initiative 层级。每个 session 仍然只推进一个可验证 spec 工作单元；涉及 runtime、auth、database、logging、packaging、payment、telemetry 或 provider surface 的实现仍必须创建对应 spec，并按 `docs/current/*` 门禁更新当前真源。

## 目标

Reo 面向公众付费发布时，建立账号、会员、支付、AI Gateway、火山引擎消费治理、云资源、域名、SEO、遥测、后台和合规基础设施。

商业化基础设施不能破坏 Reo 的本地优先模型。用户记忆内容真源仍是本地记忆空间文件夹；云端只拥有账号身份、会员权益、支付订单、用量账本、服务端 AI 调用、运营遥测和公开站点。

短期目标是让 Reo 成为 AI 产品经理求职作品集项目，增长产品经理能力作为副线展示。商业化基础设施只实现能增强作品集可信度和后续公开发布确定性的部分，其余保留为 public release gate。

## 当前约束

- 当前 Reo 已有豆包语音 ASR main-process 接入。
- 当前没有 auth、database、logging、Sentry、packaging、updater、payment 或 public release surface。
- 公开付费发布前，客户端不得直连付费模型服务或持有生产 provider secret。
- 火山引擎密钥、短信密钥、支付密钥和后台管理密钥只能存在服务端密钥边界。
- SEO 只作用于官网、下载页、价格页、帮助中心、文档和更新日志；Electron app 本体不作为 SEO surface。
- 遥测默认最小化，必须有脱敏、采样、保留周期、用户可理解说明和关闭策略。

## 能力域

1. 账号身份：内部 `user_id`、手机号、微信、邮箱、设备、session、账号合并、登录风控。
2. 会员权益：plan、subscription、entitlement、credit ledger、试用、赠送、过期、退款。
3. AI Gateway：鉴权、权益判断、额度预扣、provider 调用、实际结算、失败恢复、熔断。
4. 火山引擎消费治理：项目/标签、调用量、账单、预算、成本对账、异常高消耗用户识别。
5. 支付与账本：订单、支付回调、退款、发票、加量包、收入与成本对账。
6. 云资源与域名：阿里云账号治理、ECS/容器、RDS、Redis、OSS、CDN、SSL、备案、日志与监控。
7. 遥测与 SEO：公开站点 SEO、产品事件、AI 成本事件、崩溃/错误、链路追踪。
8. 运营后台：用户、会员、用量、成本、风控、遥测、内容、权限、审计。
9. 合规隐私：隐私政策、用户协议、手机号授权、微信绑定说明、注销、导出、删除、日志脱敏。

## 读取入口

- `career-roadmap.md`：AI 产品经理主线、增长产品经理副线、作品集交付物和阶段路线。
- `interview-readiness.md`：求职 ROI 准则、最小作品集、内测运营、2/4/8 周路线和风险修正。
- `product-thesis.md`：Reo 的产品创新主张，包括 agent-ready memory space、Codex-style 创作、设计系统约束 HTML 和功能更新纪律。
- `role-evolution.md`：AI-native PM、FDE、增长和工程协作能力变化，以及 Reo 的能力映射。
- `plan.md`：商业化基础设施架构、阶段和数据模型草案。
- `reuse-evaluation.md`：成熟开源方案复用评估。
- `tasks.md`：长期里程碑。

## 非目标

- 不在本 initiative 中直接安装依赖或改 runtime。
- 不把 agent、skills、plugins 或生成式 AI surface 写成已完成实现；只有代码和 `docs/current/*` 已确认的能力才能作为当前产品事实。
- 不把 Electron renderer 变成 provider client。
- 不把火山引擎账单当作实时权益判断真源。
- 不以单个 SaaS boilerplate 替代 Reo 当前架构。
- 不为尚未上线的能力创建空 IPC、空 DB schema、空后台页面或空遥测事件。

## 完成条件

- 完成 AI 产品经理求职作品集路线图，并明确增长产品经理副线的展示边界。
- 完成 Reo 产品创新主张，明确记录平台、agent-ready memory space、Codex-style 创作和设计系统约束 artifact 的关系。
- 选定商业化基础设施的复用优先方案和拒绝原因。
- 完成账号、会员、用量、支付、云资源、遥测、后台和合规的边界设计。
- 明确公开付费发布前必须完成的合规、备案、支付、打包、更新和运维门禁。
- 每个能力域都有可拆分 spec 的阶段顺序、验证方式和阻断条件。
- 长期稳定结论压缩回 `docs/current/*` 或 `docs/decisions/*`，任务证据留在 specs/archive。

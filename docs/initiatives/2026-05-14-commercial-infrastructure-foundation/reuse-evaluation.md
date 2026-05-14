# 开源复用评估

## 结论

没有发现一个可以直接覆盖 Reo 公开付费发布的单体开源方案。最佳方向是组合成熟开源模块，并保持 Reo 自己的产品边界：

- SaaS starter 作为官网、后台、订阅和工程组织参考。
- 身份服务优先评估 Logto、Casdoor、Better Auth。
- AI 用量和额度优先评估 OpenMeter。
- 复杂 billing/invoicing 评估 Lago 或 Kill Bill，但不进入第一版默认路径。
- 未来 LLM Gateway 评估 LiteLLM；当前豆包语音 ASR 需要 Reo 服务端 adapter。
- AI 观测评估 Langfuse；产品遥测评估 PostHog。
- 后台 UI 评估 Refine、react-admin、AdminJS、Appsmith 或 Lowcoder。

## 候选矩阵

| 方向          | 候选                                         | 适合 Reo 的部分                                                                                  | 风险                                                                       |
| ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| SaaS starter  | `ixartz/SaaS-Boilerplate`                    | Next.js、Better Auth、Drizzle、Stripe、shadcn/ui、i18n、dashboard 结构                           | 默认 Web SaaS 和 Stripe；手机号、微信、阿里云和 Electron callback 需要重做 |
| SaaS starter  | `wasp-lang/open-saas`                        | React、Node、Prisma、payments、admin、AI 示例完整                                                | 引入 Wasp 平台约束，和 Reo 当前工程栈距离较大                              |
| SaaS starter  | `boxyhq/saas-starter-kit`                    | Enterprise SaaS、SSO、audit、team/tenant 思路                                                    | 企业复杂度偏重，个人会员第一版不宜照搬                                     |
| 身份          | Better Auth                                  | Reo 已选技术路线，Electron plugin 贴近桌面授权流                                                 | 手机号、微信和账号合并需要服务端设计                                       |
| 身份          | Logto OSS                                    | Aliyun SMS、WeChat、Alipay connector，用户管理和组织能力完整                                     | 需要确认 Electron OIDC callback、部署复杂度和 self-host 许可边界           |
| 身份          | Casdoor                                      | WeChat、SMS、OIDC、SAML、RBAC、audit、SaaS 管理覆盖广                                            | Go 服务体量较重，AI/MCP 与 auth 边界需要收窄                               |
| 计量          | OpenMeter                                    | AI/API metering、entitlements、prepaid credits、usage limits、LLM cost tracking                  | 需要和 Reo credit ledger、支付 provider、火山 ASR 成本单位对齐             |
| 计费          | Lago                                         | usage billing、subscription、entitlements、invoice、payment orchestration                        | AGPL、默认遥测和运维复杂度需要评估                                         |
| 计费          | Kill Bill                                    | 订阅、支付、插件、账务和企业级扩展强                                                             | 第一版过重，Java 平台和运维成本高                                          |
| AI Gateway    | LiteLLM                                      | LLM provider routing、virtual keys、budget、rate limits、spend tracking                          | 当前豆包语音 ASR WebSocket 不能直接套用 OpenAI-compatible proxy            |
| AI 观测       | Langfuse                                     | LLM trace、prompt、eval、token/cost tracking                                                     | 只做观测，不做扣费真源                                                     |
| 产品遥测      | PostHog                                      | product/web analytics、feature flags、session replay、experiments、error tracking、LLM analytics | Electron 隐私、采样和 self-host 成本要单独设计                             |
| Web analytics | Umami/Plausible/Matomo                       | 官网 SEO 和轻量 web analytics                                                                    | 不覆盖产品行为、成本治理和 AI trace                                        |
| 后台          | Refine/react-admin/AdminJS/Appsmith/Lowcoder | 快速构建用户、会员、用量、成本、风控、审计页面                                                   | 后台权限和审计不能依赖低代码工具默认实现                                   |

## 首选组合假设

Phase 0 先验证以下组合，不把它们写成最终决定：

```text
Identity: Better Auth vs Logto vs Casdoor
Metering/entitlement: OpenMeter
Billing/invoice: Reo ledger first, Lago/Kill Bill later
LLM gateway: LiteLLM for future LLM only
ASR gateway: Reo provider adapter for Doubao Speech
LLM observability: Langfuse
Product analytics: PostHog or lighter web analytics split
Admin UI: Refine/react-admin-style custom admin
```

## 需要实测的问题

- Electron system-browser auth 能否与候选身份服务稳定完成 callback、session refresh 和 sign-out。
- 微信开放平台网站应用或桌面扫码登录是否满足 Reo 分发形态。
- 手机号登录是否直接用 Aliyun SMS connector，还是由 Reo backend 控制验证码风控。
- OpenMeter 的实时 quota 与 Reo 自己的 credit ledger 是否会产生双真源。
- 豆包语音 ASR 的秒级/时长计费、连接重试和补转写能否进入同一 usage ledger。
- LiteLLM 对火山方舟模型支持度、token/cost 返回、streaming 和错误映射是否足够。
- PostHog self-host 与中国用户数据、隐私政策和采样策略是否匹配。
- 公开付费发布需要的支付、发票、退款和税务能力是否足以由第一版账本表达。

## 官方来源

- https://github.com/ixartz/SaaS-Boilerplate
- https://github.com/wasp-lang/open-saas
- https://github.com/boxyhq/saas-starter-kit
- https://github.com/logto-io/logto
- https://docs.logto.io/connectors/sms-connectors
- https://docs.logto.io/logto-oss/develop-your-connector
- https://github.com/casdoor/casdoor
- https://casdoor.ai/
- https://github.com/openmeterio/openmeter
- https://github.com/getlago/lago
- https://github.com/killbill/killbill
- https://github.com/BerriAI/litellm
- https://docs.litellm.ai/
- https://github.com/langfuse/langfuse
- https://langfuse.com/docs/observability/features/token-and-cost-tracking
- https://github.com/PostHog/posthog

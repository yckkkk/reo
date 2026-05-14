# 商业化基础设施计划

## 设计原则

- Reo 是本地优先 Electron 产品，不是纯 Web SaaS。
- 公开付费能力通过服务端边界提供，客户端只持有受限 session 和短生命周期 capability。
- 会员判断、额度扣减、provider secret、支付回调、成本对账和风控都在服务端。
- 先评估成熟开源方案，再决定适配、薄集成、组合或自研。
- 当前豆包语音 ASR 和未来火山方舟/其他 LLM 能力分开建模，不混用计费单位。

## 目标架构

```text
Electron app
  -> system browser auth
  -> Reo backend API
      -> identity service
      -> entitlement service
      -> AI Gateway
          -> Doubao Speech ASR adapter
          -> future LLM provider adapters
      -> usage ledger
      -> credit ledger
      -> payment/order service
      -> admin API
      -> telemetry ingest

Public web
  -> www / pricing / download / docs / help / changelog
  -> SEO analytics

Ops
  -> logs / traces / metrics / alerts / audit
  -> cloud resource and provider billing reconciliation
```

## 开源复用方向

### SaaS starter

SaaS starter 只能作为官网、后台、订阅流和工程组织参考，不能直接替代 Reo backend。

- `ixartz/SaaS-Boilerplate`：Next.js、Better Auth、Stripe、Drizzle、PostgreSQL、shadcn/ui 方向与 Reo 前端技术栈接近，适合作为 Web 商业层结构参考。
- `wasp-lang/open-saas`：React、Node、Prisma、支付、AI 示例和 admin dashboard 较完整，适合作为从零 SaaS 结构参考，但引入 Wasp 框架会形成新平台约束。
- `boxyhq/saas-starter-kit`：企业 SaaS、SAML/SCIM/audit/payments 思路成熟，适合作为团队版和企业后台参考；第一版个人会员不应直接采用其企业复杂度。

### 身份与登录

候选必须覆盖 Electron 授权码/PKCE、手机号验证码、微信登录、账号合并、设备绑定和后台管理。

- Better Auth + Electron plugin：贴近 Reo TypeScript 技术路线，适合轻量自管 auth；手机号和微信需要补服务端适配与审核流程。
- Logto OSS：提供用户管理、组织、多应用、Aliyun SMS、WeChat、Alipay 等 connector 方向；适合作为公共身份服务候选。
- Casdoor：支持 OIDC/OAuth/SAML、WeChat、SMS、RBAC、audit 和 SaaS 管理；中国生态覆盖更强，但服务体量和产品边界更重。
- Keycloak/ZITADEL：企业 IAM 成熟，但手机号、微信和中国消费者登录适配成本较高，优先级低于 Logto/Casdoor。

### 用量计量、会员与账单

Reo 必须保留自己的用户可理解 credit ledger 和 provider 成本 ledger。开源 billing 系统只能接管可验证的子边界。

- OpenMeter：面向 AI/API/DevOps 的 usage metering、limits、entitlements、prepaid credits 和 LLM cost tracking，最贴近 AI 点数和额度治理。
- Lago：usage metering、subscription、entitlements、invoicing、payment orchestration、revenue analytics 完整，适合较完整的计费平台评估；AGPL 许可和默认遥测需要纳入风险。
- Kill Bill：订阅、支付、插件和复杂账务能力强，适合更成熟阶段；第一版会增加明显运维和模型复杂度。

### AI Gateway 与 AI 可观测性

- 当前豆包语音 ASR 使用 WebSocket 协议，不能默认交给 OpenAI-compatible LLM proxy。
- LiteLLM 适合未来 LLM Gateway，具备 provider routing、virtual keys、budget、rate limit、spend tracking 和 dashboard。
- Langfuse 适合 LLM trace、prompt、eval、token/cost observability，不作为会员扣费真源。
- Apache APISIX、Kong 或 NGINX 只处理 API gateway、TLS、路由、限流和基础访问控制，不承载 AI 业务权益。

### 产品遥测与 SEO

- PostHog 是产品行为、web analytics、feature flag、session replay、experiments、error tracking 和 LLM analytics 的一体化候选。
- Umami、Plausible 或 Matomo 适合公开官网 SEO/web analytics 的轻量替代。
- Sentry Electron 与 `electron-log` 仍适合客户端 crash/error 和本地诊断，不能被产品分析工具替代。
- OpenTelemetry 用于串联 Electron、backend、AI Gateway、provider call、ledger write 和 admin action 的 trace id。

### 运营后台

- Refine、react-admin、AdminJS、Appsmith 或 Lowcoder 可作为后台 UI 复用候选。
- 第一版后台可以先服务用户、会员、用量、成本、风控和审计；SEO 内容管理不进入第一批后台，优先使用静态内容和 git-reviewed docs。

## 推荐首轮路线

### Phase 0：商业化架构选择

输出：

- 账号、会员、AI Gateway、计量、支付、遥测、后台、合规的边界图。
- 开源候选评估表：功能覆盖、Electron 适配、手机号/微信、阿里云部署、火山引擎适配、许可、运维成本、退出路径。
- 第一版套餐和 credit 单位草案。
- public paid release gate 清单。

### Phase 1：云与合规预备

输出：

- 域名与子域规划：`www`、`api`、`auth`、`admin`、`download`、`telemetry`、`status`。
- 阿里云资源草案：ECS/容器、RDS、Redis、OSS、CDN、SSL、SLS、CloudMonitor、ActionTrail、RAM。
- ICP 备案、公安联网备案、支付商户、短信签名模板、微信开放平台审核材料清单。
- 密钥管理、环境隔离、最小权限和审计策略。

### Phase 2：身份服务

输出：

- Electron system-browser auth flow。
- 手机号验证码登录、微信扫码登录、账号绑定、账号合并、设备绑定、session refresh/revoke。
- 登录事件、风险事件、后台冻结和恢复。

### Phase 3：会员权益与 credit ledger

输出：

- Free、VIP、Pro 的最小套餐。
- entitlement snapshot。
- credit account 与 append-only credit ledger。
- 额度发放、扣减、退款、过期、赠送和人工调整。

### Phase 4：AI Gateway 与火山消费治理

输出：

- 豆包语音 ASR server-side adapter。
- 未来 LLM Gateway 的 provider abstraction 和 LiteLLM 适配判断。
- 额度预扣、实际结算、失败回滚、provider error mapping、熔断、重试上限。
- usage events、provider cost events、每日对账和预算告警。

### Phase 5：支付、订单和后台

输出：

- 支付 provider 选择。
- 订单、支付回调、退款、发票、加量包、续费和到期。
- 用户、会员、用量、成本、风控、审计后台。

### Phase 6：公开发布与运营

输出：

- 官网、价格页、下载页、帮助中心、隐私政策、用户协议、更新日志、sitemap、robots。
- Electron packaging、signing/notarization、updater、download delivery 和 release channel。
- 产品遥测、错误监控、成本看板、转化漏斗和告警。

## 数据模型草案

这些是概念实体，不是当前 DB schema。

- `users`
- `user_identities`
- `devices`
- `auth_sessions`
- `login_events`
- `risk_events`
- `plans`
- `subscriptions`
- `entitlements`
- `credit_accounts`
- `credit_ledger_entries`
- `ai_requests`
- `usage_events`
- `provider_cost_events`
- `orders`
- `payments`
- `refunds`
- `admin_users`
- `admin_audit_logs`
- `telemetry_events`

## 第一版不采用的方向

- 不把当前 Electron app 改成 Web-first SaaS。
- 不把 Stripe 默认作为中国公开付费首选；支付 provider 需要结合主体、地区、税务和应用分发确认。
- 不直接采用单个 all-in-one starter 作为 Reo 真源。
- 不在客户端保存 production provider key。
- 不把 Langfuse、PostHog 或火山账单当作会员扣费真源。
- 不在第一版后台建设完整 CMS。

# Memory Cover Protocol Optimization

- Started: 2026-06-02 05:18 PDT
- Completed: 2026-06-02
- Type: implementation
- Scope: main-process image file helper reuse, Memory cover protocol cache policy, async cover protocol reads, lightweight performance guard

## Goal

收敛 Memory cover 与 note attachment 的图片 payload 读取规则，并降低 MemoryRail 批量自定义封面加载时的 main process 同步 IO 与重复读取成本。

## Context

- Electron 官方 `protocol.handle` 支持返回 `Promise<Response>`，handler 可直接设置 `Content-Type` 和 `Cache-Control` headers。
- Node 官方 `fs/promises` `FileHandle` 支持 async `stat`、`readFile` 和 `close`，可替代 main process protocol handler 中的同步整文件读取。
- Reo 当前 `reo-attachment:` 只作为 renderer `img-src` 协议。Note attachment 没有 content version，继续使用 `no-store`；Memory cover URL 已包含 `?v=<mtimeNs-size>`，可以对自定义 cover 使用 versioned cache header。

## Design

- 新增 main-local image payload helper，表达共享不变量：safe filename extension、ordinary file、size cap、mime type 和 async bytes read。它不创建跨进程 shared runtime，不改变 workspace contract。
- Note attachment 与 Memory cover 继续分别拥有目录 identity、entity ownership 和错误语义；helper 只处理已经验证目录内的图片 leaf。
- Memory cover protocol response 在成功读取自定义 cover 时返回 immutable versioned cache header；note attachment response 继续 `Cache-Control: no-store`。
- Memory cover bytes read 使用 async FileHandle read。Projection 仍只返回 `source`、`filename` 和 `version`，不返回 raw path。

## Success Criteria

- Memory cover 与 note attachment 支持的图片 extension / MIME 规则来自同一个 helper。
- 自定义 cover response 带 `Cache-Control: max-age=31536000, immutable`。
- Note attachment response 仍带 `Cache-Control: no-store`。
- Cover protocol bytes read 不再使用 synchronous `readFileSync` / `fstatSync` path。
- 轻量性能测试证明多个 cover read 可以并发进入 async read gate，不被一个同步 read 串行阻塞。

## Verification

- RED: `MAIN_TEST_FILES="test/main/appProtocol.test.ts,test/main/memoryCovers.test.ts" npm run test:main` failed because `src/main/imagePayloads.js` did not exist and cache policy/helper assertions were not implemented.
- GREEN: `MAIN_TEST_FILES="test/main/appProtocol.test.ts,test/main/memoryCovers.test.ts,test/main/noteAttachments.test.ts" npm run test:main` passed.
- `MAIN_TEST_FILES="test/main/appProtocol.test.ts,test/main/memoryCovers.test.ts,test/main/noteAttachments.test.ts" npm run test:main`
- `npm run verify:quick`

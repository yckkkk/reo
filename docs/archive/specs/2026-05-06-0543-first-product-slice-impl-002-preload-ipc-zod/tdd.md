# TDD 证据

## RED

命令：`npm run test:main`

结果：失败，符合预期。

关键输出：

```text
test/main/trustedSender.test.ts(6,8): error TS2307: Cannot find module '../../src/main/trustedSender.js' or its corresponding type declarations.
test/main/workspaceBridgeSurface.test.ts(3,39): error TS2307: Cannot find module '../../src/preload/workspaceBridge.js' or its corresponding type declarations.
test/main/workspaceContract.test.ts(10,8): error TS2307: Cannot find module '../../src/main/workspaceContract.js' or its corresponding type declarations.
test/main/workspaceSelectionTokens.test.ts(3,52): error TS2307: Cannot find module '../../src/main/workspaceSelectionTokens.js' or its corresponding type declarations.
```

## GREEN

命令：`npm run test:main`

结果：通过。

关键输出：

```text
✔ renderer source cannot import Node or Electron modules
✔ trusted sender accepts main frame from trusted app url and expected session
✔ workspace preload bridge exposes only chooseDirectory and no generic ipc methods
✔ workspace contract exposes only the explicit chooseDirectory channel
✔ selection token is returned without rootPath and is consumed once
ℹ tests 15
ℹ pass 15
ℹ fail 0
```

命令：`npm run lint`

结果：通过。

命令：`npm run typecheck`

结果：通过。

命令：`npm run build`

结果：通过，生成 main、preload、renderer build output。

Runtime 验证暴露缺陷：

```text
"preloadSurface": {
  "hasChooseDirectory": false,
  "hasInvoke": false,
  "hasSend": false
}
```

新增 RED 命令：`npm run test:main`

结果：失败，符合预期。

关键输出：

```text
test/main/preloadPath.test.ts(5,36): error TS2307: Cannot find module '../../src/main/preloadPath.js'
```

实现 `resolvePreloadPath()` 后再次 runtime 验证仍失败，原因是 sandbox preload bundle 引入了 Zod-backed contract，带入普通 package。

新增 RED 命令：`npm run test:main`

结果：失败，符合预期。

关键输出：

```text
✖ preload source does not import Zod-backed contracts or regular Node packages
AssertionError [ERR_ASSERTION]: src/preload/workspaceBridge.ts
```

修复：

- preload build 输出锁定为 sandbox-compatible `out/preload/index.cjs`。
- `workspaceChannels.ts` 承载无 Zod channel 常量。
- preload bridge 不再导入 Zod-backed contract，运行时只暴露窄方法并调用显式 channel。

修复后命令：`npm run test:main`

结果：通过，main/preload tests 17/17 passed。

命令：`npm run verify:quick`

结果：测试通过，但 format check 失败，进入 REFACTOR 格式修复。

关键输出：

```text
Test Files  1 passed (1)
Tests  1 passed (1)
[warn] Code style issues found in 18 files. Run Prettier with --write to fix.
```

## REFACTOR

命令：`npm run build`

结果：通过，preload output 为 `out/preload/index.cjs`。

Runtime 验证结果：

```json
{
  "productionUrl": "reo-app://renderer/index.html",
  "preloadSurface": {
    "hasChooseDirectory": true,
    "hasInvoke": false,
    "hasSend": false
  },
  "windowOpenDenied": true,
  "externalNavigationDenied": {
    "before": "reo-app://renderer/index.html",
    "after": "reo-app://renderer/index.html"
  },
  "videoPermissionDenied": {
    "granted": false,
    "name": "NotAllowedError"
  }
}
```

# Packaging Update Foundation

## 状态

Archived spec。

## 时间

2026-05-05 22:55 America/Los_Angeles。

## 目标

判断 Reo 当前是否已经具备引入 Electron Forge、packaging config、fuses、ASAR、signing、notarization 或 `electron-updater` 的真实 release pipeline 条件。

## 结论

当前不引入 packaging 或 updater package/config。

原因：

- 当前没有 app identity、app bundle id、artifact naming 或 release channel。
- 当前没有 makers、platform target、icon、ASAR/fuse policy、signing/notarization credentials 或 publish target。
- 当前没有 packaged app launch verification harness。
- 当前没有 release metadata、update feed、published artifacts 或 installed-app update test path。
- 当前没有 logging/error owner；updater lifecycle 需要可诊断 failure path。

因此本 slice 只记录 packaging/update 启用顺序和验收门槛，不安装 Forge、`electron-updater` 或 `@electron/fuses`，不新增 packaging scripts，不创建 updater runtime。

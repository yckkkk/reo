# 规格

## 当前事实

- HEAD：`d2201fc docs: define logging error gate`。
- 工作区起始干净。
- `docs/specs` 起始为空。
- 当前 `package.json` 的 Electron entry 是 `./out/main/index.js`。
- 当前 dev/build authority 是 `electron-vite`，不是 Electron Forge。
- 当前没有 Forge config、makers、publishers、buildIdentifier 或 Forge Vite plugin。
- 当前没有 `electron-updater`、Electron built-in updater integration 或 updater lifecycle。
- 当前没有 `@electron/fuses`、ASAR policy、signing、notarization 或 packaged artifact output policy。
- 当前没有 app bundle id、installer identity、release channel、publish provider、update feed 或 generated update metadata。
- 当前没有 packaged app launch verification command。

## 官方资料核对

Context7：

- Electron Forge：`/electron-forge/electron-forge-docs`。
- electron-updater / electron-builder：`/electron-userland/electron-builder`。
- Electron：`/electron/electron`。

官方文档：

- Electron Forge configuration：`https://www.electronforge.io/config/configuration`。
- Electron Forge makers：`https://www.electronforge.io/config/makers`。
- Electron fuses：`https://www.electronjs.org/docs/latest/tutorial/fuses`。
- Electron code signing：`https://www.electronjs.org/docs/latest/tutorial/code-signing`。
- electron-builder auto update：`https://www.electron.build/auto-update.html`。
- electron-builder publish：`https://www.electron.build/publish.html`。

核对结论：

- Forge config 是 packaging/distribution pipeline，包含 `packagerConfig`、makers、publishers、plugins、hooks 和 build identifier。
- Forge makers 从 packaged app 生成平台 distributables；不是单纯 build command。
- Electron fuses 在 package time、code signing 前 flip；ASAR integrity 和 only-load-from-ASAR 需要 packaged artifact。
- macOS release 需要 code signing 和 notarization；Windows release 需要 code signing strategy。
- `electron-updater` 依赖 publish configuration、release metadata、packaged artifacts 和 update feed；macOS auto update 需要 signed app。
- update UI 可以在 dev mode 模拟，但官方更推荐 installed application update test；当前 Reo 没有 updater UI 或 product flow。

## 判断

本 slice 不新增 Forge、fuses、ASAR、signing、notarization、packaging scripts 或 updater runtime。

理由：

- 缺少 release identity 与 platform target，无法判断 maker 和 artifact naming。
- 缺少 signing/notarization/publish provider，无法定义真实 distribution pipeline。
- 缺少 packaged app verification harness，安装 Forge 只会制造未验证配置。
- 缺少 update feed 和 release metadata，初始化 `electron-updater` 会制造无效 background network/update flow。
- 缺少 logging/error owner，updater failure 无法被诊断或恢复。

## 成功标准

- `docs/current/electron.md` 写清 Forge/updater/fuses/signing/notarization 的启用顺序。
- `docs/current/quality.md` 写清 packaging/update 的 verification gate。
- `docs/current/flow.md` 写清 release/update lifecycle 必须先建模。
- 不新增 Forge、`electron-updater`、`@electron/fuses` 或 maker dependencies。
- 不新增 Forge config、packaging scripts、updater source、publish config、ASAR/fuse config 或 signing config。
- 不修改 runtime code。
- `npm run verify:quick` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- docs lifecycle checks 通过。
- 多轮 subagent review 和 Claude CLI review 通过。

## 非目标

- 不创建 unsigned local package pipeline。
- 不创建 updater UI 或 update polling。
- 不创建 dev update feed。
- 不创建 release workflow、CI workflow 或 publisher。
- 不选择 app store / direct download / GitHub / S3 / generic server。
- 不处理 icon、installer UX 或 platform branding。

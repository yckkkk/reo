# Foundation Decisions

## Tech stack

Reo first product slice uses the project stack direction:

- React 19 + TypeScript
- Vite via `electron-vite`
- Tailwind CSS v4
- shadcn/ui + Radix primitives
- Zustand + TanStack Query
- React Hook Form + Zod
- Better Auth Electron plugin
- Drizzle ORM + `better-sqlite3`
- `electron-updater`
- `date-fns`
- Sentry + `electron-log`
- Electron Forge
- Vitest

## Activation gate

| Stack item               | Current status       | Activation rule                                      |
| ------------------------ | -------------------- | ---------------------------------------------------- |
| React 19 + TypeScript    | active               | Continue                                             |
| electron-vite            | active               | Continue until packaging slice                       |
| Tailwind CSS v4          | active               | Continue                                             |
| shadcn/ui + Radix        | active partial       | Add exact source components only with consumer/tests |
| Zustand                  | selected, not active | Activate for cross-subtree client state              |
| TanStack Query           | active               | Expand for main-backed data                          |
| RHF + Zod                | active               | Continue for forms/boundaries                        |
| Better Auth Electron     | selected, not active | Auth/session slice only                              |
| Drizzle + better-sqlite3 | selected, not active | DB/index/job/auth slice only                         |
| electron-updater         | selected, not active | Packaged signed app + publish metadata only          |
| date-fns                 | selected, not active | Activate for visible date formatting                 |
| Sentry + electron-log    | selected, not active | Diagnostics/privacy slice only                       |
| Electron Forge           | selected, not active | Packaging slice only                                 |
| Vitest                   | active               | Continue for renderer behavior                       |

## Decisions

- Product-grade UI requires app shell/sidebar now; previous “no full sidebar first slice” decision is superseded.
- Recording drawer requires shadcn Drawer/Vaul evaluation and likely adoption; previous “Radix Dialog only” decision is superseded.
- Recording waveform requires ElevenLabs UI source adoption or documented adaptation failure; previous “lightweight bars” decision is superseded.
- wavesurfer.js remains a serious candidate for long audio playback/scrubber/regions, not a generic deferred afterthought.
- DB design must be written now; migration only activates when implementation plan proves need.
- Better Auth, Sentry, electron-log, Electron Forge and updater remain stack decisions but not hidden current work.

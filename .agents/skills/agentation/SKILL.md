---
name: agentation
description: Install, verify, or troubleshoot Agentation visual feedback in Reo and its MCP server
---

# Agentation Setup

Set up Agentation as a development-only visual feedback tool for Reo.

## Official References

Before changing package, component, or MCP configuration, check current official docs with Context7:

- `/benjitaylor/agentation`
- `/websites/agentation_dev_install`

If Context7 is unavailable, use the official Agentation site:

- `https://www.agentation.com/`
- `https://www.agentation.com/mcp`

## Product Boundary

- Reo is Electron + React + Vite, not Next.js.
- Agentation stays development-only in the renderer root.
- Do not add preload, IPC, main-process, permission, protocol, Query, or product runtime state for Agentation.
- The renderer toolbar connects to the local MCP HTTP endpoint at `http://localhost:4747`.
- The MCP server is a user-level agent tool, not a Reo product capability.

## React Toolbar

1. Check current package state:

   ```bash
   npm view agentation version dist-tags --json
   npm ls agentation --depth=0
   ```

2. Install or refresh the package only when needed:

   ```bash
   npm install --save-dev agentation@latest
   ```

3. Mount from the renderer root only in Vite development and outside test mode:

   ```tsx
   import { Agentation } from 'agentation';

   const enabled = import.meta.env.DEV && import.meta.env.MODE !== 'test';

   export function DevAgentation() {
     return enabled ? <Agentation copyToClipboard={true} endpoint="http://localhost:4747" /> : null;
   }
   ```

4. Lazy-load the wrapper from `src/renderer/src/main.tsx` so production builds do not include the toolbar.

## MCP Setup

Use the official MCP installer command for user/global agent configuration:

```bash
npx -y add-mcp -g -a codex -a claude-code -n agentation -y "npx -y agentation-mcp server"
```

If reinstalling a broken setup, remove the old entries first:

```bash
npx -y add-mcp remove -g -a codex -a claude-code -y agentation
npx -y add-mcp -g -a codex -a claude-code -n agentation -y "npx -y agentation-mcp server"
```

Expected Codex config:

```toml
[mcp_servers.agentation]
command = "npx"
args = [ "-y", "agentation-mcp", "server" ]
```

Expected Claude Code user config:

```json
{
  "mcpServers": {
    "agentation": {
      "command": "npx",
      "args": ["-y", "agentation-mcp", "server"]
    }
  }
}
```

## Verification

Run:

```bash
npm view agentation version dist-tags --json
npm view agentation-mcp version dist-tags --json
npm ls agentation --depth=0
codex mcp get agentation
claude mcp get agentation
npx -y add-mcp list -g
npx -y agentation-mcp doctor
```

Then verify a fresh `agentation-mcp server` process exposes the MCP tools and `agentation_list_sessions` works.

If startup logs show `better-sqlite3` was compiled for the wrong Node ABI, rebuild the `npx` cache prefix that contains `agentation-mcp`:

```bash
npm rebuild --prefix /path/to/.npm/_npx/<cache-id> better-sqlite3
```

Keep Reo's current Node version as the runtime target. Do not lower the project or MCP runtime Node version just to satisfy Agentation; fix Agentation's cached native module or local package metadata instead.

The healthy server exposes the HTTP endpoint for the toolbar and the MCP tool list for agents. `doctor` may report the HTTP server as not running when no agent/server process is currently active; that is not a config failure if the MCP command and direct server probe pass.

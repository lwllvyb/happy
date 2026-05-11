# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Happy is a pnpm monorepo providing mobile/web access to Claude Code & Codex. Key packages:

| Package | Purpose | Dev command |
|---|---|---|
| `happy-server` | Fastify backend + WebSocket relay | `pnpm --filter happy-server standalone:dev` (port 3005) |
| `happy-app` | Expo React Native + web client | `pnpm --filter happy-app web` (port 8081) |
| `happy-cli` | CLI wrapper for Claude Code/Codex | `pnpm --filter happy cli:install` |
| `happy-wire` | Shared Zod schemas (built on `pnpm install`) | N/A (auto-built via postinstall) |

### Running services

- **Server**: `pnpm --filter happy-server standalone:dev` — uses embedded PGlite, no Docker/Postgres/Redis needed. Listens on port 3005.
- **Web app**: `EXPO_PUBLIC_HAPPY_SERVER_URL=http://localhost:3005 pnpm --filter happy-app web` — point it at the local server. Listens on port 8081.
- The `happy-wire` package is automatically built during `pnpm install` via the postinstall hook. No separate build step needed.

### Typecheck and tests

- **Typecheck** (all packages): `pnpm --filter happy-server build`, `pnpm --filter happy typecheck`, `pnpm --filter happy-app typecheck`
- **Server tests**: `pnpm --filter happy-server test` (Vitest; one test `processImage.spec.ts` fails due to missing test fixture — pre-existing, not a regression)
- **CLI unit tests**: `pnpm --filter happy exec vitest run --project unit` (483 tests, ~80s)
- Integration tests hit real APIs and are flaky; run only on demand per SKILL.md.

### Gotchas

- Node.js 20 is required (not 18, not 22). The VM update script installs it from NodeSource.
- pnpm 10.11.0 is enforced via `packageManager` field; corepack activates it.
- The React Native DevTools error about `--no-sandbox` when starting the web app is harmless (Electron DevTools can't run as root); the web app itself works fine.
- `pnpm install` runs a postinstall that applies patches and builds `happy-wire`. If postinstall fails, downstream packages will have missing types.
- Server `standalone:dev` auto-runs PGlite migrations on first start — data stored in `packages/happy-server/data/pglite/`.
- For detailed per-package coding guidelines, see `packages/*/CLAUDE.md` and the dev skill at `.agents/skills/dev/SKILL.md`.

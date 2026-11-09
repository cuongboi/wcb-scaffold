# AGENTS.md

One Bun process serves a React client and an Elysia API. The client is a VS Code–style workbench whose every view, command and menu comes from a module. Setup, endpoints, the module reference and upload configuration are in [README.md](README.md).

## Stack

Bun, Elysia, React 19, better-auth (with API keys), ZenStack on Postgres, Tailwind 4, shadcn (`base-vega` style on Base UI, so components take a `render` prop rather than `asChild`).

## Commands

```bash
bun run dev           # server with hot reload, http://localhost:3000
bun run typecheck     # client and server
bun run lint
bun run format
bun run build         # compiles client and server into ./run-server
bun run db:generate   # regenerates zenstack/*.ts from schema.zmodel
bun run db:push       # applies the schema to the database in DATABASE_URL
bun run module:new <name> [--server]   # scaffolds modules/<name>/ and registers it
```

Server flags (`--ssl`, `--db-push`, `--port` and others) are defined in `server/lib/cli.ts` and listed in the README. Keep flag and listen logic there, not in `server/index.ts`.

There is no test suite. Verify changes with typecheck, lint, and by exercising the running app. For workbench performance, open the dev app with `?stress` for the Stress HUD (100 synthetic modules × 100 tabs; `?stress=run` runs it on load, or use "Developer: Run Stress Test" in the palette). It is dev-only and left out of builds.

## Layout

- `server/index.ts`: `Bun.serve` routes, health checks, shutdown, and the wiring Elysia's `.ws()` needs (see Rules)
- `server/app.ts`: Elysia app, error mapping, OpenAPI, route registration
- `server/routes/`: `execute.ts` (generic ORM endpoint), `upload.ts`, `terminal.ts` (terminal status)
- `server/websocket/<name>.event.ts`: Elysia `.ws()` routes; `terminal.event.ts` is the shell socket
- `server/modules.ts`: the server halves of modules, checked to stay under `/api/modules/<id>/`
- `server/plugins/session.ts`: mounts better-auth and adds the `auth: true` route option
- `server/lib/`: auth, db, errors, logging, rate limiting, storage, `terminal.ts` (shell access checks and PTYs)
- `src/`: React client; `src/lib/api.ts` is its API layer
- `src/router.tsx`: `/sign-in`, and everything else to the workbench, which matches the URL against modules' `main` widgets. Paths can't start with `/api` or `/uploads`, which go to Elysia
- `src/workbench/`: the module SDK (`@/workbench`): registries, commands, keybindings, menus, palettes, layout and tab stores
- `src/features/workbench/`: the workbench UI (activity bar, sidebars, tabs, panel, status bar, palette) and its built-in module
- `src/features/<name>/module.tsx`: the app's own features as modules (dashboard, files, settings, auth, terminal); `src/features/<name>/` holds the components behind them
- `src/modules.ts`: the list of loaded modules, built-ins first
- `modules/<name>/`: module packages (Bun workspaces, imported as `@modules/<name>`). `modules/hello` uses every contribution type
- `src/pages/`: sign-in and not-found
- `zenstack/schema.zmodel`: data models and access policies

## Rules

- **Data access**: use `authDb.$setAuth(user)` for anything user-driven. `db` bypasses access policies and is only for better-auth and trusted server code.
- **`/api/execute`**: serves only models in the `MODELS` set in `server/routes/execute.ts`. Never add the auth tables (session, account, verification, apikey).
- **Generated code**: never hand-edit `zenstack/schema.ts`, `models.ts` or `input.ts`. Edit `schema.zmodel`, then run `bun run db:generate`.
- **Responses**: success is `{ data }`; failure is `errorBody(code, message)` from `server/lib/errors.ts`.
- **Routes**: `.use(session)`, set `auth: true` on protected routes, rate-limit with `allow()`, and register the route in `server/app.ts`. A new top-level path prefix also needs an entry in `server/index.ts`, which only forwards `/api/*` and `/uploads/*` to Elysia.
- **Client**: call the API through `src/lib/api.ts` (`db.<model>.<op>`, `api.*`, `api.socket`), never raw `fetch` or `new WebSocket`. Auth goes through `src/lib/auth-client.ts`.
- **Modules**: new UI goes in a module (`defineModule` from `@/workbench`), not into the shell. Contribution ids start with the module id. Scaffold with `bun run module:new`, which edits the `@modules:` markers in `src/modules.ts` and `server/modules.ts`. Client files may only `import type` from a module's `server.ts`. A module's server routes follow the Routes rule, stay under `/api/modules/<id>/`, and are registered in `server/modules.ts`.
- **WebSockets**: Elysia `.ws()` routes in `server/websocket/<name>.event.ts`, registered in `server/app.ts`. They work because `server/index.ts` passes Elysia's `websocket` handlers to `Bun.serve` and sets `app.server`; keep both. Check access in a macro `resolve` (see Gotchas), and check `Origin`, since browsers send cookies with cross-site handshakes.
- **Terminal**: a shell runs as the server's OS user. Keep it off unless `--terminal` is passed, allowlisted by user id in `TERMINAL_USERS`, same-origin only, closed to API keys, and capped per user. These checks live in `terminalAccess` in `server/lib/terminal.ts`.
- **Uploads**: keep SVG and HTML out of the type allowlist, since they would run scripts on this origin. Keep the `KEY` format check on every key taken from a request.
- **Style**: Prettier (no semicolons, double quotes). Import with the `@/` aliases (`@/server/*`, `@/zenstack/*`). Comments explain why, not what.

## Gotchas

- Vite is gone; don't reintroduce it. Tailwind runs through `bun-plugin-tailwind`, set in `bunfig.toml` for dev and `build.ts` for builds.
- `server/lib/db.ts` keeps the pool on `globalThis` so it survives `bun --hot` reloads.
- `PRISMA` in `server/lib/db-push.ts` must match the `prisma` version that `@zenstackhq/cli` depends on, and `@zenstackhq/language` and `@zenstackhq/sdk` are pinned to the CLI's version. Update them together.
- `bun add` fails on the `bun` package's postinstall and saves nothing to `package.json`. Use `bun add --ignore-scripts`.
- Rate limits are in memory, so they apply per process.
- In elysia 1.4.31 a function `beforeHandle` in `.ws()` options runs twice (as a hook, then inside the upgrade), which double-counts `allow()`. Use a macro with `resolve`. `ElysiaWS.send` JSON-encodes objects, a `Uint8Array` included; use `sendBinary` for bytes.
- Interactive shells ignore SIGTERM. A closed terminal sends SIGHUP, which is what `closeShell` uses. Bun's PTY (`Bun.spawn({ terminal })`) is POSIX-only.
- Only the last `KEEP_ALIVE` (10) tabs shown stay mounted (`visited` in `src/workbench/editors.ts`); older hidden tabs unmount and lose their state. Menus are stored by menu id (`state.menus[menuId]`), and keybindings and main widgets are indexed in WeakMaps keyed on the registry records, so replace those records rather than mutating them.
- react-resizable-panels is v4 (`Group`/`Panel`/`Separator`, `orientation`, `onLayoutChanged`); numeric sizes are pixels and strings are percentages.
- Browsers keep some shortcuts (`⌘W`, `⌘T`, `⌘N`, and `⌘⇧P` in Firefox), so don't bind those; `F1` and the title bar search are the palette's fallbacks. Keys without Ctrl/⌘ don't fire while typing, and in the terminal only ⌘ combos and commands marked `inTerminal` do.
- Bun's CSS parser rejects `@supports (content: x / '')`, which Tailwind emits for classes like `supports-[content:…_/_'']`, and then the whole client build fails. Tailwind keeps class candidates for the life of `bun --hot`, so restart dev after removing one.
- Don't commit `run-server`, `.env`, `uploads`, or tool state (`.swarm`, `.claude-flow`, `ruvector.db`).

## Known drift

Comments in `src/lib/api.ts` mention `apps/api` and `POST /execute`, and its `ApiErrorCode` lists codes the server doesn't emit. Trust `server/lib/errors.ts` and `server/routes/execute.ts`.

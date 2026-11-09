---
name: add-module
description: Add or change a workbench module (a package in modules/<name>/, or a built-in in src/features/<name>/module.tsx) that contributes widgets, menus, commands, palettes or server routes. Use when asked for a new panel, sidebar view, page/tab, status bar item, menu, command, keybinding or palette, or for a module with its own API.
---

# Add a module

Follow these steps in order and skip any that don't apply. The rules in `AGENTS.md` apply throughout. `modules/hello` uses every contribution type, so copy from it.

## 1. Scaffold

```bash
bun run module:new my-tool            # client only
bun run module:new my-tool --server   # plus modules/my-tool/server.ts
```

The name is lowercase words joined by dashes, and it becomes the module id. The script writes `modules/my-tool/` and adds it under the `@modules:` markers in `src/modules.ts` (and `server/modules.ts`). For a built-in feature, write `src/features/<name>/module.tsx` and add it to the built-ins in `src/modules.ts` by hand, with `builtin: true`.

## Reference: `modules/hello`

Read the matching file in `modules/hello` before writing a contribution, and copy its pattern rather than inventing one.

| File | What to copy from it |
| --- | --- |
| `package.json` | `"name": "@modules/<id>"`, `"private": true`, `"type": "module"`, `"main": "index.tsx"` |
| `index.tsx` | The `defineModule({ id, title, description, commands, widgets, menus, palettes, activate })` declaration. Command handlers live here as plain functions (`sayHi`, `announce`) |
| `views.tsx` | One exported component per widget: `HelloView` (left), `HelloInspector` (right, reads `useContextKeys()`), `HelloLog` (bottom), `HelloPage` (main, takes `WidgetProps` with `params`), `HelloStatus` (status, renders `StatusBarItem` with a `command`) |
| `state.ts` | Module state shared between widgets and commands, kept in a zustand store (`useHelloLog`) with plain setter functions (`logGreeting`) that commands call outside React |
| `server.ts` | One Elysia instance tagged `Module: <id>`, `.use(session)`, `auth: true`, an `allow()` check that returns `status(429, errorBody(...))`, `t` query schema, and `{ data }` return |

Patterns worth reusing:

- **Server call from a command**: `await api.get<{ message: string }>("/api/modules/hello/greeting?name=...")`. `api` unwraps `{ data }`, so type the inner shape.
- **Asking for input**: `workbench.inputBox({ title, prompt, placeholder, validate })` returns `undefined` on cancel, so return early when it does.
- **Commands that take arguments**: set `palette: false` and coerce the arg (`String(greeting)`), as `hello.announce` and `hello.copy` do.
- **A module's own context menu**: declare items with `{ menu: "hello.greeting", command, group }` and render `<ContextMenuArea menu="hello.greeting" args={[value]}>`. The `args` are passed to each command's `run`.
- **A new top-level menu**: `{ menu: "menubar", submenu: "hello.menu", title, order }`, then items with `menu: "hello.menu"`. Groups sort by name (`1_greet`, `2_open`), and a separator goes between groups.
- **View title actions**: `menu: "view/title"`, `when: (c) => c.view === "hello.view"`. `group: "navigation"` shows as an icon, and other groups go behind "…".
- **Opening things**: `workbench.editors.open("hello.page")` for a main widget and `workbench.palette.open("#")` for a palette prefix.
- **Text**: every user-facing title uses `localized({ en, vi })`.

## 2. Contributions

Edit `modules/my-tool/index.tsx`. Every id must be the module id or start with `my-tool.`; anything else is rejected and shown in the Modules view.

- **Widgets**: `location` is `left`, `right`, `bottom` (optionally with `container`), `main` (a tab; `path` defaults to `/<id>`, and URL params arrive as the `params` prop), `status` (`align`), or `overlay` (always mounted, for dialogs a command opens through a store). Use `lazy()` for heavy components. Without `order`, a widget sorts after the built-ins.
- **Commands**: `run(...args)`, an optional `keybinding` (`mod`, `ctrl`, `alt`, `shift`, `cmd` plus a key), `enabled` and `palette: false` for commands that need arguments. Don't bind keys the browser keeps (`mod+w`, `mod+t`, `mod+n`). Set `inTerminal` only for workbench-level commands, since shells use Ctrl keys.
- **Menus**: `{ menu, command }` adds an item and `{ menu, submenu, title }` creates a menu. Built-in menus are `menubar` (top level), `menubar/file|view|go|terminal|help`, `view/title` (scope with `when: (c) => c.view === "<widget id>"`), `editor/title`, `editor/tab/context`, `activitybar/manage` and `activitybar/accounts`. In title bars the `navigation` group shows as icons. A widget can render its own menu with `ContextMenuArea`, `MenuDropdown` or `ActionBar` from `@/workbench`.
- **Palettes**: `{ prefix, title, provide(query, { signal }) }`, which may be async. Pick a prefix not taken yet (the `?` palette lists them).
- **Text**: plain strings, or `localized({ en, vi })` / `() => t("key")` so they follow the language setting.

## 3. Runtime

Use `workbench` from `@/workbench`: `commands.execute`, `quickPick`, `inputBox`, `notify`, `output(channel)`, `editors.open`, `widgets.reveal`, `layout`, `context.set`. Call the server through `api`/`db` from `@/lib/api`, never raw `fetch`. Put registrations that can't be declared in `activate(context)` using `context.register.*`, so they are undone when the module is disabled.

## 4. Server half

In `modules/my-tool/server.ts`, follow the Routes rule: `.use(session)`, `auth: true`, an `allow()` rate limit, `t` schemas, `{ data }` / `errorBody`, and `authDb.$setAuth(user)` for data. Every path starts with `/api/modules/my-tool/`; `server/modules.ts` refuses to start otherwise. WebSockets go in a `<name>.event.ts` file next to it, with checks in a macro `resolve` and an `Origin` check. Client files may only `import type` from server files.

## 5. Dependencies

Add packages with `bun add --ignore-scripts <pkg>` run inside `modules/my-tool/`, then `bun install` at the root. Don't add a `tsconfig.json` to the module, or the `@/` imports stop resolving.

## 6. Verify

```bash
bun run typecheck
bun run lint
```

Restart `bun run dev`, then check:

- The module is listed in the Modules view without errors, and disabling it removes its UI.
- Its commands are in the palette (`⇧⌘P`) with their keys, and its menus and widgets show where intended.
- A server route returns 401 without a session and appears at `/api/docs` under `Module: my-tool`.

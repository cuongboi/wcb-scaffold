---
name: add-feature
description: Add a data model, field, API route or client feature to this project end to end, covering the ZenStack schema and policies, exposure through /api/execute or a workflow route, and the client. Use when asked to add or change a model, table, field, endpoint or data-backed screen.
---

# Add a feature

Follow these steps in order and skip any that don't apply. The rules in `AGENTS.md` apply throughout.

## 1. Schema

Edit `zenstack/schema.zmodel`:

- Write `@@allow` policies explicitly. Access is denied by default, so a model without them is unusable through `authDb`.
- Use `@deny` on fields users must not change, as `User.email` does.
- Add `@@map` with the table name.

## 2. Generate and push

```bash
bun run db:generate
bun run db:push
```

Check which database `DATABASE_URL` points to before pushing, because the push changes it. Ask first if it isn't a local database.

## 3. Expose the data

Pick one:

- **Plain CRUD**: add the delegate name (for example `post`) to `MODELS` in `server/routes/execute.ts`. The policies from step 1 are then the only protection, so re-read them first.
- **Workflow logic**: add a route in `server/routes/`, using `server/routes/upload.ts` as the template. Include `tags`, `.use(session)`, `auth: true`, an `allow()` rate limit, a `t` body schema and `detail`. Query through `authDb.$setAuth(user)`.

## 4. Register the route

For a new route file, add `.use(...)` in `server/app.ts`, and add its tag to the OpenAPI `tags` list there. If it isn't under `/api/*` or `/uploads/*`, add the prefix to `routes` in `server/index.ts`.

## 5. Client

Use `db.<model>.<op>(args)` for CRUD and `api.get/post/...` for workflow routes, both from `src/lib/api.ts`. Add UI components with `bunx shadcn@latest add <component>`.

## 6. Docs

Update the Endpoints table in `README.md` if endpoints changed.

## 7. Verify

```bash
bun run typecheck
bun run lint
```

There are no tests, so run the app with `bun run dev` and check:

- A request the policy allows succeeds.
- A request it should refuse fails, for example another user's row or no session (401).
- New routes appear at `/api/docs`.

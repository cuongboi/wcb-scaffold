// Scaffolds a workbench module: `bun run module:new <name> [--server]`.
// Writes modules/<name>/ and registers it in src/modules.ts (and server/modules.ts with --server).
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"

const root = join(import.meta.dir, "..")
const [name, ...flags] = process.argv.slice(2)
const withServer = flags.includes("--server")

// The built-in modules' ids, which own their command and widget prefixes.
const RESERVED = new Set([
  "workbench",
  "dashboard",
  "files",
  "settings",
  "auth",
  "terminal",
])

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

if (!name || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  fail(
    "Usage: bun run module:new <name> [--server]\nThe name is lowercase letters and digits, with dashes between words, such as my-tool."
  )
}
if (RESERVED.has(name)) fail(`"${name}" is a built-in module's id.`)

const dir = join(root, "modules", name)
if (existsSync(dir)) fail(`${relative(root, dir)} already exists.`)

const camel = name.replace(/-([a-z0-9])/g, (_, char: string) =>
  char.toUpperCase()
)
const pascal = camel[0]!.toUpperCase() + camel.slice(1)
const title = name
  .split("-")
  .map((word) => word[0]!.toUpperCase() + word.slice(1))
  .join(" ")

const client = `import { BoxIcon } from "lucide-react"
${withServer ? `\nimport { api } from "@/lib/api"` : ""}
import { defineModule, workbench } from "@/workbench"

function ${pascal}View() {
  return (
    <div className="flex flex-col gap-2 p-3 text-[13px]">
      <p className="text-muted-foreground">
        The ${title} module's view. Edit modules/${name}/index.tsx.
      </p>
    </div>
  )
}

export default defineModule({
  id: "${name}",
  title: "${title}",
  commands: [
    {
      id: "${name}.hello",
      title: "Say Hello",
      category: "${title}",
      run: () => workbench.notify("Hello from ${title}"),
    },${
      withServer
        ? `
    {
      id: "${name}.ping",
      title: "Ping the Server",
      category: "${title}",
      async run() {
        await api.get("/api/modules/${name}/ping")
        workbench.notify("The ${title} server route answered")
      },
    },`
        : ""
    }
  ],
  widgets: [
    {
      id: "${name}.view",
      location: "left",
      title: "${title}",
      icon: BoxIcon,
      component: ${pascal}View,
    },
  ],
  menus: [
    { menu: "menubar/help", command: "${name}.hello", group: "8_modules" },
    {
      menu: "view/title",
      command: "${name}.hello",
      group: "navigation",
      when: (c) => c.view === "${name}.view",
    },
  ],
  palettes: [
    {
      id: "${name}.items",
      prefix: "${name}:",
      title: "${title}",
      provide: () => [
        { label: "Say Hello", run: () => workbench.notify("Hello from ${title}") },
      ],
    },
  ],
})
`

const server = `import { Elysia } from "elysia"

import { errorBody } from "@/server/lib/errors"
import { allow } from "@/server/lib/rate-limit"
import { session } from "@/server/plugins/session"

const PING_LIMIT = 60
const MINUTE_MS = 60_000

/** The server half of the ${title} module. Every path stays under /api/modules/${name}/. */
export default new Elysia({ tags: ["Module: ${name}"] }).use(session).get(
  "/api/modules/${name}/ping",
  ({ user, status }) => {
    if (!allow(\`${name}:\${user.id}\`, PING_LIMIT, MINUTE_MS)) {
      return status(429, errorBody("RATE_LIMITED", "Too many requests"))
    }
    return { data: { pong: true } }
  },
  {
    auth: true,
    detail: {
      summary: "Check the ${title} module",
      security: [{ session: [] }, { apiKey: [] }],
    },
  }
)
`

const pkg = {
  name: `@modules/${name}`,
  version: "0.0.1",
  private: true,
  type: "module",
  main: "index.tsx",
}

/**
 * Appends `line` to the block that follows `marker`: after the last line below it that has the
 * marker's indentation, so modules stay in the order they were added.
 */
function appendToBlock(
  text: string,
  marker: string,
  line: string,
  file: string
) {
  const lines = text.split("\n")
  const at = lines.findIndex((candidate) => candidate.includes(marker))
  if (at === -1)
    fail(`Couldn't find "${marker}" in ${file}; add the module there by hand.`)
  const indent = lines[at]!.slice(0, lines[at]!.indexOf(marker))
  let last = at
  while (last + 1 < lines.length) {
    const next = lines[last + 1]!
    const entry =
      next.startsWith(indent) &&
      next.trim() !== "" &&
      !/^[\s]*[\]})]/.test(next)
    if (!entry || next.slice(indent.length).startsWith(" ")) break
    last += 1
  }
  lines.splice(last + 1, 0, `${indent}${line}`)
  return lines.join("\n")
}

async function register(file: string, importLine: string, listLine: string) {
  const path = join(root, file)
  let text = await readFile(path, "utf8")
  text = appendToBlock(text, "// @modules:imports", importLine, file)
  text = appendToBlock(text, "// @modules:list", listLine, file)
  await writeFile(path, text)
}

await mkdir(dir, { recursive: true })
const written = [join(dir, "package.json"), join(dir, "index.tsx")]
await writeFile(written[0]!, `${JSON.stringify(pkg, null, 2)}\n`)
await writeFile(written[1]!, client)
await register(
  "src/modules.ts",
  `import ${camel}Module from "@modules/${name}"`,
  `${camel}Module,`
)
if (withServer) {
  written.push(join(dir, "server.ts"))
  await writeFile(written[2]!, server)
  const key = camel === name ? name : JSON.stringify(name)
  await register(
    "server/modules.ts",
    `import ${camel}Server from "@modules/${name}/server"`,
    `${key}: ${camel}Server,`
  )
}

// The templates are close to Prettier's output, but long names can push a line past the limit.
const prettier = Bun.spawnSync(
  [process.execPath, "x", "prettier", "--write", ...written],
  { cwd: root, stdout: "ignore", stderr: "pipe" }
)
if (prettier.exitCode !== 0)
  console.warn(`Prettier didn't run: ${prettier.stderr.toString().trim()}`)

console.log(
  `Created ${relative(root, dir)}/ (${written.map((file) => relative(dir, file)).join(", ")})`
)
console.log(
  `Registered it in src/modules.ts${withServer ? " and server/modules.ts" : ""}.`
)
console.log(
  "Restart `bun run dev` to load it. If you add dependencies to its package.json, run `bun install` first."
)

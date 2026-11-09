import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { createZModelServices } from "@zenstackhq/language"
import type { Model } from "@zenstackhq/language/ast"
import { PrismaSchemaGenerator } from "@zenstackhq/sdk"
import { URI } from "langium"

import policyPlugin from "@zenstackhq/plugin-policy/plugin.zmodel" with { type: "text" }
// Not in the package's `exports`, hence the path through node_modules.
import stdlib from "../../node_modules/@zenstackhq/language/res/stdlib.zmodel" with { type: "text" }
import schema from "../../zenstack/schema.zmodel" with { type: "text" }

// Must match the `prisma` that @zenstackhq/cli depends on: the generated schema targets it.
const PRISMA = "prisma@6.19.3"

/**
 * `zen db push` for the compiled executable. The CLI can't be embedded (it resolves prisma, stdlib
 * and plugins from node_modules), so this repeats its steps with the .zmodel files embedded:
 * zmodel → Prisma schema → `prisma db push`. Prisma's schema engine is native and can't be bundled
 * either; the executable runs it as Bun (`BUN_BE_BUN`), which fetches prisma into Bun's cache once.
 */
export async function dbPush(opts: { acceptDataLoss?: boolean } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fullstack-elysia-push-"))
  try {
    const write = (rel: string, text: string) => {
      const file = path.join(dir, rel)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, text)
      return file
    }
    const stdlibFile = write("stdlib.zmodel", stdlib)
    // The plugin resolves `provider = '@zenstackhq/plugin-policy'` relative to the schema first.
    write("@zenstackhq/plugin-policy/plugin.zmodel", policyPlugin)
    const schemaFile = write("schema.zmodel", schema)

    const model = await loadModel(stdlibFile, schemaFile)
    const prismaFile = write(
      "schema.prisma",
      await new PrismaSchemaGenerator(model).generate()
    )

    const args = ["db", "push", "--schema", prismaFile, "--skip-generate"]
    if (opts.acceptDataLoss) args.push("--accept-data-loss")
    const proc = Bun.spawn([process.execPath, "x", PRISMA, ...args], {
      env: { ...process.env, BUN_BE_BUN: "1", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      stdio: ["inherit", "inherit", "inherit"],
    })
    return await proc.exited
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** `loadDocument` from @zenstackhq/language, minus import merging, with an explicit stdlib path. */
async function loadModel(stdlibFile: string, schemaFile: string) {
  const { shared } = createZModelServices(false)
  const docs = shared.workspace.LangiumDocuments
  const stdlibDoc = await docs.getOrCreateDocument(URI.file(stdlibFile))
  const doc = await docs.getOrCreateDocument(URI.file(schemaFile))
  await shared.workspace.DocumentBuilder.build([stdlibDoc, doc], {
    validation: {
      stopAfterLexingErrors: true,
      stopAfterParsingErrors: true,
      stopAfterLinkingErrors: true,
    },
  })

  const errors = docs.all
    .flatMap((d) =>
      (d.diagnostics ?? [])
        .filter((x) => x.severity === 1)
        .map((x) => ({ d, x }))
    )
    .map(
      ({ d, x }) =>
        `${path.basename(d.uri.fsPath)}:${x.range.start.line + 1} - ${x.message}`
    )
    .toArray()
  if (errors.length > 0)
    throw new Error(`Schema contains errors:\n${errors.join("\n")}`)
  return doc.parseResult.value as Model
}

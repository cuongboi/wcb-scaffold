import { authModule } from "@/features/auth/module"
import { dashboardModule } from "@/features/dashboard/module"
import { filesModule } from "@/features/files/module"
import { settingsModule } from "@/features/settings/module"
import { terminalModule } from "@/features/terminal/module"
import { workbenchModule } from "@/features/workbench/module"
import type { Module } from "@/workbench"
// @modules:imports (bun run module:new adds lines below)
import helloModule from "@modules/hello"

/** Every module the app loads, in order. Built-ins come first, so later modules can extend their menus. */
export const modules: Module[] = [
  workbenchModule,
  dashboardModule,
  filesModule,
  settingsModule,
  authModule,
  terminalModule,
  // @modules:list (bun run module:new adds lines below)
  helloModule,
]

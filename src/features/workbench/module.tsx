import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BlocksIcon,
  BookOpenIcon,
  BrushCleaningIcon,
  FilesIcon,
  FileStackIcon,
  KeyboardIcon,
  Maximize2Icon,
  PanelBottomIcon,
  PanelLeftIcon,
  PanelRightIcon,
  RotateCwIcon,
  ScrollTextIcon,
  XIcon,
} from "lucide-react"

import {
  commandsPalette,
  gotoPalette,
  helpPalette,
} from "@/features/workbench/palettes"
import { KeyboardShortcutsView } from "@/features/workbench/views/keyboard-shortcuts"
import { ModulesView } from "@/features/workbench/views/modules-view"
import { OpenTabsView } from "@/features/workbench/views/open-tabs-view"
import { OutputView } from "@/features/workbench/views/output-view"
import { PagesView } from "@/features/workbench/views/pages-view"
import { t } from "@/i18n"
import { defineModule } from "@/workbench"
import {
  closeAllEditors,
  closeEditor,
  closeEditorsToRight,
  closeOtherEditors,
  openEditor,
} from "@/workbench/editors"
import { setBottomMaximized, togglePart, useLayout } from "@/workbench/layout"
import { VIEWS_MENU } from "@/workbench/modules"
import { clearOutput, useOutput } from "@/workbench/output"
import { openPalette } from "@/workbench/quick-input"
import { revealWidget } from "@/workbench/reveal"

const view = () => t("workbench.category.view")
const go = () => t("workbench.category.go")
const help = () => t("workbench.category.help")

/**
 * The workbench's own contributions: layout and tab commands, the built-in palettes, the menubar
 * skeleton that other modules fill, and the Explorer, Modules, Output and Keyboard Shortcuts views.
 */
export const workbenchModule = defineModule({
  id: "workbench",
  title: "Workbench",
  builtin: true,
  commands: [
    {
      id: "workbench.showCommands",
      title: () => t("workbench.showCommands"),
      keybinding: ["mod+shift+p", "f1"],
      inTerminal: true,
      run: () => openPalette(">"),
    },
    {
      id: "workbench.quickOpen",
      title: () => t("workbench.quickOpen"),
      keybinding: "mod+p",
      inTerminal: true,
      run: () => openPalette(""),
    },
    {
      id: "workbench.toggleLeft",
      title: () => t("workbench.toggleLeft"),
      category: view,
      icon: PanelLeftIcon,
      keybinding: "mod+b",
      run: () => togglePart("left"),
    },
    {
      id: "workbench.toggleRight",
      title: () => t("workbench.toggleRight"),
      category: view,
      icon: PanelRightIcon,
      keybinding: "mod+alt+b",
      run: () => togglePart("right"),
    },
    {
      id: "workbench.toggleBottom",
      title: () => t("workbench.toggleBottom"),
      category: view,
      icon: PanelBottomIcon,
      keybinding: "mod+j",
      inTerminal: true,
      run: () => togglePart("bottom"),
    },
    {
      id: "workbench.maximizeBottom",
      title: () => t("workbench.maximizeBottom"),
      category: view,
      icon: Maximize2Icon,
      run: () => setBottomMaximized(!useLayout.getState().bottom.maximized),
    },
    {
      id: "workbench.closeTab",
      title: () => t("workbench.closeTab"),
      category: view,
      icon: XIcon,
      keybinding: "alt+w",
      run: (key) => closeEditor(key),
    },
    {
      id: "workbench.closeOtherTabs",
      title: () => t("workbench.closeOtherTabs"),
      category: view,
      run: (key) => closeOtherEditors(key),
    },
    {
      id: "workbench.closeTabsToRight",
      title: () => t("workbench.closeTabsToRight"),
      category: view,
      run: (key) => closeEditorsToRight(key),
    },
    {
      id: "workbench.closeAllTabs",
      title: () => t("workbench.closeAllTabs"),
      category: view,
      run: () => closeAllEditors(),
    },
    {
      id: "workbench.goBack",
      title: () => t("workbench.goBack"),
      category: go,
      icon: ArrowLeftIcon,
      run: () => window.history.back(),
    },
    {
      id: "workbench.goForward",
      title: () => t("workbench.goForward"),
      category: go,
      icon: ArrowRightIcon,
      run: () => window.history.forward(),
    },
    {
      id: "workbench.reload",
      title: () => t("workbench.reload"),
      category: () => t("workbench.category.developer"),
      icon: RotateCwIcon,
      run: () => window.location.reload(),
    },
    {
      id: "workbench.openApiDocs",
      title: () => t("workbench.apiDocs"),
      category: help,
      icon: BookOpenIcon,
      run: () => window.open("/api/docs", "_blank", "noopener"),
    },
    {
      id: "workbench.openKeyboardShortcuts",
      title: () => t("workbench.keyboardShortcuts"),
      category: () => t("workbench.category.preferences"),
      icon: KeyboardIcon,
      run: () => openEditor("workbench.keyboardShortcuts"),
    },
    {
      id: "workbench.showWidget",
      title: "Show Widget",
      palette: false,
      run: (id) => {
        if (typeof id === "string") revealWidget(id)
      },
    },
    {
      id: "workbench.clearOutput",
      title: () => t("workbench.clearOutput"),
      category: view,
      icon: BrushCleaningIcon,
      run: () => {
        const { active } = useOutput.getState()
        if (active) clearOutput(active)
      },
    },
    ...(process.env.NODE_ENV !== "production"
      ? [
          {
            id: "workbench.runStress",
            title: "Developer: Run Stress Test (100 modules × 100 tabs)",
            run: async () => {
              const { runStress } = await import("@/features/workbench/stress")
              await runStress()
            },
          },
        ]
      : []),
  ],
  containers: [
    {
      id: "workbench.explorer",
      title: () => t("workbench.explorer"),
      icon: FilesIcon,
      location: "left",
      order: 10,
    },
  ],
  widgets: [
    {
      id: "workbench.pages",
      location: "left",
      container: "workbench.explorer",
      title: () => t("workbench.pages"),
      icon: FileStackIcon,
      order: 10,
      component: PagesView,
    },
    {
      id: "workbench.openTabs",
      location: "left",
      container: "workbench.explorer",
      title: () => t("workbench.openTabs"),
      order: 20,
      component: OpenTabsView,
    },
    {
      id: "workbench.modules",
      location: "left",
      title: () => t("workbench.modules"),
      icon: BlocksIcon,
      order: 90,
      component: ModulesView,
    },
    {
      id: "workbench.output",
      location: "bottom",
      title: () => t("workbench.output"),
      icon: ScrollTextIcon,
      order: 20,
      component: OutputView,
    },
    {
      id: "workbench.keyboardShortcuts",
      location: "main",
      path: "/keyboard-shortcuts",
      title: () => t("workbench.keyboardShortcuts"),
      icon: KeyboardIcon,
      order: 90,
      component: KeyboardShortcutsView,
    },
  ],
  menus: [
    // The top-level menus. Modules add items to these ids, or put their own submenu in "menubar".
    {
      menu: "menubar",
      submenu: "menubar/file",
      title: () => t("menu.file"),
      order: 10,
    },
    {
      menu: "menubar",
      submenu: "menubar/view",
      title: () => t("menu.view"),
      order: 20,
    },
    {
      menu: "menubar",
      submenu: "menubar/go",
      title: () => t("menu.go"),
      order: 30,
    },
    {
      menu: "menubar",
      submenu: "menubar/terminal",
      title: () => t("menu.terminal"),
      order: 40,
    },
    {
      menu: "menubar",
      submenu: "menubar/help",
      title: () => t("menu.help"),
      order: 90,
    },

    { menu: "menubar/file", command: "workbench.reload", group: "8_window" },

    {
      menu: "menubar/view",
      command: "workbench.showCommands",
      group: "1_open",
    },
    { menu: "menubar/view", command: "workbench.quickOpen", group: "1_open" },
    {
      menu: "menubar/view",
      submenu: VIEWS_MENU,
      title: () => t("menu.openView"),
      group: "1_open",
    },
    {
      menu: "menubar/view",
      command: "workbench.toggleLeft",
      group: "2_layout",
      checked: (c) => c.leftVisible,
    },
    {
      menu: "menubar/view",
      command: "workbench.toggleRight",
      group: "2_layout",
      checked: (c) => c.rightVisible,
    },
    {
      menu: "menubar/view",
      command: "workbench.toggleBottom",
      group: "2_layout",
      checked: (c) => c.bottomVisible,
    },
    {
      menu: "menubar/view",
      command: "workbench.maximizeBottom",
      group: "2_layout",
      checked: (c) => c.bottomMaximized,
    },

    { menu: "menubar/go", command: "workbench.goBack", group: "1_history" },
    { menu: "menubar/go", command: "workbench.goForward", group: "1_history" },
    { menu: "menubar/go", command: "workbench.quickOpen", group: "2_goto" },

    {
      menu: "menubar/help",
      command: "workbench.showCommands",
      group: "1_commands",
    },
    {
      menu: "menubar/help",
      command: "workbench.openKeyboardShortcuts",
      group: "1_commands",
    },
    { menu: "menubar/help", command: "workbench.openApiDocs", group: "2_docs" },

    {
      menu: "activitybar/manage",
      command: "workbench.showCommands",
      group: "1_commands",
    },
    {
      menu: "activitybar/manage",
      command: "workbench.openKeyboardShortcuts",
      group: "3_preferences",
    },
    {
      menu: "activitybar/manage",
      command: "workbench.modules.show",
      title: () => t("workbench.modules"),
      group: "4_modules",
    },

    {
      menu: "editor/tab/context",
      command: "workbench.closeTab",
      group: "1_close",
    },
    {
      menu: "editor/tab/context",
      command: "workbench.closeOtherTabs",
      group: "1_close",
    },
    {
      menu: "editor/tab/context",
      command: "workbench.closeTabsToRight",
      group: "1_close",
    },
    {
      menu: "editor/tab/context",
      command: "workbench.closeAllTabs",
      group: "2_close",
    },
    {
      menu: "editor/title",
      command: "workbench.closeAllTabs",
      group: "1_close",
    },

    {
      menu: "view/title",
      command: "workbench.clearOutput",
      group: "navigation",
      when: (c) => c.view === "workbench.output",
    },
  ],
  palettes: [commandsPalette, gotoPalette, helpPalette],
})

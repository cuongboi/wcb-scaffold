import { Link } from "react-router"
import {
  MenuIcon,
  PanelBottomIcon,
  PanelLeftIcon,
  PanelRightIcon,
  SearchIcon,
  TerminalIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Menubar,
  MenubarContent,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { useT } from "@/i18n"
import {
  ActionButton,
  KeybindingLabel,
  MenuDropdown,
  useContextKey,
  useLabel,
  useMenu,
} from "@/workbench"
import { executeCommand } from "@/workbench/commands"
import { keybindingsOf } from "@/workbench/keybindings"
import { useRegistry } from "@/workbench/registry"
import { MenuGroups } from "@/workbench/ui"

const useKeybinding = (id: string) =>
  useRegistry((state) => {
    const command = state.commands[id]
    return command ? keybindingsOf(command)[0] : undefined
  })

/** The top-level menus: every `submenu` placed in the `menubar` menu. */
function TitleMenubar() {
  const label = useLabel()
  const groups = useMenu("menubar")
  const menus = groups
    .flatMap((group) => group.items)
    .filter((item) => item.kind === "submenu")
  return (
    <Menubar className="h-7 gap-0 border-none bg-transparent p-0 shadow-none">
      {menus.map((menu) => (
        <MenubarMenu key={menu.key}>
          <MenubarTrigger className="px-2 py-0.5 text-[13px] font-normal">
            {label(menu.title)}
          </MenubarTrigger>
          <MenubarContent className="w-auto min-w-56">
            <MenuGroups groups={menu.groups} />
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  )
}

function CommandCenter() {
  const t = useT()
  const keybinding = useKeybinding("workbench.quickOpen")
  return (
    <button
      type="button"
      data-testid="command-center"
      onClick={() => void executeCommand("workbench.quickOpen")}
      className="flex h-6 w-full max-w-md min-w-0 items-center gap-2 rounded-md border bg-background/60 px-2 text-xs text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <SearchIcon className="size-3.5 shrink-0" />
      <span className="truncate">{t("workbench.commandCenter")}</span>
      {keybinding && (
        <KeybindingLabel keybinding={keybinding} className="ml-auto h-4" />
      )}
    </button>
  )
}

function LayoutToggle({
  command,
  pressed,
  icon,
}: {
  command: string
  pressed: boolean
  icon: typeof PanelLeftIcon
}) {
  const label = useLabel()
  const title = useRegistry((state) => state.commands[command]?.title)
  const keybinding = useKeybinding(command)
  return (
    <ActionButton
      icon={icon}
      title={label(title)}
      keybinding={keybinding}
      pressed={pressed}
      onClick={() => void executeCommand(command)}
    />
  )
}

export function TitleBar() {
  const t = useT()
  const mobile = useContextKey("isMobile") === true
  const left = useContextKey("leftVisible") === true
  const right = useContextKey("rightVisible") === true
  const bottom = useContextKey("bottomVisible") === true

  return (
    <header className="flex h-9 shrink-0 items-center gap-1 border-b bg-sidebar pr-1 pl-2 text-sidebar-foreground">
      <Link
        to="/"
        aria-label="app-name"
        className="flex shrink-0 items-center gap-2 rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="flex size-5 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
          <TerminalIcon className="size-3" />
        </span>
        <span className="hidden text-sm font-medium xl:inline sr-only">
          fullstack-elysia
        </span>
      </Link>
      {mobile ? (
        <MenuDropdown
          menu="menubar"
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={t("menu.menu")}>
              <MenuIcon />
            </Button>
          }
        />
      ) : (
        <TitleMenubar />
      )}
      <div className="flex min-w-0 flex-1 justify-center px-2">
        <CommandCenter />
      </div>
      <div className="flex shrink-0 items-center">
        <LayoutToggle
          command="workbench.toggleLeft"
          pressed={left}
          icon={PanelLeftIcon}
        />
        <LayoutToggle
          command="workbench.toggleBottom"
          pressed={bottom}
          icon={PanelBottomIcon}
        />
        <LayoutToggle
          command="workbench.toggleRight"
          pressed={right}
          icon={PanelRightIcon}
        />
      </div>
    </header>
  )
}

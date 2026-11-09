import {
  Fragment,
  type ComponentProps,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react"
import { EllipsisIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { t, useLocale } from "@/i18n"
import { cn } from "@/lib/utils"
import { executeCommand } from "@/workbench/commands"
import { formatKeybinding } from "@/workbench/keybindings"
import { useMenu, type MenuGroup } from "@/workbench/menus"
import type { Icon, Localized } from "@/workbench/types"

/** Turns a `Localized` into text, re-rendering when the locale changes. */
export function useLabel() {
  useLocale((state) => state.locale)
  return (value: Localized | undefined) =>
    typeof value === "function" ? value() : (value ?? "")
}

export function KeybindingLabel({
  keybinding,
  className,
}: {
  keybinding: string
  className?: string
}) {
  return <Kbd className={className}>{formatKeybinding(keybinding)}</Kbd>
}

type ItemProps = {
  disabled?: boolean
  onClick?: () => void
  children?: ReactNode
}

/** The menu parts a renderer needs, so one tree can render as a dropdown or a context menu. */
type MenuKit = {
  Item: ComponentType<ItemProps>
  CheckboxItem: ComponentType<
    ItemProps & { checked?: boolean; closeOnClick?: boolean }
  >
  Separator: ComponentType
  Sub: ComponentType<{ children?: ReactNode }>
  SubTrigger: ComponentType<{ children?: ReactNode }>
  SubContent: ComponentType<{ children?: ReactNode }>
  Shortcut: ComponentType<{ children?: ReactNode }>
}

export const dropdownKit: MenuKit = {
  Item: DropdownMenuItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  Shortcut: DropdownMenuShortcut,
}

const contextKit: MenuKit = {
  Item: ContextMenuItem,
  CheckboxItem: ContextMenuCheckboxItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  Shortcut: ContextMenuShortcut,
}

/** Renders resolved menu groups with dividers between them. Items run with their own args, else `args`. */
export function MenuGroups({
  groups,
  kit = dropdownKit,
  args = [],
}: {
  groups: MenuGroup[]
  kit?: MenuKit
  args?: unknown[]
}) {
  const label = useLabel()
  return groups.map((group, index) => (
    <Fragment key={group.name || "_"}>
      {index > 0 && <kit.Separator />}
      {group.items.map((item) => {
        if (item.kind === "submenu") {
          return (
            <kit.Sub key={item.key}>
              <kit.SubTrigger>
                {item.icon && <item.icon />}
                {label(item.title)}
              </kit.SubTrigger>
              <kit.SubContent>
                <MenuGroups groups={item.groups} kit={kit} args={args} />
              </kit.SubContent>
            </kit.Sub>
          )
        }
        const run = () => void executeCommand(item.id, ...(item.args ?? args))
        const content = (
          <>
            {item.checked === undefined && item.icon && <item.icon />}
            {label(item.title)}
            {item.keybinding && (
              <kit.Shortcut>{formatKeybinding(item.keybinding)}</kit.Shortcut>
            )}
          </>
        )
        return item.checked === undefined ? (
          <kit.Item key={item.key} disabled={!item.enabled} onClick={run}>
            {content}
          </kit.Item>
        ) : (
          <kit.CheckboxItem
            key={item.key}
            checked={item.checked}
            closeOnClick
            disabled={!item.enabled}
            onClick={run}
          >
            {content}
          </kit.CheckboxItem>
        )
      })}
    </Fragment>
  ))
}

/** A button that opens any menu, such as one a module created with `submenu`. */
export function MenuDropdown({
  menu,
  args,
  view,
  trigger,
  align = "start",
  side = "bottom",
  className,
}: {
  menu: string
  args?: unknown[]
  view?: string
  trigger: ReactElement
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}) {
  const groups = useMenu(menu, view)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent
        align={align}
        side={side}
        className={cn("w-auto min-w-56", className)}
      >
        <MenuGroups groups={groups} args={args} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Shows a menu on right-click inside `children`. Without items, the browser's own menu stays. */
export function ContextMenuArea({
  menu,
  args,
  view,
  children,
  className,
}: {
  menu: string
  args?: unknown[]
  view?: string
  children: ReactNode
  className?: string
}) {
  const groups = useMenu(menu, view)
  if (groups.length === 0) return <div className={className}>{children}</div>
  return (
    <ContextMenu>
      <ContextMenuTrigger className={className}>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-48">
        <MenuGroups groups={groups} kit={contextKit} args={args} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** An icon button with a tooltip naming it and its keybinding. */
export function ActionButton({
  icon: IconComponent,
  title,
  keybinding,
  pressed,
  className,
  ...props
}: {
  icon?: Icon
  title: string
  keybinding?: string
  pressed?: boolean
} & Omit<ComponentProps<typeof Button>, "title" | "children">) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={title}
            aria-pressed={pressed}
            className={cn(
              "text-muted-foreground hover:text-foreground aria-pressed:text-foreground",
              className
            )}
            {...props}
          />
        }
      >
        {IconComponent ? (
          <IconComponent />
        ) : (
          <span className="text-xs">{title.slice(0, 1)}</span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        {title}
        {keybinding && <KeybindingLabel keybinding={keybinding} />}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The actions of a menu in a title bar: the `navigation` group as icons, everything else behind
 * a "…" button. `view` scopes `view/title` items to one widget.
 */
export function ActionBar({
  menu,
  view,
  args = [],
  className,
}: {
  menu: string
  view?: string
  args?: unknown[]
  className?: string
}) {
  const groups = useMenu(menu, view)
  const label = useLabel()
  const inline = groups.find((group) => group.name === "navigation")?.items
  const rest = groups.filter((group) => group.name !== "navigation")
  if (!inline && rest.length === 0) return null
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {inline?.map((item) =>
        item.kind === "command" ? (
          <ActionButton
            key={item.key}
            icon={item.icon}
            title={label(item.title)}
            keybinding={item.keybinding}
            pressed={item.checked}
            disabled={!item.enabled}
            onClick={() => void executeCommand(item.id, ...(item.args ?? args))}
          />
        ) : null
      )}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("workbench.moreActions")}
                title={t("workbench.moreActions")}
                className="text-muted-foreground hover:text-foreground"
              />
            }
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            <MenuGroups groups={rest} args={args} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

/** A compact status bar entry that runs `command` when clicked. */
export function StatusBarItem({
  icon: IconComponent,
  text,
  tooltip,
  command,
  args = [],
  onClick,
  className,
}: {
  icon?: Icon
  text?: ReactNode
  tooltip?: string
  command?: string
  args?: unknown[]
  onClick?: () => void
  className?: string
}) {
  const interactive = !!command || !!onClick
  const button = (
    <button
      type="button"
      aria-label={tooltip}
      disabled={!interactive}
      onClick={() => {
        onClick?.()
        if (command) void executeCommand(command, ...args)
      }}
      className={cn(
        "flex h-full items-center gap-1 px-1.5 whitespace-nowrap outline-none hover:bg-foreground/10 focus-visible:bg-foreground/10 disabled:hover:bg-transparent [&_svg]:size-3.5 [&_svg]:shrink-0",
        className
      )}
    >
      {IconComponent && <IconComponent />}
      {text !== undefined && <span className="truncate">{text}</span>}
    </button>
  )
  if (!tooltip) return button
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

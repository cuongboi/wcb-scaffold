import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useT } from "@/i18n"
import { useMenu } from "@/workbench"
import { MenuGroups } from "@/workbench/ui"

export type AccountUser = {
  name: string
  email: string
  image?: string | null
}

export function UserAvatar({
  user,
  className,
}: {
  user: AccountUser
  className?: string
}) {
  return (
    <Avatar className={className}>
      <AvatarImage src={user.image ?? undefined} alt={user.name} />
      <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

export function UserSummary({ user }: { user: AccountUser }) {
  return (
    <>
      <UserAvatar user={user} />
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-xs">{user.email}</span>
      </div>
    </>
  )
}

/** The avatar at the bottom of the activity bar. Its items come from the `activitybar/accounts` menu. */
export function AccountMenu({ user }: { user: AccountUser }) {
  const t = useT()
  const groups = useMenu("activitybar/accounts")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t("workbench.account")}
            data-testid="nav-user"
            className="flex size-11 items-center justify-center outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
          />
        }
      >
        <UserAvatar user={user} className="size-6 text-[10px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={4}
        className="w-auto min-w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <UserSummary user={user} />
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {groups.length > 0 && <DropdownMenuSeparator />}
        <MenuGroups groups={groups} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

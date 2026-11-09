import { GlobeIcon, PaletteIcon, UserIcon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppearanceTab } from "@/features/settings/appearance-tab"
import { LanguageTab } from "@/features/settings/language-tab"
import { ProfileTab, type ProfileUser } from "@/features/settings/profile-tab"
import { useT } from "@/i18n"

export function SettingsDialog({
  user,
  open,
  onOpenChange,
}: {
  user: ProfileUser
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.description")}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="profile">
          <TabsList className="w-full">
            <TabsTrigger value="profile">
              <UserIcon />
              {t("settings.profile")}
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <PaletteIcon />
              {t("settings.appearance")}
            </TabsTrigger>
            <TabsTrigger value="language">
              <GlobeIcon />
              {t("settings.language")}
            </TabsTrigger>
          </TabsList>
          {/* A fixed height, so switching tabs doesn't resize the dialog. */}
          <TabsContent value="profile" className="h-80 flex-none">
            <ScrollArea className="size-full">
              <div className="p-1">
                <ProfileTab user={user} />
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="appearance" className="h-80 flex-none">
            <ScrollArea className="size-full">
              <div className="p-1">
                <AppearanceTab />
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="language" className="h-80 flex-none">
            <ScrollArea className="size-full">
              <div className="p-1">
                <LanguageTab />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

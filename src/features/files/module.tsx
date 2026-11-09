import { FolderIcon } from "lucide-react"

import { FileUploads } from "@/features/files/file-uploads"
import { t } from "@/i18n"
import { defineModule } from "@/workbench"

export const filesModule = defineModule({
  id: "files",
  title: () => t("nav.files"),
  builtin: true,
  widgets: [
    {
      id: "files",
      location: "main",
      path: "/files",
      title: () => t("nav.files"),
      icon: FolderIcon,
      order: 20,
      component: FileUploads,
    },
  ],
})

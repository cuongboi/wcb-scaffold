import {
  CopyIcon,
  HandIcon,
  MegaphoneIcon,
  SearchCodeIcon,
  SparklesIcon,
} from "lucide-react"

import { api } from "@/lib/api"
import { defineModule, localized, workbench } from "@/workbench"

import { GREETINGS, logGreeting } from "./state"
import {
  HelloInspector,
  HelloLog,
  HelloPage,
  HelloStatus,
  HelloView,
} from "./views"

function announce(greeting: string) {
  logGreeting(greeting)
  workbench.notify(greeting)
}

/** Asks for a name, then has the server half of the module write the greeting. */
async function sayHi() {
  const name = await workbench.inputBox({
    title: "Say Hello",
    prompt: "Who should we greet?",
    placeholder: "A name",
    validate: (value) => (value.trim() ? undefined : "Enter a name"),
  })
  if (!name) return
  const { message } = await api.get<{ message: string }>(
    `/api/modules/hello/greeting?name=${encodeURIComponent(name.trim())}`
  )
  announce(message)
  workbench.output("Hello").append(message)
}

export default defineModule({
  id: "hello",
  title: localized({ en: "Hello", vi: "Xin chào" }),
  description: localized({
    en: "Example module: a widget in every location, a menu, commands, a palette and a server route.",
    vi: "Mô-đun mẫu: widget ở mọi vị trí, menu, lệnh, bảng lệnh và một route phía server.",
  }),
  commands: [
    {
      id: "hello.sayHi",
      title: localized({ en: "Say Hello", vi: "Chào hỏi" }),
      category: "Hello",
      icon: HandIcon,
      keybinding: "alt+shift+h",
      run: sayHi,
    },
    {
      id: "hello.openPage",
      title: localized({ en: "Open Hello Page", vi: "Mở trang Xin chào" }),
      category: "Hello",
      icon: SparklesIcon,
      run: () => workbench.editors.open("hello.page"),
    },
    {
      id: "hello.pickGreeting",
      title: localized({ en: "Pick a Greeting…", vi: "Chọn lời chào…" }),
      category: "Hello",
      icon: SearchCodeIcon,
      run: () => workbench.palette.open("#"),
    },
    {
      // Takes the greeting as its argument, so it stays out of the palette.
      id: "hello.announce",
      title: localized({ en: "Announce", vi: "Thông báo" }),
      icon: MegaphoneIcon,
      palette: false,
      run: (greeting) => announce(String(greeting)),
    },
    {
      id: "hello.copy",
      title: localized({ en: "Copy", vi: "Sao chép" }),
      icon: CopyIcon,
      palette: false,
      run: (greeting) => navigator.clipboard.writeText(String(greeting)),
    },
  ],
  widgets: [
    {
      id: "hello.view",
      location: "left",
      title: localized({ en: "Hello", vi: "Xin chào" }),
      icon: HandIcon,
      order: 50,
      component: HelloView,
    },
    {
      id: "hello.inspector",
      location: "right",
      title: localized({ en: "Context Keys", vi: "Khóa ngữ cảnh" }),
      icon: SparklesIcon,
      component: HelloInspector,
    },
    {
      id: "hello.log",
      location: "bottom",
      title: localized({ en: "Hello Log", vi: "Nhật ký chào" }),
      icon: HandIcon,
      order: 50,
      component: HelloLog,
    },
    {
      id: "hello.page",
      location: "main",
      path: "/hello",
      title: localized({ en: "Hello", vi: "Xin chào" }),
      icon: HandIcon,
      order: 50,
      component: HelloPage,
    },
    {
      id: "hello.status",
      location: "status",
      align: "right",
      order: 10,
      title: "Hello",
      component: HelloStatus,
    },
  ],
  menus: [
    // A new top-level menu, between Terminal and Help.
    { menu: "menubar", submenu: "hello.menu", title: "Hello", order: 50 },
    { menu: "hello.menu", command: "hello.sayHi", group: "1_greet" },
    { menu: "hello.menu", command: "hello.pickGreeting", group: "1_greet" },
    { menu: "hello.menu", command: "hello.openPage", group: "2_open" },
    // Into a built-in menu.
    { menu: "menubar/help", command: "hello.openPage", group: "8_modules" },
    // In the Hello view's title bar: an icon, and an item behind "…".
    {
      menu: "view/title",
      command: "hello.sayHi",
      group: "navigation",
      when: (c) => c.view === "hello.view",
    },
    {
      menu: "view/title",
      command: "hello.openPage",
      group: "1_more",
      when: (c) => c.view === "hello.view",
    },
    // A menu of the module's own, which HelloView renders on right-click.
    { menu: "hello.greeting", command: "hello.announce", group: "1_use" },
    { menu: "hello.greeting", command: "hello.copy", group: "1_use" },
  ],
  palettes: [
    {
      id: "hello.greetings",
      prefix: "#",
      title: localized({ en: "Greetings", vi: "Lời chào" }),
      placeholder: localized({
        en: "Pick a greeting",
        vi: "Chọn một lời chào",
      }),
      provide: () =>
        GREETINGS.map((greeting) => ({
          label: greeting.text,
          description: greeting.language,
          icon: HandIcon,
          run: () => announce(greeting.text),
        })),
    },
  ],
  activate(context) {
    context.log("Hello module activated")
  },
})

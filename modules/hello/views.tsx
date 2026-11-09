import { Fragment, useState } from "react"
import { HandIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ContextMenuArea,
  StatusBarItem,
  useContextKeys,
  workbench,
  type WidgetProps,
} from "@/workbench"

import { GREETINGS, useHelloLog } from "./state"

/** Left sidebar. Each greeting has a context menu the module defines itself ("hello.greeting"). */
export function HelloView() {
  return (
    <div className="flex flex-col gap-3 p-3 text-[13px]">
      <p className="text-muted-foreground">
        This view comes from <code>modules/hello</code>. Right-click a greeting
        for its menu.
      </p>
      <Button
        size="sm"
        className="w-fit"
        onClick={() => void workbench.commands.execute("hello.sayHi")}
      >
        <HandIcon />
        Say Hello
      </Button>
      <ul className="flex flex-col">
        {GREETINGS.map((greeting) => (
          <li key={greeting.text}>
            <ContextMenuArea menu="hello.greeting" args={[greeting.text]}>
              <button
                type="button"
                onClick={() =>
                  void workbench.commands.execute(
                    "hello.announce",
                    greeting.text
                  )
                }
                className="flex w-full items-baseline gap-2 rounded-sm px-2 py-1 text-left hover:bg-sidebar-accent"
              >
                {greeting.text}
                <span className="text-xs text-muted-foreground">
                  {greeting.language}
                </span>
              </button>
            </ContextMenuArea>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Right sidebar: the live context keys that `when` clauses read. */
export function HelloInspector() {
  const keys = useContextKeys()
  const entries = Object.entries(keys)
    .filter(([, value]) => typeof value !== "function")
    .sort(([a], [b]) => a.localeCompare(b))
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 p-3 font-mono text-[11px]">
      {entries.map(([key, value]) => (
        <Fragment key={key}>
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="truncate">{String(value)}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

/** Bottom panel: every greeting so far. */
export function HelloLog() {
  const greetings = useHelloLog((state) => state.greetings)
  if (greetings.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        No greetings yet. Run Hello: Say Hello from the command palette.
      </p>
    )
  }
  return (
    <ol className="flex flex-col px-3 py-2 font-mono text-xs leading-5">
      {greetings.map((greeting, index) => (
        <li key={index}>{greeting}</li>
      ))}
    </ol>
  )
}

/** Main area, at /hello. Its counter survives switching tabs, since hidden tabs stay mounted. */
export function HelloPage({ params }: WidgetProps) {
  const [count, setCount] = useState(0)
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-lg font-medium">Hello</h1>
      <p className="text-sm text-muted-foreground">
        A page from the Hello module, opened as a tab. Switch to another tab and
        back: the count is kept.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setCount(count + 1)}>
          Clicked {count} times
        </Button>
        <Button onClick={() => void workbench.commands.execute("hello.sayHi")}>
          <HandIcon />
          Say Hello
        </Button>
        <Button variant="outline" onClick={() => workbench.palette.open("#")}>
          Pick a greeting
        </Button>
      </div>
      {Object.keys(params).length > 0 && (
        <pre className="text-xs">{JSON.stringify(params)}</pre>
      )}
    </div>
  )
}

/** Status bar. */
export function HelloStatus() {
  const count = useHelloLog((state) => state.greetings.length)
  return (
    <StatusBarItem
      icon={HandIcon}
      text={count > 0 ? `Hello ×${count}` : "Hello"}
      tooltip="Say Hello"
      command="hello.sayHi"
    />
  )
}

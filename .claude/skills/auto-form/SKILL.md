---
name: auto-form
description: Build forms with the schema-driven AutoForm component (Zod v4 + react-hook-form). Use when creating or editing any form, adding fields, validation, nested objects, repeatable array rows, custom inputs, conditional/dependent fields, or panels between fields.
---

# AutoForm

Source: `src/components/common/auto-form.tsx`. Import from `@/components/common/auto-form`.

AutoForm renders a whole form from a map of `{ fieldName: { schema, ...config } }`. Each `schema` is a Zod v4 type; it drives both validation (via `zodResolver`) and which input is rendered. Values, errors and types are inferred from the schemas — don't annotate them by hand.

## Minimal example

```tsx
import { z } from "zod"
import { AutoForm } from "@/components/common/auto-form"
import { Button } from "@/components/ui/button"

export function CustomerForm() {
    return (
        <AutoForm
            className="grid gap-4"
            schema={{
                name: { schema: z.string().min(1, "Bắt buộc"), label: "Tên" },
                email: { schema: z.email(), placeholder: "a@b.com" },
                age: { schema: z.number().int().optional() },
                type: { schema: z.enum(["personal", "business"]) },
                active: { schema: z.boolean().default(true) },
            }}
            onSubmit={async (data, form) => {
                // `data` is fully typed: { name: string; email: string; age?: number; ... }
                await save(data)
                form.reset()
            }}
        >
            <Button type="submit">Lưu</Button>
        </AutoForm>
    )
}
```

`children` render after the fields — put the submit button there.

## Schema → input mapping

| Zod type (after unwrapping optional/nullable/default/pipe…) | Rendered as |
| --- | --- |
| `string` (and anything unknown) | text `Input` |
| `number`, `bigint` | number `Input` (empty → `undefined`) |
| `boolean` | `Checkbox` with label beside it (`placeholder` overrides the text) |
| `enum` | `Select`; options auto-generated from the enum values with prettified labels |
| `date` | date `Input` (value is a `Date`) |
| `file` | file `Input` (value is the first `File`) |
| `object` | `FieldSet` with legend, children rendered recursively |
| `array` | repeatable rows with add/remove buttons |

Use `z.coerce.*` only if you really need it; the built-in number/date inputs already emit the right types.

## Field config (`FieldConfig`)

Every entry (and every nested child via `fields`) accepts:

- `label` — defaults to `schema.meta({ title })`, else prettified key (`firstName` → "First Name").
- `description` — defaults to `schema.meta({ description })` / `.describe()`.
- `placeholder`, `disabled` (cascades to children), `hidden` (keeps the value, renders nothing — use for ids).
- `options` — override enum options: `[{ label, value }]`.
- `classNames` — `{ container, input, label, description, item }` (`item` = each array row).
- `watch` — field paths; the field re-renders when they change (for conditional UI inside `render`).
- `render` — custom renderer component, receives `{ field, form, id, className, type, meta, options, defaultValue }`.
- `as` — a component that takes `{...field}` props directly (`value`, `onChange`, `onBlur`, `name`, `ref`) plus `meta`, `id`, `disabled`, `placeholder`.
- `meta` — extra props spread into `as` / passed to `render`.
- `fields` — config for children of an object, or of each item of an array of objects (keys are type-checked).
- `array` — `{ create?(index), addLabel?, removeLabel? }` for array fields.
- `defaultValue` — per-field default (top-level only).

`render` and `as` are mutually exclusive. When either is set, that component owns the **whole** value, even for objects/arrays.

## Defaults

Priority: `defaultValues` prop > field `defaultValue` > Zod `.default()` > empty value (`""` for strings, `false` for booleans, structure for objects, `min` items for arrays, `undefined` for optional/nullable). Arrays in `defaultValues` replace, not concat. Typical edit form:

```tsx
<AutoForm schema={schema} defaultValues={loaderData.customer} onSubmit={...} />
```

Keep `schema` and `defaultValues` referentially stable (module scope or `useMemo`) — both are memo dependencies.

## Nested objects

```tsx
address: {
    schema: z.object({ city: z.string(), street: z.string(), zip: z.string().optional() }),
    label: "Địa chỉ",
    fields: {
        zip: { label: "Mã bưu chính", classNames: { container: "max-w-40" } },
    },
},
```

## Arrays

```tsx
items: {
    schema: z.array(
        z.object({
            id: z.string(),
            name: z.string().min(1),
            amount: z.number().positive(),
        })
    ).min(1, "Cần ít nhất 1 dòng").max(20),
    label: "Hạng mục",
    fields: { id: { hidden: true } },          // array is transparent: configure item keys directly
    array: {
        create: () => ({ id: crypto.randomUUID(), name: "", amount: 0 }),
        addLabel: "Thêm hạng mục",               // default "Thêm"
        removeLabel: "Xóa",                      // default "Xóa" (aria-label prefix)
    },
},
```

- `.min()` / `.max()` / `.length()` disable the remove/add buttons at the bounds and set how many rows start out.
- Object items render as a horizontal row; labels show only on the first row (on sm+).
- Array-level errors (e.g. `.min(1)`) show under the list.
- Arrays of primitives work too: `z.array(z.string())`.

## Custom inputs

```tsx
import type { FieldRenderer } from "@/components/common/auto-form"

const MoneyInput: FieldRenderer = ({ field, id, className }) => (
    <Input id={id} className={className} inputMode="numeric"
        value={field.value ?? ""} onChange={(e) => field.onChange(Number(e.target.value.replace(/\D/g, "")))}
        onBlur={field.onBlur} ref={field.ref} />
)

price: { schema: z.number(), render: MoneyInput }
// or, for a component already speaking value/onChange:
note: { schema: z.string(), as: Textarea, meta: { rows: 4 } }
// images upload on pick and store their URLs (`@/components/common/image-upload`):
avatar: { schema: z.string().nullable(), as: ImageUpload }
photos: { schema: z.array(z.string()), as: ImageListUpload, meta: { maxFiles: 4 } }
```

Declare renderers at module scope so their identity is stable.

## Dependent fields & panels

Conditional field (re-renders when `type` changes):

```tsx
taxCode: {
    schema: z.string().optional(),
    watch: ["type"],
    render: ({ form, field, id }) =>
        form.getValues("type") === "business" ? <Input id={id} {...field} value={field.value ?? ""} /> : null,
},
```

Panels inject arbitrary UI before/after a field and re-render on watched paths:

```tsx
panels={[{
    after: "items",
    watch: ["items"],
    render: ({ form }) => <Total items={form.getValues("items")} />,
}]}
```

Cross-field validation: put `.refine()` on a field schema, or validate in `onSubmit` and call `form.setError(...)`.

## Imperative access

```tsx
const formRef = useRef<UseFormReturn<...>>(null)
<AutoForm formRef={formRef} ... />
formRef.current?.reset(newValues)
```

The DOM `<form>` is available through the normal `ref`.

## Other props

- `mode` — react-hook-form validation mode (`"onSubmit"` default, `"onBlur"`, `"onChange"`, …).
- `disabled` — disables the whole form.
- `className` — on the `<form>`; the form has no layout of its own, so add `grid gap-4` etc.

## Gotchas

- Zod **v4** only (`z.email()`, `.meta()`, `z.core` types).
- Error messages come from the Zod schema — write them in Vietnamese in the schema.
- Field path ids are the RHF paths (`items.0.amount`), usable for `htmlFor` / tests.
- Don't wrap AutoForm in another `<form>`.

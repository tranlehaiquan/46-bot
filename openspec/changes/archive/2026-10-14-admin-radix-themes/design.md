## Context

The `apps/admin` frontend application is a Single Page Application built with React 19, Vite 7, Tailwind CSS v4, Wouter, and TanStack React Query. The previous design attempted a shadcn-like pattern by writing custom component wrappers in `src/components/ui/` around raw Radix UI primitives. However, this introduced maintenance overhead, inconsistent UI usage (mixing custom wrappers with unstyled native HTML elements), lack of a proper notification system (resorting to `alert()`), and a TypeScript type error.

## Goals / Non-Goals

**Goals:**
- Install `@radix-ui/themes` and wrap the application with the Radix Theme provider (`appearance="dark"`, `accentColor="indigo"`).
- Replace handcrafted component files in `src/components/ui/` with direct imports from `@radix-ui/themes` (Button, Dialog, Select, Switch, Tabs, Badge, TextField, TextArea, etc.).
- Fix TypeScript type checking failure in `ChannelList.tsx:118`.
- Replace all browser `alert()` popups with non-blocking toast notifications using `sonner`.
- Convert remaining native `<select>` controls in `ChannelHeader.tsx`, `CalendarPage.tsx`, and `SettingsPage.tsx` to Radix Themes `<Select.Root>`.
- Safeguard `api.ts` `request()` against unexpected non-JSON HTTP responses.

**Non-Goals:**
- Changing backend admin endpoints, authentication mechanisms, or database schemas.
- Changing routing framework (`wouter`) or querying system (`@tanstack/react-query`).
- Altering the read-only behavior of the Messages tab (preserved according to `web-admin` specification).

## Decisions

### 1. Radix Themes Configuration
- **Decision**: Configure `<Theme appearance="dark" accentColor="indigo" grayColor="slate" radius="medium">` at the root of `App.tsx` or `main.tsx`, and import `@radix-ui/themes/styles.css`.
- **Rationale**: Radix Themes components provide built-in accessibility, keyboard navigation, and consistent dark styling matching the application's existing aesthetic without requiring generated local wrapper components.

### 2. Notification System with Sonner
- **Decision**: Add `sonner` to `apps/admin/package.json` and mount `<Toaster richColors theme="dark" position="bottom-right" />` in the layout.
- **Rationale**: Radix Themes focuses on structural and presentational components and does not include an imperative toast controller. `sonner` is lightweight, highly performant, and automatically honors the dark theme.

### 3. Component Replacement Strategy
- `Button` -> `<Button variant="solid" | "soft" | "outline" | "ghost">`
- `Dialog` -> `<Dialog.Root>`, `<Dialog.Content>`, `<Dialog.Title>`, `<Dialog.Description>`
- `ConfirmDialog` -> Custom thin wrapper or `<AlertDialog.Root>`, `<AlertDialog.Content>`, `<AlertDialog.Action>`, `<AlertDialog.Cancel>`
- `Badge` -> `<Badge color="indigo" | "green" | "amber" | "red">`
- `Input` -> `<TextField.Root>`, `<TextField.Slot>`
- `Textarea` -> `<TextArea />`
- `Select` -> `<Select.Root>`, `<Select.Trigger>`, `<Select.Content>`, `<Select.Item>`
- `Switch` -> `<Switch />`
- `Tabs` -> `<Tabs.Root>`, `<Tabs.List>`, `<Tabs.Trigger>`, `<Tabs.Content>`

### 4. TypeScript Error Fix in ChannelList.tsx
- **Decision**: Add `iconColor?: string` or provide an empty `iconColor: ""` in the `all` tab object within `ChannelList.tsx:115` to ensure consistent object shape across the tuple array.

### 5. Resilient Error Parsing in api.ts
- **Decision**: In `request<T>()`, check `response.headers.get("content-type")` or wrap `response.json()` in a try-catch fallback to `response.text()` when response is not JSON, providing a clear error message instead of an uncaught `SyntaxError`.

## Risks / Trade-offs

- **[CSS Precedence]** Radix Themes CSS styles might conflict with Tailwind CSS v4 utility classes.
  - *Mitigation*: Import `@radix-ui/themes/styles.css` before `index.css` in `main.tsx`. Tailwind utility classes can still override or augment Radix Themes component styles as needed.
- **[Bundle Size]** Adding `@radix-ui/themes`.
  - *Mitigation*: Vite performs effective tree-shaking on Radix Themes imports, and unused raw `@radix-ui/react-*` primitive packages can be pruned.

## Why

The current admin frontend (`apps/admin`) uses a mix of handcrafted Radix UI wrappers in `src/components/ui/`, ad-hoc CSS classes, native HTML `<select>` elements, and blocking browser `alert()` popups. Furthermore, there is an active TypeScript compilation error in `ChannelList.tsx` (`Property 'iconColor' does not exist on type...`), and fragile error parsing in `api.ts`.

Migrating to `@radix-ui/themes` replaces the handcrafted component boilerplate with an official, enterprise-grade, accessible component library that requires zero custom UI wrapper code to be maintained in the repository, while preserving the sleek dark aesthetic. Adding `sonner` provides smooth, non-blocking toast feedback for all administrative mutations.

## What Changes

- **Adopt `@radix-ui/themes`**: Install `@radix-ui/themes` and wrap the application with `<Theme appearance="dark" accentColor="indigo" grayColor="slate">`.
- **Eliminate Handcrafted UI Boilerplate**: Remove or replace handcrafted component wrappers in `src/components/ui/` (`button.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `switch.tsx`, `tabs.tsx`, `textarea.tsx`, `badge.tsx`, `confirm-dialog.tsx`) with direct imports from `@radix-ui/themes`.
- **Fix TypeScript Compilation Bug**: Fix `ChannelList.tsx:118` where `iconColor` was missing on the "ALL" type filter object within a `const` union array.
- **Replace Browser `alert()` with Toasts**: Integrate `sonner` (`<Toaster />`) and replace blocking `alert()` calls across all mutations (channel status, renaming, events, memories, lookups, settings) with modern toast notifications (`toast.success`, `toast.error`).
- **Standardize Form Controls**: Replace remaining native `<select>` controls in `ChannelHeader`, `CalendarPage`, and `SettingsPage` with Radix Themes `<Select.Root>`.
- **Harden API Client**: Protect `api.ts` `request()` against non-JSON response payloads (e.g., 502/504 Bad Gateway, HTML proxy error pages) to prevent uncaught `SyntaxError` crashes.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `web-admin`: Update UI component layer to use `@radix-ui/themes` and `sonner` toast notifications, eliminate handcrafted UI boilerplate in `src/components/ui/`, standardize select components, and resolve the TypeScript typecheck failure.

## Impact

- **Frontend Dependencies**: Add `@radix-ui/themes`, `sonner`. Remove unneeded individual Radix primitive dependencies once fully migrated.
- **Frontend Codebase**: Simplifies `apps/admin/src/components/*` by importing standardized UI elements directly from `@radix-ui/themes`.
- **Backend / API**: No breaking changes to backend endpoints or contracts.

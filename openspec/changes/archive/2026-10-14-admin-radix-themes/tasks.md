## 1. Dependencies & Root Theme Setup

- [x] 1.1 Install `@radix-ui/themes` and `sonner` in `apps/admin`.
- [x] 1.2 Import `@radix-ui/themes/styles.css` and configure `<Theme appearance="dark" accentColor="indigo" grayColor="slate">` with `<Toaster />` in `apps/admin/src/App.tsx` or `main.tsx`.

## 2. Bug Fixes & API Client Hardening

- [x] 2.1 Fix TypeScript error in `apps/admin/src/components/ChannelList.tsx` line 118 by ensuring `iconColor` property exists or is optional on all type filter items.
- [x] 2.2 Harden `request()` in `apps/admin/src/api.ts` to safely handle non-JSON responses (502 Bad Gateway, HTML errors) without throwing an unhandled JSON parse SyntaxError.

## 3. UI Migration to Radix Themes & Toast Feedback

- [x] 3.1 Migrate `Navbar.tsx` and `Login.tsx` to Radix Themes components (`Button`, `TextField`, `Badge`).
- [x] 3.2 Migrate `ChannelList.tsx` and `ChannelHeader.tsx` to Radix Themes components, replacing native `<select>` with `<Select.Root>`.
- [x] 3.3 Migrate `ChannelDetail.tsx` and tabs (`ChannelRemindersTab.tsx`, `ChannelMemoryTab.tsx`, `ChannelLookupsTab.tsx`, `ChannelMessagesTab.tsx`) to Radix Themes components and replace `alert()` calls with `toast.error()` / `toast.success()`.
- [x] 3.4 Migrate `CalendarPage.tsx` and `SettingsPage.tsx` to Radix Themes components, replacing native `<select>` controls and integrating toast notifications.
- [x] 3.5 Migrate `BackupExportDialog.tsx` to Radix Themes dialog and card components.

## 4. Cleanup & Verification

- [x] 4.1 Remove obsolete handcrafted wrapper files from `apps/admin/src/components/ui/`.
- [x] 4.2 Run `pnpm --filter @bot/admin exec tsc --noEmit` and `pnpm --filter @bot/admin build` to verify full TypeScript type checking and clean build output.

# Implementation Plan: dark-theme-shadcn

## Overview

All changes are confined to a single file: `client/src/index.css`. The work is split into four independent CSS-editing tasks (Tasks 1–4) that touch distinct sections of the file, followed by one verification task (Task 5) that depends on all four being complete.

## Tasks

- [x] 1. Replace `.dark {}` CSS token block with shadcn monochrome values
  - [x] 1.1 Replace core shadcn tokens in the `.dark {}` block
    - Replace `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground` with the shadcn canonical HSL values
    - Replace `--primary` (`#38bdf8` → `hsl(0 0% 98%)`), `--primary-foreground` (`#091325` → `hsl(0 0% 9%)`)
    - Replace `--secondary`, `--muted`, `--accent` and their `-foreground` variants with `hsl(0 0% 14.9%)` / `hsl(0 0% 98%)`
    - Replace `--muted-foreground` (`#94a3b8` → `hsl(0 0% 63.9%)`)
    - Replace `--destructive` (`#ef4444` → `hsl(0 62.8% 30.6%)`), `--destructive-foreground` → `hsl(0 0% 98%)`
    - Replace `--border` and `--input` (`rgba(148,163,184,0.12)` → `hsl(0 0% 14.9%)`)
    - Replace `--ring` (`#38bdf8` → `hsl(0 0% 83.1%)`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 3.1_
  - [x] 1.2 Replace custom surface tokens in the `.dark {}` block
    - Replace `--surface` (`#0f172a` → `hsl(0 0% 3.9%)`)
    - Replace `--on-surface` (`#f8fafc` → `hsl(0 0% 98%)`)
    - Replace `--on-surface-variant` (`#94a3b8` → `hsl(0 0% 63.9%)`)
    - Replace `--surface-container` (`#1e293b` → `hsl(0 0% 9%)`)
    - Replace `--surface-container-low` (`#1e293b` → `hsl(0 0% 7%)`)
    - Replace `--surface-container-lowest` (`#0b0f19` → `hsl(0 0% 2%)`)
    - Replace `--outline-variant` (`rgba(148,163,184,0.15)` → `hsl(0 0% 14.9%)`)
    - Replace `--primary-container` (`#1e293b` → `hsl(0 0% 14.9%)`)
    - Replace `--on-primary-container` (`#94a3b8` → `hsl(0 0% 63.9%)`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 2. Update global dark-mode utility overrides — replace hardcoded blue-tinted values
  - [x] 2.1 Replace the `.dark body` background gradient
    - Change `radial-gradient(circle at top left, rgba(15, 23, 42, 0.9), transparent 34rem), #091325` to `radial-gradient(circle at top left, hsl(0 0% 7%), transparent 34rem), hsl(0 0% 3.9%)`
    - _Requirements: 4.1, 4.4_
  - [x] 2.2 Replace hardcoded `rgba(15, 23, 42, …)` values in opacity-variant overrides
    - `.dark .bg-white\/95`: replace `rgba(15, 23, 42, 0.95)` with `hsl(0 0% 9% / 0.95)`
    - `.dark .bg-white\/90` and `.dark .bg-white\/80`: replace `rgba(15, 23, 42, 0.9)` with `hsl(0 0% 9% / 0.9)`
    - `.dark .bg-slate-50\/70`: replace `rgba(30, 41, 59, 0.7)` with `hsl(0 0% 9% / 0.7)`
    - _Requirements: 4.2, 4.3_

- [x] 3. Fix status color background overrides to use semantic color tints
  - [x] 3.1 Update emerald (success) background overrides
    - `.dark .bg-emerald-50`, `.dark .bg-emerald-50\/60`, `.dark .bg-emerald-50\/70`: replace `rgba(30, 41, 59, 0.8)` with `rgba(16, 185, 129, 0.15)`
    - `.dark .bg-emerald-100`: replace `rgba(30, 41, 59, 0.9)` with `rgba(16, 185, 129, 0.22)`
    - `.dark .bg-green-50`: replace `rgba(30, 41, 59, 0.8)` with `rgba(16, 185, 129, 0.15)`
    - _Requirements: 3.2_
  - [x] 3.2 Update amber/orange (warning) background overrides
    - `.dark .bg-amber-50`, `.dark .bg-amber-50\/60`, `.dark .bg-amber-50\/70`, `.dark .bg-orange-50`, `.dark .bg-orange-50\/50`, `.dark .bg-orange-50\/60`, `.dark .bg-orange-50\/70`: replace `rgba(30, 41, 59, 0.8)` with `rgba(245, 158, 11, 0.15)`
    - `.dark .bg-orange-100`, `.dark .bg-amber-100`: replace `rgba(30, 41, 59, 0.9)` with `rgba(245, 158, 11, 0.22)`
    - _Requirements: 3.3_
  - [x] 3.3 Update red (error) background overrides
    - `.dark .bg-red-50`, `.dark .bg-red-50\/70`, `.dark .bg-red-50\/60`: replace `rgba(30, 41, 59, 0.8)` with `rgba(239, 68, 68, 0.15)`
    - `.dark .bg-red-100`: replace `rgba(30, 41, 59, 0.9)` with `rgba(239, 68, 68, 0.22)`
    - _Requirements: 3.5_
  - [x] 3.4 Update blue (info) background overrides
    - `.dark .bg-blue-50`, `.dark .bg-blue-50\/60`, `.dark .bg-blue-50\/70`: replace `rgba(30, 64, 175, 0.28)` with `rgba(59, 130, 246, 0.15)`
    - `.dark .bg-blue-100`: replace `rgba(30, 64, 175, 0.38)` with `rgba(59, 130, 246, 0.22)`
    - _Requirements: 3.4_

- [x] 4. Remove explicit `.dark .app-primary-button` and `.dark .app-secondary-button` override blocks
  - [x] 4.1 Delete the `.dark .app-primary-button` override block
    - Remove the entire block: `.dark .app-primary-button { background-color: #2563eb !important; color: #ffffff !important; }` and `.dark .app-primary-button:hover { background-color: #1d4ed8 !important; }`
    - After removal, the Tailwind `dark:bg-primary` / `dark:text-primary-foreground` variants on `.app-primary-button` take effect, rendering white background with near-black text
    - _Requirements: 5.3_
  - [x] 4.2 Delete the `.dark .app-secondary-button` override block
    - Remove the entire block: `.dark .app-secondary-button { background-color: #0f172a !important; … }` and `.dark .app-secondary-button:hover { background-color: #1e293b !important; }`
    - After removal, the Tailwind `dark:bg-card` / `dark:text-foreground` variants on `.app-secondary-button` take effect
    - _Requirements: 5.4_

- [x] 5. Checkpoint — Verify light theme is unchanged and write CSS token smoke tests
  - [x] 5.1 Verify `:root` block is unmodified
    - Confirm no values under `:root {}` were altered during Tasks 1–4 (diff check)
    - Confirm `body` light-mode gradient in `@layer base` is unmodified
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ]* 5.2 Write dark-mode CSS token smoke tests
    - Create `client/src/__tests__/dark-theme-tokens.test.ts` using Vitest + jsdom
    - For each token in the new `.dark {}` block, add the `dark` class to `document.documentElement` and assert `getComputedStyle(document.documentElement).getPropertyValue('--token-name').trim()` equals the expected HSL value
    - Cover at minimum: `--background`, `--foreground`, `--card`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--ring`, `--surface-container`, `--outline-variant`
    - _Requirements: 1.1–1.10, 2.1–2.7_
  - [ ]* 5.3 Write light-theme regression smoke tests
    - In the same test file, assert that all `:root` token values are unchanged when the `dark` class is absent from `<html>`
    - _Requirements: 6.1, 6.3_
  - [ ]* 5.4 Write status color background smoke tests
    - For each status color class (`.bg-emerald-50`, `.bg-amber-50`, `.bg-red-50`, `.bg-blue-50`), create a `<div>` with the class, apply `.dark` to `<html>`, and assert the computed `background-color` matches the new semantic tint (not the old `rgba(30, 41, 59, …)`)
    - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - [ ]* 5.5 Write button override removal test
    - Assert that `.app-primary-button` in dark mode does NOT have `background-color: rgb(37, 99, 235)` (the old `#2563eb` override)
    - Assert that `.app-secondary-button` in dark mode does NOT have `background-color: rgb(15, 23, 42)` (the old `#0f172a` override)
    - _Requirements: 5.3, 5.4_
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks 1–4 are independent and can be executed in parallel — each touches a distinct section of `client/src/index.css`
- Task 5 depends on Tasks 1–4 being complete
- Sub-tasks marked with `*` are optional and can be skipped for a faster MVP
- The `:root` block and all `.tsx` component files are explicitly out of scope — do not modify them
- `ThemeContext.tsx` and `Layout.tsx` are unchanged by this feature
- After Tasks 1–4, the Tailwind `dark:` variants on `.app-primary-button` and `.app-secondary-button` automatically pick up the new `--primary` (white) and `--card` tokens — no component changes needed
- Requirements 7 (localStorage persistence) and 8 (contrast ratios) are already satisfied by the existing `ThemeContext.tsx` and the verified HSL values in the design; no additional code changes are required

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "3.3", "3.4", "4.1", "4.2"] },
    { "id": 1, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5"] }
  ]
}
```

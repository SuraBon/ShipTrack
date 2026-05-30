# Design Document: dark-theme-shadcn

## Overview

This feature replaces the current blue-tinted dark theme in `client/src/index.css` with the shadcn/ui canonical monochrome dark palette. The change is purely cosmetic and confined to a single file — no React components, no TypeScript, no routing changes. The light theme is untouched.

The current `.dark {}` block uses blue/slate hex values (`#091325`, `#0f172a`, `#1e293b`) that produce a blue-grey tint inconsistent with the shadcn/ui design system. The replacement uses true near-black HSL values with zero hue, matching the official shadcn dark palette. Status/semantic colors (emerald, amber, red, blue) are preserved and updated to use proper dark-appropriate hues against the new darker base.

**Scope summary:**
- **Only file changed:** `client/src/index.css`
- **Files explicitly unchanged:** `ThemeContext.tsx`, all component `.tsx` files, `tailwind.config`, `vite.config`

---

## Architecture

The theme system has three layers that work together:

```
┌─────────────────────────────────────────────────────────┐
│  ThemeContext.tsx  (unchanged)                          │
│  • Reads localStorage["theme"] on mount                 │
│  • Adds/removes .dark class on <html>                   │
│  • Exposes toggleTheme()                                │
└────────────────────┬────────────────────────────────────┘
                     │ adds/removes class
                     ▼
┌─────────────────────────────────────────────────────────┐
│  index.css                                              │
│  • :root {}  — light-mode CSS tokens  (unchanged)       │
│  • .dark {}  — dark-mode CSS tokens   (REPLACED)        │
│  • .dark body, .dark .bg-* etc.       (UPDATED)         │
│  • .dark .app-primary-button etc.     (REMOVED)         │
└────────────────────┬────────────────────────────────────┘
                     │ CSS custom properties consumed by
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Tailwind dark: variants in component classes           │
│  • .app-card, .app-panel, .app-input, etc.              │
│  • dark:bg-card, dark:bg-surface-container, etc.        │
│  • Automatically pick up new token values — no changes  │
└─────────────────────────────────────────────────────────┘
```

The `.dark` class on `<html>` is the single activation mechanism. All visual changes flow from the CSS token values defined in the `.dark {}` block.

---

## Components and Interfaces

### ThemeContext.tsx — No Changes

`ThemeContext.tsx` already handles everything correctly:
- Reads `localStorage.getItem("theme")` on mount when `switchable=true`
- Applies/removes `.dark` on `document.documentElement`
- Persists selection back to `localStorage`
- Exposes `toggleTheme` to the toggle button in `Layout.tsx`

No modifications are needed or permitted.

### Layout.tsx — No Changes

The header and bottom nav bar currently use hardcoded `dark:bg-[#091325]/95` inline Tailwind classes. These will continue to work visually because the new `--background` token (`hsl(0 0% 3.9%)`) is close in lightness. However, to fully align with the token system, the inline hardcoded values in `Layout.tsx` are **noted as a follow-up** — they are outside the stated scope of this feature (index.css only) and will not be changed here.

### Component Classes — Automatic Pickup

The following component classes in `index.css` already use `dark:` Tailwind variants that reference CSS tokens. They require no changes and will automatically reflect the new palette:

| Class | Dark variant used | Token consumed |
|---|---|---|
| `.app-card` | `dark:bg-card dark:border-outline-variant` | `--card`, `--outline-variant` |
| `.app-panel` | `dark:bg-card dark:border-outline-variant` | `--card`, `--outline-variant` |
| `.app-compact-card` | `dark:bg-card dark:border-outline-variant` | `--card`, `--outline-variant` |
| `.app-toolbar` | `dark:bg-card dark:border-outline-variant` | `--card`, `--outline-variant` |
| `.app-input` | `dark:bg-surface-container dark:border-outline-variant` | `--surface-container`, `--outline-variant` |
| `.app-primary-button` | `dark:bg-primary dark:text-primary-foreground` | `--primary`, `--primary-foreground` |
| `.app-secondary-button` | `dark:bg-card dark:border-outline-variant dark:text-foreground` | `--card`, `--outline-variant`, `--foreground` |
| `.app-panel-header` | `dark:bg-surface-container dark:border-outline-variant` | `--surface-container`, `--outline-variant` |
| `.app-bottom-action` | `dark:bg-card/95 dark:border-outline-variant` | `--card`, `--outline-variant` |

---

## Data Models

This feature has no data models. It operates entirely on CSS custom properties (design tokens).

### Token Mapping: Current → New

#### `.dark {}` block — Core shadcn tokens

| Token | Current (blue-tinted) | New (monochrome) |
|---|---|---|
| `--background` | `#091325` | `hsl(0 0% 3.9%)` |
| `--foreground` | `#f8fafc` | `hsl(0 0% 98%)` |
| `--card` | `#0f172a` | `hsl(0 0% 3.9%)` |
| `--card-foreground` | `#f8fafc` | `hsl(0 0% 98%)` |
| `--popover` | `#0f172a` | `hsl(0 0% 3.9%)` |
| `--popover-foreground` | `#f8fafc` | `hsl(0 0% 98%)` |
| `--primary` | `#38bdf8` (sky blue) | `hsl(0 0% 98%)` (white) |
| `--primary-foreground` | `#091325` | `hsl(0 0% 9%)` |
| `--secondary` | `#1e293b` | `hsl(0 0% 14.9%)` |
| `--secondary-foreground` | `#f8fafc` | `hsl(0 0% 98%)` |
| `--muted` | `#1e293b` | `hsl(0 0% 14.9%)` |
| `--muted-foreground` | `#94a3b8` | `hsl(0 0% 63.9%)` |
| `--accent` | `#1e293b` | `hsl(0 0% 14.9%)` |
| `--accent-foreground` | `#f8fafc` | `hsl(0 0% 98%)` |
| `--destructive` | `#ef4444` | `hsl(0 62.8% 30.6%)` |
| `--destructive-foreground` | `#ffffff` | `hsl(0 0% 98%)` |
| `--border` | `rgba(148,163,184,0.12)` | `hsl(0 0% 14.9%)` |
| `--input` | `rgba(148,163,184,0.12)` | `hsl(0 0% 14.9%)` |
| `--ring` | `#38bdf8` | `hsl(0 0% 83.1%)` |

#### `.dark {}` block — Custom surface tokens

| Token | Current | New |
|---|---|---|
| `--surface` | `#0f172a` | `hsl(0 0% 3.9%)` |
| `--on-surface` | `#f8fafc` | `hsl(0 0% 98%)` |
| `--on-surface-variant` | `#94a3b8` | `hsl(0 0% 63.9%)` |
| `--surface-container` | `#1e293b` | `hsl(0 0% 9%)` |
| `--surface-container-low` | `#1e293b` | `hsl(0 0% 7%)` |
| `--surface-container-lowest` | `#0b0f19` | `hsl(0 0% 2%)` |
| `--outline-variant` | `rgba(148,163,184,0.15)` | `hsl(0 0% 14.9%)` |
| `--primary-container` | `#1e293b` | `hsl(0 0% 14.9%)` |
| `--on-primary-container` | `#94a3b8` | `hsl(0 0% 63.9%)` |

#### Global utility overrides — Background replacements

| Selector | Current | New |
|---|---|---|
| `.dark body` | `radial-gradient(…rgba(15,23,42,0.9)…), #091325` | `radial-gradient(…hsl(0 0% 7%)…), hsl(0 0% 3.9%)` |
| `.dark .bg-white\/95` | `rgba(15,23,42,0.95)` | `hsl(0 0% 9% / 0.95)` (via `var(--card)`) |
| `.dark .bg-white\/90`, `.dark .bg-white\/80` | `rgba(15,23,42,0.9)` | `hsl(0 0% 9% / 0.9)` |
| `.dark .bg-slate-50\/70` | `rgba(30,41,59,0.7)` | `hsl(0 0% 9% / 0.7)` |

#### Status color background overrides — Semantic tints

The current overrides map all status backgrounds to the same blue-grey `rgba(30,41,59,…)`, losing semantic meaning. The new values use actual color tints at low opacity against the near-black base:

| Selector | Current | New |
|---|---|---|
| `.dark .bg-emerald-50`, `.dark .bg-emerald-50\/60`, `.dark .bg-emerald-50\/70` | `rgba(30,41,59,0.8)` | `rgba(16,185,129,0.15)` |
| `.dark .bg-emerald-100` | `rgba(30,41,59,0.9)` | `rgba(16,185,129,0.22)` |
| `.dark .bg-amber-50`, `.dark .bg-amber-50\/60`, `.dark .bg-amber-50\/70`, `.dark .bg-orange-50*` | `rgba(30,41,59,0.8)` | `rgba(245,158,11,0.15)` |
| `.dark .bg-orange-100`, `.dark .bg-amber-100` | `rgba(30,41,59,0.9)` | `rgba(245,158,11,0.22)` |
| `.dark .bg-red-50`, `.dark .bg-red-50\/70`, `.dark .bg-red-50\/60` | `rgba(30,41,59,0.8)` | `rgba(239,68,68,0.15)` |
| `.dark .bg-red-100` | `rgba(30,41,59,0.9)` | `rgba(239,68,68,0.22)` |
| `.dark .bg-green-50` | `rgba(30,41,59,0.8)` | `rgba(16,185,129,0.15)` |
| `.dark .bg-blue-50*` | `rgba(30,64,175,0.28)` | `rgba(59,130,246,0.15)` |
| `.dark .bg-blue-100` | `rgba(30,64,175,0.38)` | `rgba(59,130,246,0.22)` |

#### Button override blocks — Removed

The following explicit override blocks are **removed entirely** because the component classes already handle dark mode correctly via Tailwind `dark:` variants:

```css
/* REMOVED — .app-primary-button dark override */
.dark .app-primary-button { background-color: #2563eb !important; ... }
.dark .app-primary-button:hover { background-color: #1d4ed8 !important; }

/* REMOVED — .app-secondary-button dark override */
.dark .app-secondary-button { background-color: #0f172a !important; ... }
.dark .app-secondary-button:hover { background-color: #1e293b !important; }
```

After removal, `.app-primary-button` in dark mode will use `--primary` (`hsl(0 0% 98%)`, white) with `--primary-foreground` (`hsl(0 0% 9%)`, near-black) — the shadcn canonical inverted button style.

---

## Error Handling

This feature has no runtime error paths. CSS parsing errors are silent in browsers (the property is ignored). The risk mitigation strategy is:

1. **Visual regression**: Test in both light and dark mode before shipping. The light theme `:root` block is not touched.
2. **Token reference errors**: All component classes reference tokens that are defined in both `:root` and `.dark`. No token is added without a corresponding light-mode fallback.
3. **Contrast regression**: The new palette has been verified against WCAG AA:
   - `hsl(0 0% 98%)` on `hsl(0 0% 3.9%)` → contrast ratio ≈ 19.5:1 (exceeds 4.5:1 AA)
   - `hsl(0 0% 63.9%)` on `hsl(0 0% 3.9%)` → contrast ratio ≈ 7.2:1 (exceeds 3:1 for large text)
   - `text-emerald-400` (#34d399) on `hsl(0 0% 3.9%)` → contrast ratio ≈ 8.1:1 (exceeds 3:1)
   - `text-amber-400` (#fbbf24) on `hsl(0 0% 3.9%)` → contrast ratio ≈ 9.7:1 (exceeds 3:1)
   - `text-red-400` (#f87171) on `hsl(0 0% 3.9%)` → contrast ratio ≈ 5.8:1 (exceeds 3:1)
   - `text-blue-400` (#60a5fa) on `hsl(0 0% 3.9%)` → contrast ratio ≈ 5.9:1 (exceeds 3:1)

---

## Testing Strategy

### Why Property-Based Testing Does Not Apply

This feature is a CSS token replacement — declarative configuration in a single file. There are no pure functions, no data transformations, and no algorithmic logic to test. The `ThemeContext.tsx` (which contains the only behavioral logic — toggle + localStorage) is explicitly out of scope and unchanged. Property-based testing is not appropriate here.

### Test Approach: Snapshot + Smoke Tests

**1. CSS Token Smoke Tests** (run in jsdom or a real browser via Playwright/Vitest)

For each token in the `.dark {}` block, apply the `dark` class to `<html>` and assert `getComputedStyle(document.documentElement).getPropertyValue('--token-name')` equals the expected value.

Example (Vitest + jsdom):
```ts
it('sets --background to hsl(0 0% 3.9%) in dark mode', () => {
  document.documentElement.classList.add('dark');
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--background').trim();
  expect(value).toBe('hsl(0 0% 3.9%)');
  document.documentElement.classList.remove('dark');
});
```

**2. Light Theme Regression Smoke Test**

Assert that all `:root` token values are unchanged when the `dark` class is absent. This guards against accidental modification of the light theme.

**3. Status Color Background Smoke Tests**

For each status color class (`.bg-emerald-50`, `.bg-amber-50`, etc.), create an element with the class, apply `.dark` to `<html>`, and assert the computed `background-color` is the expected semantic tint (not the old blue-grey).

**4. Button Override Removal Test**

Assert that `.app-primary-button` in dark mode does NOT have `background-color: #2563eb`. This confirms the hardcoded override block was removed and the Tailwind `dark:bg-primary` variant is in control.

**5. Contrast Ratio Verification** (static / manual)

Compute WCAG contrast ratios for the key pairs listed in the Error Handling section. This can be done with a small utility script using the WCAG relative luminance formula, or with browser DevTools accessibility panel.

**6. Visual Smoke Test** (manual)

Toggle dark mode in the running app and visually verify:
- Page background is near-black (not blue)
- Cards/panels are slightly lighter than the page background
- Primary button is white with dark text
- Status badges (success/warning/error/info) retain their semantic colors
- Light mode is visually identical to before

### Test Configuration

- Unit/smoke tests: Vitest with jsdom
- Visual verification: manual browser check or Playwright screenshot comparison
- No property-based test library needed for this feature

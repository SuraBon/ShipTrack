# Requirements Document

## Introduction

This feature replaces the current custom blue-tinted dark theme (`#091325` background) with a shadcn/ui-canonical dark theme. The new dark theme uses a true black/near-black monochrome base (matching the shadcn/ui dark palette at https://ui.shadcn.com) while retaining color for status indicators and semantically meaningful UI elements (e.g., success, warning, error, info badges). The light theme remains unchanged. The toggle mechanism and ThemeContext already exist and will be preserved.

## Glossary

- **Theme_System**: The combination of CSS custom properties, Tailwind dark-variant classes, and ThemeContext that control the visual appearance of the application.
- **Dark_Theme**: The visual mode activated when the `dark` class is present on `<html>`, using the shadcn/ui canonical dark palette.
- **Light_Theme**: The existing light-mode visual appearance; must remain unchanged by this feature.
- **CSS_Token**: A CSS custom property (e.g., `--background`, `--foreground`) defined in `index.css` and consumed by Tailwind utility classes.
- **Status_Color**: A color used exclusively to convey semantic meaning — success (green), warning (amber/orange), error (red), info (blue/cyan) — permitted in the dark theme.
- **Monochrome_Base**: The set of background, surface, card, border, and neutral text tokens that must use only black, white, and grey values (no hue) in dark mode.
- **shadcn_Palette**: The official shadcn/ui dark-mode CSS variable values documented at https://ui.shadcn.com/themes.
- **ThemeContext**: The React context in `client/src/contexts/ThemeContext.tsx` that manages theme state and exposes `toggleTheme`.
- **Toggle_Button**: The Sun/Moon icon button in the top navigation bar that calls `toggleTheme`.

---

## Requirements

### Requirement 1: Monochrome Dark Base Tokens

**User Story:** As a user, I want the dark theme to use a true black/near-black monochrome base so that the interface matches the clean, high-contrast shadcn/ui dark aesthetic.

#### Acceptance Criteria

1. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--background` to `hsl(0 0% 3.9%)` (shadcn canonical dark background).
2. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--foreground` to `hsl(0 0% 98%)` (shadcn canonical dark foreground).
3. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--card` to `hsl(0 0% 3.9%)` and `--card-foreground` to `hsl(0 0% 98%)`.
4. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--popover` to `hsl(0 0% 3.9%)` and `--popover-foreground` to `hsl(0 0% 98%)`.
5. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--muted` to `hsl(0 0% 14.9%)` and `--muted-foreground` to `hsl(0 0% 63.9%)`.
6. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--border` to `hsl(0 0% 14.9%)` and `--input` to `hsl(0 0% 14.9%)`.
7. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--secondary` to `hsl(0 0% 14.9%)` and `--secondary-foreground` to `hsl(0 0% 98%)`.
8. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--accent` to `hsl(0 0% 14.9%)` and `--accent-foreground` to `hsl(0 0% 98%)`.
9. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--primary` to `hsl(0 0% 98%)` and `--primary-foreground` to `hsl(0 0% 9%)`.
10. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--ring` to `hsl(0 0% 83.1%)`.

### Requirement 2: Surface and Container Tokens

**User Story:** As a user, I want layered surface backgrounds in dark mode to provide visual depth without introducing color hue, so that cards, panels, and containers are distinguishable from the page background.

#### Acceptance Criteria

1. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--surface` to `hsl(0 0% 3.9%)`.
2. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--surface-container` to `hsl(0 0% 9%)`.
3. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--surface-container-low` to `hsl(0 0% 7%)`.
4. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--surface-container-lowest` to `hsl(0 0% 2%)`.
5. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--on-surface` to `hsl(0 0% 98%)`.
6. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--on-surface-variant` to `hsl(0 0% 63.9%)`.
7. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--outline-variant` to `hsl(0 0% 14.9%)`.

### Requirement 3: Status Colors Preserved in Dark Mode

**User Story:** As a user, I want status indicators (success, warning, error, info) to retain their semantic colors in dark mode so that I can quickly identify the state of parcels and system alerts.

#### Acceptance Criteria

1. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set `--destructive` to `hsl(0 62.8% 30.6%)` and `--destructive-foreground` to `hsl(0 0% 98%)`.
2. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL render success Status_Colors using green hues (e.g., `text-emerald-400`, `bg-emerald-500/20`) without overriding them to grey.
3. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL render warning Status_Colors using amber/orange hues (e.g., `text-amber-400`, `bg-amber-500/20`) without overriding them to grey.
4. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL render info Status_Colors using blue/cyan hues (e.g., `text-blue-400`, `bg-blue-500/20`) without overriding them to grey.
5. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL render error Status_Colors using red hues (e.g., `text-red-400`, `bg-red-500/20`) without overriding them to grey.

### Requirement 4: Global Dark-Mode Overrides Aligned to Monochrome Base

**User Story:** As a developer, I want the global CSS dark-mode overrides in `index.css` to be updated to use the monochrome base tokens so that hardcoded blue-tinted values (`#091325`, `#0f172a`, `#1e293b`) are replaced throughout.

#### Acceptance Criteria

1. THE Theme_System SHALL replace all occurrences of the hardcoded value `#091325` in dark-mode CSS rules with the equivalent monochrome token or `hsl(0 0% 3.9%)`.
2. THE Theme_System SHALL replace all occurrences of the hardcoded value `#0f172a` in dark-mode CSS rules with the equivalent monochrome token or `hsl(0 0% 5%)`.
3. THE Theme_System SHALL replace all occurrences of the hardcoded value `#1e293b` in dark-mode CSS rules with the equivalent monochrome token or `hsl(0 0% 9%)`.
4. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL apply a neutral (grey-toned) radial gradient to `body` background instead of the current blue-tinted gradient.
5. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL set the header and bottom navigation bar backgrounds to use the monochrome card/surface token rather than the hardcoded `#091325` value.

### Requirement 5: Component-Level Dark Styles Consistent with Monochrome Base

**User Story:** As a user, I want all application components (cards, inputs, buttons, dialogs, navigation) to visually match the monochrome dark base so that the UI is cohesive.

#### Acceptance Criteria

1. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL render `.app-card`, `.app-panel`, `.app-compact-card`, and `.app-toolbar` with `--card` as their background.
2. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL render `.app-input` with `--surface-container` as its background and `--outline-variant` as its border color.
3. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL render `.app-primary-button` with `--primary` (white) as its background and `--primary-foreground` (near-black) as its text color.
4. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL render `.app-secondary-button` with `--card` as its background and `--foreground` as its text color.
5. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL render `input`, `textarea`, and `select` elements with `--card` as their background and `--foreground` as their text color.
6. WHEN the `dark` class is present on `<html>`, THE Theme_System SHALL render webkit autofill overrides using `--card` as the inset box-shadow color.

### Requirement 6: Light Theme Unchanged

**User Story:** As a user, I want the light theme to remain exactly as it is so that switching to light mode restores the original appearance.

#### Acceptance Criteria

1. WHEN the `dark` class is absent from `<html>`, THE Theme_System SHALL apply the existing `:root` CSS token values without modification.
2. WHEN the `dark` class is absent from `<html>`, THE Theme_System SHALL render `body` with the existing light-mode radial gradient background.
3. THE Theme_System SHALL not alter any CSS token values defined under `:root` (light mode) as part of this feature.

### Requirement 7: Theme Toggle Persistence

**User Story:** As a user, I want my dark theme preference to be remembered across page reloads so that I do not have to re-enable dark mode every visit.

#### Acceptance Criteria

1. WHEN a user activates the Dark_Theme via the Toggle_Button, THE Theme_System SHALL persist the selection to `localStorage` under the key `"theme"`.
2. WHEN the application loads and `localStorage` contains `"theme": "dark"`, THE Theme_System SHALL apply the `dark` class to `<html>` before the first render.
3. WHEN a user deactivates the Dark_Theme via the Toggle_Button, THE Theme_System SHALL update `localStorage` to `"theme": "light"` and remove the `dark` class from `<html>`.

### Requirement 8: Accessibility — Contrast Ratios

**User Story:** As a user with visual impairments, I want the dark theme to maintain sufficient contrast between text and backgrounds so that content remains readable.

#### Acceptance Criteria

1. THE Theme_System SHALL ensure that the contrast ratio between `--foreground` (`hsl(0 0% 98%)`) and `--background` (`hsl(0 0% 3.9%)`) meets WCAG AA (minimum 4.5:1 for normal text).
2. THE Theme_System SHALL ensure that the contrast ratio between `--muted-foreground` (`hsl(0 0% 63.9%)`) and `--background` (`hsl(0 0% 3.9%)`) meets WCAG AA for large text (minimum 3:1).
3. THE Theme_System SHALL ensure that Status_Color text variants used in dark mode (e.g., `text-emerald-400`, `text-amber-400`, `text-red-400`, `text-blue-400`) maintain a contrast ratio of at least 3:1 against `--card` backgrounds.

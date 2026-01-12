# Mantodeus Manager Design System
## Superwhisper-Inspired Redesign Specification

**Version**: 1.0  
**Last Updated**: 2026-01-12  
**Status**: Production-Ready Spec

---

## A) Aesthetic Translation

### Superwhisper Visual Language → Mantodeus

| Superwhisper Element | Mantodeus Translation |
|---------------------|----------------------|
| Monochrome surfaces | Layered `surface-0/1/2/3` tokens with subtle elevation |
| Soft premium feel | Gentle shadows, rounded corners (`radius-xl`), no harsh edges |
| Subtle texture/grain | Opt-in `--noise-opacity` overlay (default: off) |
| Big typography | Kanit font, generous sizing, weight 300-400 for readability |
| Pill CTAs | `rounded-full` buttons with `h-10` height |
| Gentle borders | `border-border/50` opacity, no harsh 1px solid lines |
| Soft shadows | `shadow-sm` to `shadow-lg` using token-defined values |

### Design Principles

1. **Monochrome Foundation**: The UI is predominantly grayscale. Color is reserved for:
   - Accent highlights (green in dark mode, pink in light mode)
   - Semantic states (success, warning, error)
   - Interactive feedback

2. **Layered Depth**: Surfaces stack visually using the `surface-0` → `surface-3` hierarchy. Higher numbers = more elevated.

3. **Buttery Motion**: All animations use defined easing curves. No jarring transitions.

4. **Premium Restraint**: Less is more. Avoid decorative elements. Let content breathe.

---

## B) Design Tokens

### Brand Anchors (DO NOT CHANGE)

```css
/* Dark Mode Accent - Green Mantis */
--primary: oklch(0.85 0.25 155);

/* Light Mode Accent - Orchid Mantis */  
--primary: oklch(0.75 0.25 330);

/* Font Family */
font-family: 'Kanit', sans-serif;
```

### Surface Tokens

```css
:root {
  /* Surface hierarchy - light mode */
  --surface-0: oklch(0.98 0.01 85);   /* Page background */
  --surface-1: oklch(0.96 0.01 85);   /* Cards */
  --surface-2: oklch(0.94 0.01 85);   /* Elevated (popovers, dropdowns) */
  --surface-3: oklch(0.92 0.01 85);   /* Highest elevation (modals) */
  --surface-overlay: oklch(0.98 0.01 85 / 0.85); /* Translucent overlays */
  
  /* Map to shadcn semantic tokens */
  --background: var(--surface-0);
  --card: var(--surface-1);
  --popover: var(--surface-2);
  --muted: var(--surface-3);
}

.dark {
  /* Surface hierarchy - dark mode */
  --surface-0: oklch(0.10 0 0);
  --surface-1: oklch(0.12 0 0);
  --surface-2: oklch(0.14 0 0);
  --surface-3: oklch(0.16 0 0);
  --surface-overlay: oklch(0.10 0 0 / 0.85);
  
  /* Map to shadcn semantic tokens */
  --background: var(--surface-0);
  --card: var(--surface-1);
  --popover: var(--surface-2);
  --muted: var(--surface-3);
}
```

### Spacing Tokens

```css
:root {
  /* Header spacing */
  --space-header-subtitle: 12px;      /* TitleRow ↔ SubtitleRow */
  --space-header-actions: 16px;       /* SubtitleRow ↔ ActionRow */
  --space-header-icons: 8px;          /* Between icon buttons */
  
  /* Page layout spacing */
  --space-page-gap: 24px;             /* Header ↔ Content, Section ↔ Section */
  --space-section-gap: 24px;          /* Between major sections */
  
  /* Card spacing */
  --space-card-gap: 16px;             /* Between cards in grid */
  --space-card-padding: 16px;         /* Internal card padding */
}

/* Mobile overrides */
@media (max-width: 767px) {
  :root {
    --space-header-subtitle: 8px;
    --space-header-actions: 12px;
    --space-page-gap: 20px;
    --space-section-gap: 20px;
    --space-card-gap: 12px;
  }
}
```

### Safe Area Tokens

```css
:root {
  /* Base values */
  --tab-bar-height: 56px;
  --multi-select-bar-height: 72px;
  
  /* Computed safe areas */
  --bottom-safe-area: calc(
    env(safe-area-inset-bottom, 0px) + 
    var(--tab-bar-height)
  );
  
  --bottom-safe-area-with-select: calc(
    var(--bottom-safe-area) + 
    var(--multi-select-bar-height)
  );
}
```

### Motion Tokens

```css
:root {
  /* Easing curves */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);         /* Default - snappy settle */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);    /* Symmetric transitions */
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);         /* Exit/disappear only */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy feedback */
  
  /* Durations */
  --dur-instant: 50ms;      /* Micro-feedback (checkbox tick) */
  --dur-quick: 150ms;       /* Hover, focus, color changes */
  --dur-standard: 250ms;    /* Most transitions (scale, opacity) */
  --dur-slow: 400ms;        /* Modals, sheets, page transitions */
  --dur-emphasis: 500ms;    /* Attention-grabbing (onboarding) */
  
  /* Blur values */
  --blur-subtle: 8px;       /* Light glass effect */
  --blur-standard: 16px;    /* Cards, popovers */
  --blur-overlay: 24px;     /* Full overlays, sheets */
}
```

#### Motion Usage Guide

| Context | Duration | Easing |
|---------|----------|--------|
| Button hover/press | `--dur-quick` | `--ease-out` |
| Focus ring appear | `--dur-quick` | `--ease-out` |
| Card hover lift | `--dur-standard` | `--ease-out` |
| Modal open | `--dur-slow` | `--ease-out` |
| Modal close | `--dur-standard` | `--ease-in` |
| Toggle switch | `--dur-quick` | `--ease-spring` |
| Tab indicator slide | `--dur-standard` | `--ease-in-out` |
| Toast appear | `--dur-standard` | `--ease-spring` |

### Typography Weights (Kanit)

| Element | Weight | Size | Class |
|---------|--------|------|-------|
| Display headings | 100-200 | 48px+ | Hero/splash only |
| Page titles (h1) | 300 | 30px | `text-3xl font-light` |
| Section titles (h2) | 400 | 20px | `text-xl font-normal` |
| Card titles | 400 | 16px | `text-base font-normal` |
| Body text | 300 | 14px | `text-sm font-light` |
| Muted/secondary | 300 | 14px | `text-sm font-light text-muted-foreground` |
| Buttons | 400 | 14px | `text-sm font-normal` |

**Rule**: Never use `font-weight: 100` for text smaller than 24px.

### Radius Scale

```css
:root {
  --radius-sm: 6px;    /* Small elements (badges, chips) */
  --radius-md: 8px;    /* Buttons, inputs */
  --radius-lg: 12px;   /* Cards */
  --radius-xl: 16px;   /* Sheets, modals */
  --radius-2xl: 24px;  /* Large panels */
  --radius-full: 9999px; /* Pills */
}
```

### Noise Texture (Opt-In)

```css
:root {
  --noise-opacity: 0;  /* Off by default */
}

.surface-textured {
  position: relative;
}

.surface-textured::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url('/noise.svg');
  opacity: var(--noise-opacity);
  pointer-events: none;
  mix-blend-mode: overlay;
  border-radius: inherit;
}
```

**Rules**:
- Default: OFF (`--noise-opacity: 0`)
- Maximum: `--noise-opacity: 0.05`
- Test performance on mobile before enabling

---

## C) Component Specifications

### PageContainer

Enforces consistent page-level spacing and width constraints.

```typescript
type PageContainerProps = {
  children: React.ReactNode;
  variant?: "default" | "narrow" | "fullscreen";
  multiSelectActive?: boolean;
};
```

| Variant | Max Width | Horizontal Padding |
|---------|-----------|-------------------|
| `default` | 1280px (`max-w-7xl`) | 16px mobile, 24px tablet, 32px desktop |
| `narrow` | 768px (`max-w-3xl`) | Same as default |
| `fullscreen` | 100% | 0 (content manages own padding) |

**Tailwind Recipe**:
```tsx
// Default variant
<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  {children}
</div>

// With spacing
<div 
  className="space-y-[var(--space-page-gap)]"
  style={{ paddingBottom: multiSelectActive ? 'var(--bottom-safe-area-with-select)' : 'var(--bottom-safe-area)' }}
>
```

**Do**:
- Always wrap page content in `PageContainer`
- Use `multiSelectActive` prop for bottom padding
- Let CSS vars handle safe area math

**Don't**:
- Add custom `max-w-*` per page
- Hardcode bottom padding values
- Use different horizontal padding per page

---

### PageHeader

Standardized header with title, subtitle, icon actions, and primary actions.

```typescript
type PageHeaderProps = {
  // REQUIRED
  title: string;
  
  // OPTIONAL
  subtitle?: string;
  leading?: React.ReactNode;        // Back button (detail pages only)
  
  // ICON ACTIONS - handlers, not JSX
  onSearch?: () => void;
  onFilter?: () => void;
  onSettings?: () => void;
  searchEnabled?: boolean;          // Default: true
  filterEnabled?: boolean;          // Default: true
  settingsEnabled?: boolean;        // Default: true
  extraActions?: React.ReactNode;   // Escape hatch (must justify)
  
  // PRIMARY ACTIONS
  primaryActions?: React.ReactNode;
  
  // VARIANT
  variant?: "default" | "detail" | "fullscreen";
};
```

#### Header Anatomy

```
DESKTOP (≥768px):
+------------------------------------------------------------------+
|  TITLE                              [Search] [Filter] [Settings] |  <- TitleRow
|  Description text here                                           |  <- SubtitleRow
+------------------------------------------------------------------+
|                                      [Secondary] [+ Primary]     |  <- ActionRow
+------------------------------------------------------------------+

MOBILE (<768px):
+----------------------------------+
|  TITLE           [🔍] [⚙️] [⚙️]  |  <- TitleRow
|  Description                     |  <- SubtitleRow
+----------------------------------+
|  [Secondary]                     |  <- ActionRow (full-width stacked)
|  [+ Primary]                     |
+----------------------------------+
```

#### Variant Behavior

| Variant | TitleRow | SubtitleRow | ActionRow | Icon Cluster |
|---------|----------|-------------|-----------|--------------|
| `default` | ✓ | ✓ | ✓ | Full (Search/Filter/Settings) |
| `detail` | ✓ (with back button) | ✓ | ✓ | None |
| `fullscreen` | ✓ | ✗ | ✗ | Settings only |

**Internal Component**: `<HeaderIconCluster />` renders icons with:
- Fixed order: Search → Filter → Settings → extraActions
- Fixed size: `size-6` icons, `size-9` touch targets
- Fixed spacing: `gap-2` between icons

**Do**:
- Pass handlers (`onSearch`, `onFilter`) not JSX
- Use `searchEnabled={false}` to hide icons
- Use `variant` for different page types

**Don't**:
- Pass custom JSX to icon slots
- Override icon sizes per page
- Add responsive logic in page components

---

### Card

Soft surface with consistent padding and radius.

```tsx
<Card className="bg-card border-border/50 rounded-[var(--radius-lg)] p-[var(--space-card-padding)] shadow-sm">
  {children}
</Card>
```

**Tailwind Recipe**:
```css
.card {
  @apply bg-card rounded-xl border border-border/50 shadow-sm;
  padding: var(--space-card-padding);
}

.card:hover {
  @apply shadow-md;
  transition: box-shadow var(--dur-standard) var(--ease-out);
}
```

**Do**:
- Use `--space-card-padding` token
- Use `border-border/50` for soft borders
- Add hover lift with `shadow-md`

**Don't**:
- Override padding per card
- Use different border opacity per card
- Mix shadow styles

---

### Button

Primary, Secondary, Ghost, and Pill variants.

```typescript
type ButtonVariant = "default" | "secondary" | "ghost" | "outline" | "destructive" | "pill";
```

**Pill Variant Recipe**:
```css
.btn-pill {
  @apply rounded-full h-10 px-6 font-normal;
  transition: all var(--dur-quick) var(--ease-out);
}

.btn-pill:hover {
  transform: scale(1.02);
}

.btn-pill:active {
  transform: scale(0.98);
  transition: transform var(--dur-instant) var(--ease-spring);
}
```

**Do**:
- Use `h-10` for all primary action buttons
- Use `rounded-full` for pill style
- Apply motion tokens for hover/press

**Don't**:
- Mix button heights on same row
- Use ad-hoc `duration-150`

---

### Badge

Status indicators with muted colors.

| Status | Light Mode | Dark Mode |
|--------|------------|-----------|
| Draft | `bg-muted text-muted-foreground` | Same |
| Sent/Open | `bg-blue-50 text-blue-600` | `bg-blue-900/30 text-blue-400` |
| Paid/Complete | `bg-green-50 text-green-600` | `bg-green-900/30 text-green-400` |
| Overdue/Error | `bg-red-50 text-red-600` | `bg-red-900/30 text-red-400` |
| Needs Review | `bg-amber-50 text-amber-600` | `bg-amber-900/30 text-amber-400` |

**Do**:
- Use muted background colors
- Keep text legible (check contrast)
- Use consistent sizes

**Don't**:
- Use bright/saturated badge colors
- Create new status colors ad-hoc

---

### Input

Text inputs with soft borders and focus states.

```css
.input {
  @apply h-10 rounded-[var(--radius-md)] border border-border/50 bg-transparent;
  @apply focus:border-primary focus:ring-2 focus:ring-primary/20;
  transition: border-color var(--dur-quick) var(--ease-out),
              box-shadow var(--dur-quick) var(--ease-out);
}
```

**Do**:
- Use `border-border/50` for soft borders
- Add subtle focus ring with `ring-primary/20`
- Use motion tokens for transitions

**Don't**:
- Use different border styles per input
- Skip focus states

---

### Chat UI (AssistantPanel)

Mobile bottom sheet + desktop side panel.

**Message Bubbles**:
```css
/* User message */
.bubble-user {
  @apply bg-primary text-primary-foreground rounded-2xl rounded-br-sm;
  @apply max-w-[85%] ml-auto;
}

/* Assistant message */
.bubble-assistant {
  @apply bg-surface-2 text-foreground rounded-2xl rounded-bl-sm;
  @apply max-w-[85%];
}
```

**Composer Bar**:
```css
.chat-composer {
  @apply flex gap-2 p-4 border-t border-border/30;
  background: var(--surface-1);
}

.chat-input {
  @apply flex-1 h-11 rounded-xl bg-muted/50 border-0;
  @apply focus:ring-1 focus:ring-primary/50;
}
```

---

## D) Accessibility Checklist

### Contrast Requirements (WCAG AA)

| Element | Minimum Ratio |
|---------|---------------|
| Body text on background | 4.5:1 |
| Large text (18px+) on background | 3:1 |
| UI components (borders, icons) | 3:1 |
| Focus indicators | 3:1 |

### Focus Visibility

```css
/* All focusable elements */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Touch Targets

- Minimum size: 44×44px
- Icon buttons: `size-9` (36px) with 4px margin = 44px effective
- Tab bar buttons: 56px height

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Keyboard Navigation

- All interactive elements must be focusable
- Tab order follows visual order
- Escape closes modals/sheets
- Arrow keys navigate within components (tabs, menus)

---

## E) Rollout Plan

### Phase 0: Token Foundation
- Add all tokens to `client/src/index.css`
- Apply `--surface-0` to `DashboardLayout` background
- Verify no visual regression

### Phase 1: Core Primitives
- Enhance `PageHeader` with spacing tokens and strict API
- Create `PageContainer` wrapper
- Add pill variant to Button
- Update Card with soft surface styling

### Phase 2: Module Migration
**Order**:
1. Invoices (reference - verify, don't change)
2. Projects
3. Expenses (first POC)
4. Notes
5. Contacts
6. Reports

**Per-module checklist**:
- [ ] Uses `<PageHeader />` with correct variant
- [ ] Title is plain string
- [ ] Icon actions use handler props
- [ ] Primary actions use `h-10` height
- [ ] Page wrapped in `<PageContainer />`
- [ ] NO page-level spacing overrides
- [ ] Cards use `--space-card-padding`
- [ ] Grid uses `--space-card-gap`
- [ ] Screenshot comparison passes

### Phase 3: Special Pages + Chat
- Calendar (`fullscreen` variant)
- Gallery (`fullscreen` variant)
- Maps (`fullscreen` variant)
- Settings (`narrow` variant)
- AssistantPanel restyle

---

## F) Variant Assignments

| Page | Header Variant | Container Variant |
|------|----------------|-------------------|
| Invoices | `default` | `default` |
| Projects | `default` | `default` |
| Expenses | `default` | `default` |
| Notes | `default` | `default` |
| Contacts | `default` | `default` |
| Reports | `default` | `default` |
| InvoiceDetail | `detail` | `default` |
| ProjectDetail | `detail` | `default` |
| NoteDetail | `detail` | `default` |
| Calendar | `fullscreen` | `fullscreen` |
| Gallery | `fullscreen` | `fullscreen` |
| Maps | `fullscreen` | `fullscreen` |
| Settings | `default` | `narrow` |

---

## G) DON'T DO THIS

| Don't | Why | Do Instead |
|-------|-----|------------|
| Add page-level ad-hoc spacing (`mt-7`) | Breaks rhythm | Use spacing tokens |
| Introduce new accent colors | Brand dilution | Only green/pink |
| Mix shadow/border styles | Inconsistency | Use token-defined values |
| Create custom header layouts | Layout creep | Use `PageHeader` variant |
| Use `font-weight: 100` for small text | Readability | Minimum 300 for body |
| Use ad-hoc `duration-150` | Motion inconsistency | Use `--dur-*` tokens |
| Pass custom JSX to icon slots | Layout variance | Use handler props |
| Hardcode bottom padding | Safe area bugs | Use `--bottom-safe-area` |

---

## H) Sandbox Rule

Experimentation allowed ONLY in:
- `/client/src/components/sandbox/` folder
- `/dev/design-sandbox` route (dev-only)

**Rules**:
- Sandbox code CANNOT ship to production
- Backport proven patterns to tokens in same/next PR
- Delete sandbox files after extraction

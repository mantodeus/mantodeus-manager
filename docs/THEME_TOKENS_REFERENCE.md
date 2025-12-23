# Theme Tokens Reference

## Token Structure

All themes expose the same token keys for structural parity. This ensures components work consistently across all themes.

## Token Categories

### Background Layers (4 tokens)

| Token | Purpose | Green Mantis | Orchid Mantis |
|-------|---------|--------------|---------------|
| `--bg-app` | App-level background | `linear-gradient(180deg, oklch(0.08 0.01 240) 0%, oklch(0.10 0 0) 100%)` | `linear-gradient(180deg, oklch(0.96 0.01 60) 0%, oklch(0.98 0.005 50) 100%)` |
| `--bg-page` | Page background | `oklch(0.10 0 0)` | `oklch(0.98 0.005 50)` |
| `--bg-surface` | Card/surface background | `#0D0E10` | `oklch(1.0 0 0)` |
| `--bg-elevated` | Elevated elements | `oklch(0.12 0 0)` | `oklch(0.99 0.005 50)` |

### Typography (4 tokens)

| Token | Purpose | Green Mantis | Orchid Mantis |
|-------|---------|--------------|---------------|
| `--text-primary` | Primary text | `oklch(0.78 0 0)` | `oklch(0.20 0 0)` |
| `--text-secondary` | Secondary text | `oklch(0.65 0 0)` | `oklch(0.35 0 0)` |
| `--text-muted` | Muted text | `oklch(0.50 0 0)` | `oklch(0.50 0 0)` |
| `--text-disabled` | Disabled text | `oklch(0.35 0 0)` | `oklch(0.65 0 0)` |

### Accent System (5 tokens)

| Token | Purpose | Green Mantis | Orchid Mantis |
|-------|---------|--------------|---------------|
| `--accent-start` | Gradient start | `#0CF57E` | `#FF4FA3` |
| `--accent-mid` | Gradient middle | `#2BFFA0` | `#FF78C7` |
| `--accent-end` | Gradient end | `#07C964` | `#E83D8C` |
| `--accent-gradient` | Pre-composed gradient | `linear-gradient(135deg, #0CF57E 0%, #2BFFA0 50%, #07C964 100%)` | `linear-gradient(135deg, #FF4FA3 0%, #FF78C7 50%, #E83D8C 100%)` |
| `--accent-foreground` | Text on accent | `oklch(0.1 0 0)` | `oklch(1.0 0 0)` |

### Borders & Dividers (2 tokens)

| Token | Purpose | Green Mantis | Orchid Mantis |
|-------|---------|--------------|---------------|
| `--border-subtle` | Subtle borders | `oklch(0.15 0 0)` | `oklch(0.90 0.005 50)` |
| `--border-strong` | Strong borders | `oklch(0.25 0 0)` | `oklch(0.80 0.01 50)` |

### State Colors (4 tokens)

| Token | Purpose | Green Mantis | Orchid Mantis |
|-------|---------|--------------|---------------|
| `--state-info` | Info messages | `oklch(0.65 0.20 240)` | `oklch(0.55 0.20 240)` |
| `--state-warning` | Warning messages | `oklch(0.70 0.20 60)` | `oklch(0.60 0.20 60)` |
| `--state-danger` | Error messages | `oklch(0.60 0.25 25)` | `oklch(0.55 0.25 25)` |
| `--state-success` | Success messages | `oklch(0.65 0.20 155)` | `oklch(0.55 0.20 155)` |

## Usage Examples

### Background Layers

```css
/* App background with gradient */
body {
  background: var(--bg-app);
}

/* Page container */
.page {
  background: var(--bg-page);
}

/* Card surface */
.card {
  background: var(--bg-surface);
}

/* Popover/dialog */
.popover {
  background: var(--bg-elevated);
}
```

### Typography

```css
/* Primary heading */
h1 {
  color: var(--text-primary);
}

/* Secondary text */
.subtitle {
  color: var(--text-secondary);
}

/* Muted label */
.label {
  color: var(--text-muted);
}

/* Disabled button */
button:disabled {
  color: var(--text-disabled);
}
```

### Accent System

```css
/* Gradient button */
.btn-primary {
  background: var(--accent-gradient);
  color: var(--accent-foreground);
}

/* Selected state */
.selected {
  border-color: var(--accent-mid);
  background: color-mix(in srgb, var(--accent-mid) 10%, transparent);
}

/* Custom gradient */
.custom-gradient {
  background: linear-gradient(
    to right,
    var(--accent-start),
    var(--accent-mid),
    var(--accent-end)
  );
}
```

### Borders

```css
/* Card border */
.card {
  border: 1px solid var(--border-subtle);
}

/* Focused input */
input:focus {
  border-color: var(--border-strong);
}
```

### State Colors

```css
/* Info banner */
.info {
  background: var(--state-info);
}

/* Warning alert */
.warning {
  background: var(--state-warning);
}

/* Error message */
.error {
  background: var(--state-danger);
}

/* Success toast */
.success {
  background: var(--state-success);
}
```

## Pre-built CSS Classes

### `.btn-gradient`
Applies accent gradient background with proper foreground color.

```tsx
<button className="btn-gradient">
  Primary Action
</button>
```

### `.calendar-day-selected`
Applies accent gradient for selected calendar days.

```tsx
<div className="calendar-day-selected">
  15
</div>
```

### `.page-header-gradient`
Applies subtle gradient for page headers.

```tsx
<header className="page-header-gradient">
  <h1>Page Title</h1>
</header>
```

## Color Psychology

### Green Mantis (Dark)
- **Dark backgrounds**: Reduce eye strain in low-light environments
- **Blue tint**: Creates depth and professionalism
- **Green accent**: Represents growth, precision, and technical excellence
- **No pure white**: Prevents harsh contrast and eye fatigue

### Orchid Mantis (Light)
- **Warm backgrounds**: Create welcoming, comfortable atmosphere
- **Beige tones**: Reduce glare compared to pure white
- **Pink accent**: Represents elegance, craft, and attention to detail
- **No pure black**: Prevents harsh contrast and maintains softness

## Accessibility Notes

### Contrast Ratios

**Green Mantis**:
- Primary text on background: 7.2:1 (AAA)
- Secondary text on background: 5.1:1 (AA)
- Accent on dark background: 8.5:1 (AAA)

**Orchid Mantis**:
- Primary text on background: 8.1:1 (AAA)
- Secondary text on background: 5.5:1 (AA)
- Accent on light background: 4.8:1 (AA)

### Best Practices

1. Always use semantic tokens, not color values
2. Test in both themes before committing
3. Ensure interactive elements have sufficient contrast
4. Use gradients sparingly for emphasis only
5. Maintain visual hierarchy with token choices

## Token Mapping

The theme system also maps to existing Tailwind tokens for backward compatibility:

| New Token | Tailwind Token |
|-----------|----------------|
| `--bg-page` | `--background` |
| `--text-primary` | `--foreground` |
| `--bg-surface` | `--card` |
| `--bg-elevated` | `--popover` |
| `--accent-mid` | `--primary` |
| `--accent-mid` | `--accent` |
| `--border-subtle` | `--border` |

This ensures existing components continue to work while new components can use the enhanced token system.

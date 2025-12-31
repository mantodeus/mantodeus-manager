# ðŸ”’ NAVIGATION CONSTITUTION â†’ CODE MAPPING

**Purpose:** Map each constitutional requirement to concrete implementation checkpoints.

This document ensures no constitutional requirement is missed during implementation.

---

## Â§ 1. PLATFORM SOVEREIGNTY

### Â§ 1.1 Mobile First â€” By Law

**Constitutional Requirement:**
- Mobile navigation rules apply only on mobile breakpoints
- Desktop navigation must not change
- Desktop sidebar remains authoritative

**Implementation Checkpoint:**
```typescript
// constants.ts
export const MOBILE_BREAKPOINT = 768; // Must match existing useMobile.tsx

// All mobile nav components must be wrapped:
{isMobile && <MobileNavigation />}
{!isMobile && <DesktopSidebar />} {/* Existing component, unchanged */}
```

**Test Criteria:**
- [ ] Desktop sidebar functions identically before/after implementation
- [ ] Mobile nav components never render on desktop (â‰¥768px)
- [ ] No CSS media query leakage between mobile/desktop
- [ ] Wouter routing unchanged (routes work on both platforms)

---

### Â§ 1.2 No Cross-Contamination

**Constitutional Requirement:**
- Mobile gestures must never activate on desktop
- Desktop shortcuts must never affect mobile behaviour

**Implementation Checkpoint:**
```typescript
// useGestureRecognition.ts
export function useGestureRecognition() {
  const isMobile = useIsMobile();

  // CRITICAL: Guard clause at hook level
  if (!isMobile) {
    return { state: GestureState.DISABLED, handlers: {} };
  }

  // Gesture logic only runs on mobile
}
```

**Test Criteria:**
- [ ] Pointer events never attach on desktop
- [ ] Hold timers never start on desktop
- [ ] No event listener leaks between mobile/desktop transitions
- [ ] Ctrl+B sidebar toggle still works on desktop

---

## Â§ 2. NAVIGATION MODEL (FOUNDATIONAL)

### Â§ 2.1 Bottom Tab Bar

**Constitutional Requirement:**
- Exactly three bottom navigation tabs: Office, Field, Tools
- No additional tabs may be added

**Implementation Checkpoint:**
```typescript
// types.ts
export type TabId = 'office' | 'field' | 'tools'; // Literal union (type-safe)

// constants.ts
export const TABS = [
  { id: 'office' as const, icon: Briefcase, label: 'Office' },
  { id: 'field' as const, icon: Clipboard, label: 'Field' },
  { id: 'tools' as const, icon: Wrench, label: 'Tools' }
] as const;

// Enforce array length at compile time
type _AssertThreeTabs = typeof TABS extends readonly [any, any, any] ? true : never;
```

**Test Criteria:**
- [ ] Tab array length === 3 (compile-time check)
- [ ] TypeScript error if fourth tab added
- [ ] No dynamic tab generation

---

### Â§ 2.2 Default State

**Constitutional Requirement:**
- App must open into Field tab on mobile
- Not configurable

**Implementation Checkpoint:**
```typescript
// MobileNavProvider.tsx
const [activeTab, setActiveTab] = useState<TabId>('field'); // Hard-coded default

// No localStorage persistence of active tab
// No URL param override (deep linking is Phase 3)
```

**Test Criteria:**
- [ ] Fresh app load â†’ Field tab active
- [ ] After navigation â†’ Field remains default on app restart
- [ ] No user preference storage for default tab

---

### Â§ 2.3 Tab Meaning

**Constitutional Requirement:**
- Office = administrative, financial, planning
- Field = on-site, active, primary
- Tools = utilities, reference, system

**Implementation Checkpoint:**
```typescript
// Document semantic meaning in code comments
/**
 * Tab Semantics (Constitutional):
 * - Office: Administrative, financial, planning work
 * - Field: On-site, active, primary work context
 * - Tools: Utilities, reference, system controls
 */
```

**Test Criteria:**
- [ ] Module placement matches semantic categorization (see Â§ 3)

---

## Â§ 3. MODULE OWNERSHIP (LOCKED)

### Â§ 3.1-3.3 Module Mapping

**Constitutional Requirement:**
- Each module belongs to one and only one tab
- Specific module â†’ tab assignments locked

**Implementation Checkpoint:**
```typescript
// constants.ts
export const MODULE_REGISTRY = {
  office: [
    { id: 'projects', label: 'Projects', path: '/projects', icon: FolderOpen },
    { id: 'invoices', label: 'Invoices', path: '/invoices', icon: FileCheck },
    { id: 'expenses', label: 'Expenses', path: '/expenses', icon: Receipt },
    { id: 'reports', label: 'Reports', path: '/reports', icon: FileText },
    { id: 'contacts', label: 'Contacts', path: '/contacts', icon: Users },
    { id: 'notes', label: 'Notes', path: '/notes', icon: StickyNote }
  ],
  field: [
    { id: 'inspections', label: 'Inspections', path: '/inspections', icon: ClipboardCheck },
    { id: 'gallery', label: 'Gallery', path: '/gallery', icon: Image }, // Placeholder route
    { id: 'notes', label: 'Notes', path: '/notes', icon: StickyNote }
  ],
  tools: [
    { id: 'map', label: 'Map', path: '/maps', icon: MapPin },
    { id: 'calendar', label: 'Calendar', path: '/calendar', icon: CalendarIcon },
    { id: 'contacts', label: 'Contacts', path: '/contacts', icon: Users },
    { id: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon }
    // Settings ALWAYS last (array order enforced)
  ]
} as const;

// Type-level enforcement
type ModuleId = keyof typeof MODULE_REGISTRY;
type _AssertNoOverlap = /* Add type check for duplicate module IDs across tabs */;
```

**Test Criteria:**
- [ ] MODULE_REGISTRY matches constitutional spec exactly
- [ ] Settings appears last in Tools array
- [ ] No module ID appears in multiple tabs
- [ ] Gallery route exists (even if placeholder page)

---

## Â§ 4. PRIMARY GESTURE â€” HOLD â†’ FLICK

### Â§ 4.1 Activation Rule

**Constitutional Requirement:**
- Only activate via: Tap â†’ Hold (250ms Â± 30ms) â†’ Vertical Swipe Up
- Simple tap must never activate scroller

**Implementation Checkpoint:**
```typescript
// constants.ts
export const GESTURE_CONFIG = {
  HOLD_DURATION: 250,           // ms (constitutional)
  HOLD_TOLERANCE: 30,           // Â± tolerance
  MOVEMENT_CANCEL_THRESHOLD: 10, // px (cancel if moved during hold)
  EDGE_DEAD_ZONE: 16,           // px from screen edges
  SCROLL_VELOCITY_CANCEL: 150   // px/s (cancel if scrolling)
} as const;

// useGestureRecognition.ts
const handlePointerDown = (e: PointerEvent) => {
  startTime.current = Date.now();
  startPos.current = { x: e.clientX, y: e.clientY };

  holdTimer.current = window.setTimeout(() => {
    const elapsed = Date.now() - startTime.current;

    // Constitutional check: 220-280ms window
    if (elapsed >= GESTURE_CONFIG.HOLD_DURATION - GESTURE_CONFIG.HOLD_TOLERANCE &&
        elapsed <= GESTURE_CONFIG.HOLD_DURATION + GESTURE_CONFIG.HOLD_TOLERANCE) {
      setState(GestureState.HOLD_ACTIVE);
      triggerHaptic(HapticIntent.HOLD_RECOGNIZED);
    }
  }, GESTURE_CONFIG.HOLD_DURATION);
};
```

**Test Criteria:**
- [ ] Quick tap (< 220ms) never activates scroller
- [ ] Hold (220-280ms) activates scroller consistently
- [ ] Long hold (> 280ms) still activates (tolerance window)
- [ ] Movement during hold (> 10px) cancels activation

---

### Â§ 4.2 Valid Touch Origin

**Constitutional Requirement:**
- Gesture must originate on bottom tab icon
- Touches outside tab icons are invalid

**Implementation Checkpoint:**
```typescript
// BottomTabBar.tsx
<button
  data-tab-trigger={tab.id}  // Constitutional marker
  onPointerDown={handlePointerDown}
>
  <tab.icon />
</button>

// useGestureRecognition.ts
const handlePointerDown = (e: PointerEvent) => {
  // CRITICAL: Validate touch origin
  const target = e.target as HTMLElement;
  const tabTrigger = target.closest('[data-tab-trigger]');

  if (!tabTrigger) {
    return; // Invalid origin, ignore
  }

  // Gesture logic continues...
};
```

**Test Criteria:**
- [ ] Touch on tab icon â†’ gesture starts
- [ ] Touch on tab label â†’ gesture starts (label is child of trigger)
- [ ] Touch on empty bar space â†’ no gesture
- [ ] Touch on screen content â†’ no gesture

---

## Â§ 5. ERGONOMIC LAW (NON-NEGOTIABLE)

### Â§ 5.1-5.2 Thumb Biomechanics

**Constitutional Requirement:**
- Scroller placement is tab-based (swipe direction ignored):
  - Office -> left
  - Field -> center
  - Tools -> right

`	s
const scrollerSide =
  activeTab === 'office' ? 'left' : activeTab === 'tools' ? 'right' : 'center';
`

- [ ] Office hold + swipe up -> left scroller
- [ ] Field hold + swipe up -> centered scroller
- [ ] Tools hold + swipe up -> right scroller
- [ ] Swipe direction has no effect
- [ ] Phase 2: Fast swipe â†’ momentum scroll, then snap
- [ ] Pausing finger â†’ highlight snaps within 120ms
- [ ] Snap easing feels deliberate, not springy

---

## Â§ 8. DEPTH DISPLACEMENT (READABILITY LAW)

### Â§ 8.1 Purpose

**Constitutional Requirement:**
- Prevent finger occlusion of text
- Communicate selection spatially
- Replace decorative highlights with physical clarity

**Implementation Checkpoint:**
```typescript
// constants.ts
export const DEPTH_OFFSET = {
  ACTIVE: 28,        // px (maximum displacement)
  NEIGHBOR_1: 14,    // px (Â±1 from active)
  NEIGHBOR_2: 0,     // px (Â±2+ from active)
} as const;

// ModuleItem.tsx
function calculateOffset(
  itemIndex: number,
  activeIndex: number,
  scrollerSide: 'left' | 'right'
): number {
  const distance = Math.abs(itemIndex - activeIndex);

  let offset = 0;
  if (distance === 0) offset = DEPTH_OFFSET.ACTIVE;
  else if (distance === 1) offset = DEPTH_OFFSET.NEIGHBOR_1;
  else offset = DEPTH_OFFSET.NEIGHBOR_2; // No offset

  // Apply toward center (constitutional requirement)
  return scrollerSide === 'right' ? -offset : offset;
}

// Usage:
<div
  className="module-item"
  style={{
    transform: `translateX(${calculateOffset(index, activeIndex, side)}px)`
  }}
>
```

**Test Criteria:**
- [ ] Active item pushed 28px toward center
- [ ] Neighbors (Â±1) pushed 14px toward center
- [ ] Distant items (Â±2+) have 0px offset
- [ ] Text remains readable on all items (not occluded by finger)

---

### Â§ 8.2 Displacement Rules

**Constitutional Requirement:**
- Offsets applied laterally toward screen center
- Strength strictly proportional to proximity

**Implementation Checkpoint:**
```typescript
// Proportional mapping (linear, no curves)
const offsetMap = [
  { distance: 0, offset: 28 },  // Active
  { distance: 1, offset: 14 },  // Â±1
  { distance: 2, offset: 0 }    // Â±2+
];

// Linear interpolation forbidden (discrete steps only)
// Ensures predictable, testable behavior
```

**Test Criteria:**
- [ ] Offset changes are discrete (28 â†’ 14 â†’ 0), not gradual
- [ ] No easing between offset values (instant transition)
- [ ] Direction always toward center (never toward edges)

---

### Â§ 8.3 Blur

**Constitutional Requirement:**
- Blur is additive, not essential
- Offset alone must solve readability
- Blur must be capability-gated

**Implementation Checkpoint:**
```typescript
// Phase 1: No blur (offset only)
<div className="module-item" style={{ transform: `translateX(${offset}px)` }} />

// Phase 2: Blur with capability gate
const deviceCapabilities = {
  hasBlur: (() => {
    const memory = (navigator as any).deviceMemory;
    if (memory && memory < 4) return false; // Low-end device

    if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) {
      return false; // User preference
    }

    return CSS.supports('backdrop-filter', 'blur(1px)');
  })()
};

// Apply blur only if capable
<div
  className="module-item"
  style={{
    transform: `translateX(${offset}px)`,
    filter: deviceCapabilities.hasBlur ? `blur(${blurAmount}px)` : 'none'
  }}
/>
```

**Test Criteria:**
- [ ] Phase 1: Zero blur, offset works perfectly
- [ ] Phase 2 (capable device): Blur enhances depth
- [ ] Phase 2 (low-end device): No blur, no performance hit
- [ ] `prefers-reduced-transparency` disables blur

---

## Â§ 9. VISUAL HIERARCHY (MANDATORY)

### Â§ 9.1 Active Item

**Constitutional Requirement:**
- Highest opacity
- Slight scale increase
- Accent colour emphasis
- Text must remain fully legible

**Implementation Checkpoint:**
```typescript
// constants.ts
export const VISUAL_HIERARCHY = {
  ACTIVE: {
    scale: 1.08,
    opacity: 1.0,
    // Accent from theme (Green Mantis or Orchid Mantis)
  },
  NEIGHBOR: {
    scale: 1.0,
    opacity: 0.75
  },
  DISTANT: {
    scale: 1.0,
    opacity: 0.35
  }
} as const;

// ModuleItem.tsx
const isActive = index === highlightedIndex;
const isNeighbor = Math.abs(index - highlightedIndex) === 1;

const itemStyle = {
  transform: `translateX(${offset}px) scale(${
    isActive ? VISUAL_HIERARCHY.ACTIVE.scale : 1.0
  })`,
  opacity: isActive
    ? VISUAL_HIERARCHY.ACTIVE.opacity
    : isNeighbor
      ? VISUAL_HIERARCHY.NEIGHBOR.opacity
      : VISUAL_HIERARCHY.DISTANT.opacity,
  borderColor: isActive ? 'var(--accent)' : 'transparent',
  transition: 'transform 150ms ease-out, opacity 150ms ease-out'
};
```

**Test Criteria:**
- [ ] Active item has 100% opacity, 1.08 scale
- [ ] Active item uses theme accent color (green or pink)
- [ ] Active item text passes WCAG AA contrast (4.5:1)
- [ ] No color-only differentiation (scale + opacity + border)

---

### Â§ 9.2 Inactive Items

**Constitutional Requirement:**
- Reduced opacity
- No competing emphasis
- No decorative animation

**Implementation Checkpoint:**
```typescript
// Inactive items (Phase 1)
// - No hover states
// - No pulse animations
// - No glow effects
// - Opacity reduction only

// Phase 2 may add subtle blur (capability-gated)
// But NEVER decorative motion
```

**Test Criteria:**
- [ ] No hover effects on inactive items during gesture
- [ ] No pulse, bounce, or wave animations
- [ ] Opacity is only visual difference (besides offset)

---

### Â§ 9.3 Background

**Constitutional Requirement:**
- App background dims subtly during scroller activation
- Must feel paused, not modal or blocked

**Implementation Checkpoint:**
```typescript
// ScrollerOverlay.tsx
<div
  className="scroller-overlay"
  style={{
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--overlay-light)', // 10-12% opacity from theme
    // Phase 2: backdropFilter: deviceCapabilities.hasBlur ? 'blur(8px)' : 'none'
  }}
/>

// theme.ts (ensure overlay exists)
overlayLight: theme === 'green-mantis'
  ? 'rgba(6, 8, 11, 0.1)'    // Dark overlay (10%)
  : 'rgba(247, 246, 244, 0.12)' // Light overlay (12%)
```

**Test Criteria:**
- [ ] Background dims when scroller appears
- [ ] Dim is subtle (user can still see background content)
- [ ] No hard modal edges or borders
- [ ] Feels like "pause" not "block"

---

## Â§ 10. CONTEXT ANCHORING

### Â§ 10.1 Bottom Bar Authority

**Constitutional Requirement:**
- Context shown only in bottom bar
- Active tab reveals label above icon
- Other tabs remain icon-only

**Implementation Checkpoint:**
```typescript
// BottomTabBar.tsx
const isActiveTab = tab.id === activeTab;
const isScrollerActive = gestureState === GestureState.FLICK_ACTIVE;

<button className="tab-button">
  {/* Label reveals ONLY when scroller is active AND this tab is active */}
  {isScrollerActive && isActiveTab && (
    <span
      className="tab-label"
      style={{
        animation: 'context-label-reveal 280ms cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      {tab.label}
    </span>
  )}

  <tab.icon className="tab-icon" />
</button>

// CSS
@keyframes context-label-reveal {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.92);
  }
  60% {
    opacity: 1;
    transform: translateY(-2px) scale(1.02); // Overshoot
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

**Test Criteria:**
- [ ] Scroller inactive â†’ all tabs show icon only
- [ ] Scroller active â†’ active tab shows "Office" / "Field" / "Tools" above icon
- [ ] Inactive tabs remain icon-only during scroller
- [ ] Label animates smoothly (280ms)

---

### Â§ 10.2 Prohibition

**Constitutional Requirement:**
- Tab labels must never appear inside scroller

**Implementation Checkpoint:**
```typescript
// ModuleScroller.tsx
// FORBIDDEN:
// <div className="scroller-header">{activeTab.toUpperCase()}</div> âŒ

// Module items show ONLY module name, never tab name
<div className="module-item">
  <module.icon />
  <span>{module.label}</span> {/* "Projects", not "Office â†’ Projects" */}
</div>
```

**Test Criteria:**
- [ ] Scroller contains zero references to "Office" / "Field" / "Tools"
- [ ] Module items show module name only
- [ ] No breadcrumb-style "Tab â†’ Module" text

---

## Â§ 11. PERFORMANCE LAW

### Â§ 11.1 Budgets

**Constitutional Requirement:**
- Gesture response: < 16 ms
- Scroller appearance: < 150 ms
- Tap â†’ screen navigation: < 300 ms
- Max dropped frames per gesture: 2

**Implementation Checkpoint:**
```typescript
// Performance monitoring (Phase 2+)
const perfObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === 'gesture-response' && entry.duration > 16) {
      console.warn('[Perf] Gesture lag:', entry.duration);
    }
    if (entry.name === 'scroller-render' && entry.duration > 150) {
      console.warn('[Perf] Scroller slow:', entry.duration);
    }
    if (entry.name === 'navigation-total' && entry.duration > 300) {
      console.warn('[Perf] Navigation slow:', entry.duration);
    }
  }
});
perfObserver.observe({ entryTypes: ['measure'] });

// Usage:
const gestureStart = performance.now();
// ... gesture logic
performance.measure('gesture-response', { start: gestureStart });
```

**Test Criteria:**
- [ ] 95% of gestures respond in < 16ms (< 1 frame at 60fps)
- [ ] Scroller renders in < 150ms on iPhone SE 2020
- [ ] Tap â†’ new screen in < 300ms
- [ ] No more than 2 dropped frames per gesture (measure with DevTools)

---

### Â§ 11.2 Degradation

**Constitutional Requirement:**
- Enhancements must degrade gracefully
- Core interaction never fails due to enhancement removal

**Implementation Checkpoint:**
```typescript
// Example: Blur degrades to opacity gradient
const scrollerOverlayStyle = {
  backgroundColor: 'var(--overlay-light)',
  backdropFilter: deviceCapabilities.hasBlur ? 'blur(8px)' : 'none'
  // If blur unsupported â†’ solid overlay still works
};

// Example: Spring physics degrades to CSS ease-out
const snapAnimation = deviceCapabilities.hasSpringPhysics
  ? springConfig
  : { duration: 120, easing: 'ease-out' };
```

**Test Criteria:**
- [ ] Phase 2 features can be disabled without breaking Phase 1
- [ ] Low-end device gets full functionality (no blur/springs)
- [ ] No crashes or visual glitches when enhancements disabled

---

## Â§ 12. ACCESSIBILITY LAW

### Â§ 12.1 Compliance

**Constitutional Requirement:**
- Navigation must meet WCAG 2.2 AA

**Implementation Checkpoint:**
```typescript
// Keyboard navigation (Phase 3)
const handleKeyDown = (e: KeyboardEvent) => {
  if (!scrollerActive) return;

  switch (e.key) {
    case 'ArrowUp':
      setHighlightedIndex(Math.max(0, highlightedIndex - 1));
      break;
    case 'ArrowDown':
      setHighlightedIndex(Math.min(modules.length - 1, highlightedIndex + 1));
      break;
    case 'Enter':
    case ' ':
      navigate(modules[highlightedIndex].path);
      break;
    case 'Escape':
      closeScroller();
      break;
  }
};

// Screen reader support
<div
  role="menu"
  aria-label={`Module selector for ${activeTab}`}
  aria-activedescendant={`module-${highlightedIndex}`}
>
  {modules.map((module, index) => (
    <div
      id={`module-${index}`}
      role="menuitem"
      aria-label={`${module.label}, ${index + 1} of ${modules.length}`}
    >
      {module.label}
    </div>
  ))}
</div>
```

**Test Criteria:**
- [ ] Tab key navigates modules
- [ ] Arrow keys move selection
- [ ] Enter/Space activates module
- [ ] Escape closes scroller
- [ ] Screen reader announces "Inspections, 1 of 3"
- [ ] Focus trap prevents tabbing outside scroller

---

### Â§ 12.2 Mandatory Support

**Constitutional Requirement:**
- Keyboard navigation
- Screen reader announcements
- Focus trapping
- Focus restoration
- Reduced motion honored

**Implementation Checkpoint:**
```typescript
// Reduced motion support
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const animationDuration = prefersReducedMotion ? 0 : 150;

// Focus trap
import { FocusTrap } from '@radix-ui/react-focus-trap'; // Or similar

<FocusTrap active={scrollerActive}>
  <ModuleScroller />
</FocusTrap>

// Focus restoration
const previousFocusRef = useRef<HTMLElement | null>(null);

useEffect(() => {
  if (scrollerActive) {
    previousFocusRef.current = document.activeElement as HTMLElement;
  } else if (previousFocusRef.current) {
    previousFocusRef.current.focus();
  }
}, [scrollerActive]);
```

**Test Criteria:**
- [ ] VoiceOver/TalkBack works correctly
- [ ] Keyboard users can access all modules
- [ ] Focus trapped in scroller when active
- [ ] Focus returns to tab trigger after close
- [ ] `prefers-reduced-motion` â†’ instant transitions

---

## Â§ 13. PHASE AUTHORITY

### Â§ 13.1 Phase Separation

**Constitutional Requirement:**
- Phase 1: Core (must ship)
- Phase 2: Premium feel (device-gated)
- Phase 3: Native-ready polish
- No partial borrowing

**Implementation Checkpoint:**
```typescript
// Use feature flags to enforce phase boundaries
const FEATURES = {
  PHASE_1_CORE: true,              // Always enabled
  PHASE_2_MOMENTUM: false,         // Enable when Phase 2 starts
  PHASE_2_BLUR: false,
  PHASE_2_SPRINGS: false,
  PHASE_3_DEEP_LINKING: false,
  PHASE_3_HAPTICS: false
} as const;

// Usage:
if (FEATURES.PHASE_2_MOMENTUM) {
  applyMomentumScroll();
} else {
  instantSnap();
}
```

**Test Criteria:**
- [ ] Phase 1 ships with only core features (no momentum, no blur)
- [ ] Phase 2 features toggle cleanly via flags
- [ ] No Phase 3 code runs during Phase 1/2

---

### Â§ 13.2 Guarantees vs Enhancements

**Constitutional Requirement:**
- Guarantees must always work
- Enhancements may be removed without breaking guarantees

**Implementation Checkpoint:**
```typescript
// Guarantees (cannot be disabled):
const GUARANTEES = {
  offsetPreventsOcclusion: true,    // Â§ 8 requirement
  instantNavigation: true,           // Â§ 6.2 requirement
  desktopUnchanged: true,            // Â§ 1.1 requirement
  holdGestureActivation: true        // Â§ 4.1 requirement
};

// Enhancements (can be disabled):
const ENHANCEMENTS = {
  depthBlur: deviceCapabilities.hasBlur,
  momentumScrolling: FEATURES.PHASE_2_MOMENTUM,
  springPhysics: deviceCapabilities.hasSpringPhysics,
  hapticFeedback: FEATURES.PHASE_3_HAPTICS
};
```

**Test Criteria:**
- [ ] Disabling all enhancements â†’ core functionality intact
- [ ] Guarantees tested on lowest-end target device
- [ ] Enhancements enhance, never replace guarantees

---

## Â§ 14. PROHIBITIONS (ABSOLUTE)

**Constitutional Requirement:**
The following are forbidden:
1. Accidental edge activation
2. Mid-swipe routing
3. Decorative motion without purpose
4. Ripple/wave animations
5. Cross-tab scroller content
6. Gesture-triggered navigation without hold
7. Desktop behaviour changes

**Implementation Checkpoint:**
```typescript
// 1. Edge activation prevention
if (e.clientX < GESTURE_CONFIG.EDGE_DEAD_ZONE ||
    e.clientX > window.innerWidth - GESTURE_CONFIG.EDGE_DEAD_ZONE) {
  return; // Too close to edge, ignore
}

// 2. Mid-swipe routing prevention
// Navigation ONLY in handlePointerUp, never handlePointerMove

// 3. No decorative motion
// No animations unless they serve gesture feedback

// 4. No ripple/wave
// FORBIDDEN: Material Design ripple effects

// 5. Cross-tab prevention
const modules = MODULE_REGISTRY[activeTab]; // Only current tab

// 6. No gesture without hold
if (elapsed < GESTURE_CONFIG.HOLD_DURATION - GESTURE_CONFIG.HOLD_TOLERANCE) {
  return; // Tap too quick, not a hold gesture
}

// 7. Desktop unchanged
if (!isMobile) {
  return <DesktopSidebar />; // Original component, zero changes
}
```

**Test Criteria:**
- [ ] Edge swipes (within 16px of screen edge) don't activate
- [ ] No route changes occur during pointer move
- [ ] No animations exist without functional purpose
- [ ] No ripple effects anywhere in mobile nav
- [ ] Scroller never shows modules from other tabs
- [ ] Quick taps (< 220ms) never activate scroller
- [ ] Desktop sidebar 100% unchanged (visual regression test)

---

## Â§ 15. CHANGE AUTHORITY

**Constitutional Requirement:**
- Changes must be deliberate, documented, improve ergonomics/clarity/safety
- Silent drift not allowed

**Implementation Checkpoint:**
```typescript
// All magic numbers must be constants
// constants.ts is single source of truth
// Changes require:
// 1. Update constants.ts
// 2. Update this mapping document
// 3. Git commit message: "Constitutional change: [reason]"
// 4. Update tests to match new values

// Example:
// HOLD_DURATION: 250 â†’ 280
// Reason: User testing showed 250ms too quick for accessibility
// Commit: "Constitutional change: increase hold duration for a11y"
```

**Test Criteria:**
- [ ] All timing/offset values sourced from constants.ts
- [ ] No magic numbers in component files
- [ ] Git history shows clear change rationale
- [ ] Mapping document updated with changes

---

## Â§ 16. FINAL PRINCIPLE

**Constitutional Requirement:**
> "Navigation is not animation. Navigation is trust."

Every gesture must:
- Feel deliberate
- Feel readable
- Feel predictable
- Feel calm

**Implementation Checkpoint:**
```typescript
// This is not a code checkpoint
// This is a review criterion

// Before shipping any phase, ask:
// 1. Does this feel deliberate? (No accidental activations in testing)
// 2. Does this feel readable? (Users can see what's happening)
// 3. Does this feel predictable? (Same action = same result)
// 4. Does this feel calm? (No jarring motion or chaos)

// If any answer is "no", the implementation violates the constitution
```

**Review Criteria:**
- [ ] User testing shows zero confusion about gesture
- [ ] Users can describe what will happen before they do it
- [ ] No surprise behaviors or "Easter eggs"
- [ ] Animations feel purposeful, not decorative
- [ ] System feels calm and controlled

---

## ðŸ”’ CONSTITUTIONAL ENFORCEMENT

**Implementation must:**
1. âœ… Pass all test criteria in this document
2. âœ… Match all code checkpoints exactly
3. âœ… Honor all absolute prohibitions
4. âœ… Meet all performance budgets
5. âœ… Achieve all accessibility requirements

**Any deviation requires:**
1. Constitutional amendment (documented change to spec)
2. Justification (ergonomics, clarity, or safety improvement)
3. Update to this mapping document
4. Re-validation of all affected test criteria

**Silent drift is not allowed.**

---

## ðŸ“‹ QUICK REFERENCE CHECKLIST

Use this during implementation reviews:

**Phase 1 (Core):**
- [ ] Â§ 1: Desktop unchanged, mobile-only guards active
- [ ] Â§ 2: Three tabs (Office, Field, Tools), Field default
- [ ] Â§ 3: Module registry matches spec exactly
- [ ] Â§ 4: Hold (250ms Â± 30ms) â†’ swipe activation only
- [ ] Â§ 5: Office left / Field center / Tools right (tab-based placement)
- [ ] Â§ 6: Only active tab modules shown, no navigation until release
- [ ] Â§ 7: Finger is source of truth, instant snap on pause
- [ ] Â§ 8: Offset only (28/14/0px toward center), no blur yet
- [ ] Â§ 9: Active 1.08 scale, 100% opacity, accent border
- [ ] Â§ 10: Context label in tab bar only (not in scroller)
- [ ] Â§ 11: < 16ms response, < 150ms render, < 300ms navigation
- [ ] Â§ 14: Zero prohibitions violated

**Phase 2 (Premium Feel):**
- [ ] Â§ 8.3: Blur capability-gated, offset still works without blur
- [ ] Â§ 7.2: Momentum scrolling (device-gated)
- [ ] Â§ 9: Spring physics fallback to CSS ease-out
- [ ] Â§ 11: Performance observer active, tracking metrics

**Phase 3 (Native-Ready):**
- [ ] Â§ 12: WCAG 2.2 AA compliance (keyboard, screen reader, focus)
- [ ] Deep linking functional (`/inspections?tab=field`)
- [ ] Haptic intents logged (not implemented as vibration)
- [ ] Landscape/foldable device tested

---

**End of Constitutional Mapping**

This document is authoritative. Code must conform to this spec, not the other way around.





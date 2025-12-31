# ðŸ“‹ Mobile Navigation â€” Quick Reference

**For rapid lookup during development and code review.**

---

## âš¡ Constitutional Quick Facts

| Requirement | Value | Section |
|-------------|-------|---------|
| **Tabs** | Exactly 3: Office, Field, Tools | Â§ 2.1 |
| **Default tab** | Field (not configurable) | Â§ 2.2 |
| **Hold duration** | 250ms Â± 30ms (220-280ms) | Â§ 4.1 |
| **Movement cancel** | 10px during hold | Â§ 10 |
| **Edge dead zone** | 16px from screen edges | Â§ 14 |
| **Scroll velocity cancel** | 150px/s | Â§ 10 |
| **Gesture response** | < 16ms | Â§ 11.1 |
| **Scroller render** | < 150ms | Â§ 11.1 |
| **Navigation total** | < 300ms | Â§ 11.1 |
| **Max dropped frames** | 2 per gesture | Â§ 11.1 |
| **Mobile breakpoint** | 768px | Â§ 1.1 |

---

## ðŸŽ¨ Visual Hierarchy

| Element | Scale | Opacity | Offset |
|---------|-------|---------|--------|
| **Active module** | 1.08 | 100% | 28px toward center |
| **Neighbor (Â±1)** | 1.0 | 75% | 14px toward center |
| **Distant (Â±2+)** | 1.0 | 35% | 0px |
| **Background dim** | â€” | 10% | â€” |

**Phase 2 Blur (device-gated):**
- Active: 0px blur (crisp)
- Neighbor (Â±1): 0.5px blur
- Secondary (Â±2): 1px blur
- Distant (Â±3+): 2px blur

---

## ðŸ—‚ï¸ Module Registry

### Office Tab
1. Projects â†’ `/projects`
2. Invoices â†’ `/invoices`
3. Expenses â†’ `/expenses`
4. Reports â†’ `/reports`
5. Contacts â†’ `/contacts`
6. Notes â†’ `/notes`

### Field Tab (Default)
1. Inspections â†’ `/inspections`
2. Gallery â†’ `/gallery`
3. Notes â†’ `/notes`

### Tools Tab
1. Map â†’ `/maps`
2. Calendar â†’ `/calendar`
3. Contacts â†’ `/contacts`
4. Settings â†’ `/settings` (always last)

---

## ðŸŽ¯ Gesture State Machine

```
IDLE
  â†“ (tap + hold 250ms on tab icon)
HOLD_PENDING
  â†“ (moved >10px â†’ cancel)
  â†“ (250ms elapsed)
HOLD_ACTIVE
  â†“ (vertical swipe detected)
DRAGGING
  â†“ (finger lifted)
SNAPPING
  â†“ (navigate to module)
IDLE
```

---

## ðŸ”§ Feature Flags

```typescript
// constants.ts
export const FEATURES = {
  PHASE_1_CORE: true,          // Always on
  PHASE_2_MOMENTUM: true,      // âœ… Enabled
  PHASE_2_BLUR: true,          // âœ… Enabled (device-gated)
  PHASE_2_SPRINGS: true,       // âœ… Enabled (device-gated)
  PHASE_3_DEEP_LINKING: false, // â¸ï¸ Not implemented
  PHASE_3_HAPTICS: false,      // â¸ï¸ Not implemented
};
```

---

## ðŸ›¡ï¸ Device Capability Gates

```typescript
// Low-end device detection
hasBlur = false if:
  - navigator.deviceMemory < 4GB
  - prefers-reduced-transparency: reduce
  - CSS.supports('backdrop-filter') === false

hasSpringPhysics = false if:
  - navigator.deviceMemory < 4GB

hasHaptics = 'vibrate' in navigator
```

---

## ðŸš« Absolute Prohibitions

| Prohibited | Reason | Section |
|------------|--------|---------|
| Accidental edge activation | Too close to iOS back gesture | Â§ 14.1 |
| Mid-swipe routing | Navigation only on release | Â§ 14.2 |
| Decorative motion | Every animation serves function | Â§ 14.3 |
| Ripple/wave animations | Calm over flashy | Â§ 14.4 |
| Cross-tab scroller | Modules belong to one tab | Â§ 14.5 |
| Navigation without hold | Quick tap â‰  gesture | Â§ 14.6 |
| Desktop changes | Mobile-first by law | Â§ 14.7 |

---

## ðŸ“ File Locations

| File | Purpose |
|------|---------|
| `constants.ts` | All magic numbers, module registry |
| `types.ts` | TypeScript interfaces |
| `MobileNavProvider.tsx` | Context state |
| `BottomTabBar.tsx` | 3-tab fixed bar |
| `ModuleScroller.tsx` | Gesture-driven list |
| `ScrollerOverlay.tsx` | Backdrop dim |
| `useGestureRecognition.ts` | Hold + swipe logic |
| `useDeviceCapabilities.ts` | Device detection |
| `useScrollPhysics.ts` | Momentum (Phase 2) |
| `usePerformanceMonitor.ts` | Telemetry (Phase 2) |

---

## ðŸ§ª Test Checklist (1-Minute)

```bash
# Phase 1
[ ] Desktop (â‰¥768px) â†’ Bottom bar hidden
[ ] Mobile (<768px) â†’ Bottom bar visible
[ ] Quick tap â†’ No scroller
[ ] Hold 250ms -> Scroller appears\n[ ] Hold + swipe up on Office -> Left scroller\n[ ] Hold + swipe up on Field -> Center scroller\n[ ] Hold + swipe up on Tools -> Right scroller\n[ ] Release -> Navigate to module\n[ ] Edge swipe -> No activation â†’ No activation

# Phase 2
[ ] High-end device â†’ Blur visible
[ ] Low-end device â†’ No blur
[ ] Console â†’ [Device Capabilities] logged
[ ] Console â†’ [Performance] metrics logged
```

---

## ðŸ› Common Issues

### Scroller Won't Appear
1. Check mobile breakpoint (`window.innerWidth < 768`)
2. Check hold duration reached (`>= 220ms`)
3. Check touch on tab icon (`data-tab-trigger`)
4. Check vertical movement (`dy < 0`)

### React Error #310
**Cause:** Hooks called conditionally
**Fix:** All hooks must be at top level (before any returns)

### Blur Not Working
1. Check `FEATURES.PHASE_2_BLUR === true`
2. Check device memory (`navigator.deviceMemory`)
3. Check browser support (`CSS.supports('backdrop-filter')`)

### Navigation Not Working
1. Check finger released (not mid-drag)
2. Check `highlightedIndex !== null`
3. Check route exists in Wouter

---

## ðŸ’¡ Performance Tips

**Optimize:**
- Use `React.memo` on `ModuleItem`
- Memoize `calculateOffset` and `calculateBlur`
- Use `requestAnimationFrame` for gesture updates

**Avoid:**
- Layout reflows during gestures
- Heavy computations in pointer move handlers
- Event listener leaks (always cleanup)

---

## ðŸ“ Code Snippets

### Add New Module
```typescript
// constants.ts - Add to MODULE_REGISTRY
office: [
  // ...existing modules
  { id: 'new-module', label: 'New Module', path: '/new-module', icon: NewIcon },
]
```

### Disable Phase 2 Feature
```typescript
// constants.ts
export const FEATURES = {
  // ...
  PHASE_2_BLUR: false, // Disable blur globally
};
```

### Check Device Capabilities
```typescript
const capabilities = useDeviceCapabilities();

if (capabilities.hasBlur) {
  // Apply blur enhancement
}
```

### Monitor Performance
```typescript
const { startGesture, markScrollerRender, markNavigationComplete } = usePerformanceMonitor();

startGesture(); // On pointer down
markScrollerRender(); // When scroller appears
markNavigationComplete(); // After navigation
```

---

## ðŸŽ“ Key Concepts

**Guarantees (Phase 1):**
Work everywhere, never fail

**Enhancements (Phase 2):**
Device-gated, degrade gracefully

**Deliberate Gestures:**
250ms hold prevents accidents

**Ergonomic Mapping:**
Thumb arcs â†’ swipe direction

**Finger Authority:**
UI follows finger, never leads

**State Safety:**
Navigation only on release

---

**Last Updated:** 2024-12-31
**Quick Lookup Version:** 1.0



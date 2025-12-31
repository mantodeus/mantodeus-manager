# ðŸ”’ Mobile Navigation System â€” Documentation

This directory contains the complete documentation for the Mantodeus Manager mobile navigation system.

---

## ðŸ“š Documents

### 1. [CONSTITUTION.md](./CONSTITUTION.md)
**The legally-binding specification**

This document defines the non-negotiable laws governing mobile navigation. It supersedes all informal discussions, mockups, or partial implementations.

**Key Sections:**
- Platform Sovereignty (Mobile only, Desktop unchanged)
- Navigation Model (3-tab system, module ownership)
- Primary Gesture (Hold + Swipe Up)
- Ergonomic Law (Thumb biomechanics)
- Performance Budgets
- Accessibility Requirements
- Absolute Prohibitions

**Use this when:**
- Planning new features
- Reviewing pull requests
- Resolving design debates
- Onboarding new developers

---

### 2. [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)
**Technical analysis and premium enhancements**

Detailed technical breakdown of how to elevate the constitutional spec to Apple-grade premium quality.

**Key Sections:**
- Aesthetic Enhancements (Depth-of-field blur, spring physics)
- Performance Refinement (Device capability detection)
- Accessibility Compliance (WCAG 2.2 AA)
- Gesture Refinement (Edge case prevention)
- Visual Specifications (Bottom tab bar, scroller overlay)
- Phased Rollout Strategy

**Use this when:**
- Implementing new phases
- Understanding device-gated features
- Optimizing performance
- Adding premium polish

---

### 3. [CONSTITUTIONAL-MAPPING.md](./CONSTITUTIONAL-MAPPING.md)
**Constitution â†’ Code translation**

Maps every constitutional requirement to concrete implementation checkpoints with test criteria.

**Key Sections:**
- Â§ 1-16 mapped to code examples
- TypeScript implementation snippets
- Test criteria checklists
- Quick reference for reviews

**Use this when:**
- Writing code
- Testing compliance
- Conducting code reviews
- Debugging constitutional violations

---

## ðŸ—ï¸ Implementation Architecture

### File Structure

```
client/src/components/mobile-nav/
â”œâ”€â”€ index.ts                      # Central exports
â”œâ”€â”€ types.ts                      # TypeScript interfaces
â”œâ”€â”€ constants.ts                  # Constitutional values
â”œâ”€â”€ MobileNavProvider.tsx         # Context provider
â”œâ”€â”€ BottomTabBar.tsx              # 3-tab fixed navigation
â”œâ”€â”€ ModuleScroller.tsx            # Gesture-driven module list
â”œâ”€â”€ ScrollerOverlay.tsx           # Backdrop dimming
â”œâ”€â”€ useGestureRecognition.ts      # Hold + swipe up detection
â”œâ”€â”€ useDeviceCapabilities.ts      # Device capability detection
â”œâ”€â”€ useScrollPhysics.ts           # Momentum scrolling
â””â”€â”€ usePerformanceMonitor.ts      # Performance telemetry
```

---

## ðŸ“Š Current Status

### âœ… Phase 1: Core (COMPLETE)
- Bottom tab bar (3 tabs: Office, Field, Tools)
- Hold + swipe up gesture (250ms Â± 30ms)
- Module scroller with depth displacement
- Instant navigation on release
- Desktop unchanged (sidebar remains)

### âœ… Phase 2: Premium Feel (COMPLETE)
- Device capability detection
- Depth-of-field blur (device-gated)
- Backdrop blur overlay (device-gated)
- Momentum scrolling physics
- Performance observer
- Theme integration (Green/Orchid Mantis)

### â¸ï¸ Phase 3: Native-Ready Polish (PLANNED)
- WCAG 2.2 AA accessibility compliance
- Deep linking (`/inspections?tab=field`)
- State restoration (tab + scroll position)
- Haptic semantic implementation
- Landscape/foldable device support

---

## ðŸ§ª Testing

### Constitutional Compliance Checklist

**Phase 1 Requirements:**
- [ ] Â§ 1.1: Desktop unchanged (sidebar works identically)
- [ ] Â§ 2.1: Exactly 3 tabs (Office, Field, Tools)
- [ ] Â§ 2.2: Field tab default on app open
- [ ] Â§ 4.1: Hold (250ms Â± 30ms) activates scroller
- [ ] Â§ 4.2: Only tab icons trigger gesture
- [ ] Â§ 5.2: Office left / Field center / Tools right (tab-based placement)
- [ ] Â§ 6.1: Only active tab modules shown
- [ ] Â§ 6.2: Navigation only on finger release
- [ ] Â§ 8: Depth displacement (28/14/0px)
- [ ] Â§ 9: Visual hierarchy (1.08 scale, opacity)
- [ ] Â§ 10.1: Context label in tab bar only
- [ ] Â§ 11: Performance budgets (<16ms, <150ms, <300ms)
- [ ] Â§ 14: All prohibitions honored

**Phase 2 Requirements:**
- [ ] Device capability detection working
- [ ] Blur disabled on <4GB devices
- [ ] Offset works without blur
- [ ] Backdrop blur on capable devices
- [ ] Performance observer logging metrics

### Manual Testing Steps

1. **Gesture Recognition**
   `
   - Quick tap (<220ms) → No scroller ✓
   - Hold (250ms) + swipe up on Office → Left scroller ✓
   - Hold (250ms) + swipe up on Field → Center scroller ✓
   - Hold (250ms) + swipe up on Tools → Right scroller ✓
   - Drag finger → Module highlights follow ✓
   - Release → Navigate to highlighted module ✓
   `

2. **Edge Cases**
   ```
   - Edge swipe (<16px from edge) â†’ No activation âœ“
   - Movement during hold (>10px) â†’ Gesture cancelled âœ“
   - Fast scrolling â†’ Gesture cancelled âœ“
   ```

3. **Device Capability**
   ```
   - High-end device â†’ Blur visible âœ“
   - Low-end device â†’ No blur, offset works âœ“
   - prefers-reduced-transparency â†’ No blur âœ“
   ```

4. **Desktop Safety**
   ```
   - Resize to â‰¥768px â†’ Bottom bar hidden âœ“
   - Sidebar still works â†’ No regressions âœ“
   ```

---

## ðŸ”§ Development Commands

### Build
```bash
npm run build
```

### Dev Server
```bash
npm run dev
```

### Type Check
```bash
npm run type-check
```

### Constitutional Validation
Check implementation against [CONSTITUTIONAL-MAPPING.md](./CONSTITUTIONAL-MAPPING.md)

---

## ðŸ“– Key Principles

### 1. Navigation is Trust
Every gesture must feel **deliberate, readable, predictable, and calm**.

### 2. Mobile First by Law
Desktop behaviour **must never change**. Mobile enhancements are isolated.

### 3. Blur is Additive
Depth displacement solves finger occlusion. Blur enhances but is not essential.

### 4. Guarantees vs Enhancements
**Guarantees** (Phase 1) work everywhere.
**Enhancements** (Phase 2) degrade gracefully.

### 5. No Silent Drift
Changes to navigation require constitutional amendment with documented rationale.

---

## ðŸ› Troubleshooting

### Error: React #310
**Cause:** Hooks called conditionally
**Fix:** Ensure all hooks in `useGestureRecognition.ts` are called unconditionally at top level

### Scroller Not Appearing
**Check:**
1. Mobile breakpoint (<768px)?
2. Hold duration reached (250ms)?
3. Tab icon clicked (has `data-tab-trigger`)?
4. Hold + swipe up detected?

### Blur Not Working
**Check:**
1. `FEATURES.PHASE_2_BLUR === true`?
2. Device memory â‰¥4GB?
3. `prefers-reduced-transparency` not set?
4. Browser supports `backdrop-filter`?

### Performance Issues
**Check:**
1. Console for performance warnings
2. DevTools â†’ Performance â†’ Record gesture
3. Dropped frames > 2 per gesture?
4. Disable blur on low-end devices

---

## ðŸ“ Contributing

### Adding New Modules
1. Update `MODULE_REGISTRY` in [constants.ts](../../client/src/components/mobile-nav/constants.ts)
2. Ensure module belongs to exactly one tab (Â§ 3)
3. Add route to Wouter in [App.tsx](../../client/src/App.tsx)
4. Test navigation to new module

### Changing Gesture Behavior
1. Propose constitutional amendment
2. Document rationale in commit message
3. Update [CONSTITUTION.md](./CONSTITUTION.md)
4. Update [CONSTITUTIONAL-MAPPING.md](./CONSTITUTIONAL-MAPPING.md)
5. Update test criteria

### Modifying Performance Budgets
Constitutional change required (Â§ 11.1)

**Current budgets:**
- Gesture response: < 16ms
- Scroller render: < 150ms
- Navigation total: < 300ms
- Max dropped frames: 2

---

## ðŸŽ¯ Design Philosophy

This navigation system is designed to feel like a **physical object**, not a digital interface.

**Physical Metaphors:**
- **Hold** = deliberate grip
- **Swipe Up** = physical gesture
- **Snap** = magnetic alignment
- **Depth displacement** = hand shadow avoidance
- **Blur** = depth-of-field (camera lens)

**Anti-Patterns Avoided:**
- Accidental activation (gestures are deliberate)
- Ripple/wave effects (calm over flashy)
- Cross-tab contamination (modules belong to one tab)
- Desktop changes (mobile-first, desktop untouched)

---

## ðŸ“œ License & Governance

This navigation system is governed by the [Mobile Navigation Constitution](./CONSTITUTION.md).

All changes must comply with Â§ 15 (Change Authority).

Silent drift is not allowed.

---

**Last Updated:** 2024-12-31
**Current Phase:** Phase 2 Complete
**Next Milestone:** Phase 3 (Accessibility)




# ðŸ”’ Mobile Navigation System â€” Documentation Index

Complete documentation for the Mantodeus Manager mobile navigation system.

**Status:** Phase 2 Complete âœ…
**Last Updated:** 2024-12-31

---

## ðŸ“š Documentation Files

### 1. ðŸ›ï¸ [CONSTITUTION.md](./CONSTITUTION.md) â€” **START HERE**
**The legally-binding specification (6.3 KB)**

This is the single source of truth. All code must comply with this document.

**Read this if:**
- You're new to the project
- Making any navigation changes
- Reviewing pull requests
- Resolving design debates

**Key Contents:**
- 16 constitutional sections (Â§ 1-16)
- Absolute prohibitions
- Performance budgets
- Change authority rules

---

### 2. ðŸ“‹ [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)
**Rapid lookup for daily development (6.3 KB)**

Quick facts, code snippets, and test checklists for developers.

**Read this if:**
- You need a quick fact (hold duration, offset values, etc.)
- Writing code and need syntax examples
- Running manual tests
- Debugging common issues

**Key Contents:**
- Constitutional quick facts table
- Module registry
- Gesture state machine
- 1-minute test checklist
- Common issues + fixes

---

### 3. ðŸ“– [README.md](./README.md)
**Complete overview and navigation guide (8.3 KB)**

Comprehensive introduction to the mobile navigation system.

**Read this if:**
- You want to understand the big picture
- Need to know what files do what
- Looking for testing instructions
- Want to understand design philosophy

**Key Contents:**
- Implementation architecture
- Current phase status
- Testing procedures
- Development commands
- Design philosophy
- Troubleshooting guide

---

### 4. ðŸŽ¨ [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)
**Technical analysis and premium enhancements (30 KB)**

Detailed technical breakdown of aesthetic and performance refinements.

**Read this if:**
- Implementing Phase 2 or Phase 3 features
- Optimizing performance
- Adding device-gated enhancements
- Understanding spring physics, blur, haptics

**Key Contents:**
- Aesthetic enhancements (depth-of-field blur, spring physics)
- Performance refinement (device capability detection)
- Accessibility compliance (WCAG 2.2 AA)
- Gesture refinement (edge case prevention)
- Visual specifications
- Phased rollout strategy

---

### 5. ðŸ—ºï¸ [CONSTITUTIONAL-MAPPING.md](./CONSTITUTIONAL-MAPPING.md)
**Constitution â†’ Code translation (33 KB)**

Maps every constitutional section to concrete implementation checkpoints.

**Read this if:**
- Writing code for a specific constitutional section
- Testing constitutional compliance
- Conducting code reviews
- Need implementation examples

**Key Contents:**
- Â§ 1-16 mapped to TypeScript code
- Test criteria for each section
- Implementation checkpoints
- Quick reference checklist

---

## ðŸ§­ Navigation Guide

### "I want to..."

**...understand what mobile navigation is:**
â†’ Start with [README.md](./README.md)

**...know the rules:**
â†’ Read [CONSTITUTION.md](./CONSTITUTION.md)

**...write code:**
â†’ Use [QUICK-REFERENCE.md](./QUICK-REFERENCE.md) + [CONSTITUTIONAL-MAPPING.md](./CONSTITUTIONAL-MAPPING.md)

**...implement Phase 2 features:**
â†’ Follow [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)

**...test the system:**
â†’ Use test checklists in [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)

**...review a pull request:**
â†’ Check against [CONSTITUTION.md](./CONSTITUTION.md) + [CONSTITUTIONAL-MAPPING.md](./CONSTITUTIONAL-MAPPING.md)

**...debug an issue:**
â†’ See troubleshooting in [README.md](./README.md) and [QUICK-REFERENCE.md](./QUICK-REFERENCE.md)

**...add a new module:**
â†’ Follow instructions in [README.md Â§ Contributing](./README.md#contributing)

**...change gesture behavior:**
â†’ Requires constitutional amendment (see [CONSTITUTION.md Â§ 15](./CONSTITUTION.md#15-change-authority))

---

## ðŸ“Š Phase Status

| Phase | Status | Documentation |
|-------|--------|---------------|
| **Phase 1: Core** | âœ… Complete | All sections of CONSTITUTION.md implemented |
| **Phase 2: Premium Feel** | âœ… Complete | Device-gated blur, momentum, telemetry |
| **Phase 3: Native-Ready** | â¸ï¸ Planned | Accessibility, deep linking, haptics |

---

## ðŸŽ¯ Key Files in Codebase

```
client/src/components/mobile-nav/
â”œâ”€â”€ constants.ts              â† Constitutional values (Â§ all)
â”œâ”€â”€ types.ts                  â† TypeScript interfaces
â”œâ”€â”€ MobileNavProvider.tsx     â† State management (Â§ 2.2)
â”œâ”€â”€ BottomTabBar.tsx          â† 3-tab bar (Â§ 2.1, Â§ 10)
â”œâ”€â”€ ModuleScroller.tsx        â† Gesture list (Â§ 6, Â§ 7, Â§ 8, Â§ 9)
â”œâ”€â”€ ScrollerOverlay.tsx       â† Backdrop (Â§ 9.3)
â”œâ”€â”€ useGestureRecognition.ts  â† Hold + swipe up (Â§ 4, Â§ 5)
â”œâ”€â”€ useDeviceCapabilities.ts  â† Device detection (Phase 2)
â”œâ”€â”€ useScrollPhysics.ts       â† Momentum (Phase 2)
â””â”€â”€ usePerformanceMonitor.ts  â† Telemetry (Â§ 11.1)
```

---

## ðŸ”— External References

- [React Rules of Hooks](https://react.dev/warnings/invalid-hook-call-warning)
- [WCAG 2.2 AA Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [Touch Events Specification](https://www.w3.org/TR/touch-events/)
- [PerformanceObserver API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver)

---

## ðŸ“ž Quick Help

### Common Questions

**Q: Can I add a fourth tab?**
A: No. Â§ 2.1 prohibits this.

**Q: Can I change the hold duration?**
A: Requires constitutional amendment (Â§ 15). Current: 250ms Â± 30ms

**Q: Why is blur not working?**
A: Check device memory (<4GB), browser support, and `FEATURES.PHASE_2_BLUR` flag

**Q: Can desktop use this navigation?**
A: No. Â§ 1.1: Mobile only. Desktop sidebar remains unchanged.

**Q: How do I disable Phase 2 features?**
A: Set `FEATURES.PHASE_2_*` flags to `false` in `constants.ts`

---

## ðŸ“œ License

This navigation system is governed by the [Mobile Navigation Constitution](./CONSTITUTION.md).

All changes must comply with **Â§ 15: Change Authority**.

---

**Documentation Version:** 1.0
**Implementation Version:** Phase 2 Complete
**Next Milestone:** Phase 3 (Accessibility)


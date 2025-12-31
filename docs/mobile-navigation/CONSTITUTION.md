# 🔒 MANTODEUS MANAGER — MOBILE NAVIGATION CONSTITUTION

**Status:** Binding
**Scope:** Mobile only
**Audience:** Engineers, designers, reviewers
**Enforcement:** Mandatory

---

## 0. PURPOSE

This document defines the non-negotiable laws governing mobile navigation in Mantodeus Manager.

Its purpose is to ensure that:

- Navigation remains deliberate, ergonomic, and accident-proof
- Performance remains predictable and testable
- Visual behaviour remains calm, readable, and brand-consistent
- Desktop behaviour remains untouched
- Future contributors cannot degrade the system through interpretation or "taste"

This constitution overrides all informal discussion, mockups, or partial implementations.

---

## 1. PLATFORM SOVEREIGNTY

### 1.1 Mobile First — By Law

Mobile navigation rules apply only on mobile breakpoints.

Desktop navigation must not change.

Desktop sidebar remains authoritative.

### 1.2 No Cross-Contamination

Mobile gestures must never activate on desktop.

Desktop shortcuts must never affect mobile behaviour.

---

## 2. NAVIGATION MODEL (FOUNDATIONAL)

### 2.1 Bottom Tab Bar

The mobile app has exactly three bottom navigation tabs:

- **Office**
- **Field**
- **Tools**

No additional tabs may be added.

### 2.2 Default State

The app must open into the **Field** tab on mobile.

This is not configurable.

### 2.3 Tab Meaning

- **Office** = administrative, financial, planning work
- **Field** = on-site, active, primary work
- **Tools** = utilities, reference, system controls

---

## 3. MODULE OWNERSHIP (LOCKED)

Each module belongs to one and only one tab.

### 3.1 Office Modules

- Projects
- Invoices
- Expenses
- Reports
- Contacts
- Notes

### 3.2 Field Modules

- Inspections
- Gallery
- Notes

### 3.3 Tools Modules

- Map
- Calendar
- Contacts
- Settings (always last)

Modules may not appear in multiple tabs.

---

## 4. PRIMARY GESTURE — HOLD → FLICK

### 4.1 Activation Rule

A module scroller may only be activated by:
**Tap → Hold → Vertical Flick**

Hold duration: **250 ms ± 30 ms**

A simple tap must never activate the scroller.

### 4.2 Valid Touch Origin

Gesture must originate on a bottom tab icon.

Touches outside tab icons are invalid.

---

## 5. ERGONOMIC LAW (NON-NEGOTIABLE)

### 5.1 Thumb Biomechanics

A thumb arcs outward toward the side of the hand holding the phone.

Navigation must respect this physical truth.

### 5.2 Direction Mapping

- **Up + Right flick** → Right-side scroller
- **Up + Left flick** → Left-side scroller

This mapping may never be inverted.

---

## 6. MODULE SCROLLER — BEHAVIOUR

### 6.1 Scope

The scroller shows only modules belonging to the active tab.

Cross-tab scrolling is forbidden.

### 6.2 State Safety

The module scroller may never change application state until finger release.

Highlighting during drag is preview-only.

Navigation occurs only on release.

---

## 7. FLICK-THROUGH INTERACTION

### 7.1 Finger Authority

Finger position is the source of truth.

UI must never move ahead of the finger.

### 7.2 Motion Rules

- Slow movement → precise stepping
- Fast movement → momentum scrolling (if enabled by phase)
- When finger pauses, selection snaps to nearest item.

---

## 8. DEPTH DISPLACEMENT (READABILITY LAW)

### 8.1 Purpose

Depth displacement exists to:

- Prevent finger occlusion of text
- Communicate selection spatially
- Replace decorative highlights with physical clarity

### 8.2 Displacement Rules

Offsets are applied laterally toward the screen centre:

- **Active item:** maximum displacement
- **Immediate neighbours:** reduced displacement
- **Distant items:** no displacement

Displacement strength is strictly proportional to proximity to the active index.

### 8.3 Blur

**Blur is additive, not essential.**

Offset alone must solve readability.

Blur must be capability-gated.

---

## 9. VISUAL HIERARCHY (MANDATORY)

### 9.1 Active Item

- Highest opacity
- Slight scale increase
- Accent colour emphasis
- Text must remain fully legible at all times

### 9.2 Inactive Items

- Reduced opacity
- No competing emphasis
- No decorative animation

### 9.3 Background

App background dims subtly during scroller activation.

Must feel paused, not modal or blocked.

---

## 10. CONTEXT ANCHORING

### 10.1 Bottom Bar Authority

Context (Office / Field / Tools) is shown only in the bottom bar.

When the scroller is active:

- The active tab reveals its label above the icon
- Other tabs remain icon-only

### 10.2 Prohibition

Tab labels must never appear inside the scroller.

---

## 11. PERFORMANCE LAW

### 11.1 Budgets

The system must meet these guarantees:

- **Gesture response:** < 16 ms
- **Scroller appearance:** < 150 ms
- **Tap → screen navigation:** < 300 ms
- **Maximum dropped frames per gesture:** 2

These are testable requirements.

### 11.2 Degradation

Enhancements must degrade gracefully.

Core interaction must never fail due to enhancement removal.

---

## 12. ACCESSIBILITY LAW

### 12.1 Compliance

Navigation must meet WCAG 2.2 AA requirements.

### 12.2 Mandatory Support

- Keyboard navigation
- Screen reader announcements
- Focus trapping during scroller activation
- Focus restoration on close
- Reduced motion preference honoured

Accessibility is not optional.

---

## 13. PHASE AUTHORITY

### 13.1 Phase Separation

Enhancements are phased:

- **Phase 1:** Core (must ship)
- **Phase 2:** Premium feel (device-gated)
- **Phase 3:** Native-ready polish

No phase may partially borrow features from a later phase.

### 13.2 Guarantees vs Enhancements

**Guarantees** must always work.

**Enhancements** may be removed without breaking guarantees.

---

## 14. PROHIBITIONS (ABSOLUTE)

The following are forbidden:

1. Accidental edge activation
2. Mid-flick routing
3. Decorative motion without purpose
4. Ripple/wave animations
5. Cross-tab scroller content
6. Gesture-triggered navigation without hold
7. Desktop behaviour changes

---

## 15. CHANGE AUTHORITY

This constitution may only be changed if:

- The change is deliberate
- The change is documented
- The change improves ergonomics, clarity, or safety

Silent drift is not allowed.

---

## 16. FINAL PRINCIPLE

**Navigation is not animation.**
**Navigation is trust.**

Every gesture must:

- feel deliberate
- feel readable
- feel predictable
- feel calm

Anything that compromises trust is a regression.

---

🔒 **END OF NAVIGATION CONSTITUTION**

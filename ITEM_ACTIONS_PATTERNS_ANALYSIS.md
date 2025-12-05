# Item Actions Patterns Analysis

This document catalogs all the different patterns used for item actions (edit/delete/duplicate/etc) across the codebase.

## Pattern 1: Right-Click / Long-Press Context Menus

**Description:** Custom context menu component that appears on right-click (desktop) or long-press (mobile). The menu is positioned at cursor/touch location and shows action buttons (Edit, Delete, Select).

**Components:**
- `client/src/components/ContextMenu.tsx` - The reusable context menu component
- `client/src/hooks/useContextMenu.ts` - Hook for handling right-click and long-press events

**How it works:**
1. User right-clicks or long-presses (500ms) on an item
2. Context menu state is set with x/y coordinates and item ID
3. `ContextMenu` component renders at those coordinates
4. User clicks an action button (Edit, Delete, Select)
5. Handler executes the action and closes the menu

**Files using this pattern:**
- `client/src/pages/Projects.tsx` (lines 32, 74-89, 161-164, 225-232)
- `client/src/pages/Jobs.tsx` (lines 26, 60-75, 146-189, 250-257)
- `client/src/pages/Contacts.tsx` (lines 27, 131-140, 267-279, 293-295, 383-390)
- `client/src/pages/Notes.tsx` (lines 56, 165-174, 335-353, 362-365, 627-633)
- `client/src/pages/Maps.tsx` (lines 71, 513-522, 791-817, 888-895)

**Issues:**
- **No visible trigger** - Actions are only discoverable via right-click/long-press
- **Inconsistent implementation** - Some pages use the `useContextMenu` hook, others implement long-press manually
- **Mobile UX** - Long-press is not intuitive and has no visual feedback until menu appears

---

## Pattern 2: Inline Delete Buttons

**Description:** Delete button (trash icon) directly visible on each item card, typically in the top-right corner or action area.

**How it works:**
- Button is always visible (or appears on hover in some cases)
- Clicking triggers delete confirmation dialog
- Button may be hidden during multi-select mode

**Files using this pattern:**

### Always Visible Inline Delete Buttons:
- `client/src/pages/Contacts.tsx` (lines 328-340) - Trash icon button in card header
- `client/src/pages/Notes.tsx` (lines 384-396) - Trash icon button in card header  
- `client/src/pages/Maps.tsx` (lines 852-864) - Trash icon button in location card
- `client/src/components/ProjectJobList.tsx` (lines 104-116) - Trash icon button next to status badge
- `client/src/components/TaskList.tsx` (lines 169-176) - Trash icon button in action area
- `client/src/pages/Invoices.tsx` (lines 369-374) - Trash icon button in header

### Hover-Overlay Delete Buttons:
- `client/src/components/ImageGallery.tsx` (lines 198-209) - Delete button appears on hover overlay
- `client/src/components/ProjectFileGallery.tsx` (lines 353-360, 401-410) - Delete button in action area (always visible for non-images, in overlay for images)

**Issues:**
- **Inconsistent placement** - Some top-right, some bottom-right, some in overlays
- **No edit action** - Only delete is available inline (except detail pages)
- **Mixed with context menus** - Contacts, Notes, Maps have BOTH inline delete AND context menu (redundant)

---

## Pattern 3: Detail Page Action Buttons

**Description:** Edit and Delete buttons in the header/toolbar of detail pages (not in list views).

**Files using this pattern:**
- `client/src/pages/ProjectDetail.tsx` (lines 126-130, 260) - Edit button in header, Delete button at bottom
- `client/src/pages/JobDetail.tsx` (lines 111-113, 214) - Edit button in header, Delete button at bottom
- `client/src/pages/ProjectJobDetail.tsx` (lines 138, 243) - Edit button in header, Delete button at bottom

**How it works:**
- Edit button opens edit dialog
- Delete button is typically at the bottom of the page
- Both are always visible in the page header/toolbar

**Issues:**
- **Consistent pattern** - This is actually well-implemented and consistent
- **Different from list views** - List items don't have visible edit buttons

---

## Pattern 4: Dropdown Menu (Kebab/More Menu)

**Description:** Radix UI dropdown menu component, typically triggered by a button or avatar.

**Components:**
- `client/src/components/ui/dropdown-menu.tsx` - Radix UI dropdown menu primitives

**Files using this pattern:**
- `client/src/components/DashboardLayout.tsx` (lines 242-277) - User menu dropdown (Export/Import, Sign out)
- `client/src/pages/ComponentShowcase.tsx` (lines 1127-1139) - Example usage only

**How it works:**
- DropdownMenuTrigger wraps a button/avatar
- DropdownMenuContent contains menu items
- Opens on click, closes on selection or outside click

**Issues:**
- **Not used for item actions** - Only used for user menu, not for list item actions
- **Could be the solution** - This pattern would work well for item actions but isn't currently used

---

## Pattern 5: Multi-Select Bar Actions

**Description:** When multi-select mode is active, a bottom bar appears with batch actions (Delete, Cancel).

**Components:**
- `client/src/components/MultiSelectBar.tsx` - Bottom action bar for multi-select

**Files using this pattern:**
- `client/src/pages/Projects.tsx` (lines 234-243)
- `client/src/pages/Jobs.tsx` (lines 259-268)
- `client/src/pages/Contacts.tsx` (lines 393-399)
- `client/src/pages/Notes.tsx` (lines 640-647)
- `client/src/pages/Maps.tsx` (lines 898-905)

**How it works:**
- User enters multi-select mode (via context menu "Select" action)
- Selected items show checkboxes
- MultiSelectBar appears at bottom with batch delete action
- This is a separate pattern from single-item actions

**Issues:**
- **Consistent implementation** - This pattern is well-implemented
- **Entry point issue** - Multi-select mode is only accessible via context menu "Select" action, which is not discoverable

---

## Summary of Inconsistencies

### 1. **Mixed Patterns on Same Pages**
- **Contacts, Notes, Maps**: Have BOTH context menu AND inline delete button (redundant)
- **Projects, Jobs**: Only have context menu (no visible actions)
- **ProjectJobList, TaskList**: Only have inline delete button (no context menu)

### 2. **No Consistent Primary Pattern**
- Some pages rely solely on right-click/long-press (poor discoverability)
- Some pages have inline buttons but only for delete
- No pages use a kebab/more menu for item actions

### 3. **Inconsistent Edit Access**
- List items: Edit only via context menu (not discoverable)
- Detail pages: Edit button always visible (good)
- Some items: Clicking opens edit (Contacts, Notes) - but this conflicts with multi-select

### 4. **Mobile UX Issues**
- Long-press is not intuitive
- No visual indication that long-press is available
- Touch targets may be too small for inline buttons

### 5. **Implementation Inconsistencies**
- Some pages use `useContextMenu` hook (Contacts, Notes, Maps)
- Some pages implement long-press manually (Jobs)
- Some pages only support right-click (Projects)

---

## Recommendations

### Primary Pattern: Kebab Menu (More Menu)
- **Visible trigger** - Three-dot icon always visible on each item
- **Desktop & Mobile friendly** - Works well on both platforms
- **Consistent placement** - Top-right corner of each item card
- **All actions in one place** - Edit, Delete, Duplicate, etc.

### Secondary Pattern: Right-Click/Long-Press (Optional Shortcut)
- Keep as a shortcut for power users
- Should trigger the same kebab menu
- Not required for discoverability

### Implementation Strategy
1. Create shared `ItemActionsMenu` component (kebab menu)
2. Support both click trigger and context menu trigger
3. Replace all current patterns with this unified component
4. Ensure visible trigger is always present

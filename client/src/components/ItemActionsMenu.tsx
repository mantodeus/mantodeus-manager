/**
 * ItemActionsMenu Component
 * 
 * A reusable three-dot (kebab) menu for item actions with Apple-style centered context menu.
 * 
 * STRICT ORDER (non-negotiable):
 * 1. Edit
 * 2. Duplicate
 * 3. Select
 * 4. Archive
 * 5. Delete
 * 
 * Only visibility may change based on permissions/state — order never changes.
 * 
 * Now uses CenteredContextMenu for Apple Maps/Files-style interaction:
 * - Item lifts up when menu opens
 * - Menu appears centered below preview
 * - Background blurs and dims
 * - Supports both button tap and long-press
 */

import { useCallback, useMemo } from "react";
import { CenteredContextMenu, CenteredContextMenuAction } from "@/components/CenteredContextMenu";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export type ItemAction = CenteredContextMenuAction;

interface ItemActionsMenuProps {
  /** Callback when an action is selected */
  onAction: (action: ItemAction) => void;
  /** Available actions to show in the menu (order is enforced) */
  actions?: ItemAction[];
  /** Additional className for the trigger button */
  triggerClassName?: string;
  /** Size of the trigger button */
  size?: "sm" | "md" | "lg";
  /** Whether the menu is disabled */
  disabled?: boolean;
}

// STRICT ORDER - This order must never change
const STANDARD_ACTION_ORDER: ItemAction[] = ["edit", "duplicate", "select", "archive", "delete"];
// Rubbish actions order (for trashed items)
const RUBBISH_ACTION_ORDER: ItemAction[] = ["restore", "deletePermanently"];

export function ItemActionsMenu({
  onAction,
  actions = ["edit", "delete"],
  triggerClassName,
  size = "sm",
  disabled = false,
}: ItemActionsMenuProps) {
  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-8 w-8",
    lg: "h-9 w-9",
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-4 w-4",
  };

  if (!onAction || typeof onAction !== 'function') {
    console.error('ItemActionsMenu: onAction prop is required and must be a function');
    return null;
  }

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className={cn(sizeClasses[size], triggerClassName)}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <MoreVertical className={iconSizes[size]} />
      <span className="sr-only">More actions</span>
    </Button>
  );

  // CenteredContextMenu needs to wrap the item to create the preview.
  // Since ItemActionsMenu is used as a button inside items, we need a different approach.
  // We'll use a wrapper that finds the parent item element.
  
  return (
    <CenteredContextMenu
      onAction={onAction}
      actions={actions}
      disabled={disabled}
      triggerButton={triggerButton}
    >
      {/* This div will be used to find the parent item */}
      <div style={{ display: "none" }} />
    </CenteredContextMenu>
  );
}

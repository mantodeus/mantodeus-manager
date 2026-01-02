/**
 * ItemActionsMenu Component
 * 
 * A reusable three-dot (kebab) menu for item actions.
 * 
 * STRICT ORDER (non-negotiable):
 * 1. Edit
 * 2. Duplicate
 * 3. Select
 * 4. Archive
 * 5. Delete
 * 
 * Only visibility may change based on permissions/state — order never changes.
 */

import { useState, useCallback, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, Copy, CheckCircle2, Archive, RotateCcw, Trash, Eye, DollarSign, XCircle } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export type ItemAction =
  | "edit"
  | "duplicate"
  | "select"
  | "archive"
  | "delete";

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

export function ItemActionsMenu({
  onAction,
  actions = ["edit", "delete"],
  triggerClassName,
  size = "sm",
  disabled = false,
}: ItemActionsMenuProps) {
  const [open, setOpen] = useState(false);

  const actionConfig = {
    view: { icon: Eye, label: "View", variant: "default" as const },
    edit: { icon: Edit, label: "Edit", variant: "default" as const },
    delete: { icon: Trash2, label: "Delete", variant: "destructive" as const },
    duplicate: { icon: Copy, label: "Duplicate", variant: "default" as const },
    select: { icon: CheckCircle2, label: "Select", variant: "default" as const },
    archive: { icon: Archive, label: "Archive", variant: "default" as const },
    restore: { icon: RotateCcw, label: "Restore", variant: "default" as const },
    moveToTrash: { icon: Trash, label: "Delete", variant: "destructive" as const },
    deletePermanently: { icon: Trash2, label: "Delete permanently", variant: "destructive" as const },
    revertToDraft: { icon: RotateCcw, label: "Mark as not sent", variant: "destructive" as const },
    revertToSent: { icon: RotateCcw, label: "Mark as not paid", variant: "destructive" as const },
    markAsPaid: { icon: DollarSign, label: "Mark as paid", variant: "default" as const },
    markAsInOrder: { icon: CheckCircle2, label: "Mark as In Order", variant: "default" as const },
    void: { icon: XCircle, label: "Void", variant: "destructive" as const },
  };
  const handleAction = useCallback(
    (action: ItemAction) => {
      try {
        onAction(action);
        setOpen(false);
      } catch (error) {
        console.error("Error handling action:", error);
        setOpen(false);
      }
    },
    [onAction]
  );

  // Enforce strict order: filter to only standard actions, then sort by STANDARD_ACTION_ORDER
  const validActions = STANDARD_ACTION_ORDER.filter((action) => 
    (actions || []).includes(action)
  );

  // Group actions logically: Primary, Mode, Lifecycle, Destructive
  const groupedActions = useMemo(() => {
    const groups: {
      primary: ItemAction[];
      mode: ItemAction[];
      lifecycle: ItemAction[];
      destructive: ItemAction[];
    } = {
      primary: [],
      mode: [],
      lifecycle: [],
      destructive: [],
    };

    validActions.forEach((action) => {
      if (action === "edit" || action === "duplicate") {
        groups.primary.push(action);
      } else if (action === "select") {
        groups.mode.push(action);
      } else if (action === "archive") {
        groups.lifecycle.push(action);
      } else if (action === "delete") {
        groups.destructive.push(action);
      }
    });

    return groups;
  }, [validActions]);

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

  const renderActionItem = (action: ItemAction) => {
    const config = actionConfig[action];
    if (!config) return null;
    const Icon = config.icon;
    const isDestructive = config.variant === "destructive";
    
    return (
      <DropdownMenuItem
        key={action}
        variant={config.variant}
        onClick={(e) => {
          e.stopPropagation();
          handleAction(action);
        }}
        className={cn(
          "cursor-pointer",
          isDestructive && "delete"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{config.label}</span>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            sizeClasses[size],
            triggerClassName
          )}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <MoreVertical className={iconSizes[size]} />
          <span className="sr-only">More actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
      >
        {validActions.length === 0 ? (
          <DropdownMenuItem disabled className="text-xs uppercase">
            No actions available
          </DropdownMenuItem>
        ) : (
          <>
            {/* Primary: Edit, Duplicate */}
            {groupedActions.primary.length > 0 && (
              <div className="menu-group">
                {groupedActions.primary.map(renderActionItem)}
              </div>
            )}

            {/* Mode: Select */}
            {groupedActions.mode.length > 0 && (
              <div className="menu-group">
                {groupedActions.mode.map(renderActionItem)}
              </div>
            )}

            {/* Lifecycle: Archive */}
            {groupedActions.lifecycle.length > 0 && (
              <div className="menu-group">
                {groupedActions.lifecycle.map(renderActionItem)}
              </div>
            )}

            {/* Destructive: Delete (isolated with extra spacing) */}
            {groupedActions.destructive.length > 0 && (
              <div className="menu-group destructive">
                {groupedActions.destructive.map(renderActionItem)}
              </div>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

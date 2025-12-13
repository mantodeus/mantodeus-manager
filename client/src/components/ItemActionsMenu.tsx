/**
 * ItemActionsMenu Component
 * 
 * A reusable three-dot (kebab) menu for item actions (edit, delete, duplicate, etc.)
 * Supports both click trigger and right-click/long-press shortcuts.
 */

import { useState, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, Copy, CheckSquare, Archive, RotateCcw, Trash } from "lucide-react";

export type ItemAction =
  | "edit"
  | "delete"
  | "duplicate"
  | "select"
  // Project lifecycle actions (Projects only)
  | "archive"
  | "restore"
  | "moveToTrash"
  | "deletePermanently";

interface ItemActionsMenuProps {
  /** Callback when an action is selected */
  onAction: (action: ItemAction) => void;
  /** Available actions to show in the menu */
  actions?: ItemAction[];
  /** Additional className for the trigger button */
  triggerClassName?: string;
  /** Size of the trigger button */
  size?: "sm" | "md" | "lg";
  /** Whether the menu is disabled */
  disabled?: boolean;
}

export function ItemActionsMenu({
  onAction,
  actions = ["edit", "delete"],
  triggerClassName,
  size = "sm",
  disabled = false,
}: ItemActionsMenuProps) {
  const [open, setOpen] = useState(false);

  const actionConfig = {
    edit: { icon: Edit, label: "Edit", variant: "default" as const },
    delete: { icon: Trash2, label: "Delete", variant: "destructive" as const },
    duplicate: { icon: Copy, label: "Duplicate", variant: "default" as const },
    select: { icon: CheckSquare, label: "Select", variant: "default" as const },
    archive: { icon: Archive, label: "Archive", variant: "default" as const },
    restore: { icon: RotateCcw, label: "Restore", variant: "default" as const },
    moveToTrash: { icon: Trash, label: "Move to Trash", variant: "destructive" as const },
    deletePermanently: { icon: Trash2, label: "Delete permanently", variant: "destructive" as const },
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

  // Filter and validate actions
  const validActions = (actions || []).filter((action) => actionConfig[action]);

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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`${sizeClasses[size]} ${triggerClassName || ""}`}
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
        align="end"
        className="min-w-[160px]"
        onClick={(e) => e.stopPropagation()}
      >
        {validActions.length === 0 ? (
          <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
        ) : (
          validActions.map((action) => {
            const config = actionConfig[action];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <DropdownMenuItem
                key={action}
                variant={config.variant}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(action);
                }}
                className="cursor-pointer"
              >
                <Icon className="h-4 w-4 mr-2" />
                <span>{config.label}</span>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * ItemActionsMenu Component
 * 
 * A reusable three-dot (kebab) menu for item actions (edit, delete, duplicate, etc.)
 * Supports both click trigger and right-click/long-press shortcuts.
 */

import { useState, useCallback, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, Copy, CheckSquare } from "lucide-react";
import { useContextMenu } from "@/hooks/useContextMenu";

export type ItemAction = "edit" | "delete" | "duplicate" | "select";

interface ItemActionsMenuProps {
  /** Callback when an action is selected */
  onAction: (action: ItemAction) => void;
  /** Available actions to show in the menu */
  actions?: ItemAction[];
  /** Whether to show the menu trigger button */
  showTrigger?: boolean;
  /** Whether to enable right-click/long-press shortcut */
  enableContextMenu?: boolean;
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
  showTrigger = true,
  enableContextMenu = true,
  triggerClassName,
  size = "sm",
  disabled = false,
}: ItemActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleAction = useCallback(
    (action: ItemAction) => {
      onAction(action);
      setOpen(false);
    },
    [onAction]
  );

  const handleContextMenu = useCallback(
    (x: number, y: number) => {
      if (!enableContextMenu || disabled) return;
      // Open the dropdown menu at the context menu position
      setOpen(true);
      // Position will be handled by Radix UI's positioning
    },
    [enableContextMenu, disabled]
  );

  const { contextMenuHandlers } = useContextMenu({
    onContextMenu: handleContextMenu,
  });

  const actionConfig = {
    edit: { icon: Edit, label: "Edit", variant: "default" as const },
    delete: { icon: Trash2, label: "Delete", variant: "destructive" as const },
    duplicate: { icon: Copy, label: "Duplicate", variant: "default" as const },
    select: { icon: CheckSquare, label: "Select", variant: "default" as const },
  };

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

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            className={`${sizeClasses[size]} ${triggerClassName || ""}`}
            disabled={disabled}
            {...(enableContextMenu ? {
              ...contextMenuHandlers,
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                contextMenuHandlers.onClick?.(e);
              }
            } : {
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
              }
            })}
          >
            <MoreVertical className={iconSizes[size]} />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        align="end"
        className="min-w-[160px]"
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((action, index) => {
          const config = actionConfig[action];
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
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

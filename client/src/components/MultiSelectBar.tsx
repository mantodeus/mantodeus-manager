/**
 * MultiSelectBar Component
 * 
 * Selection mode UI bar that appears when items are selected.
 * 
 * REQUIRED ACTIONS (in order):
 * - Select all
 * - Duplicate
 * - Archive
 * - Delete
 * - Cancel
 * 
 * Mobile-first, full-width, properly aligned, no clipping.
 */

import { Trash2, Archive, X, Copy, CheckSquare } from "@/components/ui/Icon";
import type { IconComponent } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export interface MultiSelectAction {
  label: string;
  icon: IconComponent;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary";
  disabled?: boolean;
}

interface MultiSelectBarProps {
  selectedCount: number;
  totalCount?: number;
  onSelectAll?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onCancel: () => void;
  /** Whether all items are currently selected */
  allSelected?: boolean;
  /** Legacy support: if provided, shows only this action + cancel */
  onPrimaryAction?: () => void;
  primaryLabel?: string;
  primaryIcon?: IconComponent;
  primaryVariant?: "default" | "destructive" | "outline" | "secondary";
  /** Legacy support: custom actions array (deprecated, use individual handlers) */
  actions?: MultiSelectAction[];
}

export function MultiSelectBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDuplicate,
  onArchive,
  onDelete,
  onCancel,
  allSelected = false,
  // Legacy props
  onPrimaryAction,
  primaryLabel = "Delete",
  primaryIcon: PrimaryIcon = Trash2,
  primaryVariant = "destructive",
  actions,
}: MultiSelectBarProps) {
  if (selectedCount === 0) return null;

  // Use new API if handlers are provided, otherwise fall back to legacy API
  const useNewAPI = onSelectAll || onDuplicate || onArchive || onDelete;
  
  // Build actions array in required order
  const standardActions: MultiSelectAction[] = [];
  
  if (useNewAPI) {
    if (onSelectAll && totalCount && selectedCount < totalCount) {
      standardActions.push({
        label: "Select all",
        icon: CheckSquare,
        onClick: onSelectAll,
        variant: "outline",
      });
    }
    if (onDuplicate) {
      standardActions.push({
        label: "Duplicate",
        icon: Copy,
        onClick: onDuplicate,
        variant: "default",
      });
    }
    if (onArchive) {
      standardActions.push({
        label: "Archive",
        icon: Archive,
        onClick: onArchive,
        variant: "default",
      });
    }
    if (onDelete) {
      standardActions.push({
        label: "Delete",
        icon: Trash2,
        onClick: onDelete,
        variant: "destructive",
      });
    }
  } else if (actions) {
    // Legacy: use provided actions array
    standardActions.push(...actions);
  } else if (onPrimaryAction) {
    // Legacy: use single primary action
    standardActions.push({
      label: primaryLabel,
      icon: PrimaryIcon,
      onClick: onPrimaryAction,
      variant: primaryVariant,
    });
  }

  return (
    <div 
      className="multi-select-bar fixed left-0 right-0 mx-auto z-50 w-full max-w-7xl"
      style={{ bottom: 'var(--bottom-safe-area, 0px)', marginBottom: '1rem' }}
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center justify-center sm:justify-start min-h-[44px]">
          <span
            className="text-sm sm:text-base font-medium text-center sm:text-left"
            style={{ fontFamily: "Kanit, sans-serif", color: "rgba(255, 255, 255, 0.9)" }}
          >
            {selectedCount} selected
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 flex-1">
          {standardActions.map((action, index) => {
            const Icon = action.icon;
            const isDelete = action.variant === "destructive";
            return (
              <button
                key={index}
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  "select-action",
                  isDelete && "delete",
                  action.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{action.label}</span>
              </button>
            );
          })}
          <button
            onClick={onCancel}
            className="select-action"
          >
            <X className="h-4 w-4" />
            <span className="whitespace-nowrap">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Creates a delete action for MultiSelectBar
 */
export function createDeleteAction(
  onDelete: () => void,
  isPending: boolean = false
): MultiSelectAction {
  return {
    label: "Delete",
    icon: Trash2,
    onClick: onDelete,
    variant: "destructive",
    disabled: isPending,
  };
}

/**
 * Creates an archive action for MultiSelectBar
 */
export function createArchiveAction(
  onArchive: () => void,
  isPending: boolean = false
): MultiSelectAction {
  return {
    label: "Archive",
    icon: Archive,
    onClick: onArchive,
    variant: "default",
    disabled: isPending,
  };
}

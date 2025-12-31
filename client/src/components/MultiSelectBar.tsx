import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Archive, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MultiSelectAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary";
  disabled?: boolean;
}

interface MultiSelectBarProps {
  selectedCount: number;
  onPrimaryAction?: () => void;
  onCancel: () => void;
  primaryLabel?: string;
  primaryIcon?: LucideIcon;
  /**
   * Defaults to destructive to preserve existing behavior.
   * (Projects use this for "Archive", etc.)
   */
  primaryVariant?: "default" | "destructive" | "outline" | "secondary";
  /**
   * Array of actions to display. If provided, this takes precedence over onPrimaryAction.
   */
  actions?: MultiSelectAction[];
}

export function MultiSelectBar({
  selectedCount,
  onPrimaryAction,
  onCancel,
  primaryLabel = "Delete",
  primaryIcon: PrimaryIcon = Trash2,
  primaryVariant = "destructive",
  actions,
}: MultiSelectBarProps) {
  if (selectedCount === 0) return null;

  return (
    <Card className="fixed left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 shadow-2xl border-2 border-accent bg-background/95 backdrop-blur" style={{ bottom: `calc(6rem + env(safe-area-inset-bottom))` }}>
      <div className="flex items-center gap-6">
        <span
          className="text-sm font-medium"
          style={{ fontFamily: "Kanit, sans-serif" }}
        >
          {selectedCount} selected
        </span>
        <div className="flex items-center gap-2">
          {actions ? (
            actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant={action.variant || "default"}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </Button>
              );
            })
          ) : (
            <Button
              variant={primaryVariant}
              size="sm"
              onClick={onPrimaryAction}
              className="gap-2"
            >
              <PrimaryIcon className="h-4 w-4" />
              {primaryLabel}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </div>
    </Card>
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

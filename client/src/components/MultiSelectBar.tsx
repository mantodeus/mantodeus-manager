import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Archive, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MultiSelectAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
}

interface MultiSelectBarProps {
  selectedCount: number;
  onCancel: () => void;
  /** Actions to display (in order). Typically: Delete, Archive */
  actions?: MultiSelectAction[];
  /** @deprecated Use actions array instead. Kept for backwards compatibility */
  onPrimaryAction?: () => void;
  /** @deprecated Use actions array instead */
  primaryLabel?: string;
  /** @deprecated Use actions array instead */
  primaryIcon?: LucideIcon;
  /** @deprecated Use actions array instead */
  primaryVariant?: "default" | "destructive" | "outline" | "secondary";
}

/**
 * Bulk action bar for multi-select mode.
 * Displays at the bottom of the screen with selected count and action buttons.
 * 
 * @example
 * ```tsx
 * <MultiSelectBar
 *   selectedCount={3}
 *   onCancel={handleCancel}
 *   actions={[
 *     { label: "Delete", icon: Trash2, onClick: handleDelete, variant: "destructive" },
 *     { label: "Archive", icon: Archive, onClick: handleArchive, variant: "outline" },
 *   ]}
 * />
 * ```
 */
export function MultiSelectBar({
  selectedCount,
  onCancel,
  actions,
  // Deprecated props for backwards compatibility
  onPrimaryAction,
  primaryLabel = "Delete",
  primaryIcon: PrimaryIcon = Trash2,
  primaryVariant = "destructive",
}: MultiSelectBarProps) {
  if (selectedCount === 0) return null;

  // Build actions array - use new actions prop if provided, otherwise fall back to legacy props
  const resolvedActions: MultiSelectAction[] = actions || (onPrimaryAction ? [{
    label: primaryLabel,
    icon: PrimaryIcon,
    onClick: onPrimaryAction,
    variant: primaryVariant,
  }] : []);

  return (
    <Card 
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-4 sm:px-6 py-3 sm:py-4 shadow-2xl border-2 border-primary bg-background/95 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200"
      role="toolbar"
      aria-label="Bulk actions"
    >
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Selected count indicator */}
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
          aria-live="polite"
        >
          <span
            className="text-sm font-medium text-primary tabular-nums"
            style={{ fontFamily: "Kanit, sans-serif" }}
          >
            {selectedCount}
          </span>
          <span
            className="text-sm text-muted-foreground hidden sm:inline"
            style={{ fontFamily: "Kanit, sans-serif" }}
          >
            selected
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {resolvedActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                variant={action.variant || "outline"}
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
                className="gap-2 transition-all duration-150 active:scale-95"
                aria-label={`${action.label} ${selectedCount} items`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{action.label}</span>
              </Button>
            );
          })}
          
          {/* Cancel button - always last */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="gap-2 text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95"
            aria-label="Cancel selection"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Cancel</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Export commonly used action creators for convenience
export const createDeleteAction = (onClick: () => void, disabled?: boolean): MultiSelectAction => ({
  label: "Delete",
  icon: Trash2,
  onClick,
  variant: "destructive",
  disabled,
});

export const createArchiveAction = (onClick: () => void, disabled?: boolean): MultiSelectAction => ({
  label: "Archive",
  icon: Archive,
  onClick,
  variant: "outline",
  disabled,
});

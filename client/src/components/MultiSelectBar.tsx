import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MultiSelectBarProps {
  selectedCount: number;
  onPrimaryAction: () => void;
  onCancel: () => void;
  primaryLabel?: string;
  primaryIcon?: LucideIcon;
  /**
   * Defaults to destructive to preserve existing behavior.
   * (Projects use this for "Archive", etc.)
   */
  primaryVariant?: "default" | "destructive" | "outline" | "secondary";
}

export function MultiSelectBar({
  selectedCount,
  onPrimaryAction,
  onCancel,
  primaryLabel = "Delete",
  primaryIcon: PrimaryIcon = Trash2,
  primaryVariant = "destructive",
}: MultiSelectBarProps) {
  if (selectedCount === 0) return null;

  return (
    <Card className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 shadow-2xl border-2 border-[#00ff88] bg-background/95 backdrop-blur">
      <div className="flex items-center gap-6">
        <span
          className="text-sm font-medium"
          style={{ fontFamily: "Kanit, sans-serif" }}
        >
          {selectedCount} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant={primaryVariant}
            size="sm"
            onClick={onPrimaryAction}
            className="gap-2"
          >
            <PrimaryIcon className="h-4 w-4" />
            {primaryLabel}
          </Button>
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

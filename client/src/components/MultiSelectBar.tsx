import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, X } from "lucide-react";

interface MultiSelectBarProps {
  selectedCount: number;
  onDelete: () => void;
  onCancel: () => void;
}

export function MultiSelectBar({ selectedCount, onDelete, onCancel }: MultiSelectBarProps) {
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
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
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

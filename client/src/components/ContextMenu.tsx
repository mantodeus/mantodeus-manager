import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Edit, Trash2, CheckSquare, X } from "@/components/ui/Icon";

export type ContextMenuAction = "edit" | "delete" | "select" | "cancel";

interface ContextMenuProps {
  x: number;
  y: number;
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
  actions?: ContextMenuAction[];
}

export function ContextMenu({ x, y, onAction, onClose, actions = ["edit", "delete", "select"] }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const actionConfig = {
    edit: { icon: Edit, label: "Edit", color: "text-foreground" },
    delete: { icon: Trash2, label: "Delete", color: "text-destructive" },
    select: { icon: CheckSquare, label: "Select", color: "text-accent" },
    cancel: { icon: X, label: "Cancel", color: "text-muted-foreground" },
  };

  return (
    <Card
      ref={menuRef}
      className="fixed z-50 min-w-[160px] p-1 shadow-lg border-2 border-accent/20"
      style={{ left: x, top: y }}
    >
      {actions.map((action) => {
        const config = actionConfig[action];
        const Icon = config.icon;
        return (
          <button
            key={action}
            onClick={() => {
              onAction(action);
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded hover:bg-accent transition-colors ${config.color}`}
            style={{ fontFamily: "Kanit, sans-serif", fontWeight: 200 }}
          >
            <Icon className="h-4 w-4" />
            <span>{config.label}</span>
          </button>
        );
      })}
    </Card>
  );
}

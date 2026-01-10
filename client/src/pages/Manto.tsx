import { useEffect } from "react";
import { useManto } from "@/contexts/MantoContext";
import { Button } from "@/components/ui/button";
import { BugAnt } from "@/components/ui/Icon";

export default function MantoPage() {
  const { openManto, isOpen } = useManto();

  useEffect(() => {
    openManto();
  }, [openManto]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <BugAnt className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Manto</h1>
          <p className="text-xs text-muted-foreground">
            The assistant is floating above the app. You can continue navigating while it stays open.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          If the panel does not appear, tap the button below to bring Manto back.
        </p>
        <Button onClick={openManto} size="sm" className="w-full justify-center" disabled={isOpen}>
          {isOpen ? "Manto is open" : "Show Manto"}
        </Button>
      </div>
    </div>
  );
}

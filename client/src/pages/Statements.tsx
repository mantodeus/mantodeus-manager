import { useEffect } from "react";
import { toast } from "sonner";

export default function Statements() {
  useEffect(() => {
    toast.info("Statements are coming soon.");
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-lg font-medium">Statements</h1>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}

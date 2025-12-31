import { useEffect } from "react";
import { toast } from "sonner";

export default function Weather() {
  useEffect(() => {
    toast.info("Weather is coming soon.");
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-lg font-medium">Weather</h1>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}

import { useEffect } from "react";
import { toast } from "sonner";
import { ModulePage } from "@/components/ModulePage";

export default function Weather() {
  useEffect(() => {
    toast.info("Weather is coming soon.");
  }, []);

  return (
    <ModulePage
      title="Weather"
      subtitle="Coming soon."
    >
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </div>
    </ModulePage>
  );
}

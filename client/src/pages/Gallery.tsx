import { useEffect } from "react";
import { toast } from "sonner";
import { ModulePage } from "@/components/ModulePage";

export default function Gallery() {
  useEffect(() => {
    toast.info("Gallery is coming soon.");
  }, []);

  return (
    <ModulePage
      title="Gallery"
      subtitle="View and manage your photos and images"
    >
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </div>
    </ModulePage>
  );
}

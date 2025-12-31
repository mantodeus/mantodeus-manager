import { useEffect } from "react";
import { toast } from "sonner";

export default function Gallery() {
  useEffect(() => {
    toast.info("Gallery is coming soon.");
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-lg font-medium">Gallery</h1>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}

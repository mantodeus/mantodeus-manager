import { Camera } from "@/components/ui/Icon";
import { ModulePage } from "@/components/ModulePage";

/**
 * Capture page - Camera and gallery module
 * 
 * NOTE: This page does NOT open Mantodeus chat.
 * Mantodeus chat only opens when the action tab button is tapped.
 */
export default function Capture() {
  return (
    <ModulePage
      title="Capture"
      subtitle="Camera and gallery module is coming soon."
    >
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted/70 p-2">
          <Camera className="h-5 w-5 text-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Check back later for lightning-fast capture.
        </p>
      </div>
    </ModulePage>
  );
}

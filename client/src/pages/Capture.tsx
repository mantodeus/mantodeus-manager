import { Camera } from "@/components/ui/Icon";

/**
 * Capture page - Camera and gallery module
 * 
 * NOTE: This page does NOT open Mantodeus chat.
 * Mantodeus chat only opens when the action tab button is tapped.
 */
export default function Capture() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted/70 p-2">
          <Camera className="h-5 w-5 text-foreground" />
        </div>
        <h1 className="text-lg font-semibold">Capture</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Camera and gallery module is coming soon. Check back later for lightning-fast capture.
      </p>
    </div>
  );
}

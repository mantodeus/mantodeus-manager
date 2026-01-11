import { Microphone } from "@/components/ui/Icon";

/**
 * Record page - Voice recording module
 * 
 * NOTE: This page does NOT open Mantodeus chat.
 * Mantodeus chat only opens when the action tab button is tapped.
 */
export default function Record() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted/70 p-2">
          <Microphone className="h-5 w-5 text-foreground" />
        </div>
        <h1 className="text-lg font-semibold">Record</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Voice recording & transcript automation is on the way. Stay tuned for effortless notes from your audio.
      </p>
    </div>
  );
}

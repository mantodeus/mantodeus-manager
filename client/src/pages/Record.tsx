import { Microphone } from "@/components/ui/Icon";
import { ModulePage } from "@/components/ModulePage";

/**
 * Record page - Voice recording module
 * 
 * NOTE: This page does NOT open Mantodeus chat.
 * Mantodeus chat only opens when the action tab button is tapped.
 */
export default function Record() {
  return (
    <ModulePage
      title="Record"
      subtitle="Voice recording and transcript automation is on the way."
    >
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted/70 p-2">
          <Microphone className="h-5 w-5 text-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Stay tuned for effortless notes from your audio.
        </p>
      </div>
    </ModulePage>
  );
}

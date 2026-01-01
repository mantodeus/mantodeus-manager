/**
 * Sticky Review Actions Component (Mobile Only)
 * 
 * Sticky bottom action bar for mobile expense review.
 * Shows "Apply all" and "Mark in order" buttons.
 * Only visible when a needs_review card is expanded.
 */

import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles } from "@/components/ui/Icon";

interface StickyReviewActionsProps {
  proposedCount: number;
  canMarkInOrder: boolean;
  onApplyAll: () => void;
  onMarkInOrder: () => void;
  isApplying?: boolean;
  isMarkingInOrder?: boolean;
}

export function StickyReviewActions({
  proposedCount,
  canMarkInOrder,
  onApplyAll,
  onMarkInOrder,
  isApplying = false,
  isMarkingInOrder = false,
}: StickyReviewActionsProps) {
  // Only show on mobile (hidden on desktop)
  return (
    <div className="md:hidden fixed left-0 right-0 z-50 bg-background border-t shadow-lg p-4" style={{ bottom: 'var(--bottom-safe-area, 0px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
      <div className="flex gap-2">
        {proposedCount >= 2 && (
          <Button
            variant="outline"
            className="flex-1 h-12 text-base"
            onClick={onApplyAll}
            disabled={isApplying}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Apply all
          </Button>
        )}
        <Button
          variant="default"
          className="flex-1 h-12 text-base"
          onClick={onMarkInOrder}
          disabled={isMarkingInOrder || !canMarkInOrder}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Mark in order
        </Button>
      </div>
    </div>
  );
}


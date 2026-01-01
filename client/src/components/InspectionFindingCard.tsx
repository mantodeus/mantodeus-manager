/**
 * Memoized Finding Card Component
 * 
 * Reduces re-renders when findings list updates
 */

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2 } from "@/components/ui/Icon";

interface InspectionFindingCardProps {
  finding: any;
  isLocalId: boolean;
  mediaRefreshKey: number;
  onEdit: (finding: any) => void;
  onDelete: (finding: any) => void;
  onTakePhoto: (finding: any) => void;
  onViewMedia: (media: any) => void;
  FindingMediaSection: React.ComponentType<any>;
}

export const InspectionFindingCard = memo(function InspectionFindingCard({
  finding,
  isLocalId,
  mediaRefreshKey,
  onEdit,
  onDelete,
  onTakePhoto,
  onViewMedia,
  FindingMediaSection,
}: InspectionFindingCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-2">
              {finding.defectType && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{finding.defectType}</Badge>
                  {finding.severity && (
                    <Badge variant="secondary">{finding.severity}</Badge>
                  )}
                </div>
              )}
              {finding.notes && (
                <p className="text-sm">{finding.notes}</p>
              )}
              {(finding.positionDescriptor || finding.heightMeters) && (
                <p className="text-xs text-muted-foreground">
                  {finding.positionDescriptor}
                  {finding.heightMeters && ` • ${finding.heightMeters}m`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(finding)}
                className="h-11 w-11 p-0" // Touch target: ≥44×44px
                aria-label="Edit finding"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(finding)}
                className="h-11 w-11 p-0 text-destructive" // Touch target: ≥44×44px
                aria-label="Delete finding"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Media section */}
          <FindingMediaSection 
            key={`${finding.localId || finding.id}-${mediaRefreshKey}`}
            finding={finding} 
            isLocalId={isLocalId}
            onTakePhoto={onTakePhoto}
            onViewMedia={onViewMedia}
          />
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memoization
  return (
    prevProps.finding.localId === nextProps.finding.localId &&
    prevProps.finding.id === nextProps.finding.id &&
    prevProps.finding.defectType === nextProps.finding.defectType &&
    prevProps.finding.severity === nextProps.finding.severity &&
    prevProps.finding.notes === nextProps.finding.notes &&
    prevProps.finding.positionDescriptor === nextProps.finding.positionDescriptor &&
    prevProps.finding.heightMeters === nextProps.finding.heightMeters &&
    prevProps.finding.deletedAt === nextProps.finding.deletedAt &&
    prevProps.mediaRefreshKey === nextProps.mediaRefreshKey &&
    prevProps.isLocalId === nextProps.isLocalId
  );
});


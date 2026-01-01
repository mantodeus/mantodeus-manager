/**
 * Inspection Overview Page
 * 
 * Lists inspections and units for a project.
 * Mobile-first, offline-first design.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, CheckCircle2, Circle, Clock, AlertCircle, Loader2, FileDown } from "@/components/ui/Icon";
import { Link, useRoute, useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { unitStorage, inspectionStorage } from "@/lib/offlineStorage";
import { toast } from "sonner";
import { InspectionOverviewSkeleton } from "@/components/InspectionSkeletons";
import { PageHeader } from "@/components/PageHeader";

export default function Inspections() {
  const [, params] = useRoute("/projects/:projectId/inspections");
  const [location] = useLocation();
  const projectId = params?.projectId ? parseInt(params.projectId) : 0;
  const [createUnitDialogOpen, setCreateUnitDialogOpen] = useState(false);
  
  // PDF generation
  const generatePDFMutation = trpc.pdf.generateInspectionReport.useMutation({
    onSuccess: (data) => {
      if (data.shareUrl) {
        window.open(data.shareUrl, "_blank");
        toast.success("PDF generated and opened");
      } else {
        toast.success("PDF generated successfully");
      }
    },
    onError: (error) => {
      toast.error("Failed to generate PDF: " + error.message);
    },
  });

  // Fetch inspections from server
  const { data: inspections = [], isLoading: inspectionsLoading, refetch: refetchInspections } = 
    trpc.inspections.inspections.listByProject.useQuery(
      { projectId },
      { enabled: projectId > 0 }
    );

  // Fetch project info
  const { data: project } = trpc.projects.getById.useQuery(
    { id: projectId },
    { enabled: projectId > 0 }
  );

  // Load offline data
  const [offlineUnits, setOfflineUnits] = useState<any[]>([]);
  const [offlineInspections, setOfflineInspections] = useState<any[]>([]);
  const [offlineDataLoading, setOfflineDataLoading] = useState(true);

  useEffect(() => {
    if (projectId > 0) {
      setOfflineDataLoading(true);
      // Load offline data - filter by projectId stored in local entity
      Promise.all([
        unitStorage.getAll().then((units) => {
          // Filter units that belong to this project (stored in local entity)
          const filtered = units.filter(u => u.projectId === projectId || (!u.id && !u.projectId));
          return filtered;
        }),
        inspectionStorage.getAll(projectId)
      ]).then(([units, inspections]) => {
        setOfflineUnits(units);
        setOfflineInspections(inspections);
        setOfflineDataLoading(false);
      }).catch((error) => {
        console.error("Failed to load offline data:", error);
        setOfflineDataLoading(false);
      });
    } else {
      setOfflineDataLoading(false);
    }
  }, [projectId]);

  // Combine server and offline data (memoized)
  const allInspections = useMemo(() => {
    return [...inspections, ...offlineInspections.filter(i => !i.id)];
  }, [inspections, offlineInspections]);

  const allUnits = useMemo(() => {
    return offlineUnits.filter(u => !u.id);
  }, [offlineUnits]);

  const utils = trpc.useUtils();

  const getStatusIcon = (status?: string | null) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSyncStatusBadge = (syncStatus?: string) => {
    if (!syncStatus || syncStatus === "synced") return null;
    return (
      <Badge variant="outline" className="ml-2 text-xs">
        {syncStatus === "pending" && "Pending"}
        {syncStatus === "syncing" && "Syncing"}
        {syncStatus === "error" && "Error"}
      </Badge>
    );
  };

  if (projectId === 0) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">No project selected</p>
      </div>
    );
  }

  // Show skeleton while loading (first load only)
  if (inspectionsLoading || offlineDataLoading) {
    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        <PageHeader title="Inspections" titleClassName="text-2xl font-bold" />
        <InspectionOverviewSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <PageHeader
        title="Inspections"
        subtitle={project?.name}
        titleClassName="text-2xl font-bold"
      />

      {/* Top-of-Page Action Row */}
      <div className="flex items-center justify-end gap-2 pb-2 border-b">
        {(() => {
          // Find first inspection with an ID (server-synced)
          const inspectionWithId = allInspections.find(i => i.id && typeof i.id === 'number');
          return inspectionWithId ? (
            <Button
              onClick={() => {
                const inspectionId = inspectionWithId.id;
                if (inspectionId && typeof inspectionId === 'number') {
                  generatePDFMutation.mutate({ inspectionId });
                } else {
                  toast.error("No inspection found to export");
                }
              }}
              disabled={generatePDFMutation.isPending}
              variant="outline"
              size="sm"
            >
              {generatePDFMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export PDF
                </>
              )}
            </Button>
          ) : null;
        })()}
        <Button
          onClick={() => setCreateUnitDialogOpen(true)}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {/* Inspections List */}
      {allInspections.length === 0 && allUnits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No inspections yet</p>
            <Button onClick={() => setCreateUnitDialogOpen(true)}>
              Create First Inspection Unit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Inspection Units (main focus) */}
          {allUnits.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Units</h2>
              <div className="space-y-2">
                {allUnits.map((unit) => (
                  <Card key={unit.localId || unit.id} className="cursor-pointer hover:bg-accent/50">
                    <Link href={`/projects/${projectId}/inspections/units/${unit.localId || unit.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {getStatusIcon(unit.status)}
                            <div>
                              <p className="font-medium">{unit.label || "Unlabeled"}</p>
                              {unit.status && (
                                <p className="text-sm text-muted-foreground">{unit.status}</p>
                              )}
                            </div>
                          </div>
                          {getSyncStatusBadge(unit.syncStatus)}
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Inspections (if any) */}
          {allInspections.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Inspections</h2>
              <div className="space-y-2">
                {allInspections.map((inspection) => (
                  <Card key={inspection.localId || inspection.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(inspection.status)}
                          <div>
                            <p className="font-medium">
                              {inspection.type || "Inspection"} - {inspection.status || "Not started"}
                            </p>
                            {inspection.startedAt && (
                              <p className="text-sm text-muted-foreground">
                                Started: {new Date(inspection.startedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        {getSyncStatusBadge(inspection.syncStatus)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Unit Dialog - Simple inline form for now */}
      {createUnitDialogOpen && (
        <CreateInspectionUnitDialog
          projectId={projectId}
          open={createUnitDialogOpen}
          onOpenChange={setCreateUnitDialogOpen}
          onSuccess={() => {
            refetchInspections();
            unitStorage.getAll().then((units) => {
              const filtered = units.filter(u => u.projectId === projectId || (!u.id && !u.projectId));
              setOfflineUnits(filtered);
            }).catch(console.error);
          }}
        />
      )}
    </div>
  );
}

// Simple inline dialog component
function CreateInspectionUnitDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [label, setLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();

  // For now, units can exist without an inspection (per requirements)
  // We'll use a default sequence index
  const [nextIndex, setNextIndex] = useState(1);

  // Pre-fill label based on last unit
  useEffect(() => {
    if (open && !label) {
      // Try to get suggested label from last unit
      unitStorage.getAll(projectId).then((units) => {
        if (units.length > 0) {
          const lastUnit = units[units.length - 1];
          const lastLabel = lastUnit.label || "";
          const lastIndex = lastUnit.sequenceIndex || 0;
          setNextIndex(lastIndex + 1);
          // Try to increment number if present
          const match = lastLabel.match(/^(.+?)(\d+)$/);
          if (match) {
            const base = match[1];
            const num = parseInt(match[2]);
            setLabel(`${base}${num + 1}`);
          } else {
            setLabel(`${lastLabel} 2`);
          }
        } else {
          setLabel("Unit 1");
          setNextIndex(1);
        }
      });
    }
  }, [open, label, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Save to local storage immediately (offline-first)
      const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const unit = {
        inspectionId: 0, // Units can exist without inspection (per requirements)
        label: label.trim() || "Unlabeled",
        sequenceIndex: nextIndex,
        status: "pending",
        localId,
        syncStatus: "pending" as const,
        projectId, // Store projectId for filtering
      };

      await unitStorage.save(unit);

      // Try to sync to server (non-blocking)
      try {
        // For now, we need an inspection first - create a minimal one
        // In a real implementation, you'd create the inspection first or use an existing one
        // For now, just save locally
        toast.success("Unit saved locally");
      } catch (error) {
        console.warn("Failed to sync to server:", error);
        // Continue anyway - data is saved locally
      }

      setLabel("");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create unit:", error);
      toast.error("Failed to create unit");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>New Abseil / Section</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., Abseil 1, Section A"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


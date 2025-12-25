/**
 * Inspection Unit Detail Page
 * 
 * Shows unit details with buttons for:
 * - Take Photo
 * - Add Finding
 * 
 * Mobile-first, offline-first design.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Camera, Plus, CheckCircle2, Circle, Clock, Loader2, Edit2, Trash2, Image as ImageIcon } from "lucide-react";
import { Link, useRoute, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { unitStorage, findingStorage, mediaStorage } from "@/lib/offlineStorage";
import { toast } from "sonner";

export default function InspectionUnitDetail() {
  const [, params] = useRoute("/projects/:projectId/inspections/units/:unitId");
  const [location, navigate] = useLocation();
  const projectId = params?.projectId ? parseInt(params.projectId) : 0;
  const unitId = params?.unitId || "";
  const isLocalId = unitId.startsWith("local_");

  // Fetch unit from server (if not local)
  const { data: serverUnit, isLoading: serverLoading } = trpc.inspections.units.getById.useQuery(
    { id: parseInt(unitId) },
    { enabled: !isLocalId && unitId !== "" }
  );

  // Load offline unit
  const [offlineUnit, setOfflineUnit] = useState<any>(null);
  const [offlineFindings, setOfflineFindings] = useState<any[]>([]);

  useEffect(() => {
    if (isLocalId) {
      unitStorage.get(unitId).then(setOfflineUnit).catch(console.error);
      findingStorage.getAll().then((findings) => {
        setOfflineFindings(findings.filter(f => f.inspectionUnitId === unitId || f.inspectionUnitId === 0));
      }).catch(console.error);
    }
  }, [unitId, isLocalId]);

  // Fetch findings from server
  const { data: serverFindings = [], refetch: refetchFindings } = 
    trpc.inspections.findings.listByUnit.useQuery(
      { unitId: parseInt(unitId) },
      { enabled: !isLocalId && unitId !== "" }
    );

  const unit = isLocalId ? offlineUnit : serverUnit;
  const findings = (isLocalId ? offlineFindings : serverFindings).filter(f => !f.deletedAt);

  const [addFindingDialogOpen, setAddFindingDialogOpen] = useState(false);
  const [editFindingDialogOpen, setEditFindingDialogOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<any>(null);
  const [takePhotoDialogOpen, setTakePhotoDialogOpen] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState("");

  // Initialize label value
  useEffect(() => {
    if (unit?.label) {
      setLabelValue(unit.label);
    }
  }, [unit]);

  const createFindingMutation = trpc.inspections.findings.create.useMutation({
    onSuccess: () => {
      refetchFindings();
      toast.success("Finding saved");
    },
    onError: (error) => {
      console.warn("Failed to sync to server:", error);
      // Continue anyway - data is saved locally
    },
  });

  const updateFindingMutation = trpc.inspections.findings.update.useMutation({
    onSuccess: () => {
      refetchFindings();
      toast.success("Finding updated");
    },
    onError: (error) => {
      console.warn("Failed to sync to server:", error);
      // Continue anyway - data is saved locally
    },
  });

  const updateUnitMutation = trpc.inspections.units.update.useMutation({
    onSuccess: () => {
      if (isLocalId) {
        unitStorage.get(unitId).then(setOfflineUnit).catch(console.error);
      }
      toast.success("Unit updated");
    },
    onError: (error) => {
      console.warn("Failed to sync to server:", error);
      // Continue anyway - data is saved locally
    },
  });

  // Auto-update unit status based on findings
  useEffect(() => {
    if (!unit || unit.status === "completed") return; // Don't auto-update if manually completed
    
    const hasFindings = findings.length > 0;
    const newStatus = hasFindings ? "in_progress" : null;
    
    if (unit.status !== newStatus) {
      const updated = {
        ...unit,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        syncStatus: "pending" as const,
      };
      
      if (isLocalId) {
        unitStorage.save(updated).then(() => {
          setOfflineUnit(updated);
        }).catch(console.error);
      } else {
        updateUnitMutation.mutate({
          id: parseInt(unitId),
          status: newStatus || undefined,
        });
      }
    }
  }, [findings.length, unit?.status]);

  // Handle label edit
  const handleLabelSave = async () => {
    if (!unit) return;
    
    const updated = {
      ...unit,
      label: labelValue.trim() || "Unlabeled",
      updatedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    };

    if (isLocalId) {
      await unitStorage.save(updated);
      setOfflineUnit(updated);
      toast.success("Label updated");
    } else {
      updateUnitMutation.mutate({
        id: parseInt(unitId),
        label: updated.label,
      });
    }
    
    setIsEditingLabel(false);
  };

  const handleLabelCancel = () => {
    setLabelValue(unit?.label || "");
    setIsEditingLabel(false);
  };

  // Handle status toggle
  const handleStatusToggle = async (checked: boolean) => {
    if (!unit) return;
    
    const newStatus = checked ? "completed" : (findings.length > 0 ? "in_progress" : null);
    const updated = {
      ...unit,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    };

    if (isLocalId) {
      await unitStorage.save(updated);
      setOfflineUnit(updated);
    } else {
      updateUnitMutation.mutate({
        id: parseInt(unitId),
        status: newStatus || undefined,
      });
    }
  };

  // Handle finding edit
  const handleEditFinding = (finding: any) => {
    setEditingFinding(finding);
    setEditFindingDialogOpen(true);
  };

  // Handle finding soft delete
  const handleDeleteFinding = async (finding: any) => {
    const deleted = {
      ...finding,
      deletedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    };

    await findingStorage.save(deleted);
    
    if (!isLocalId && finding.id) {
      // For server findings, we'd need a soft delete endpoint
      // For now, just mark locally
    }

    // Refresh findings list
    if (isLocalId) {
      findingStorage.getAll().then((findings) => {
        setOfflineFindings(findings.filter(f => 
          (f.inspectionUnitId === unitId || f.inspectionUnitId === 0) && !f.deletedAt
        ));
      }).catch(console.error);
    } else {
      refetchFindings();
    }
    
    toast.success("Finding deleted");
  };

  const getStatusIcon = (status?: string | null) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  if (serverLoading && !isLocalId) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!unit && !offlineUnit) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Unit not found</p>
        <Link href={`/projects/${projectId}/inspections`}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inspections
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/projects/${projectId}/inspections`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          {isEditingLabel ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
                onBlur={handleLabelSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLabelSave();
                  } else if (e.key === "Escape") {
                    handleLabelCancel();
                  }
                }}
                className="text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none flex-1"
                autoFocus
              />
              <Button size="sm" onClick={handleLabelSave} variant="ghost">
                Save
              </Button>
              <Button size="sm" onClick={handleLabelCancel} variant="ghost">
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{unit?.label || "Unlabeled Unit"}</h1>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingLabel(true)}
                className="h-8 w-8 p-0"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            {unit?.status && (
              <div className="flex items-center gap-2">
                {getStatusIcon(unit.status)}
                <span className="text-sm text-muted-foreground">{unit.status}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={unit?.status === "completed"}
                onCheckedChange={handleStatusToggle}
              />
              <span className="text-sm text-muted-foreground">Mark Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={() => setTakePhotoDialogOpen(true)}
          size="lg"
          className="h-16"
          variant="outline"
        >
          <Camera className="h-5 w-5 mr-2" />
          Take Photo
        </Button>
        <Button
          onClick={() => setAddFindingDialogOpen(true)}
          size="lg"
          className="h-16"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Finding
        </Button>
      </div>

      {/* Findings List */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Findings</h2>
        {findings.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No findings yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {findings.map((finding) => (
              <Card key={finding.localId || finding.id}>
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
                          onClick={() => handleEditFinding(finding)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteFinding(finding)}
                          className="h-8 w-8 p-0 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {/* Media section */}
                    <FindingMediaSection finding={finding} isLocalId={isLocalId} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Finding Dialog */}
      {addFindingDialogOpen && (
        <FindingDialog
          unitId={unitId}
          isLocalId={isLocalId}
          open={addFindingDialogOpen}
          onOpenChange={setAddFindingDialogOpen}
          createMutation={createFindingMutation}
          onSuccess={() => {
            if (isLocalId) {
              findingStorage.getAll().then((findings) => {
                setOfflineFindings(findings.filter(f => 
                  (f.inspectionUnitId === unitId || f.inspectionUnitId === 0) && !f.deletedAt
                ));
              }).catch(console.error);
            } else {
              refetchFindings();
            }
          }}
        />
      )}

      {/* Edit Finding Dialog */}
      {editFindingDialogOpen && editingFinding && (
        <FindingDialog
          unitId={unitId}
          isLocalId={isLocalId}
          open={editFindingDialogOpen}
          onOpenChange={setEditFindingDialogOpen}
          finding={editingFinding}
          updateMutation={updateFindingMutation}
          onSuccess={() => {
            setEditingFinding(null);
            if (isLocalId) {
              findingStorage.getAll().then((findings) => {
                setOfflineFindings(findings.filter(f => 
                  (f.inspectionUnitId === unitId || f.inspectionUnitId === 0) && !f.deletedAt
                ));
              }).catch(console.error);
            } else {
              refetchFindings();
            }
          }}
        />
      )}

      {/* Take Photo Dialog - Stub for now */}
      {takePhotoDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Take Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Photo capture will be implemented with camera API integration.
              </p>
              <Button onClick={() => setTakePhotoDialogOpen(false)} className="w-full">
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Finding Media Section Component
function FindingMediaSection({ finding, isLocalId }: { finding: any; isLocalId: boolean }) {
  const [media, setMedia] = useState<any[]>([]);
  const findingId = finding.localId || finding.id;

  useEffect(() => {
    // Load media for this finding
    mediaStorage.getAll().then((allMedia) => {
      const findingMedia = allMedia.filter(m => {
        const matchesFinding = m.inspectionFindingId === findingId || 
                               m.inspectionFindingId === finding.id ||
                               (typeof m.inspectionFindingId === 'string' && m.inspectionFindingId === findingId);
        return matchesFinding && !m.deletedAt;
      });
      setMedia(findingMedia);
    }).catch(console.error);
  }, [findingId, finding.id]);

  const handleReplacePhoto = async (mediaItem: any) => {
    // Mark old media as deleted (soft delete)
    const deleted = {
      ...mediaItem,
      deletedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    };
    await mediaStorage.save(deleted);

    // Create new media entry (stub - will be implemented with camera API)
    const newMedia = {
      inspectionFindingId: findingId,
      localOriginalPath: undefined, // Will be set by camera API
      localAnnotatedPath: undefined,
      syncStatus: "pending" as const,
      localId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    await mediaStorage.save(newMedia);

    // Refresh media list
    mediaStorage.getAll().then((allMedia) => {
      const findingMedia = allMedia.filter(m => {
        const matchesFinding = m.inspectionFindingId === findingId || 
                               m.inspectionFindingId === finding.id ||
                               (typeof m.inspectionFindingId === 'string' && m.inspectionFindingId === findingId);
        return matchesFinding && !m.deletedAt;
      });
      setMedia(findingMedia);
    }).catch(console.error);

    toast.info("Photo replacement will be implemented with camera integration");
  };

  const handleReAnnotate = async (mediaItem: any) => {
    // Update media to mark for re-annotation
    // Original path is preserved, annotated path will be updated
    const updated = {
      ...mediaItem,
      localAnnotatedPath: undefined, // Clear old annotation
      syncStatus: "pending" as const,
      updatedAt: new Date().toISOString(),
    };
    await mediaStorage.save(updated);

    // Refresh media list
    mediaStorage.getAll().then((allMedia) => {
      const findingMedia = allMedia.filter(m => {
        const matchesFinding = m.inspectionFindingId === findingId || 
                               m.inspectionFindingId === finding.id ||
                               (typeof m.inspectionFindingId === 'string' && m.inspectionFindingId === findingId);
        return matchesFinding && !m.deletedAt;
      });
      setMedia(findingMedia);
    }).catch(console.error);

    toast.info("Re-annotation will be implemented with annotation tools");
  };

  const handleDeleteMedia = async (mediaItem: any) => {
    const deleted = {
      ...mediaItem,
      deletedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    };
    await mediaStorage.save(deleted);

    // Refresh media list
    mediaStorage.getAll().then((allMedia) => {
      const findingMedia = allMedia.filter(m => {
        const matchesFinding = m.inspectionFindingId === findingId || 
                               m.inspectionFindingId === finding.id ||
                               (typeof m.inspectionFindingId === 'string' && m.inspectionFindingId === findingId);
        return matchesFinding && !m.deletedAt;
      });
      setMedia(findingMedia);
    }).catch(console.error);

    toast.success("Media deleted");
  };

  if (media.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Media</p>
      <div className="flex gap-2 flex-wrap">
        {media.map((m) => (
          <div key={m.localId || m.id} className="relative group">
            <div className="w-20 h-20 bg-muted rounded flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity rounded">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleReplacePhoto(m)}
                className="h-7 text-xs"
              >
                Replace
              </Button>
              {m.annotatedS3Key || m.localAnnotatedPath ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleReAnnotate(m)}
                  className="h-7 text-xs"
                >
                  Re-annotate
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleReAnnotate(m)}
                  className="h-7 text-xs"
                >
                  Annotate
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDeleteMedia(m)}
                className="h-7 w-7 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Finding Dialog (Create or Edit)
function FindingDialog({
  unitId,
  isLocalId,
  open,
  onOpenChange,
  finding,
  createMutation,
  updateMutation,
  onSuccess,
}: {
  unitId: string;
  isLocalId: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finding?: any;
  createMutation?: ReturnType<typeof trpc.inspections.findings.create.useMutation>;
  updateMutation?: ReturnType<typeof trpc.inspections.findings.update.useMutation>;
  onSuccess: () => void;
}) {
  const [defectType, setDefectType] = useState("");
  const [severity, setSeverity] = useState("");
  const [notes, setNotes] = useState("");
  const [positionDescriptor, setPositionDescriptor] = useState("");
  const [heightMeters, setHeightMeters] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill form if editing
  useEffect(() => {
    if (finding) {
      setDefectType(finding.defectType || "");
      setSeverity(finding.severity || "");
      setNotes(finding.notes || "");
      setPositionDescriptor(finding.positionDescriptor || "");
      setHeightMeters(finding.heightMeters?.toString() || "");
    } else {
      // Reset for new finding
      setDefectType("");
      setSeverity("");
      setNotes("");
      setPositionDescriptor("");
      setHeightMeters("");
    }
  }, [finding, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const findingData = {
        inspectionUnitId: isLocalId ? unitId : parseInt(unitId),
        defectType: defectType.trim() || undefined,
        severity: severity.trim() || undefined,
        notes: notes.trim() || undefined,
        positionDescriptor: positionDescriptor.trim() || undefined,
        heightMeters: heightMeters ? parseFloat(heightMeters) : null,
        syncStatus: "pending" as const,
      };

      if (finding) {
        // Update existing finding
        const updated = {
          ...finding,
          ...findingData,
          updatedAt: new Date().toISOString(),
          // Preserve original fields
          createdAt: finding.createdAt,
          createdByUserId: finding.createdByUserId,
        };

        await findingStorage.save(updated);

        // Try to sync to server (non-blocking)
        if (!isLocalId && finding.id && updateMutation) {
          updateMutation.mutate({
            id: finding.id,
            ...findingData,
          });
        } else {
          toast.success("Finding updated locally");
        }
      } else {
        // Create new finding
        const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newFinding = {
          ...findingData,
          localId,
        };

        await findingStorage.save(newFinding);

        // Try to sync to server (non-blocking)
        if (!isLocalId && createMutation) {
          createMutation.mutate({
            inspectionUnitId: parseInt(unitId),
            ...findingData,
            localId,
            syncStatus: "pending",
          });
        } else {
          toast.success("Finding saved locally");
        }
      }

      // Reset form
      setDefectType("");
      setSeverity("");
      setNotes("");
      setPositionDescriptor("");
      setHeightMeters("");

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save finding:", error);
      toast.error("Failed to save finding");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{finding ? "Edit Finding" : "Add Finding"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Defect Type (optional)</label>
              <input
                type="text"
                value={defectType}
                onChange={(e) => setDefectType(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., Crack, Corrosion"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Severity (optional)</label>
              <input
                type="text"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., Low, Medium, High"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                placeholder="Additional notes..."
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Position (optional)</label>
              <input
                type="text"
                value={positionDescriptor}
                onChange={(e) => setPositionDescriptor(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., Top left corner"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Height (meters, optional)</label>
              <input
                type="number"
                step="0.1"
                value={heightMeters}
                onChange={(e) => setHeightMeters(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., 5.2"
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


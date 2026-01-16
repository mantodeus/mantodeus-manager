/**
 * Inspections Overview Page (Top-level)
 * 
 * Shows all inspections across all projects.
 * Allows selecting a project to view its inspections.
 * Mobile-first, offline-first design.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, CheckCircle2, Circle, Clock, Loader2, ArrowRight } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { unitStorage, inspectionStorage } from "@/lib/offlineStorage";
import { ModulePage } from "@/components/ModulePage";

export default function InspectionsOverview() {
  const [, setLocation] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Fetch all projects
  const { data: projects = [], isLoading: projectsLoading } = trpc.projects.list.useQuery();

  // Fetch inspections for selected project
  const { data: inspections = [], isLoading: inspectionsLoading } = 
    trpc.inspections.inspections.listByProject.useQuery(
      { projectId: selectedProjectId! },
      { enabled: selectedProjectId !== null }
    );

  // Load offline data
  const [offlineUnits, setOfflineUnits] = useState<any[]>([]);
  const [offlineInspections, setOfflineInspections] = useState<any[]>([]);

  useEffect(() => {
    if (selectedProjectId) {
      unitStorage.getAll().then((units) => {
        const filtered = units.filter(u => u.projectId === selectedProjectId || (!u.id && !u.projectId));
        setOfflineUnits(filtered);
      }).catch(console.error);
      inspectionStorage.getAll(selectedProjectId).then(setOfflineInspections).catch(console.error);
    }
  }, [selectedProjectId]);

  const allInspections = [...inspections, ...offlineInspections.filter(i => !i.id)];
  const allUnits = offlineUnits.filter(u => !u.id);

  const getStatusIcon = (status?: string | null) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  if (projectsLoading) {
    return (
      <ModulePage title="Inspections">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </ModulePage>
    );
  }

  // If no project selected, show project selector
  if (!selectedProjectId) {
    return (
      <ModulePage
        title="Inspections"
        subtitle="Select a project to view or create inspections"
      >

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No projects yet</p>
              <Link href="/projects">
                <Button>Go to Projects</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      {project.client && (
                        <p className="text-sm text-muted-foreground">{project.client}</p>
                      )}
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ModulePage>
    );
  }

  // Show inspections for selected project
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <ModulePage
      title="Inspections"
      subtitle={selectedProject?.name}
      leading={
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedProjectId(null)}
          className="size-9 [&_svg]:size-6"
          aria-label="Back to projects"
        >
          ←
        </Button>
      }
      primaryActions={
        selectedProjectId ? (
          <Link href={`/projects/${selectedProjectId}/inspections`}>
            <Button className="h-10 whitespace-nowrap">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </Link>
        ) : undefined
      }
    >

      {/* Inspections List */}
      {allInspections.length === 0 && allUnits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No inspections yet</p>
            <Link href={`/projects/${selectedProjectId}/inspections`}>
              <Button>Create First Inspection Unit</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Inspection Units */}
          {allUnits.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Units</h2>
              <div className="space-y-2">
                {allUnits.map((unit) => (
                  <Card key={unit.localId || unit.id} className="cursor-pointer hover:bg-accent/50">
                    <Link href={`/projects/${selectedProjectId}/inspections/units/${unit.localId || unit.id}`}>
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
                          {unit.syncStatus && unit.syncStatus !== "synced" && (
                            <Badge variant="outline" className="text-xs">
                              {unit.syncStatus}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Inspections */}
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
                        {inspection.syncStatus && inspection.syncStatus !== "synced" && (
                          <Badge variant="outline" className="text-xs">
                            {inspection.syncStatus}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ModulePage>
  );
}


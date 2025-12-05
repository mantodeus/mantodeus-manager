/**
 * Projects List Page
 * 
 * Displays all projects for the current user with:
 * - Grid of project cards
 * - Status badges
 * - Quick actions (edit, delete)
 * - Create new project button
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, MapPin, Calendar, Loader2, Building2, FolderOpen } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { toast } from "sonner";

export default function Projects() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: projects, isLoading } = trpc.projects.list.useQuery();

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const archiveProjectMutation = trpc.projects.archive.useMutation({
    onSuccess: () => {
      toast.success("Project archived successfully");
      trpc.useUtils().projects.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to archive project: ${error.message}`);
    },
  });

  const deleteProjectMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted successfully");
      trpc.useUtils().projects.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary text-primary-foreground";
      case "planned":
        return "bg-secondary text-secondary-foreground";
      case "completed":
        return "bg-emerald-600 text-white";
      case "archived":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  };

  const handleItemAction = (action: ItemAction, projectId: number) => {
    switch (action) {
      case "edit":
        window.location.href = `/projects/${projectId}`;
        break;
      case "delete":
        handleArchiveProject(projectId);
        break;
      case "select":
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([projectId]));
        break;
    }
  };

  const handleArchiveProject = (projectId: number) => {
    if (confirm("Are you sure you want to archive this project? You can still view it in archived projects.")) {
      archiveProjectMutation.mutate({ id: projectId });
    }
  };

  const handleBatchArchive = () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    if (confirm(`Are you sure you want to archive ${count} project${count > 1 ? 's' : ''}?`)) {
      selectedIds.forEach((id) => {
        archiveProjectMutation.mutate({ id });
      });
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
    }
  };

  const toggleSelection = (projectId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedIds(newSelected);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage your client projects and work</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {projects && projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No projects yet. Create your first project to get started.</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => {
            const isSelected = selectedIds.has(project.id);
            
            return (
              <div
                key={project.id}
                className="relative no-select"
                onClick={(e) => {
                  if (isMultiSelectMode) {
                    e.preventDefault();
                    toggleSelection(project.id);
                  }
                }}
              >
                {isMultiSelectMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(project.id)}
                      className="h-5 w-5 rounded border-2 border-primary accent-primary"
                    />
                  </div>
                )}
                <Link href={`/projects/${project.id}`}>
                  <Card 
                    className={`hover:shadow-lg transition-all cursor-pointer h-full ${
                      isSelected ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-xl">{project.name}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(project.status)}>
                            {project.status}
                          </Badge>
                          {!isMultiSelectMode && (
                            <ItemActionsMenu
                              onAction={(action) => handleItemAction(action, project.id)}
                              actions={["edit", "delete", "select"]}
                              triggerClassName="text-muted-foreground hover:text-foreground ml-1"
                            />
                          )}
                        </div>
                      </div>
                      {project.client && (
                        <CardDescription>Client: {project.client}</CardDescription>
                      )}
                      {project.description && (
                        <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {project.address && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-2" />
                          <span className="truncate">{project.address}</span>
                        </div>
                      )}
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatDate(project.startDate)} - {formatDate(project.endDate)}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          onCancel={() => {
            setIsMultiSelectMode(false);
            setSelectedIds(new Set());
          }}
          onDelete={handleBatchArchive}
        />
      )}

      <CreateProjectDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}

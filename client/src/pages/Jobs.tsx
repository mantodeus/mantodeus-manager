import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, MapPin, Calendar, Loader2, User } from "@/components/ui/Icon";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { CreateJobDialog } from "@/components/CreateJobDialog";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { toast } from "sonner";

export default function Jobs() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: jobs, isLoading } = trpc.jobs.list.useQuery();
  const { data: contacts } = trpc.contacts.list.useQuery();
  const utils = trpc.useUtils();

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const deleteJobMutation = trpc.jobs.delete.useMutation({
    onSuccess: () => {
      toast.success("Job deleted successfully");
      utils.jobs.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete job: ${error.message}`);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary text-primary-foreground";
      case "planning":
        return "bg-secondary text-secondary-foreground";
      case "on_hold":
        return "bg-yellow-600 text-white";
      case "completed":
        return "bg-muted text-muted-foreground";
      case "cancelled":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  };

  const handleItemAction = (action: ItemAction, jobId: number) => {
    switch (action) {
      case "edit":
        navigate(`/jobs/${jobId}`);
        break;
      case "duplicate":
        toast.info("Duplicate is coming soon.");
        break;
      case "select":
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([jobId]));
        break;
      case "archive":
        toast.info("Archive is coming soon.");
        break;
      case "delete":
        handleDeleteJob(jobId);
        break;
    }
  };

  const handleSelectAll = () => {
    if (!jobs) return;
    setSelectedIds(new Set(jobs.map(j => j.id)));
  };

  const handleBatchDuplicate = () => {
    toast.info("Batch duplicate is coming soon.");
  };

  const handleBatchArchive = () => {
    toast.info("Batch archive is coming soon.");
  };

  const handleDeleteJob = (jobId: number) => {
    if (confirm("Are you sure you want to delete this job? This will also delete all associated tasks and images.")) {
      deleteJobMutation.mutate({ id: jobId });
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    if (confirm(`Are you sure you want to delete ${count} job${count > 1 ? 's' : ''}? This will also delete all associated tasks and images.`)) {
      selectedIds.forEach((id) => {
        deleteJobMutation.mutate({ id });
      });
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
    }
  };

  const toggleSelection = (jobId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-regular">Jobs</h1>
          <p className="text-muted-foreground text-sm">Manage your construction projects and job sites</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {jobs && jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No jobs yet. Create your first job to get started.</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs?.map((job) => {
            const isSelected = selectedIds.has(job.id);
            
            return (
              <div
                key={job.id}
                className="relative no-select"
                onClick={(e) => {
                  if (isMultiSelectMode) {
                    e.preventDefault();
                    toggleSelection(job.id);
                  }
                }}
              >
                {isMultiSelectMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(job.id)}
                      className="h-5 w-5 rounded border-2 border-primary accent-primary"
                    />
                  </div>
                )}
                <Link href={`/jobs/${job.id}`}>
                  <Card 
                    className={`hover:shadow-lg transition-all cursor-pointer h-full ${
                      isSelected ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-xl">{job.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(job.status)}>
                            {job.status.replace("_", " ")}
                          </Badge>
                          {!isMultiSelectMode && (
                            <ItemActionsMenu
                              onAction={(action) => handleItemAction(action, job.id)}
                              actions={["edit", "duplicate", "select", "archive", "delete"]}
                              triggerClassName="text-muted-foreground hover:text-foreground"
                            />
                          )}
                        </div>
                      </div>
                      {job.description && (
                        <CardDescription className="line-clamp-2">{job.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {job.location && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-2" />
                          {job.location}
                        </div>
                      )}
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatDate(job.startDate)} - {formatDate(job.endDate)}
                      </div>
                      {job.contactId && contacts && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <User className="h-4 w-4 mr-2" />
                          {contacts.find(c => c.id === job.contactId)?.name || "Unknown Contact"}
                        </div>
                      )}
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
          totalCount={jobs?.length}
          onSelectAll={handleSelectAll}
          onDuplicate={handleBatchDuplicate}
          onArchive={handleBatchArchive}
          onDelete={handleBatchDelete}
          onCancel={() => {
            setIsMultiSelectMode(false);
            setSelectedIds(new Set());
          }}
        />
      )}

      <CreateJobDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}

/**
 * Project Job Detail Page
 * 
 * Shows job details within a project context with:
 * - Job information
 * - Assigned users
 * - Files attached to this job
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Calendar, Loader2, FileText, Trash2, Briefcase, Users, Edit } from "lucide-react";
import { Link, useRoute, useLocation } from "wouter";
import { useState } from "react";
import { EditProjectJobDialog } from "@/components/EditProjectJobDialog";
import { ProjectFileGallery } from "@/components/ProjectFileGallery";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { toast } from "sonner";

export default function ProjectJobDetail() {
  const [, params] = useRoute("/projects/:projectId/jobs/:jobId");
  const [, navigate] = useLocation();
  const projectId = params?.projectId ? parseInt(params.projectId) : 0;
  const jobId = params?.jobId ? parseInt(params.jobId) : 0;
  const [editJobDialogOpen, setEditJobDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: project, isLoading: projectLoading } = trpc.projects.getById.useQuery({ id: projectId });
  const { data: job, isLoading: jobLoading } = trpc.projects.jobs.get.useQuery({ projectId, jobId });
  const { data: files, isLoading: filesLoading } = trpc.projects.files.listByJob.useQuery({ projectId, jobId });
  const { data: allUsers } = trpc.users.list.useQuery();
  const utils = trpc.useUtils();
  
  const deleteJob = trpc.projects.jobs.delete.useMutation({
    onSuccess: () => {
      utils.projects.jobs.list.invalidate({ projectId });
      toast.success("Job deleted successfully");
      navigate(`/projects/${projectId}`);
    },
    onError: (error) => {
      toast.error("Failed to delete job: " + error.message);
    },
  });

  const handleDeleteJob = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDeleteJob = () => {
    deleteJob.mutate({ projectId, jobId });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-primary text-primary-foreground";
      case "pending":
        return "bg-secondary text-secondary-foreground";
      case "done":
        return "bg-emerald-600 text-white";
      case "cancelled":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatStatus = (status: string) => {
    return status.replace("_", " ");
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  };

  const getAssignedUserNames = () => {
    if (!job?.assignedUsers || !allUsers) return [];
    return job.assignedUsers
      .map((userId) => allUsers.find((u) => u.id === userId)?.name || `User ${userId}`)
      .filter(Boolean);
  };

  if (projectLoading || jobLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <Link href="/projects">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Project not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {project.name}
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Job not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const assignedUserNames = getAssignedUserNames();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {project.name}
          </Button>
        </Link>
        <Button variant="outline" onClick={() => setEditJobDialogOpen(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-6 w-6 text-muted-foreground" />
                <CardTitle className="text-3xl">{job.title}</CardTitle>
              </div>
              {job.category && (
                <Badge variant="outline" className="mb-2">{job.category}</Badge>
              )}
              {job.description && (
                <CardDescription className="mt-2">{job.description}</CardDescription>
              )}
            </div>
            <Badge className={getStatusColor(job.status)}>{formatStatus(job.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(job.startTime || job.endTime) && (
            <div className="flex items-center text-muted-foreground">
              <Calendar className="h-5 w-5 mr-2" />
              {formatDate(job.startTime)} - {formatDate(job.endTime)}
            </div>
          )}
          {assignedUserNames.length > 0 && (
            <div className="flex items-center text-muted-foreground">
              <Users className="h-5 w-5 mr-2" />
              {assignedUserNames.join(", ")}
            </div>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <FileText className="h-4 w-4 mr-1" />
              {files?.length || 0} Files
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">Files ({files?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <p className="mt-1">
                    <Badge className={getStatusColor(job.status)}>{formatStatus(job.status)}</Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <p className="mt-1">{job.category || "Not specified"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Start Time</label>
                  <p className="mt-1">{formatDate(job.startTime)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">End Time</label>
                  <p className="mt-1">{formatDate(job.endTime)}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Assigned Users</label>
                  <p className="mt-1">
                    {assignedUserNames.length > 0 ? assignedUserNames.join(", ") : "No one assigned"}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="mt-1 whitespace-pre-wrap">{job.description || "No description"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <ProjectFileGallery 
            projectId={projectId} 
            jobId={jobId} 
            files={files || []} 
            isLoading={filesLoading} 
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-6 border-t border-border">
        <Button
          variant="destructive"
          onClick={handleDeleteJob}
          disabled={deleteJob.isPending}
          className="gap-2"
        >
          {deleteJob.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete Job
        </Button>
      </div>

      {job && (
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDeleteJob}
          title="Delete permanently"
          description="This action cannot be undone."
          confirmLabel="Delete permanently"
          isDeleting={deleteJob.isPending}
        />
      )}

      {job && (
        <EditProjectJobDialog 
          open={editJobDialogOpen} 
          onOpenChange={setEditJobDialogOpen} 
          job={job}
          projectId={projectId}
        />
      )}
    </div>
  );
}

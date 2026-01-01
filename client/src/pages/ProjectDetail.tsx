/**
 * Project Detail Page
 * 
 * Shows project details with tabs:
 * - Overview: Project info, status, dates
 * - Jobs: List of jobs under this project
 * - Files: Uploaded files for the project
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, MapPin, Calendar, Plus, Loader2, FileText, Trash2, Building2, Briefcase, Archive, Edit } from "@/components/ui/Icon";
import { Link, useRoute, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { CreateProjectJobDialog } from "@/components/CreateProjectJobDialog";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { ProjectJobList } from "@/components/ProjectJobList";
import { ProjectFileGallery } from "@/components/ProjectFileGallery";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ProjectCheckIn } from "@/components/ProjectCheckIn";
import { GenerateProjectReportDialog } from "@/components/GenerateProjectReportDialog";
import { toast } from "sonner";
import { formatProjectSchedule } from "@/lib/dateFormat";
import { PageHeader } from "@/components/PageHeader";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [location, navigate] = useLocation();
  const projectId = params?.id ? parseInt(params.id) : 0;
  const [createJobDialogOpen, setCreateJobDialogOpen] = useState(false);
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const { data: project, isLoading: projectLoading } = trpc.projects.getById.useQuery({ id: projectId });
  const { data: jobs, isLoading: jobsLoading } = trpc.projects.jobs.list.useQuery({ projectId });
  const { data: files, isLoading: filesLoading } = trpc.projects.files.listByProject.useQuery({ projectId });
  const clientContact = project?.clientContact ?? null;
  const utils = trpc.useUtils();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("openEditProject") === "1") {
      setEditProjectDialogOpen(true);
      url.searchParams.delete("openEditProject");
      const nextSearch = url.searchParams.toString();
      const nextHref = nextSearch ? `${url.pathname}?${nextSearch}${url.hash}` : `${url.pathname}${url.hash}`;
      window.history.replaceState(null, "", nextHref);
    }
  }, [location]);

  const scheduleInfo = project
    ? formatProjectSchedule({
        dates: project.scheduledDates,
        start: project.startDate,
        end: project.endDate,
      })
    : null;
  
  const archiveProject = trpc.projects.archive.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      toast.success("Project archived successfully");
      navigate("/projects");
    },
    onError: (error) => {
      toast.error("Failed to archive project: " + error.message);
    },
  });

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      toast.success("Project deleted permanently");
      navigate("/projects");
    },
    onError: (error) => {
      toast.error("Failed to delete project: " + error.message);
    },
  });

  const handleArchiveProject = () => {
    if (confirm("Are you sure you want to archive this project? It will be hidden from the main list.")) {
      archiveProject.mutate({ id: projectId });
    }
  };

  const handleDeleteProject = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDeleteProject = () => {
    deleteProject.mutate({ id: projectId });
  };

  const handleDateClick = () => {
    if (!project || !scheduleInfo?.primaryDate) return;
    const url = new URL("/calendar", window.location.origin);
    url.searchParams.set("focusDate", scheduleInfo.primaryDate.toISOString());
    url.searchParams.set("highlightProjectId", project.id.toString());
    navigate(url.pathname + url.search);
  };

  const handleAddressClick = () => {
    if (!project?.address) return;
    if (clientContact?.latitude && clientContact.longitude) {
      navigate(`/maps?contactId=${clientContact.id}`);
      return;
    }
    navigate(`/maps?address=${encodeURIComponent(project.address)}`);
  };

  const handleContactClick = () => {
    if (!clientContact) return;
    navigate(`/contacts?contactId=${clientContact.id}`);
  };

  const handleRequestAddContact = () => {
    if (!project) return;
    const returnToPath = `/projects/${project.id}?openEditProject=1`;
    navigate(`/contacts?returnTo=${encodeURIComponent(returnToPath)}`);
  };

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

  const actionHeader = <PageHeader />;

  if (projectLoading) {
    return (
      <div className="space-y-6">
        {actionHeader}
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        {actionHeader}
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

  return (
    <div className="space-y-6">
      <PageHeader />
      <div className="flex items-center justify-between">
        <Link href="/projects">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReportDialogOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Button variant="outline" onClick={() => setEditProjectDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-6 w-6 text-muted-foreground" />
                <CardTitle className="text-3xl">{project.name}</CardTitle>
              </div>
              {(clientContact || project.client) && (
                <CardDescription className="text-lg">
                  Client:{" "}
                  {clientContact ? (
                    <button
                      type="button"
                      className="underline decoration-dotted hover:text-primary transition-colors"
                      onClick={handleContactClick}
                    >
                      {clientContact.name}
                    </button>
                  ) : (
                    project.client
                  )}
                </CardDescription>
              )}
              {project.description && (
                <CardDescription className="mt-2">{project.description}</CardDescription>
              )}
            </div>
            <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.address && (
            <button
              type="button"
              className="flex items-center text-muted-foreground hover:text-primary transition-colors"
              onClick={handleAddressClick}
            >
              <MapPin className="h-5 w-5 mr-2" />
              <span className="underline decoration-dotted">{project.address}</span>
            </button>
          )}
          <button
            type="button"
            className={`flex items-center transition-colors ${
              scheduleInfo?.primaryDate
                ? "text-muted-foreground hover:text-primary"
                : "text-muted-foreground opacity-70 cursor-default"
            }`}
            disabled={!scheduleInfo?.primaryDate}
            onClick={handleDateClick}
          >
            <Calendar className="h-5 w-5 mr-2" />
            <span>{scheduleInfo?.label ?? "Not scheduled"}</span>
          </button>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Briefcase className="h-4 w-4 mr-1" />
              {jobs?.length || 0} Jobs
            </div>
            <div className="flex items-center">
              <FileText className="h-4 w-4 mr-1" />
              {files?.length || 0} Files
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="jobs" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs">Jobs ({jobs?.length || 0})</TabsTrigger>
          <TabsTrigger value="files">Files ({files?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ProjectCheckIn projectId={projectId} />
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <p className="mt-1">
                    <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Client</label>
                  <p className="mt-1">
                    {clientContact ? (
                      <button
                        type="button"
                        className="underline decoration-dotted hover:text-primary transition-colors"
                        onClick={handleContactClick}
                      >
                        {clientContact.name}
                      </button>
                    ) : (
                      project.client || "Not specified"
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                  <p className="mt-1">{formatDate(project.startDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">End Date</label>
                  <p className="mt-1">{formatDate(project.endDate)}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p className="mt-1">{project.address || "Not specified"}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="mt-1 whitespace-pre-wrap">{project.description || "No description"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl">Jobs</h2>
            <Button onClick={() => setCreateJobDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Job
            </Button>
          </div>
          {jobsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ProjectJobList jobs={jobs || []} projectId={projectId} />
          )}
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <ProjectFileGallery projectId={projectId} files={files || []} isLoading={filesLoading} />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-6 border-t border-border">
        {project.status !== "archived" && (
          <Button
            variant="outline"
            onClick={handleArchiveProject}
            disabled={archiveProject.isPending}
            className="gap-2"
          >
            {archiveProject.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Archive Project
          </Button>
        )}
        <Button
          variant="destructive"
          onClick={handleDeleteProject}
          disabled={deleteProject.isPending}
          className="gap-2"
        >
          {deleteProject.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete Project
        </Button>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDeleteProject}
        title="Permanently Delete Project"
        description="This action cannot be undone. This will permanently delete the project and remove all associated data from our servers."
        warning={`This will delete ${jobs?.length || 0} job${(jobs?.length || 0) !== 1 ? 's' : ''} and ${files?.length || 0} file${(files?.length || 0) !== 1 ? 's' : ''} associated with this project.`}
        requireTypeToConfirm={project.name}
        confirmValue={deleteConfirmValue}
        onConfirmValueChange={setDeleteConfirmValue}
        confirmLabel="Delete Project Permanently"
        isDeleting={deleteProject.isPending}
      />

      <CreateProjectJobDialog 
        open={createJobDialogOpen} 
        onOpenChange={setCreateJobDialogOpen} 
        projectId={projectId} 
      />
      {project && (
        <EditProjectDialog 
          open={editProjectDialogOpen} 
          onOpenChange={setEditProjectDialogOpen} 
          project={project}
          onRequestAddContact={handleRequestAddContact}
        />
      )}
      <GenerateProjectReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        projectId={projectId}
      />
    </div>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, MapPin, Calendar, Plus, Loader2, Image as ImageIcon, FileText, Trash2, User } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useState } from "react";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { EditJobDialog } from "@/components/EditJobDialog";
import { TaskList } from "@/components/TaskList";

import ImageGallery from "@/components/ImageGallery";
import { PDFExportButton } from "@/components/PDFExportButton";
import { toast } from "sonner";

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const jobId = params?.id ? parseInt(params.id) : 0;
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [editJobDialogOpen, setEditJobDialogOpen] = useState(false);

  const { data: job, isLoading: jobLoading } = trpc.jobs.getById.useQuery({ id: jobId });
  const { data: tasks, isLoading: tasksLoading } = trpc.tasks.listByJob.useQuery({ jobId });
  const { data: images, isLoading: imagesLoading } = trpc.images.listByJob.useQuery({ jobId });
  const { data: contact } = trpc.contacts.getById.useQuery(
    { id: job?.contactId || 0 },
    { enabled: !!job?.contactId }
  );
  const utils = trpc.useUtils();
  const router = useRoute("/")[1];
  
  const deleteJob = trpc.jobs.delete.useMutation({
    onSuccess: () => {
      utils.jobs.list.invalidate();
      toast.success("Job deleted successfully");
      window.location.href = "/jobs";
    },
    onError: (error) => {
      toast.error("Failed to delete job: " + error.message);
    },
  });

  const handleDeleteJob = () => {
    if (confirm("Are you sure you want to delete this job? This action cannot be undone.")) {
      deleteJob.mutate({ id: jobId });
    }
  };

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

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <Link href="/jobs">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/jobs">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
        </Link>
        <div className="flex gap-2">
          {job && (
            <>
              <Button variant="outline" onClick={() => setEditJobDialogOpen(true)}>
                Edit Job
              </Button>
              <PDFExportButton jobId={job.id} jobTitle={job.title} />
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl">{job.title}</CardTitle>
              {job.description && <CardDescription className="mt-2">{job.description}</CardDescription>}
            </div>
            <Badge className={getStatusColor(job.status)}>{job.status.replace("_", " ")}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {job.location && (
            <div className="flex items-center text-muted-foreground">
              <MapPin className="h-5 w-5 mr-2" />
              {job.latitude && job.longitude ? (
                <Link href={`/maps?jobId=${job.id}`}>
                  <span className="hover:text-primary transition-colors cursor-pointer">
                    {job.location}
                  </span>
                </Link>
              ) : (
                <span>{job.location}</span>
              )}
            </div>
          )}
          <div className="flex items-center text-muted-foreground">
            <Calendar className="h-5 w-5 mr-2" />
            <Link href={`/calendar?jobId=${job.id}`}>
              <span className="hover:text-primary transition-colors cursor-pointer">
                {formatDate(job.startDate)} - {formatDate(job.endDate)}
              </span>
            </Link>
          </div>
          {contact && (
            <div className="flex items-center text-muted-foreground">
              <User className="h-5 w-5 mr-2" />
              <Link href={`/contacts/${contact.id}?back=${encodeURIComponent("/jobs")}&backLabel=Jobs`}>
                <span className="hover:text-primary transition-colors cursor-pointer">
                  {contact.name}
                </span>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Tasks</h2>
            <Button onClick={() => setCreateTaskDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
          {tasksLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <TaskList tasks={tasks || []} jobId={jobId} />
          )}
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <ImageGallery jobId={jobId} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Reports</h2>
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">Report generation coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-6 border-t border-border">
        <PDFExportButton jobId={jobId} jobTitle={job?.title || "Job"} />
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

      <CreateTaskDialog open={createTaskDialogOpen} onOpenChange={setCreateTaskDialogOpen} jobId={jobId} />
      {job && <EditJobDialog open={editJobDialogOpen} onOpenChange={setEditJobDialogOpen} job={job} />}
    </div>
  );
}

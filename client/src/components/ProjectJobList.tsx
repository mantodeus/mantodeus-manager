/**
 * Project Job List Component
 * 
 * Displays jobs within a project as cards with status badges.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Briefcase, Calendar, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";

interface ProjectJob {
  id: number;
  projectId: number;
  title: string;
  category: string | null;
  description: string | null;
  status: "pending" | "in_progress" | "done" | "cancelled";
  assignedUsers: number[] | null;
  startTime: Date | null;
  endTime: Date | null;
  createdAt: Date;
}

interface ProjectJobListProps {
  jobs: ProjectJob[];
  projectId: number;
}

export function ProjectJobList({ jobs, projectId }: ProjectJobListProps) {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  
  const deleteJob = trpc.projects.jobs.delete.useMutation({
    onSuccess: () => {
      toast.success("Job deleted successfully");
      utils.projects.jobs.list.invalidate({ projectId });
    },
    onError: (error) => {
      toast.error("Failed to delete job: " + error.message);
    },
  });

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
    if (!date) return null;
    return new Date(date).toLocaleDateString();
  };

  const handleItemAction = (action: ItemAction, jobId: number) => {
    switch (action) {
      case "edit":
        navigate(`/projects/${projectId}/jobs/${jobId}`);
        break;
      case "duplicate":
        toast.info("Duplicate is coming soon.");
        break;
      case "delete":
        if (confirm("Are you sure you want to delete this job?")) {
          deleteJob.mutate({ projectId, jobId });
        }
        break;
    }
  };

  const handleDateClick = (job: ProjectJob) => {
    const date = job.startTime ? new Date(job.startTime) : job.endTime ? new Date(job.endTime) : null;
    if (!date) return;
    const url = new URL("/calendar", window.location.origin);
    url.searchParams.set("focusDate", date.toISOString());
    url.searchParams.set("highlightJobId", job.id.toString());
    navigate(url.pathname + url.search);
  };

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No jobs yet. Create your first job to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {jobs.map((job) => {
        const startLabel = formatDate(job.startTime);
        const endLabel = formatDate(job.endTime);
        const dateLabel = startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel || endLabel;
        return (
        <Link key={job.id} href={`/projects/${projectId}/jobs/${job.id}`}>
          <Card className="hover:shadow-lg transition-all cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{job.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(job.status)}>
                    {formatStatus(job.status)}
                  </Badge>
                  <ItemActionsMenu
                    onAction={(action) => handleItemAction(action, job.id)}
                    actions={["edit", "duplicate", "delete"]}
                    triggerClassName="text-muted-foreground hover:text-foreground"
                    disabled={deleteJob.isPending}
                  />
                </div>
              </div>
              {job.category && (
                <CardDescription>
                  <Badge variant="outline" className="text-xs">
                    {job.category}
                  </Badge>
                </CardDescription>
              )}
              {job.description && (
                <CardDescription className="line-clamp-2">{job.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {dateLabel && (
                <button
                  type="button"
                  className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors w-full text-left"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDateClick(job);
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>{dateLabel}</span>
                </button>
              )}
              {job.assignedUsers && job.assignedUsers.length > 0 && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="h-4 w-4 mr-2" />
                  {job.assignedUsers.length} assigned
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      );
      })}
    </div>
  );
}

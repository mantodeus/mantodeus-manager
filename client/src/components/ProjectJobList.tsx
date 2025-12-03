/**
 * Project Job List Component
 * 
 * Displays jobs within a project as cards with status badges.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Briefcase, Calendar, Loader2, Trash2, Users } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

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

  const handleDeleteJob = (e: React.MouseEvent, jobId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this job?")) {
      deleteJob.mutate({ projectId, jobId });
    }
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
      {jobs.map((job) => (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteJob(e, job.id)}
                    disabled={deleteJob.isPending}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    {deleteJob.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
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
              {(job.startTime || job.endTime) && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  {formatDate(job.startTime)} - {formatDate(job.endTime)}
                </div>
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
      ))}
    </div>
  );
}

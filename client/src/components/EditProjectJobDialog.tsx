/**
 * Edit Project Job Dialog
 * 
 * Modal dialog for editing an existing job within a project.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
}

interface EditProjectJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: ProjectJob;
  projectId: number;
}

type JobStatus = "pending" | "in_progress" | "done" | "cancelled";

export function EditProjectJobDialog({ open, onOpenChange, job, projectId }: EditProjectJobDialogProps) {
  const [title, setTitle] = useState(job.title);
  const [category, setCategory] = useState(job.category || "");
  const [description, setDescription] = useState(job.description || "");
  const [status, setStatus] = useState<JobStatus>(job.status);

  // Reset form when job changes
  useEffect(() => {
    setTitle(job.title);
    setCategory(job.category || "");
    setDescription(job.description || "");
    setStatus(job.status);
  }, [job]);

  const utils = trpc.useUtils();
  const updateJob = trpc.projects.jobs.update.useMutation({
    onSuccess: () => {
      toast.success("Job updated successfully");
      utils.projects.jobs.get.invalidate({ projectId, jobId: job.id });
      utils.projects.jobs.list.invalidate({ projectId });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to update job: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Job title is required");
      return;
    }

    updateJob.mutate({
      id: job.id,
      projectId,
      title: title.trim(),
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
          <DialogDescription>
            Update job details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Foundation Work"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Construction, Electrical, Plumbing"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details about this job"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value: JobStatus) => setStatus(value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateJob.isPending}>
              {updateJob.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

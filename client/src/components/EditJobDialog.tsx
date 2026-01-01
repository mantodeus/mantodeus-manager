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
import { Loader2 } from "@/components/ui/Icon";
import type { Job } from "drizzle/schema";
import { DatePicker } from "@/components/DatePicker";

interface EditJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
}

export function EditJobDialog({ open, onOpenChange, job }: EditJobDialogProps) {
  const [title, setTitle] = useState(job.title);
  const [description, setDescription] = useState(job.description || "");
  const [location, setLocation] = useState(job.location || "");
  const [status, setStatus] = useState<"planning" | "active" | "on_hold" | "completed" | "cancelled">(job.status);
  const [contactId, setContactId] = useState<number | undefined>(job.contactId || undefined);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const utils = trpc.useUtils();
  const { data: contacts } = trpc.contacts.list.useQuery();
  
  const updateJob = trpc.jobs.update.useMutation({
    onSuccess: () => {
      toast.success("Job updated successfully");
      utils.jobs.list.invalidate();
      utils.jobs.getById.invalidate({ id: job.id });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to update job: " + error.message);
    },
  });

  // Reset form when job changes
  useEffect(() => {
    setTitle(job.title);
    setDescription(job.description || "");
    setLocation(job.location || "");
    setStatus(job.status);
    setContactId(job.contactId || undefined);
    
    // Initialize selected dates from job
    const dates: Date[] = [];
    if (job.startDate && job.endDate) {
      // If it's a range, add all dates in the range
      const start = new Date(job.startDate);
      const end = new Date(job.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
    }
    setSelectedDates(dates);
  }, [job]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Job title is required");
      return;
    }

    // Determine if we have dates and set dateMode accordingly
    const hasSelectedDates = selectedDates.length > 0;
    const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const startDate = hasSelectedDates ? sortedDates[0] : undefined;
    const endDate = hasSelectedDates ? sortedDates[sortedDates.length - 1] : undefined;

    updateJob.mutate({
      id: job.id,
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      status,
      contactId,
      dateMode: "individual",
      startDate,
      endDate,
      individualDates: selectedDates,
    });
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
          <DialogDescription>Update job details and settings.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Downtown Office Building"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the project"
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., 123 Main St, City, State"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contact">Contact (Optional)</Label>
              <Select value={contactId?.toString() || "none"} onValueChange={(value) => setContactId(value === "none" ? undefined : parseInt(value))}>
                <SelectTrigger id="contact">
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No contact</SelectItem>
                  {contacts?.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id.toString()}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label>Select Dates</Label>
              <DatePicker selectedDates={selectedDates} onChange={setSelectedDates} />
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

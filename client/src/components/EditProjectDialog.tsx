/**
 * Edit Project Dialog
 * 
 * Modal dialog for editing an existing project.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Loader2, ArrowLeft } from "@/components/ui/Icon";
import { DatePicker } from "@/components/DatePicker";

interface Project {
  id: number;
  name: string;
  client: string | null;
  clientId: number | null;
  description: string | null;
  address: string | null;
  status: "planned" | "active" | "completed" | "archived";
  startDate: Date | null;
  endDate: Date | null;
  scheduledDates: string[] | string | null;
}

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onRequestAddContact?: () => void;
}

type ProjectStatus = "planned" | "active" | "completed";

export function EditProjectDialog({ open, onOpenChange, project, onRequestAddContact }: EditProjectDialogProps) {
  const [name, setName] = useState(project.name);
  const [client, setClient] = useState(project.client || "");
  const [clientId, setClientId] = useState<number | null>(project.clientId);
  const [description, setDescription] = useState(project.description || "");
  const [address, setAddress] = useState(project.address || "");
  const [status, setStatus] = useState<ProjectStatus>(project.status === "archived" ? "active" : project.status);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const { data: contacts = [] } = trpc.contacts.list.useQuery(undefined, {
    enabled: open,
  });

  const coerceScheduledDates = (value: Project["scheduledDates"]): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter((d): d is string => typeof d === "string");
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.filter((d): d is string => typeof d === "string");
        }
      } catch {
        // ignore
      }
    }
    return [];
  };

  // Reset form when project changes
  useEffect(() => {
    setName(project.name);
    setClient(project.client || "");
    setClientId(project.clientId);
    setDescription(project.description || "");
    setAddress(project.address || "");
    setStatus(project.status === "archived" ? "active" : project.status);

    const explicitDates = coerceScheduledDates(project.scheduledDates)
      .map((date) => new Date(date))
      .filter((date) => !Number.isNaN(date.getTime()));
    if (explicitDates.length > 0) {
      setSelectedDates(explicitDates);
    } else {
      const dates: Date[] = [];
      if (project.startDate) dates.push(new Date(project.startDate));
      if (project.endDate) dates.push(new Date(project.endDate));
      setSelectedDates(dates);
    }
  }, [project]);

  const utils = trpc.useUtils();
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      toast.success("Project updated successfully");
      utils.projects.getById.invalidate({ id: project.id });
      utils.projects.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to update project: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }

    // Determine dates
    const hasSelectedDates = selectedDates.length > 0;
    const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    const startDate = hasSelectedDates ? sortedDates[0] : undefined;
    const endDate = hasSelectedDates ? sortedDates[sortedDates.length - 1] : undefined;

    updateProject.mutate({
      id: project.id,
      name: name.trim(),
      client: client.trim() || undefined,
      clientId: clientId ?? null,
      description: description.trim() || undefined,
      address: address.trim() || undefined,
      status,
      startDate,
      endDate,
      scheduledDates: selectedDates,
    });
  };

  const handleClientSelect = (value: string) => {
    if (value === "add-new") {
      if (onRequestAddContact) {
        onRequestAddContact();
        onOpenChange(false);
      }
      return;
    }
    if (value === "none") {
      setClientId(null);
      return;
    }
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      setClientId(null);
      return;
    }
    setClientId(parsed);
    const selectedContact = contacts.find((contact) => contact.id === parsed);
    if (selectedContact && !client) {
      setClient(selectedContact.name);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="h-screen w-screen max-w-full top-0 left-0 right-0 bottom-0 translate-x-0 translate-y-0 rounded-none m-0 p-0 flex flex-col"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            {/* Back button and title */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <DialogTitle className="text-2xl">Edit Project</DialogTitle>
            </div>
            
            {/* Save button */}
            <Button 
              type="submit" 
              form="edit-project-form"
              disabled={updateProject.isPending}
            >
              {updateProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogHeader>
        
        {/* Form - scrollable */}
        <form id="edit-project-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid gap-4 p-4 max-w-2xl mx-auto">
            <div className="grid gap-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Downtown Office Renovation"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client">Client</Label>
              <Select value={clientId?.toString() ?? "none"} onValueChange={handleClientSelect}>
                <SelectTrigger id="client">
                  <SelectValue placeholder={contacts.length ? "Select a client" : "No contacts yet"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id.toString()}>
                      {contact.name}
                    </SelectItem>
                  ))}
                <SelectItem value="add-new" className="border-t border-border mt-1 pt-1 text-primary font-medium">
                  + New Client
                </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-name">Client Display Name</Label>
              <Input
                id="client-name"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g., Acme Corporation"
              />
              <p className="text-xs text-muted-foreground">
                Shown on the project overview. Defaults to the linked contact name.
              </p>
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
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 123 Main St, City, State"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value: ProjectStatus) => setStatus(value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Project Dates</Label>
              <DatePicker selectedDates={selectedDates} onChange={setSelectedDates} />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

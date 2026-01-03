/**
 * Project New Page
 * 
 * Full-screen page for creating a new project with:
 * - Name (required)
 * - Client
 * - Description
 * - Address
 * - Date range
 * - Status
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Link, useLocation } from "wouter";
import { PageHeader } from "@/components/PageHeader";

type ProjectStatus = "planned" | "active" | "completed";

const CREATE_NEW_CLIENT_VALUE = "__create_new_client__";

export default function ProjectNew() {
  const [location, navigate] = useLocation();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientId, setClientId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planned");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const utils = trpc.useUtils();
  const createProject = trpc.projects.create.useMutation({
    onSuccess: (data) => {
      toast.success("Project created successfully");
      utils.projects.list.invalidate();
      navigate(`/projects/${data.id}`);
    },
    onError: (error) => {
      toast.error("Failed to create project: " + error.message);
    },
  });

  // Get prefillClientId from URL params and prefill client
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const prefillClientIdParam = urlParams.get("prefillClientId");
    const prefillClientId = prefillClientIdParam ? parseInt(prefillClientIdParam, 10) : null;
    
    if (!prefillClientId || !contacts.length) return;
    const match = contacts.find((contact) => contact.id === prefillClientId);
    if (!match) return;
    setClientId(match.id);
    setClientName((current) => current || match.name);
  }, [location, contacts]);

  const handleClientSelect = (value: string) => {
    if (value === CREATE_NEW_CLIENT_VALUE) {
      const currentUrl = new URL(window.location.href);
      const returnToPath = `/projects/new${currentUrl.search}`;
      navigate(`/contacts?returnTo=${encodeURIComponent(returnToPath)}`);
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
    if (selectedContact && !clientName) {
      setClientName(selectedContact.name);
    }
  };

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
    const scheduledDates = selectedDates.length > 0 ? selectedDates : undefined;
    const normalizedClientName = clientName.trim();

    createProject.mutate({
      name: name.trim(),
      client: normalizedClientName || undefined,
      clientId: clientId ?? undefined,
      description: description.trim() || undefined,
      address: address.trim() || undefined,
      status,
      startDate,
      endDate,
      scheduledDates,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader />
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-regular">New Project</h1>
          <p className="text-muted-foreground text-sm">
            Create a new project to organize your work and jobs
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
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
                    <SelectItem
                      value={CREATE_NEW_CLIENT_VALUE}
                      className="border-t border-border mt-1 pt-1 text-primary font-medium"
                    >
                      + New Client
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-name">Client Display Name</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                />
                <p className="text-xs text-muted-foreground">
                  Used for labeling in project lists. Defaults to the linked contact name.
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
            <div className="flex justify-end gap-2 pt-4">
              <Link href="/projects">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createProject.isPending}>
                {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


/**
 * Contacts List Page
 * 
 * Displays all active contacts for the current user.
 * Pull-down reveal provides navigation to archived/rubbish views.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Mail, MapPin, Phone, Plus, Map, Loader2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";

export default function Contacts() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  
  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Confirmation dialogs
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const [deleteToRubbishDialogOpen, setDeleteToRubbishDialogOpen] = useState(false);
  const [deleteToRubbishTargetId, setDeleteToRubbishTargetId] = useState<number | null>(null);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [batchArchiveDialogOpen, setBatchArchiveDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: activeContacts = [], isLoading: activeLoading } = trpc.contacts.list.useQuery();
  const createMutation = trpc.contacts.create.useMutation();
  const updateMutation = trpc.contacts.update.useMutation();
  const archiveMutation = trpc.contacts.archive.useMutation({
    onSuccess: () => {
      toast.success("Archived. You can restore this later.");
      invalidateContactLists();
    },
    onError: (error) => {
      toast.error("Failed to archive contact: " + error.message);
    },
  });
  const deleteToRubbishMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted. You can restore this later from the Rubbish bin.");
      invalidateContactLists();
    },
    onError: (error) => {
      toast.error("Failed to delete contact: " + error.message);
    },
  });

  const invalidateContactLists = () => {
    utils.contacts.list.invalidate();
    utils.contacts.listArchived.invalidate();
    utils.contacts.listTrashed.invalidate();
  };

  const filteredActiveContacts = activeContacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Contact name is required");
      return;
    }

    try {
      let newlyCreatedId: number | null = null;
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          name: formData.name || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          notes: formData.notes || undefined,
        });
        toast.success("Contact updated successfully");
      } else {
        const result = await createMutation.mutateAsync({
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          notes: formData.notes || undefined,
        });
        newlyCreatedId = result?.id ?? null;
        toast.success("Contact created successfully");
      }
      setFormData({ name: "", email: "", phone: "", address: "", notes: "" });
      setEditingId(null);
      setIsDialogOpen(false);
      invalidateContactLists();
      if (!editingId && newlyCreatedId && returnTo) {
        const redirectUrl = new URL(returnTo, window.location.origin);
        redirectUrl.searchParams.set("prefillClientId", newlyCreatedId.toString());
        if (!redirectUrl.searchParams.has("openCreateProject")) {
          redirectUrl.searchParams.set("openCreateProject", "1");
        }
        setLocation(`${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`);
      }
    } catch (error) {
      toast.error(editingId ? "Failed to update contact" : "Failed to create contact");
    }
  };

  const handleEdit = (contact: typeof activeContacts[0]) => {
    setFormData({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      address: contact.address || "",
      notes: contact.notes || "",
    });
    setEditingId(contact.id);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setFormData({ name: "", email: "", phone: "", address: "", notes: "" });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchDeleteDialogOpen(true);
  };

  const handleBatchArchive = async () => {
    if (selectedIds.size === 0) return;
    setBatchArchiveDialogOpen(true);
  };

  const handleItemAction = (action: ItemAction, contactId: number) => {
    const contact = activeContacts.find((c) => c.id === contactId);
    if (!contact) return;

    switch (action) {
      case "edit":
        handleEdit(contact);
        break;
      case "archive":
        setArchiveTargetId(contactId);
        setArchiveDialogOpen(true);
        break;
      case "moveToTrash":
        setDeleteToRubbishTargetId(contactId);
        setDeleteToRubbishDialogOpen(true);
        break;
      case "select":
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([contactId]));
        break;
    }
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const returnParam = url.searchParams.get("returnTo");
    if (returnParam) {
      setReturnTo(returnParam);
    }
    const focusParam = url.searchParams.get("contactId");
    if (focusParam && activeContacts.length > 0) {
      const contactId = parseInt(focusParam, 10);
      const focusContact = activeContacts.find((contact) => contact.id === contactId);
      if (focusContact) {
        handleEdit(focusContact);
      }
      url.searchParams.delete("contactId");
      const nextSearch = url.searchParams.toString();
      const nextHref = nextSearch ? `${url.pathname}?${nextSearch}${url.hash}` : `${url.pathname}${url.hash}`;
      window.history.replaceState(null, "", nextHref);
    }
  }, [location, activeContacts]);

  const toggleSelection = (contactId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedIds(newSelected);
  };

  const renderContactCard = (contact: typeof activeContacts[0]) => {
    const handleCardClick = () => {
      if (isMultiSelectMode) {
        toggleSelection(contact.id);
      } else {
        handleEdit(contact);
      }
    };

    return (
      <Card
        key={contact.id}
        className={`bg-[#0D0E10] border-[#0D0E10] p-4 hover:border-[#0D0E10] transition-all ${
          selectedIds.has(contact.id) ? "ring-2 ring-[#0D0E10]" : ""
        }`}
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-3 mb-3">
          {isMultiSelectMode && (
            <Checkbox
              checked={selectedIds.has(contact.id)}
              onCheckedChange={() => toggleSelection(contact.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
          )}
          <div className="flex-1">
            <h3 className="font-regular text-lg">{contact.name}</h3>
            {contact.address && (
              <a 
                href={contact.latitude && contact.longitude ? `/maps?contactId=${contact.id}` : '#'}
                className={`text-gray-400 text-sm flex items-center gap-1 mt-1 ${contact.latitude && contact.longitude ? 'hover:text-[#00ff88] cursor-pointer transition-colors' : ''}`}
                onClick={(e) => {
                  if (!contact.latitude || !contact.longitude) {
                    e.preventDefault();
                  }
                  e.stopPropagation();
                }}
              >
                <MapPin className="w-3 h-3" />
                {contact.address}
              </a>
            )}
          </div>
          {!isMultiSelectMode && (
            <ItemActionsMenu
              onAction={(action) => handleItemAction(action, contact.id)}
              actions={["edit", "archive", "moveToTrash", "select"]}
              triggerClassName="text-muted-foreground hover:text-foreground"
            />
          )}
        </div>

        <div className="space-y-2 text-sm text-gray-400">
          {contact.email && (
            <p className="flex items-center gap-2">
              <Mail className="w-3 h-3" />
              <a href={`mailto:${contact.email}`} className="hover:text-[#00ff88] transition-colors">
                {contact.email}
              </a>
            </p>
          )}
          {contact.phone && (
            <p className="flex items-center gap-2">
              <Phone className="w-3 h-3" />
              <a href={`tel:${contact.phone}`} className="hover:text-[#00ff88] transition-colors">
                {contact.phone}
              </a>
            </p>
          )}
        </div>
        
        {!isMultiSelectMode && contact.latitude && contact.longitude && (
          <div className="mt-3 pt-3 border-t border-[#0D0E10]">
            <a href={`/maps?contactId=${contact.id}`}>
              <Button variant="outline" size="sm" className="w-full">
                <Map className="h-3 w-3 mr-2" />
                View on Map
              </Button>
            </a>
          </div>
        )}

        {contact.notes && (
          <p className="text-gray-500 text-xs mt-3 pt-3 border-t border-[#0D0E10]">{contact.notes}</p>
        )}
      </Card>
    );
  };

  if (activeLoading) {
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
          <h1 className="text-3xl font-regular">Contacts</h1>
          <p className="text-gray-400 text-sm">Manage your clients and contacts</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#00ff88] text-black hover:bg-[#00dd77]">
              <Plus className="w-4 h-4 mr-2" />
              New Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1a1a] border-[#0D0E10]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Contact" : "Add New Contact"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <Input
                  placeholder="Contact name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-[#0D0E10] border-[#0D0E10]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-[#0D0E10] border-[#0D0E10]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <Input
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-[#0D0E10] border-[#0D0E10]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <Input
                  placeholder="Street address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="bg-[#0D0E10] border-[#0D0E10]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <Textarea
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-[#0D0E10] border-[#0D0E10]"
                  rows={3}
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full bg-[#00ff88] text-black hover:bg-[#00dd77]"
              >
                {editingId
                  ? updateMutation.isPending
                    ? "Updating..."
                    : "Update Contact"
                  : createMutation.isPending
                  ? "Creating..."
                  : "Create Contact"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div>
        <Input
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-[#0D0E10] border-[#0D0E10]"
        />
      </div>

      {/* Active Contacts Grid */}
      <div className="space-y-4">
        {filteredActiveContacts.length === 0 ? (
          <Card className="bg-[#0D0E10] border-[#0D0E10] p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-gray-400">
              {searchTerm ? "No contacts found matching your search." : "No contacts found. Create your first contact to get started."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActiveContacts.map((contact) => renderContactCard(contact))}
          </div>
        )}
      </div>

      {/* Scroll-reveal footer for Archived/Rubbish navigation */}
      <ScrollRevealFooter basePath="/contacts" />

      {/* Multi-Select Bar */}
      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          onPrimaryAction={handleBatchDelete}
          onCancel={() => {
            setIsMultiSelectMode(false);
            setSelectedIds(new Set());
          }}
        />
      )}

      {/* Archive Confirmation Dialog */}
      <DeleteConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={(open) => {
          setArchiveDialogOpen(open);
          if (!open) {
            setArchiveTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!archiveTargetId) return;
          archiveMutation.mutate({ id: archiveTargetId });
        }}
        title="Archive"
        description="Archive this contact? You can restore it anytime from the archived view."
        confirmLabel="Archive"
        isDeleting={archiveMutation.isPending}
      />

      {/* Delete (Move to Rubbish) Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteToRubbishDialogOpen}
        onOpenChange={(open) => {
          setDeleteToRubbishDialogOpen(open);
          if (!open) {
            setDeleteToRubbishTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!deleteToRubbishTargetId) return;
          deleteToRubbishMutation.mutate({ id: deleteToRubbishTargetId });
        }}
        title="Delete"
        description={"Are you sure?\nYou can restore this later from the Rubbish bin."}
        confirmLabel="Delete"
        isDeleting={deleteToRubbishMutation.isPending}
      />

      {/* Batch Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={batchDeleteDialogOpen}
        onOpenChange={setBatchDeleteDialogOpen}
        onConfirm={() => {
          const ids = Array.from(selectedIds);
          ids.forEach((id) => deleteToRubbishMutation.mutate({ id }));
          setSelectedIds(new Set());
          setIsMultiSelectMode(false);
        }}
        title="Delete"
        description={"Are you sure?\nYou can restore this later from the Rubbish bin."}
        confirmLabel="Delete"
        isDeleting={deleteToRubbishMutation.isPending}
      />

      {/* Batch Archive Confirmation Dialog */}
      <DeleteConfirmDialog
        open={batchArchiveDialogOpen}
        onOpenChange={setBatchArchiveDialogOpen}
        onConfirm={() => {
          const ids = Array.from(selectedIds);
          ids.forEach((id) => archiveMutation.mutate({ id }));
          setSelectedIds(new Set());
          setIsMultiSelectMode(false);
        }}
        title="Archive"
        description={`Archive ${selectedIds.size} contact${selectedIds.size > 1 ? "s" : ""}? You can restore them anytime.`}
        confirmLabel="Archive"
        isDeleting={archiveMutation.isPending}
      />
    </div>
  );
}

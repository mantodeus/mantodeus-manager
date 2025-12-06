import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Mail, MapPin, Phone, Plus, Map } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { useState } from "react";
import { toast } from "sonner";

export default function Contacts() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  const { data: contacts = [], refetch } = trpc.contacts.list.useQuery();
  const createMutation = trpc.contacts.create.useMutation();
  const updateMutation = trpc.contacts.update.useMutation();
  const deleteMutation = trpc.contacts.delete.useMutation();

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Contact name is required");
      return;
    }

    try {
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
        await createMutation.mutateAsync({
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          notes: formData.notes || undefined,
        });
        toast.success("Contact created successfully");
      }
      setFormData({ name: "", email: "", phone: "", address: "", notes: "" });
      setEditingId(null);
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error(editingId ? "Failed to update contact" : "Failed to create contact");
    }
  };

  const handleEdit = (contact: typeof contacts[0]) => {
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

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this contact?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast.success("Contact deleted successfully");
        refetch();
      } catch (error) {
        toast.error("Failed to delete contact");
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    
    const count = selectedIds.size;
    if (confirm(`Are you sure you want to delete ${count} contact${count > 1 ? 's' : ''}?`)) {
      try {
        await Promise.all(
          Array.from(selectedIds).map((id) => deleteMutation.mutateAsync({ id }))
        );
        toast.success(`${count} contact${count > 1 ? 's' : ''} deleted successfully`);
        setSelectedIds(new Set());
        setIsMultiSelectMode(false);
        refetch();
      } catch (error) {
        toast.error("Failed to delete contacts");
      }
    }
  };

  const handleItemAction = (action: ItemAction, contactId: number) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    switch (action) {
      case "edit":
        handleEdit(contact);
        break;
      case "delete":
        handleDelete(contactId);
        break;
      case "select":
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([contactId]));
        break;
    }
  };

  const toggleSelection = (contactId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedIds(newSelected);
  };

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

      <div>
        <Input
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-[#0D0E10] border-[#0D0E10] mb-4"
        />
      </div>

      {filteredContacts.length === 0 ? (
        <Card className="bg-[#0D0E10] border-[#0D0E10] p-8 text-center">
          <p className="text-gray-400">No contacts found. Create your first contact to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => {
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
                    <h3 
                      className="font-regular text-lg"
                    >
                      {contact.name}
                    </h3>
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
                    actions={["edit", "delete", "select"]}
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
          })}
        </div>
      )}

      {/* Multi-Select Bar */}
      <MultiSelectBar
        selectedCount={selectedIds.size}
        onDelete={handleBatchDelete}
        onCancel={() => {
          setIsMultiSelectMode(false);
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
}

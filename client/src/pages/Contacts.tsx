/**
 * Contacts List Page
 * 
 * Displays all active contacts for the current user.
 * Pull-down reveal provides navigation to archived/rubbish views.
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Building2, ChevronDown, Loader2, Mail, MapPin, Phone, Plus, Search, User, Users, X } from "@/components/ui/Icon";
import { Checkbox } from "@/components/ui/checkbox";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";
import { PageHeader } from "@/components/PageHeader";

export default function Contacts() {
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [expandedContactId, setExpandedContactId] = useState<number | null>(null);
  const [previewContactId, setPreviewContactId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
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
    clientName: "",
    type: "business" as "business" | "private",
    contactPerson: "",
    streetName: "",
    streetNumber: "",
    postalCode: "",
    city: "",
    country: "",
    vatStatus: "not_subject_to_vat" as "subject_to_vat" | "not_subject_to_vat",
    vatNumber: "",
    taxNumber: "",
    leitwegId: "",
    email: "",
    phoneNumber: "",
    emails: [] as Array<{ label: string; value: string }>,
    phoneNumbers: [] as Array<{ label: string; value: string }>,
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

  const filteredActiveContacts = activeContacts.filter((contact) => {
    const displayName = contact.clientName || contact.name || "";
    const matchesName = displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmail = contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const phoneValue = contact.phoneNumber || contact.phone;
    const matchesPhone = phoneValue?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesContactPerson = contact.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesName || matchesEmail || matchesPhone || matchesContactPerson;
  });

  const resetForm = () => {
    setFormData({
      clientName: "",
      type: "business",
      contactPerson: "",
      streetName: "",
      streetNumber: "",
      postalCode: "",
      city: "",
      country: "",
      vatStatus: "not_subject_to_vat",
      vatNumber: "",
      taxNumber: "",
      leitwegId: "",
      email: "",
      phoneNumber: "",
      emails: [],
      phoneNumbers: [],
      notes: "",
    });
  };

  const normalizeOptional = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const isValidEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const openForm = () => {
    setIsFormOpen(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleSave = async () => {
    if (!formData.clientName.trim()) {
      toast.error("Client name is required");
      return;
    }
    
    // Validate emails - at least one valid email is required
    const validEmails = formData.emails.filter(e => e.value.trim() && isValidEmail(e.value.trim()));
    if (validEmails.length === 0) {
      // Check if single email field is provided as fallback
      if (!formData.email.trim() || !isValidEmail(formData.email.trim())) {
        toast.error("At least one valid email is required");
        return;
      }
    }
    
    // Validate email format if single email provided
    if (formData.email.trim() && !isValidEmail(formData.email.trim())) {
      toast.error("Invalid email address");
      return;
    }
    
    if (!formData.streetName.trim() || !formData.streetNumber.trim()) {
      toast.error("Street name and number are required");
      return;
    }
    if (!formData.postalCode.trim() || !formData.city.trim()) {
      toast.error("Postal code and city are required");
      return;
    }
    if (!formData.country.trim()) {
      toast.error("Country is required");
      return;
    }

    try {
      let newlyCreatedId: number | null = null;
      const payload = {
        clientName: formData.clientName.trim(),
        type: formData.type,
        contactPerson: normalizeOptional(formData.contactPerson),
        streetName: formData.streetName.trim(),
        streetNumber: formData.streetNumber.trim(),
        postalCode: formData.postalCode.trim(),
        city: formData.city.trim(),
        country: formData.country.trim(),
        vatStatus: formData.vatStatus,
        vatNumber: normalizeOptional(formData.vatNumber),
        taxNumber: normalizeOptional(formData.taxNumber),
        leitwegId: normalizeOptional(formData.leitwegId),
        email: formData.email.trim() || undefined,
        phoneNumber: normalizeOptional(formData.phoneNumber),
        emails: validEmails.length > 0 ? validEmails.map(e => ({ 
          label: e.label.trim() || "Email", 
          value: e.value.trim() 
        })) : undefined,
        phoneNumbers: (() => {
          const validPhones = formData.phoneNumbers.filter(p => p.value && p.value.trim());
          return validPhones.length > 0 
            ? validPhones.map(p => ({ 
                label: p.label.trim() || "Phone", 
                value: p.value.trim() 
              }))
            : undefined;
        })(),
        notes: normalizeOptional(formData.notes),
      };

      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...payload,
        });
        toast.success("Contact updated successfully");
      } else {
        const result = await createMutation.mutateAsync(payload);
        newlyCreatedId = result?.id ?? null;
        toast.success("Contact created successfully");
      }
      resetForm();
      setEditingId(null);
      setIsFormOpen(false);
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
    // Migrate old single email/phone to new array format if arrays don't exist
    const emails = (contact.emails as Array<{ label: string; value: string }> | null) || 
      (contact.email ? [{ label: "Email", value: contact.email }] : [{ label: "", value: "" }]);
    const phoneNumbers = (contact.phoneNumbers as Array<{ label: string; value: string }> | null) || 
      (contact.phoneNumber || contact.phone ? [{ label: "Phone", value: contact.phoneNumber || contact.phone || "" }] : []);
    
    setFormData({
      clientName: contact.clientName || contact.name || "",
      type: contact.type || "business",
      contactPerson: contact.contactPerson || "",
      streetName: contact.streetName || "",
      streetNumber: contact.streetNumber || "",
      postalCode: contact.postalCode || "",
      city: contact.city || "",
      country: contact.country || "",
      vatStatus: contact.vatStatus || "not_subject_to_vat",
      vatNumber: contact.vatNumber || "",
      taxNumber: contact.taxNumber || "",
      leitwegId: contact.leitwegId || "",
      email: contact.email || "",
      phoneNumber: contact.phoneNumber || contact.phone || "",
      emails: emails,
      phoneNumbers: phoneNumbers,
      notes: contact.notes || "",
    });
    setEditingId(contact.id);
    openForm();
  };

  const handleCloseForm = () => {
    resetForm();
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleNewContact = () => {
    resetForm();
    // Initialize with at least one email field
    setFormData(prev => ({
      ...prev,
      emails: [{ label: "", value: "" }],
    }));
    setEditingId(null);
    openForm();
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
      case "duplicate":
        toast.info("Duplicate is coming soon.");
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
    if (!isSearchOpen) return;
    setSearchDraft(searchTerm);
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [isSearchOpen, searchTerm]);

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

  const getDisplayName = (contact: typeof activeContacts[0]) =>
    contact.clientName || contact.name || "Contact";

  const getPreviewAddress = (contact: typeof activeContacts[0]) => {
    const streetLine = [contact.streetName, contact.streetNumber].filter(Boolean).join(" ").trim();
    const cityLine = [contact.postalCode, contact.city].filter(Boolean).join(" ").trim();
    if (!streetLine && !cityLine) return null;
    return [streetLine, cityLine].filter(Boolean).join(", ");
  };

  const getMapAddress = (contact: typeof activeContacts[0]) => {
    const streetLine = [contact.streetName, contact.streetNumber].filter(Boolean).join(" ").trim();
    const cityLine = [contact.postalCode, contact.city].filter(Boolean).join(" ").trim();
    const parts = [streetLine, cityLine, contact.country].filter(Boolean);
    if (parts.length === 0) return contact.address;
    return parts.join(", ");
  };

  const renderContactRow = (contact: typeof activeContacts[0]) => {
    const isExpanded = expandedContactId === contact.id;
    const displayName = getDisplayName(contact);
    const previewAddress = getPreviewAddress(contact);
    const mapAddress = getMapAddress(contact);
    
    // Get emails and phone numbers from new array format or fallback to single values
    const emails = (contact.emails as Array<{ label: string; value: string }> | null) || 
      (contact.email ? [{ label: "Email", value: contact.email }] : []);
    const phoneNumbers = (contact.phoneNumbers as Array<{ label: string; value: string }> | null) || 
      (contact.phoneNumber || contact.phone ? [{ label: "Phone", value: contact.phoneNumber || contact.phone || "" }] : []);
    
    const ContactIcon = contact.type === "business" ? Building2 : User;

    return (
      <div
        key={contact.id}
        className={`rounded-lg border ${selectedIds.has(contact.id) ? "ring-2 ring-accent" : ""}`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {isMultiSelectMode && (
            <Checkbox
              checked={selectedIds.has(contact.id)}
              onCheckedChange={() => toggleSelection(contact.id)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <ContactIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <button
              type="button"
              onClick={() => setPreviewContactId(contact.id)}
              className="truncate text-base font-regular hover:text-primary transition-colors text-left"
            >
              {displayName}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-expanded={isExpanded}
              onClick={() =>
                setExpandedContactId(isExpanded ? null : contact.id)
              }
            >
              <ChevronDown
                className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </Button>
            <ItemActionsMenu
              onAction={(action) => handleItemAction(action, contact.id)}
              actions={["edit", "duplicate", "archive", "moveToTrash", "select"]}
              triggerClassName="h-11 w-11 text-muted-foreground hover:text-foreground"
              size="lg"
            />
          </div>
        </div>

        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-2 px-4 pb-3">
              {previewAddress && (
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => {
                    if (!mapAddress) return;
                    setLocation(`/maps?address=${encodeURIComponent(mapAddress)}`);
                  }}
                >
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{previewAddress}</span>
                </button>
              )}
              {emails.map((emailItem, idx) => (
                <a
                  key={idx}
                  href={`mailto:${emailItem.value}`}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Mail className="h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    {emailItem.label !== "Email" && (
                      <div className="text-xs text-muted-foreground/70">{emailItem.label}</div>
                    )}
                    <span className="truncate">{emailItem.value}</span>
                  </div>
                </a>
              ))}
              {phoneNumbers.map((phoneItem, idx) => (
                <a
                  key={idx}
                  href={`tel:${phoneItem.value}`}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    {phoneItem.label !== "Phone" && (
                      <div className="text-xs text-muted-foreground/70">{phoneItem.label}</div>
                    )}
                    <span className="truncate">{phoneItem.value}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const applySearch = () => {
    setSearchTerm(searchDraft.trim());
    setIsSearchOpen(false);
  };

  const clearSearch = () => {
    setSearchDraft("");
    setSearchTerm("");
    setIsSearchOpen(false);
  };

  if (activeLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const searchSlot = (
    <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Search contacts">
          <Search className="size-6" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Search contacts</DialogTitle>
        </DialogHeader>
        <Input
          ref={searchInputRef}
          placeholder="Search contacts..."
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applySearch();
            }
          }}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={clearSearch}>
            Clear
          </Button>
          <Button onClick={applySearch}>Search</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        subtitle="Manage your clients and contacts"
        searchSlot={searchSlot}
      />

      <div className="flex items-center justify-end gap-2 pb-2 border-b">
        {isFormOpen && (
          <Button variant="ghost" onClick={handleCloseForm}>
            Cancel
          </Button>
        )}
        <Button onClick={handleNewContact}>
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {isFormOpen && (
        <div ref={formRef} className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit Contact" : "New Contact"}
            </h2>
            <Button variant="ghost" onClick={handleCloseForm}>
              Close
            </Button>
          </div>
          <div className="mt-4 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm mb-2">Client Name *</label>
                <Input
                  placeholder="Client or contact name"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Type *</label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as "business" | "private" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm mb-2">Contact Person</label>
                <Input
                  placeholder="Optional contact person"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Address</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm mb-2">Street Name *</label>
                  <Input
                    placeholder="Street name"
                    value={formData.streetName}
                    onChange={(e) => setFormData({ ...formData, streetName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Street Number *</label>
                  <Input
                    placeholder="Street number"
                    value={formData.streetNumber}
                    onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Postal Code *</label>
                  <Input
                    placeholder="Postal code"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">City *</label>
                  <Input
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm mb-2">Country *</label>
                  <Input
                    placeholder="Country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Tax and Compliance</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm mb-2">VAT Status *</label>
                  <Select
                    value={formData.vatStatus}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        vatStatus: value as "subject_to_vat" | "not_subject_to_vat",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select VAT status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subject_to_vat">Subject to VAT</SelectItem>
                      <SelectItem value="not_subject_to_vat">Not subject to VAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm mb-2">VAT Number</label>
                  <Input
                    placeholder="VAT number"
                    value={formData.vatNumber}
                    onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Tax Number</label>
                  <Input
                    placeholder="Tax number"
                    value={formData.taxNumber}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Leitweg ID</label>
                  <Input
                    placeholder="Leitweg ID"
                    value={formData.leitwegId}
                    onChange={(e) => setFormData({ ...formData, leitwegId: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Communication</div>
              
              {/* Multiple Emails */}
              <div className="space-y-2">
                <label className="block text-sm mb-2">Email Addresses *</label>
                {formData.emails.map((email, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Label (e.g., Work, Personal)"
                      value={email.label}
                      onChange={(e) => {
                        const newEmails = [...formData.emails];
                        newEmails[idx].label = e.target.value;
                        setFormData({ ...formData, emails: newEmails });
                      }}
                      className="w-32"
                    />
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={email.value}
                      onChange={(e) => {
                        const newEmails = [...formData.emails];
                        newEmails[idx].value = e.target.value;
                        setFormData({ ...formData, emails: newEmails });
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newEmails = formData.emails.filter((_, i) => i !== idx);
                        setFormData({ ...formData, emails: newEmails });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      emails: [...formData.emails, { label: "", value: "" }],
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Email
                </Button>
              </div>

              {/* Multiple Phone Numbers */}
              <div className="space-y-2">
                <label className="block text-sm mb-2">Phone Numbers</label>
                {formData.phoneNumbers.map((phone, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Label (e.g., Mobile, Office)"
                      value={phone.label}
                      onChange={(e) => {
                        const newPhones = [...formData.phoneNumbers];
                        newPhones[idx].label = e.target.value;
                        setFormData({ ...formData, phoneNumbers: newPhones });
                      }}
                      className="w-32"
                    />
                    <Input
                      placeholder="+49 123 456 789"
                      value={phone.value}
                      onChange={(e) => {
                        const newPhones = [...formData.phoneNumbers];
                        newPhones[idx].value = e.target.value;
                        setFormData({ ...formData, phoneNumbers: newPhones });
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newPhones = formData.phoneNumbers.filter((_, i) => i !== idx);
                        setFormData({ ...formData, phoneNumbers: newPhones });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      phoneNumbers: [...formData.phoneNumbers, { label: "", value: "" }],
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Phone
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Notes</label>
              <Textarea
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="w-full md:w-auto"
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
        </div>
      )}

      {/* Active Contacts Grid */}
      <div className="space-y-4">
        {filteredActiveContacts.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchTerm ? "No contacts found matching your search." : "No contacts found. Create your first contact to get started."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredActiveContacts.map((contact) => renderContactRow(contact))}
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

      {/* Contact Preview Dialog */}
      {previewContactId && (() => {
        const contact = activeContacts.find((c) => c.id === previewContactId);
        if (!contact) return null;
        
        const previewAddress = getPreviewAddress(contact);
        const mapAddress = getMapAddress(contact);
        const emails = (contact.emails as Array<{ label: string; value: string }> | null) || 
          (contact.email ? [{ label: "Email", value: contact.email }] : []);
        const phoneNumbers = (contact.phoneNumbers as Array<{ label: string; value: string }> | null) || 
          (contact.phoneNumber || contact.phone ? [{ label: "Phone", value: contact.phoneNumber || contact.phone || "" }] : []);
        const ContactIcon = contact.type === "business" ? Building2 : User;
        const displayName = getDisplayName(contact);
        
        return (
          <Dialog open={!!previewContactId} onOpenChange={(open) => !open && setPreviewContactId(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <ContactIcon className="h-6 w-6 text-primary" />
                  <DialogTitle className="text-2xl">{displayName}</DialogTitle>
                </div>
                {contact.contactPerson && (
                  <p className="text-sm text-muted-foreground mt-1">Contact: {contact.contactPerson}</p>
                )}
              </DialogHeader>
              
              <div className="space-y-6 mt-6">
                {/* Address Section */}
                {previewAddress && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Address</h3>
                    <button
                      type="button"
                      onClick={() => {
                        if (mapAddress) {
                          setLocation(`/maps?address=${encodeURIComponent(mapAddress)}`);
                          setPreviewContactId(null);
                        }
                      }}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left w-full group"
                    >
                      <MapPin className="h-5 w-5 text-muted-foreground group-hover:text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{previewAddress}</div>
                        {contact.country && (
                          <div className="text-sm text-muted-foreground mt-1">{contact.country}</div>
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {/* Emails Section */}
                {emails.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Email</h3>
                    <div className="space-y-2">
                      {emails.map((emailItem, idx) => (
                        <a
                          key={idx}
                          href={`mailto:${emailItem.value}`}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors group"
                        >
                          <Mail className="h-5 w-5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            {emailItem.label !== "Email" && (
                              <div className="text-xs text-muted-foreground mb-1">{emailItem.label}</div>
                            )}
                            <div className="text-sm font-medium break-all">{emailItem.value}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Phone Numbers Section */}
                {phoneNumbers.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Phone</h3>
                    <div className="space-y-2">
                      {phoneNumbers.map((phoneItem, idx) => (
                        <a
                          key={idx}
                          href={`tel:${phoneItem.value}`}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors group"
                        >
                          <Phone className="h-5 w-5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            {phoneItem.label !== "Phone" && (
                              <div className="text-xs text-muted-foreground mb-1">{phoneItem.label}</div>
                            )}
                            <div className="text-sm font-medium">{phoneItem.value}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tax Information */}
                {(contact.vatNumber || contact.taxNumber || contact.leitwegId) && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tax Information</h3>
                    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                      {contact.vatStatus && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">VAT Status:</span>
                          <span className="font-medium">{contact.vatStatus === "subject_to_vat" ? "Subject to VAT" : "Not subject to VAT"}</span>
                        </div>
                      )}
                      {contact.vatNumber && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">VAT Number:</span>
                          <span className="font-medium">{contact.vatNumber}</span>
                        </div>
                      )}
                      {contact.taxNumber && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax Number:</span>
                          <span className="font-medium">{contact.taxNumber}</span>
                        </div>
                      )}
                      {contact.leitwegId && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Leitweg ID:</span>
                          <span className="font-medium">{contact.leitwegId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {contact.notes && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes</h3>
                    <div className="p-3 rounded-lg border bg-muted/30">
                      <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  handleEdit(contact);
                  setPreviewContactId(null);
                }}>
                  Edit Contact
                </Button>
                <Button onClick={() => setPreviewContactId(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

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

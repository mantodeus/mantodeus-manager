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
import { Building2, Loader2, Mail, MapPin, Phone, Plus, Search, User, Users, X, ArrowLeft, Edit } from "@/components/ui/Icon";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { MultiSelectBar } from "@/components/MultiSelectBar";
import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal } from "@/components/ui/Icon";

type FilterState = {
  time: string; // "all" | "2024" | "2024-10" (year-month format)
  status: "active" | "archived" | "deleted" | "all";
};

const defaultFilters: FilterState = {
  time: "all",
  status: "active",
};

const monthDisplayNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Contacts() {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
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
  const { data: activeContactsData, isLoading: activeLoading } = trpc.contacts.list.useQuery();
  const { data: archivedContacts = [] } = trpc.contacts.listArchived.useQuery();
  const { data: trashedContacts = [] } = trpc.contacts.listTrashed.useQuery();
  const activeContacts = Array.isArray(activeContactsData) ? activeContactsData : [];
  
  // Combine all contacts for filtering
  const allContacts = useMemo(() => {
    const active = activeContacts.map(contact => ({ ...contact, _status: 'active' as const }));
    const archived = archivedContacts.map(contact => ({ ...contact, _status: 'archived' as const }));
    const trashed = trashedContacts.map(contact => ({ ...contact, _status: 'deleted' as const }));
    return [...active, ...archived, ...trashed];
  }, [activeContacts, archivedContacts, trashedContacts]);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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
      toast.success("Deleted. You can restore this later from the Rubbish.");
      invalidateContactLists();
    },
    onError: (error) => {
      toast.error("Failed to delete contact: " + error.message);
    },
  });
  const duplicateContactMutation = trpc.contacts.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Contact duplicated");
      invalidateContactLists();
    },
    onError: (error) => {
      toast.error("Failed to duplicate contact: " + error.message);
    },
  });

  const invalidateContactLists = () => {
    utils.contacts.list.invalidate();
    utils.contacts.listArchived.invalidate();
    utils.contacts.listTrashed.invalidate();
  };

  const filteredActiveContacts = useMemo(() => {
    return allContacts.filter((contact) => {
      // Search filter
      const displayName = contact.clientName || contact.name || "";
      const matchesSearch = !searchTerm || 
        displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.phoneNumber || contact.phone)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Time filter (based on createdAt or updatedAt) - supports "all", "2024" (year), or "2024-10" (year-month)
      const contactDate = contact.createdAt ? new Date(contact.createdAt) : (contact.updatedAt ? new Date(contact.updatedAt) : null);
      const matchesTime =
        filters.time === "all" ||
        (contactDate && (() => {
          const contactYear = contactDate.getFullYear();
          const contactMonth = contactDate.getMonth() + 1; // 1-12
          
          // If filter is just a year (e.g., "2024")
          if (/^\d{4}$/.test(filters.time)) {
            return contactYear === parseInt(filters.time, 10);
          }
          
          // If filter is year-month format (e.g., "2024-10")
          if (/^\d{4}-\d{1,2}$/.test(filters.time)) {
            const [filterYear, filterMonth] = filters.time.split("-").map(Number);
            return contactYear === filterYear && contactMonth === filterMonth;
          }
          
          return false;
        })());

      // Status filter
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" && contact._status === "active") ||
        (filters.status === "archived" && contact._status === "archived") ||
        (filters.status === "deleted" && contact._status === "deleted");

      return matchesSearch && matchesTime && matchesStatus;
    });
  }, [allContacts, searchTerm, filters]);

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
    const emails = Array.isArray(contact.emails)
      ? contact.emails
      : (contact.email ? [{ label: "Email", value: contact.email }] : [{ label: "", value: "" }]);
    const phoneNumbers = Array.isArray(contact.phoneNumbers)
      ? contact.phoneNumbers
      : (contact.phoneNumber || contact.phone ? [{ label: "Phone", value: contact.phoneNumber || contact.phone || "" }] : []);
    
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
        duplicateContactMutation.mutate({ id: contactId });
        break;
      case "select":
        setIsMultiSelectMode(true);
        setSelectedIds(new Set([contactId]));
        break;
      case "archive":
        setArchiveTargetId(contactId);
        setArchiveDialogOpen(true);
        break;
      case "delete":
        setDeleteToRubbishTargetId(contactId);
        setDeleteToRubbishDialogOpen(true);
        break;
    }
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredActiveContacts.map(c => c.id)));
  };
  
  const clearDraftFilters = () => {
    setDraftFilters(defaultFilters);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setIsFilterOpen(false);
  };
  
  useEffect(() => {
    if (isFilterOpen) {
      setDraftFilters(filters);
    }
  }, [isFilterOpen, filters]);

  const handleBatchDuplicate = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      duplicateContactMutation.mutate({ id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
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
    const displayName = getDisplayName(contact);
    
    const ContactIcon = contact.type === "business" ? Building2 : User;

    const handleRowClick = () => {
      if (isMultiSelectMode) {
        toggleSelection(contact.id);
      } else {
        setPreviewContactId(contact.id);
      }
    };

    return (
      <div
        key={contact.id}
        className={`rounded-lg border ${selectedIds.has(contact.id) ? "item-selected" : ""} ${isMultiSelectMode ? "cursor-pointer" : ""}`}
        onClick={handleRowClick}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <ContactIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isMultiSelectMode) {
                  setPreviewContactId(contact.id);
                }
              }}
              className="text-base font-regular hover:text-primary transition-colors text-left break-words"
            >
              {displayName}
            </button>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <ItemActionsMenu
              onAction={(action) => handleItemAction(action, contact.id)}
              actions={["edit", "duplicate", "select", "archive", "delete"]}
              triggerClassName="h-11 w-11 text-muted-foreground hover:text-foreground"
              size="lg"
            />
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
                  <div key={idx} className="space-y-1.5 p-3 border rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs text-muted-foreground font-medium">Label</label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          const newEmails = formData.emails.filter((_, i) => i !== idx);
                          setFormData({ ...formData, emails: newEmails });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Label (e.g., Work, Personal)"
                      value={email.label}
                      onChange={(e) => {
                        const newEmails = formData.emails.map((item, i) => 
                          i === idx ? { ...item, label: e.target.value } : item
                        );
                        setFormData({ ...formData, emails: newEmails });
                      }}
                    />
                    <label className="text-xs text-muted-foreground font-medium">Email Address</label>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={email.value}
                      onChange={(e) => {
                        const newEmails = formData.emails.map((item, i) => 
                          i === idx ? { ...item, value: e.target.value } : item
                        );
                        setFormData({ ...formData, emails: newEmails });
                      }}
                    />
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
                  <div key={idx} className="space-y-1.5 p-3 border rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs text-muted-foreground font-medium">Label</label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          const newPhones = formData.phoneNumbers.filter((_, i) => i !== idx);
                          setFormData({ ...formData, phoneNumbers: newPhones });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Label (e.g., Mobile, Office)"
                      value={phone.label}
                      onChange={(e) => {
                        const newPhones = formData.phoneNumbers.map((item, i) => 
                          i === idx ? { ...item, label: e.target.value } : item
                        );
                        setFormData({ ...formData, phoneNumbers: newPhones });
                      }}
                    />
                    <label className="text-xs text-muted-foreground font-medium">Phone Number</label>
                    <Input
                      placeholder="+49 123 456 789"
                      value={phone.value}
                      onChange={(e) => {
                        const newPhones = formData.phoneNumbers.map((item, i) => 
                          i === idx ? { ...item, value: e.target.value } : item
                        );
                        setFormData({ ...formData, phoneNumbers: newPhones });
                      }}
                    />
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

      {/* Multi-Select Bar */}
      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          totalCount={activeContacts.length}
          onSelectAll={handleSelectAll}
          onDuplicate={handleBatchDuplicate}
          onArchive={handleBatchArchive}
          onDelete={handleBatchDelete}
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
        const emails = Array.isArray(contact.emails) 
          ? contact.emails 
          : (contact.email ? [{ label: "Email", value: contact.email }] : []);
        const phoneNumbers = Array.isArray(contact.phoneNumbers)
          ? contact.phoneNumbers
          : (contact.phoneNumber || contact.phone ? [{ label: "Phone", value: contact.phoneNumber || contact.phone || "" }] : []);
        const ContactIcon = contact.type === "business" ? Building2 : User;
        const displayName = getDisplayName(contact);
        
        return (
          <Dialog open={!!previewContactId} onOpenChange={(open) => !open && setPreviewContactId(null)}>
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
                      onClick={() => setPreviewContactId(null)}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3 min-w-0">
                      <ContactIcon className="h-6 w-6 text-primary flex-shrink-0" />
                      <DialogTitle className="text-2xl break-words">{displayName}</DialogTitle>
                    </div>
                  </div>
                  
                  {/* Edit button */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleEdit(contact);
                      setPreviewContactId(null);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </DialogHeader>
              
              {/* Content - scrollable, aligned to top */}
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
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
                          className="flex gap-3 p-3 rounded-lg border hover:bg-accent transition-colors group"
                        >
                          <Mail className="h-5 w-5 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground mb-1.5 font-medium">{emailItem.label}</div>
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
                          className="flex gap-3 p-3 rounded-lg border hover:bg-accent transition-colors group"
                        >
                          <Phone className="h-5 w-5 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-muted-foreground mb-1.5 font-medium">{phoneItem.label}</div>
                            <div className="text-sm font-medium break-all">{phoneItem.value}</div>
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
        description={"Are you sure?\nYou can restore this later from the Rubbish."}
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
        description={"Are you sure?\nYou can restore this later from the Rubbish."}
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

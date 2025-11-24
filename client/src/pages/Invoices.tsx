import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Trash2, Upload, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Invoices() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobFilter, setJobFilter] = useState<string>("");
  const [contactFilter, setContactFilter] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const { data: invoices = [], refetch } = trpc.invoices.list.useQuery();
  const { data: jobs = [] } = trpc.jobs.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const createMutation = trpc.invoices.create.useMutation();
  const deleteMutation = trpc.invoices.delete.useMutation();

  const filteredInvoices = invoices.filter((invoice) => {
    if (jobFilter && invoice.jobId !== parseInt(jobFilter)) return false;
    if (contactFilter && invoice.contactId !== parseInt(contactFilter)) return false;
    return true;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setIsUploading(true);
    try {
      await createMutation.mutateAsync({
        filename: selectedFile.name,
        fileKey: `invoices/${Date.now()}-${selectedFile.name}`,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        jobId: jobFilter ? parseInt(jobFilter) : undefined,
        contactId: contactFilter ? parseInt(contactFilter) : undefined,
      });

      toast.success("Invoice uploaded successfully");
      setSelectedFile(null);
      setJobFilter("");
      setContactFilter("");
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error("Failed to upload invoice");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this invoice?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast.success("Invoice deleted successfully");
        refetch();
      } catch (error) {
        toast.error("Failed to delete invoice");
      }
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleOpenInvoice = (filename: string) => {
    // Simple approach: Open in new tab or download
    // Since we don't have actual file URLs, we'll show a toast for now
    toast.info(`Opening ${filename}...`);
    // In production, you would open the actual file URL:
    // window.open(fileUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-regular">Invoices</h1>
          <p className="text-gray-400 text-sm">Upload and manage invoice documents</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#00ff88] text-black hover:bg-[#00dd77]">
              <Plus className="w-4 h-4 mr-2" />
              Upload Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1a1a] border-gray-700">
            <DialogHeader>
              <DialogTitle>Upload Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select File *</label>
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-input"
                  />
                  <label htmlFor="file-input" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400">
                      {selectedFile ? selectedFile.name : "Click to select or drag and drop"}
                    </p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Link to Job (optional)</label>
                <Select value={jobFilter || "none"} onValueChange={(val) => setJobFilter(val === "none" ? "" : val)}>
                  <SelectTrigger className="bg-gray-900 border-gray-700">
                    <SelectValue placeholder="Select a job..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="none">None</SelectItem>
                    {jobs && jobs.length > 0 ? (
                      jobs.map((job) => (
                        <SelectItem key={job.id} value={String(job.id)}>
                          {job.title}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-jobs" disabled>
                        No jobs available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Link to Contact (optional)</label>
                <Select value={contactFilter || "none"} onValueChange={(val) => setContactFilter(val === "none" ? "" : val)}>
                  <SelectTrigger className="bg-gray-900 border-gray-700">
                    <SelectValue placeholder="Select a contact..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="none">None</SelectItem>
                    {contacts && contacts.length > 0 ? (
                      contacts.map((contact) => (
                        <SelectItem key={contact.id} value={String(contact.id)}>
                          {contact.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-contacts" disabled>
                        No contacts available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="w-full bg-[#00ff88] text-black hover:bg-[#00dd77]"
              >
                {isUploading ? "Uploading..." : "Upload Invoice"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-2">Filter by Job</label>
          <Select value={jobFilter || "all"} onValueChange={(val) => setJobFilter(val === "all" ? "" : val)}>
            <SelectTrigger className="bg-gray-900 border-gray-700">
              <SelectValue placeholder="All jobs" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="all">All jobs</SelectItem>
              {jobs && jobs.length > 0 ? (
                jobs.map((job) => (
                  <SelectItem key={job.id} value={String(job.id)}>
                    {job.title}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-jobs" disabled>
                  No jobs available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Filter by Contact</label>
          <Select value={contactFilter || "all"} onValueChange={(val) => setContactFilter(val === "all" ? "" : val)}>
            <SelectTrigger className="bg-gray-900 border-gray-700">
              <SelectValue placeholder="All contacts" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="all">All contacts</SelectItem>
              {contacts && contacts.length > 0 ? (
                contacts.map((contact) => (
                  <SelectItem key={contact.id} value={String(contact.id)}>
                    {contact.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-contacts" disabled>
                  No contacts available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <Card className="bg-gray-900 border-gray-700 p-8 text-center">
          <p className="text-gray-400">No invoices found. Upload your first invoice to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvoices.map((invoice) => {
            const linkedJob = jobs.find((j) => j.id === invoice.jobId);
            const linkedContact = contacts.find((c) => c.id === invoice.contactId);

            return (
              <Card key={invoice.id} className="bg-gray-900 border-gray-700 p-4 hover:border-[#00ff88] transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="w-5 h-5 text-[#00ff88] mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 
                        className="font-regular text-lg cursor-pointer hover:text-[#00ff88] transition-colors truncate"
                        onClick={() => handleOpenInvoice(invoice.filename)}
                      >
                        {invoice.filename}
                      </h3>
                      <p className="text-gray-400 text-xs">{formatDate(invoice.createdAt)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(invoice.id)}
                    className="text-red-500 hover:text-red-400 transition-colors flex-shrink-0 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-sm text-gray-400">
                  {linkedJob && (
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        <span className="text-gray-500">Job:</span> {linkedJob.title}
                      </span>
                      <a href={`/jobs/${linkedJob.id}`}>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[#00ff88] hover:text-[#00dd77]">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  )}
                  {linkedContact && (
                    <div className="flex items-center justify-between text-xs">
                      <span>
                        <span className="text-gray-500">Contact:</span> {linkedContact.name}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[#00ff88] hover:text-[#00dd77]"
                        onClick={() => {
                          // Open contacts page and trigger edit for this contact
                          window.location.href = '/contacts';
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {invoice.fileSize && (
                    <p className="text-xs text-gray-500">
                      Size: {(invoice.fileSize / 1024).toFixed(2)} KB
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

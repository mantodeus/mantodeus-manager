import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Trash2, Upload, ExternalLink, Eye, Download } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// Convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:mime/type;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

export default function Invoices() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [contactFilter, setContactFilter] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: invoices = [], refetch } = trpc.invoices.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const uploadMutation = trpc.invoices.upload.useMutation();
  const deleteMutation = trpc.invoices.delete.useMutation();

  const filteredInvoices = invoices.filter((invoice) => {
    if (projectFilter && invoice.projectId !== parseInt(projectFilter)) return false;
    if (contactFilter && invoice.contactId !== parseInt(contactFilter)) return false;
    return true;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Please select a valid document file (PDF, DOC, DOCX, XLS, XLSX)");
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setIsUploading(true);
    try {
      // Convert file to base64
      const base64Data = await fileToBase64(selectedFile);

      // Upload via server (bypasses CORS)
      await uploadMutation.mutateAsync({
        filename: selectedFile.name,
        mimeType: selectedFile.type || "application/octet-stream",
        fileSize: selectedFile.size,
        base64Data,
        projectId: selectedProjectId ? parseInt(selectedProjectId) : undefined,
        contactId: selectedContactId ? parseInt(selectedContactId) : undefined,
      });

      toast.success("Invoice uploaded successfully");
      setSelectedFile(null);
      setSelectedProjectId("");
      setSelectedContactId("");
      setIsDialogOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      refetch();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to upload invoice";
      toast.error(message);
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Component to handle viewing invoice via file proxy (bypasses CORS)
  function InvoiceViewButton({ fileKey, filename }: { fileKey: string; filename: string }) {
    // Use file proxy instead of presigned URLs (CORS-free)
    const viewUrl = `/api/file-proxy?key=${encodeURIComponent(fileKey)}&filename=${encodeURIComponent(filename)}`;
    const downloadUrl = `/api/file-proxy?key=${encodeURIComponent(fileKey)}&filename=${encodeURIComponent(filename)}&download=true`;

    const handleView = () => {
      window.open(viewUrl, "_blank");
    };

    const handleDownload = () => {
      // Create a link and trigger download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[#00ff88] hover:text-[#00dd77]"
          onClick={handleView}
          title="View"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-blue-400 hover:text-blue-300"
          onClick={handleDownload}
          title="Download"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

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
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-[#00ff88] transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-input"
                  />
                  <label htmlFor="file-input" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400">
                      {selectedFile ? (
                        <span className="text-[#00ff88]">{selectedFile.name}</span>
                      ) : (
                        "Click to select or drag and drop"
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, DOC, DOCX, XLS, XLSX up to 10MB
                    </p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Link to Job (optional)</label>
                <Select 
                  value={selectedJobId || "none"} 
                  onValueChange={(val) => setSelectedJobId(val === "none" ? "" : val)}
                >
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
                <Select 
                  value={selectedContactId || "none"} 
                  onValueChange={(val) => setSelectedContactId(val === "none" ? "" : val)}
                >
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
            const linkedProject = projects.find((p) => p.id === invoice.projectId);
            const linkedContact = contacts.find((c) => c.id === invoice.contactId);

            return (
              <Card key={invoice.id} className="bg-gray-900 border-gray-700 p-4 hover:border-[#00ff88] transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="w-5 h-5 text-[#00ff88] mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-regular text-lg truncate" title={invoice.filename}>
                        {invoice.filename}
                      </h3>
                      <p className="text-gray-400 text-xs">
                        {formatDate(invoice.createdAt)} • {formatFileSize(invoice.fileSize)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <InvoiceViewButton fileKey={invoice.fileKey} filename={invoice.filename} />
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      className="text-red-500 hover:text-red-400 transition-colors flex-shrink-0 p-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
                          window.location.href = '/contacts';
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
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

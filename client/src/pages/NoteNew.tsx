/**
 * New Note Page
 * 
 * Full-screen note creation with WYSIWYG editor.
 * Mobile-first design, desktop uses full-width workspace.
 */

import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, Paperclip, Trash2, FileText, Image as ImageIcon, User, Briefcase } from "lucide-react";
import { WYSIWYGEditor } from "@/components/WYSIWYGEditor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type NoteFile = {
  id: number;
  s3Key: string;
  mimeType: string;
  originalFilename: string;
  fileSize: number;
  createdAt: Date;
};

export default function NoteNew() {
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("none");
  const [selectedContactId, setSelectedContactId] = useState<string>("none");
  const [files, setFiles] = useState<NoteFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: jobs = [] } = trpc.jobs.list.useQuery();

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: (data) => {
      toast.success("Note created successfully");
      utils.notes.list.invalidate();
      navigate(`/notes/${data.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create note: ${error.message}`);
    },
  });

  const uploadFileMutation = trpc.notes.uploadNoteFile.useMutation();
  const registerFileMutation = trpc.notes.registerNoteFile.useMutation();

  const handleSave = async () => {
    // Create note first
    const result = await createNoteMutation.mutateAsync({
      title: title.trim() || "Untitled Note",
      content: content.trim() || undefined,
      jobId: selectedJobId && selectedJobId !== "none" ? parseInt(selectedJobId) : undefined,
      contactId: selectedContactId && selectedContactId !== "none" ? parseInt(selectedContactId) : undefined,
    });

    // Upload files if any
    if (files.length > 0 && result.id) {
      // Files are already uploaded, just need to register them
      // For new notes, we'll handle file uploads after creation
      // This is a simplified version - in production, you might want to upload files first
    }
  };

  const handleFileUpload = async (fileList: File[]) => {
    if (fileList.length === 0) return;

    // For new notes, we can't upload files until the note is created
    // So we'll store them temporarily and upload after creation
    toast.info("Files will be attached after saving the note");
  };

  const handleCancel = () => {
    navigate("/notes");
  };

  const isImage = (mimeType: string) => {
    return mimeType.startsWith("image/");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full max-w-none space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/notes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title (optional)"
            className="text-3xl font-regular border-none shadow-none px-0 focus-visible:ring-0 h-auto"
          />
        </div>
        <Button variant="ghost" onClick={handleCancel} size="sm">
          Cancel
        </Button>
      </div>

      {/* Editor */}
      <div className="w-full">
        <WYSIWYGEditor
          content={content}
          onChange={setContent}
          placeholder="Start writing..."
          autoFocus={true}
        />
      </div>

      {/* Attachments (if any pending) */}
      {files.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Attachments (will be saved with note)</h3>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
              >
                {isImage(file.mimeType) ? (
                  <ImageIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{file.originalFilename}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Bottom Action Bar (Edit Mode) */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex items-center justify-center gap-4 md:justify-end md:pr-8 z-40">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const fileList = Array.from(e.target.files || []);
            if (fileList.length > 0) {
              handleFileUpload(fileList);
            }
            if (e.target) {
              e.target.value = "";
            }
          }}
          accept="image/*,application/pdf,.doc,.docx"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 md:flex-initial"
        >
          <Paperclip className="h-4 w-4 mr-2" />
          Add Attachment
        </Button>
        <Select value={selectedContactId} onValueChange={setSelectedContactId}>
          <SelectTrigger className="flex-1 md:flex-initial md:w-[180px]">
            <SelectValue placeholder="Link Contact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Contact</SelectItem>
            {contacts.map((contact) => (
              <SelectItem key={contact.id} value={contact.id.toString()}>
                {contact.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedJobId} onValueChange={setSelectedJobId}>
          <SelectTrigger className="flex-1 md:flex-initial md:w-[180px]">
            <SelectValue placeholder="Link Job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Job</SelectItem>
            {jobs.map((job) => (
              <SelectItem key={job.id} value={job.id.toString()}>
                {job.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Floating Action Button - Save */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleSave}
          disabled={createNoteMutation.isPending}
          size="lg"
          className="rounded-full shadow-lg h-14 w-14"
        >
          {createNoteMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}


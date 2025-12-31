/**
 * Note Detail Page
 * 
 * Apple Notes-style UX:
 * - Preview mode (default): Read-only markdown rendering, attachments display
 * - Edit mode: Markdown editor with toolbar, attachment management
 * - Full-width workspace on desktop, full-screen on mobile
 */

import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Edit, Save, X, Loader2, Paperclip, Trash2, Download, Image as ImageIcon, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { WYSIWYGEditor } from "@/components/WYSIWYGEditor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "@/components/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


// Image thumbnail component with lazy loading
function ImageThumbnail({ file, onView }: { file: NoteFile; onView: (file: NoteFile) => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const utils = trpc.useUtils();

  useEffect(() => {
    let cancelled = false;
    utils.notes.getNoteFileUrl
      .fetch({ fileId: file.id })
      .then((result) => {
        if (!cancelled) {
          setImageUrl(result.url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file.id, utils]);

  return (
    <div className="relative w-full h-full bg-muted">
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={file.originalFilename}
            className="w-full h-full object-cover"
            onError={() => onView(file)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Download className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

type NoteFile = {
  id: number;
  s3Key: string;
  mimeType: string;
  originalFilename: string;
  fileSize: number;
  createdAt: Date;
};

type Note = {
  id: number;
  title: string;
  content: string | null;
  tags: string | null;
  jobId: number | null;
  contactId: number | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date | null;
  trashedAt?: Date | null;
  files?: NoteFile[];
};

export default function NoteDetail() {
  const [, params] = useRoute("/notes/:id");
  const noteId = params?.id ? parseInt(params.id, 10) : null;
  
  // Validate noteId is a valid number
  const isValidNoteId = noteId !== null && !isNaN(noteId) && noteId > 0;

  const [isEditMode, setIsEditMode] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("none");
  const [selectedContactId, setSelectedContactId] = useState<string>("none");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track last saved content to prevent unnecessary saves
  const lastSavedContentRef = useRef<{
    title: string;
    body: string;
    jobId: string;
    contactId: string;
  } | null>(null);

  // Track if an update request is in flight
  const updateInFlightRef = useRef(false);
  // Track if another save is pending after current one completes
  const pendingSaveRef = useRef(false);

  // Debounce title and body for autosave (increased to 2000ms for mobile typing latency)
  const debouncedTitle = useDebounce(title, 2000);
  const debouncedBody = useDebounce(body, 2000);
  const debouncedJobId = useDebounce(selectedJobId, 2000);
  const debouncedContactId = useDebounce(selectedContactId, 2000);

  const utils = trpc.useUtils();
  const { data: note, isLoading, error, refetch } = trpc.notes.getById.useQuery(
    { id: noteId! },
    { enabled: isValidNoteId }
  );
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: jobs = [] } = trpc.jobs.list.useQuery();

  const updateMutation = trpc.notes.update.useMutation({
    onSuccess: () => {
      const timestamp = new Date().toISOString();
      console.log(`[NOTES_DETAIL] ${timestamp} | UPDATE_SUCCESS | note: ${noteId}`);
      
      updateInFlightRef.current = false;
      setSaveStatus("saved");
      
      // Update last saved content (DO NOT overwrite editor state)
      lastSavedContentRef.current = {
        title: debouncedTitle.trim(),
        body: debouncedBody.trim() || "",
        jobId: debouncedJobId,
        contactId: debouncedContactId,
      };
      
      // Invalidate cache to update metadata (refetch happens automatically when needed)
      // Editor state remains source of truth during editing - we don't refetch here
      // to avoid overwriting editor content
      utils.notes.list.invalidate();
      utils.notes.getById.invalidate({ id: noteId });
      
      // Reset saved status after 2 seconds
      setTimeout(() => {
        setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
      }, 2000);
      
      // If another save was pending, trigger it now
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        // Trigger autosave check (will be handled by useEffect)
        setTimeout(() => {
          // Force re-evaluation of autosave conditions
        }, 100);
      }
    },
    onError: (err) => {
      const timestamp = new Date().toISOString();
      console.error(`[NOTES_DETAIL] ${timestamp} | UPDATE_ERROR | note: ${noteId} | error: ${err.message}`);
      
      updateInFlightRef.current = false;
      setSaveStatus("error");
      toast.error(err.message || "Failed to save note");
      // Reset error status after 3 seconds
      setTimeout(() => {
        setSaveStatus((prev) => (prev === "error" ? "idle" : prev));
      }, 3000);
    },
  });

  // SAFE AUTOSAVE: Only update, with concurrency control and change detection
  useEffect(() => {
    const timestamp = new Date().toISOString();
    
    // Rule 3.1: Autosave may run only if in edit mode and valid note id exists
    if (!isEditMode || !noteId) return;
    if (!note) return; // Don't autosave until note is loaded
    
    // Rule 3.1: Skip if no changes exist
    const currentContent = {
      title: debouncedTitle.trim(),
      body: debouncedBody.trim() || "",
      jobId: debouncedJobId,
      contactId: debouncedContactId,
    };
    
    // Compare against last saved content (not original note, to handle rapid edits)
    if (lastSavedContentRef.current) {
      const hasChanges = 
        currentContent.title !== lastSavedContentRef.current.title ||
        currentContent.body !== lastSavedContentRef.current.body ||
        currentContent.jobId !== lastSavedContentRef.current.jobId ||
        currentContent.contactId !== lastSavedContentRef.current.contactId;
      
      if (!hasChanges) {
        return; // No changes since last save
      }
    } else {
      // First autosave - compare against original note
      const hasChanges = 
        currentContent.title !== (note.title || "") ||
        currentContent.body !== (note.content || "") ||
        currentContent.jobId !== (note.jobId?.toString() || "none") ||
        currentContent.contactId !== (note.contactId?.toString() || "none");
      
      if (!hasChanges) {
        return; // No changes from original
      }
    }
    
    // Rule 3.3: Concurrency control - at most one save in flight
    if (updateInFlightRef.current) {
      console.log(`[NOTES_DETAIL] ${timestamp} | AUTOSAVE_SKIP | note: ${noteId} | reason: save_in_flight`);
      pendingSaveRef.current = true; // Mark that another save is pending
      return;
    }
    
    // Rule 3.1: Don't autosave if title is empty
    if (!debouncedTitle.trim()) return;
    
    // All checks passed - perform autosave
    console.log(`[NOTES_DETAIL] ${timestamp} | AUTOSAVE_TRIGGER | note: ${noteId}`);
    updateInFlightRef.current = true;
    setSaveStatus("saving");
    
    updateMutation.mutate({
      id: noteId,
      title: currentContent.title,
      body: currentContent.body || undefined,
      jobId: currentContent.jobId && currentContent.jobId !== "none" ? parseInt(currentContent.jobId) : undefined,
      contactId: currentContent.contactId && currentContent.contactId !== "none" ? parseInt(currentContent.contactId) : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, debouncedBody, debouncedJobId, debouncedContactId, isEditMode, noteId]);

  const uploadFileMutation = trpc.notes.uploadNoteFile.useMutation();
  const registerFileMutation = trpc.notes.registerNoteFile.useMutation();
  const deleteFileMutation = trpc.notes.deleteNoteFile.useMutation({
    onSuccess: () => {
      toast.success("Attachment removed");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove attachment");
    },
  });

  const getFileUrlQuery = trpc.notes.getNoteFileUrl.useQuery(
    { fileId: 0 }, // Dummy, will be called manually
    { enabled: false }
  );

  // Initialize form when note loads (only when not editing to prevent overwriting editor state)
  useEffect(() => {
    if (note && !isEditMode) {
      setTitle(note.title);
      setBody(note.content || "");
      setSelectedJobId(note.jobId?.toString() || "none");
      setSelectedContactId(note.contactId?.toString() || "none");
      
      // Initialize last saved content
      lastSavedContentRef.current = {
        title: note.title,
        body: note.content || "",
        jobId: note.jobId?.toString() || "none",
        contactId: note.contactId?.toString() || "none",
      };
    }
  }, [note, isEditMode]);

  // Focus editor when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isEditMode]);

  const handleSave = () => {
    const timestamp = new Date().toISOString();
    console.log(`[NOTES_DETAIL] ${timestamp} | MANUAL_SAVE | note: ${noteId}`);
    
    if (!noteId) return;
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setSaveStatus("saving");
    updateMutation.mutate({
      id: noteId,
      title: title.trim(),
      body: body.trim() || undefined,
      jobId: selectedJobId && selectedJobId !== "none" ? parseInt(selectedJobId) : undefined,
      contactId: selectedContactId && selectedContactId !== "none" ? parseInt(selectedContactId) : undefined,
    });
  };

  const handleCancel = () => {
    if (note) {
      // Restore original values from note (editor is source of truth until cancelled)
      setTitle(note.title);
      setBody(note.content || "");
      setSelectedJobId(note.jobId?.toString() || "none");
      setSelectedContactId(note.contactId?.toString() || "none");
      
      // Reset last saved content to original
      lastSavedContentRef.current = {
        title: note.title,
        body: note.content || "",
        jobId: note.jobId?.toString() || "none",
        contactId: note.contactId?.toString() || "none",
      };
    }
    setIsEditMode(false);
  };

  const handleFileUpload = async (files: File[]) => {
    if (!noteId || files.length === 0) return;

    let successCount = 0;
    let failureCount = 0;

    for (const file of files) {
      try {
        const { uploadUrl, s3Key } = await uploadFileMutation.mutateAsync({
          noteId,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });

        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Storage upload failed (${uploadResponse.status})`);
        }

        await registerFileMutation.mutateAsync({
          noteId,
          s3Key,
          mimeType: file.type,
          originalFilename: file.name,
          fileSize: file.size,
        });

        successCount += 1;
      } catch (error) {
        console.error("Failed to upload file:", file.name, error);
        failureCount += 1;
      }
    }

    if (successCount > 0 && failureCount === 0) {
      toast.success("Attachment uploaded successfully");
    } else if (failureCount > 0) {
      toast.error(
        `Uploaded ${successCount} file${successCount === 1 ? "" : "s"} with ${failureCount} failure${failureCount === 1 ? "" : "s"}`
      );
    }

    if (successCount > 0) {
      await refetch();
    }
  };

  const handleFileDelete = (fileId: number) => {
    deleteFileMutation.mutate({ id: fileId });
  };

  const handleFileView = async (file: NoteFile) => {
    try {
      const result = await utils.notes.getNoteFileUrl.fetch({ fileId: file.id });
      window.open(result.url, "_blank");
    } catch (error) {
      toast.error("Failed to open file");
    }
  };


  const isImage = (mimeType: string) => {
    return mimeType.startsWith("image/");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const actionHeader = <PageHeader />;

  if (!isValidNoteId) {
    return (
      <div className="w-full space-y-6">
        {actionHeader}
        <div className="flex items-center gap-4">
          <Link href="/notes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-regular">Invalid Note ID</h1>
          </div>
        </div>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">The note ID is invalid.</p>
          <Link href="/notes">
            <Button variant="outline" className="mt-4">
              Back to Notes
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        {actionHeader}
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || (!isLoading && !note)) {
    return (
      <div className="w-full space-y-6">
        {actionHeader}
        <div className="flex items-center gap-4">
          <Link href="/notes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-regular">Note not found</h1>
          </div>
        </div>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">The note you're looking for doesn't exist or has been deleted.</p>
          <Link href="/notes">
            <Button variant="outline" className="mt-4">
              Back to Notes
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const files = note.files || [];

  return (
    <div className="w-full max-w-none space-y-6 pb-24">
      <PageHeader />
      <div className="flex items-center gap-4">
        <Link href="/notes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          {isEditMode ? (
            <Input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              className="text-3xl font-regular border-none shadow-none px-0 focus-visible:ring-0"
            />
          ) : (
            <h1 className="text-3xl font-regular">{note.title}</h1>
          )}
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-sm">
              {new Date(note.updatedAt).toLocaleDateString()}
            </p>
            {isEditMode && saveStatus !== "idle" && (
              <div className="flex items-center gap-1 text-xs">
                {saveStatus === "saving" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Saving...</span>
                  </>
                )}
                {saveStatus === "saved" && (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    <span className="text-primary">Saved</span>
                  </>
                )}
                {saveStatus === "error" && (
                  <>
                    <AlertCircle className="h-3 w-3 text-destructive" />
                    <span className="text-destructive">Error</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {isEditMode && (
          <Button variant="ghost" onClick={handleCancel} size="sm">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="w-full">
        {isEditMode ? (
          <div className="space-y-4">
            {/* WYSIWYG Editor */}
            <WYSIWYGEditor
              content={body}
              onChange={setBody}
              placeholder="Start writing..."
              autoFocus={true}
            />

            {/* Attachments in Edit Mode */}
            {files.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3">Attachments</h3>
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleFileDelete(file.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

          </div>
        ) : (
          <div className="space-y-6">
            {/* Markdown Preview */}
            {note.content ? (
              <Card className="p-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{note.content}</Markdown>
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No content yet. Tap Edit to start writing.</p>
              </Card>
            )}

            {/* Attachments in Preview Mode */}
            {files.length > 0 && (
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3">Attachments</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className={cn(
                        "relative group rounded-lg overflow-hidden border cursor-pointer hover:border-primary transition-colors",
                        isImage(file.mimeType) ? "aspect-square" : "p-4"
                      )}
                      onClick={() => handleFileView(file)}
                    >
                      {isImage(file.mimeType) ? (
                        <ImageThumbnail file={file} onView={handleFileView} />
                      ) : (
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.originalFilename}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Bar (Edit Mode Only) */}
      {isEditMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex items-center justify-center gap-4 md:justify-end md:pr-8 z-40">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                handleFileUpload(files);
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
            disabled={uploadFileMutation.isPending || registerFileMutation.isPending}
            className="flex-1 md:flex-initial"
          >
            <Paperclip className="h-4 w-4 mr-2" />
            {uploadFileMutation.isPending || registerFileMutation.isPending
              ? "Uploading..."
              : "Add Attachment"}
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
      )}

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {isEditMode ? (
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            size="lg"
            className="rounded-full shadow-lg h-14 w-14"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
          </Button>
        ) : (
          <Button
            onClick={() => setIsEditMode(true)}
            size="lg"
            className="rounded-full shadow-lg h-14 w-14"
          >
            <Edit className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}


/**
 * New Note Page
 * 
 * Full-screen note creation with WYSIWYG editor.
 * Mobile-first design, desktop uses full-width workspace.
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, Paperclip, Trash2, FileText, Image as ImageIcon, User, Briefcase, CheckCircle2, AlertCircle } from "@/components/ui/Icon";
import { SimpleMarkdownEditor } from "@/components/SimpleMarkdownEditor";
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
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none");
  const [selectedContactId, setSelectedContactId] = useState<string>("none");
  const [files, setFiles] = useState<NoteFile[]>([]);
  const [noteId, setNoteId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();

  // Generate stable client creation key for idempotent creation (once per component mount)
  const clientCreationKey = useMemo(() => {
    return `note_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }, []);

  // Track last saved content to prevent unnecessary saves
  const lastSavedContentRef = useRef<{
    title: string;
    content: string;
    jobId: string;
    contactId: string;
  } | null>(null);

  // Track if a create request is in flight
  const createInFlightRef = useRef(false);
  // Track if an update request is in flight
  const updateInFlightRef = useRef(false);
  // Track if another save is pending after current one completes
  const pendingSaveRef = useRef(false);

  // Debounce values for autosave (increased to 2000ms for mobile typing latency)
  const debouncedTitle = useDebounce(title, 2000);
  const debouncedContent = useDebounce(content, 2000);
  const debouncedProjectId = useDebounce(selectedProjectId, 2000);
  const debouncedContactId = useDebounce(selectedContactId, 2000);

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: (data) => {
      const timestamp = new Date().toISOString();
      console.log(`[NOTES_NEW] ${timestamp} | CREATE_SUCCESS | note: ${data.id} | key: ${clientCreationKey}`);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:79',message:'note creation success',data:{noteId:data.id,clientCreationKey,previousNoteId:noteId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      createInFlightRef.current = false;
      setNoteId(data.id);
      setSaveStatus("saved");
      
      // Update last saved content
      lastSavedContentRef.current = {
        title: debouncedTitle.trim() || "Untitled Note",
        content: debouncedContent.trim() || "",
        jobId: debouncedProjectId,
        contactId: debouncedContactId,
      };
      
      utils.notes.list.invalidate();
      
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
    onError: (error) => {
      const timestamp = new Date().toISOString();
      console.error(`[NOTES_NEW] ${timestamp} | CREATE_ERROR | key: ${clientCreationKey} | error: ${error.message}`);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:111',message:'note creation error',data:{error:error.message,clientCreationKey,createInFlight:createInFlightRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      createInFlightRef.current = false;
      setSaveStatus("error");
      toast.error(`Failed to create note: ${error.message}`);
      setTimeout(() => {
        setSaveStatus((prev) => (prev === "error" ? "idle" : prev));
      }, 3000);
    },
  });

  const updateNoteMutation = trpc.notes.update.useMutation({
    onSuccess: () => {
      const timestamp = new Date().toISOString();
      console.log(`[NOTES_NEW] ${timestamp} | UPDATE_SUCCESS | note: ${noteId}`);
      
      updateInFlightRef.current = false;
      setSaveStatus("saved");
      
      // Update last saved content
      lastSavedContentRef.current = {
        title: debouncedTitle.trim() || "Untitled Note",
        content: debouncedContent.trim() || "",
        jobId: debouncedProjectId,
        contactId: debouncedContactId,
      };
      
      utils.notes.list.invalidate();
      
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
    onError: (error) => {
      const timestamp = new Date().toISOString();
      console.error(`[NOTES_NEW] ${timestamp} | UPDATE_ERROR | note: ${noteId} | error: ${error.message}`);
      
      updateInFlightRef.current = false;
      setSaveStatus("error");
      toast.error(`Failed to save note: ${error.message}`);
      setTimeout(() => {
        setSaveStatus((prev) => (prev === "error" ? "idle" : prev));
      }, 3000);
    },
  });

  const uploadFileMutation = trpc.notes.uploadNoteFile.useMutation();
  const registerFileMutation = trpc.notes.registerNoteFile.useMutation();

  // SAFE AUTOSAVE: Only update, never create. Creation happens on explicit save or first meaningful change.
  useEffect(() => {
    const timestamp = new Date().toISOString();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:173',message:'autosave effect triggered',data:{noteId,updateInFlight:updateInFlightRef.current,debouncedTitleLength:debouncedTitle.length,debouncedContentLength:debouncedContent.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    // Rule 3.1: Autosave may run only if valid note id exists
    if (!noteId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:177',message:'autosave skipped - no noteId',data:{noteId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Autosave never creates - creation happens via explicit save button or first change handler
      return;
    }
    
    // Rule 3.1: Skip if no changes exist
    const currentContent = {
      title: debouncedTitle.trim() || "Untitled Note",
      content: debouncedContent.trim() || "",
      jobId: debouncedProjectId,
      contactId: debouncedContactId,
    };
    
    if (lastSavedContentRef.current) {
      const hasChanges = 
        currentContent.title !== lastSavedContentRef.current.title ||
        currentContent.content !== lastSavedContentRef.current.content ||
        currentContent.jobId !== lastSavedContentRef.current.jobId ||
        currentContent.contactId !== lastSavedContentRef.current.contactId;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:191',message:'change detection',data:{hasChanges,titleChanged:currentContent.title!==lastSavedContentRef.current.title,contentChanged:currentContent.content!==lastSavedContentRef.current.content,currentContentLength:currentContent.content.length,lastSavedLength:lastSavedContentRef.current.content.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      if (!hasChanges) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:197',message:'no changes, skipping autosave',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return; // No changes, skip autosave
      }
    }
    
    // Rule 3.3: Concurrency control - at most one save in flight
    if (updateInFlightRef.current) {
      console.log(`[NOTES_NEW] ${timestamp} | AUTOSAVE_SKIP | note: ${noteId} | reason: save_in_flight`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:203',message:'autosave skipped - update in flight',data:{noteId,updateInFlight:updateInFlightRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      pendingSaveRef.current = true; // Mark that another save is pending
      return;
    }
    
    // Rule 3.1: Don't autosave if title is empty
    if (!debouncedTitle.trim()) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:210',message:'autosave skipped - empty title',data:{noteId,titleLength:debouncedTitle.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    // All checks passed - perform autosave
    console.log(`[NOTES_NEW] ${timestamp} | AUTOSAVE_TRIGGER | note: ${noteId}`);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:215',message:'triggering autosave',data:{noteId,title:currentContent.title.substring(0,20),contentLength:currentContent.content.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    updateInFlightRef.current = true;
    setSaveStatus("saving");
    
    updateNoteMutation.mutate({
      id: noteId,
      title: currentContent.title,
      body: currentContent.content || undefined,
      jobId: currentContent.jobId && currentContent.jobId !== "none" ? parseInt(currentContent.jobId) : undefined,
      contactId: currentContent.contactId && currentContent.contactId !== "none" ? parseInt(currentContent.contactId) : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, debouncedContent, debouncedProjectId, debouncedContactId, noteId]);
  
  // Separate effect for initial note creation (on first meaningful change)
  useEffect(() => {
    const timestamp = new Date().toISOString();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:230',message:'note creation effect triggered',data:{noteId,createInFlight:createInFlightRef.current,debouncedTitle:debouncedTitle.substring(0,20),debouncedContentLength:debouncedContent.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Only create if note doesn't exist yet and we have content
    if (noteId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:234',message:'note already exists, skipping',data:{noteId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return; // Note already exists
    }
    if (createInFlightRef.current) {
      console.log(`[NOTES_NEW] ${timestamp} | CREATE_SKIP | reason: create_in_flight`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:237',message:'create in flight, skipping',data:{createInFlight:createInFlightRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return; // Create already in flight
    }
    
    // Check if we have any content (title or body)
    const hasTitle = debouncedTitle.trim().length > 0;
    const hasContent = debouncedContent.trim().length > 0;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:243',message:'content check',data:{hasTitle,hasContent,titleLength:debouncedTitle.length,contentLength:debouncedContent.length,contentPreview:debouncedContent.substring(0,30)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Don't create if both are empty
    if (!hasTitle && !hasContent) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:246',message:'no content, skipping creation',data:{hasTitle,hasContent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return; // No content yet
    }
    
    // Create note on first meaningful change (with idempotency key)
    console.log(`[NOTES_NEW] ${timestamp} | CREATE_TRIGGER | key: ${clientCreationKey} | title: ${hasTitle} | content: ${hasContent}`);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/16f098e1-fe8b-46cb-be1e-f0f07a5af48a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoteNew.tsx:251',message:'triggering note creation',data:{clientCreationKey,hasTitle,hasContent,title:debouncedTitle.trim()||'Untitled Note',contentLength:debouncedContent.trim().length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    createInFlightRef.current = true;
    setSaveStatus("saving");
    
    createNoteMutation.mutate({
      title: debouncedTitle.trim() || "Untitled Note",
      content: debouncedContent.trim() || undefined,
      jobId: debouncedProjectId && debouncedProjectId !== "none" ? parseInt(debouncedProjectId) : undefined,
      contactId: debouncedContactId && debouncedContactId !== "none" ? parseInt(debouncedContactId) : undefined,
      clientCreationKey: clientCreationKey,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, debouncedContent, debouncedProjectId, debouncedContactId, clientCreationKey]);

  const handleSave = async () => {
    const timestamp = new Date().toISOString();
    console.log(`[NOTES_NEW] ${timestamp} | MANUAL_SAVE | note: ${noteId || 'new'}`);
    
    if (!noteId) {
      // Create note if it doesn't exist (with idempotency key)
      const result = await createNoteMutation.mutateAsync({
        title: title.trim() || "Untitled Note",
        content: content.trim() || undefined,
        jobId: selectedProjectId && selectedProjectId !== "none" ? parseInt(selectedProjectId) : undefined,
        contactId: selectedContactId && selectedContactId !== "none" ? parseInt(selectedContactId) : undefined,
        clientCreationKey: clientCreationKey,
      });
      setNoteId(result.id);
      navigate(`/notes/${result.id}`);
    } else {
      // Update and navigate
      await updateNoteMutation.mutateAsync({
        id: noteId,
        title: title.trim() || "Untitled Note",
        body: content.trim() || undefined,
        jobId: selectedProjectId && selectedProjectId !== "none" ? parseInt(selectedProjectId) : undefined,
        contactId: selectedContactId && selectedContactId !== "none" ? parseInt(selectedContactId) : undefined,
      });
      navigate(`/notes/${noteId}`);
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
    <div className="w-full max-w-none space-y-6 pb-24 md:pb-24 [--notes-action-bar-height:0px] md:[--notes-action-bar-height:72px]" style={{ paddingBottom: 'calc(var(--bottom-safe-area, 0px) + 6rem)' }}>
      <PageHeader />
      
      {/* Title Section */}
      <div className="flex items-center gap-4">
        <Link href="/notes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title (optional)"
              className="text-3xl font-regular border-none shadow-none px-0 focus-visible:ring-0 h-auto"
            />
            {saveStatus !== "idle" && (
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
      </div>

      {/* Top-of-Page Action Row */}
      <div className="flex items-center justify-end gap-2 pb-2 border-b">
        <Button variant="outline" onClick={handleCancel} size="sm">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={createNoteMutation.isPending}
          size="sm"
        >
          {createNoteMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </div>

      {/* Editor */}
      <div className="w-full">
        <SimpleMarkdownEditor
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
      <div className="fixed left-0 right-0 bg-background border-t p-4 flex items-center justify-center gap-4 md:justify-end md:pr-8 z-40 md:bottom-0" style={{ bottom: 'var(--bottom-safe-area, 0px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
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
          Attachment
        </Button>
        <Select value={selectedContactId} onValueChange={setSelectedContactId}>
          <SelectTrigger className="flex-1 md:flex-initial md:w-[140px]">
            <SelectValue placeholder="Contact" />
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
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="flex-1 md:flex-initial md:w-[140px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Project</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id.toString()}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

    </div>
  );
}


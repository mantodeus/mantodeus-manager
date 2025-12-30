/**
 * WYSIWYG Editor Component using TipTap
 * 
 * Provides a rich text editor that:
 * - Shows formatted text (no markdown syntax visible)
 * - Serializes to markdown for storage
 * - Deserializes from markdown for editing
 * - Toolbar with active state indicators
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { marked } from "marked";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Heading1, Heading2, List, CheckSquare, Code, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface WYSIWYGEditorProps {
  content: string; // Markdown content
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

// Initialize Turndown service for HTML → Markdown conversion
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});
turndownService.use(gfm); // Enable GitHub Flavored Markdown (task lists, etc.)

// Configure marked for markdown → HTML conversion
marked.setOptions({
  breaks: true,
  gfm: true,
});

export function WYSIWYGEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  className,
  autoFocus = false,
}: WYSIWYGEditorProps) {
  const isUpdatingFromProp = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-4 py-3",
      },
    },
    onUpdate: ({ editor }) => {
      // Only convert to markdown if update came from user, not from prop change
      if (!isUpdatingFromProp.current) {
        const html = editor.getHTML();
        const markdown = turndownService.turndown(html);
        onChange(markdown);
      }
    },
  });

  // Update editor content when prop changes (convert markdown to HTML for TipTap)
  useEffect(() => {
    if (!editor) return;

    // Convert markdown to HTML using marked
    const markdownToHtml = (md: string): string => {
      if (!md) return "";
      try {
        return marked.parse(md) as string;
      } catch (error) {
        console.error("Error parsing markdown:", error);
        return md; // Fallback to raw content
      }
    };

    const currentHtml = editor.getHTML();
    const expectedHtml = markdownToHtml(content || "");
    
    // Only update if content actually changed
    if (currentHtml !== expectedHtml && content !== undefined) {
      isUpdatingFromProp.current = true;
      editor.commands.setContent(expectedHtml || "");
      // Reset flag after a brief delay
      setTimeout(() => {
        isUpdatingFromProp.current = false;
      }, 100);
    }
  }, [content, editor]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editor) {
      setTimeout(() => {
        editor.commands.focus();
      }, 100);
    }
  }, [autoFocus, editor]);

  if (!editor) {
    return null;
  }

  const isActive = (name: string, options?: any) => {
    return editor.isActive(name, options);
  };

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleHeading1 = () => editor.chain().focus().toggleHeading({ level: 1 }).run();
  const toggleHeading2 = () => editor.chain().focus().toggleHeading({ level: 2 }).run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleTaskList = () => editor.chain().focus().toggleTaskList().run();
  const toggleCode = () => editor.chain().focus().toggleCode().run();
  const setLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    } else if (url === "") {
      editor.chain().focus().unsetLink().run();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-muted/50">
        <Button
          variant={isActive("bold") ? "default" : "ghost"}
          size="sm"
          onClick={toggleBold}
          title="Bold"
          type="button"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={isActive("italic") ? "default" : "ghost"}
          size="sm"
          onClick={toggleItalic}
          title="Italic"
          type="button"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button
          variant={isActive("heading", { level: 1 }) ? "default" : "ghost"}
          size="sm"
          onClick={toggleHeading1}
          title="Heading 1"
          type="button"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant={isActive("heading", { level: 2 }) ? "default" : "ghost"}
          size="sm"
          onClick={toggleHeading2}
          title="Heading 2"
          type="button"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button
          variant={isActive("bulletList") ? "default" : "ghost"}
          size="sm"
          onClick={toggleBulletList}
          title="Bullet List"
          type="button"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant={isActive("taskList") ? "default" : "ghost"}
          size="sm"
          onClick={toggleTaskList}
          title="Checklist"
          type="button"
        >
          <CheckSquare className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button
          variant={isActive("code") ? "default" : "ghost"}
          size="sm"
          onClick={toggleCode}
          title="Code"
          type="button"
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          variant={isActive("link") ? "default" : "ghost"}
          size="sm"
          onClick={setLink}
          title="Link"
          type="button"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <div className="border rounded-md bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

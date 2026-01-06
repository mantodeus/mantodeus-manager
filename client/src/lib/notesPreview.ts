/**
 * Notes Preview Helper
 * 
 * Extracts plain text from markdown content for list previews.
 * Preserves paragraph structure by converting multiple newlines to separators.
 */

/**
 * Convert markdown content to plain text preview
 * - Removes markdown syntax
 * - Converts multiple newlines to " · " separator
 * - Preserves single newlines as spaces
 * - Does NOT trim meaningful whitespace from stored body
 */
export function extractNotePreview(content: string | null): string {
  if (!content) return "";
  
  // Remove markdown syntax for preview
  let text = content
    .replace(/#{1,6}\s+/g, "") // Remove headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
    .replace(/\*([^*]+)\*/g, "$1") // Remove italic
    .replace(/~~([^~]+)~~/g, "$1") // Remove strikethrough
    .replace(/`([^`]+)`/g, "$1") // Remove inline code
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1"); // Remove links
  
  // Convert multiple consecutive newlines to paragraph separator
  // This preserves the paragraph structure feel
  text = text.replace(/\n{2,}/g, " · ");
  
  // Convert single newlines to spaces (for line breaks within paragraphs)
  text = text.replace(/\n/g, " ");
  
  // Only trim leading/trailing whitespace from the final preview string
  // (not the original content)
  return text.trim();
}


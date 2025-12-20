# PDF Pipeline Architecture

## Overview

The PDF pipeline uses a dedicated Fly.io microservice (wkhtmltopdf) for stable, browser-free PDF generation. All PDF logic is server-side only.

## Architecture

### 1. PDF Service (`server/services/pdfService.ts`)

**Single reusable client** for calling the Fly.io PDF service.

- Accepts HTML + options
- Returns PDF Buffer
- Handles timeouts (30s), errors, retries
- Never exposes secrets to client

**Usage:**
```typescript
import { renderPDF } from "./services/pdfService";

const pdfBuffer = await renderPDF(html, {
  format: "A4",
  margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  printBackground: true,
});
```

### 2. Document Renderers (`server/templates/`)

**Pure HTML generators** - no PDF logic, no fetch calls.

- `invoice.ts` - Invoice HTML
- `projectReport.ts` - Project report HTML  
- `inspection.ts` - Inspection HTML

**Pattern:**
```typescript
export function generateInvoiceHTML(data: InvoiceData): string {
  // Return complete HTML string with inline CSS
  // No external dependencies, no async calls
}
```

### 3. Controller Endpoints

**REST endpoints** for direct PDF streaming:

- `GET /api/projects/:id/pdf` - Stream project report PDF
- Future: `GET /api/invoices/:id/pdf`, `GET /api/inspections/:id/pdf`

**Flow:**
1. Authenticate user
2. Load data from DB
3. Call renderer → HTML
4. Call `renderPDF(html)` → Buffer
5. Stream to client with proper headers

### 4. tRPC Router (`server/pdfRouter.ts`)

**Existing tRPC endpoints** updated to use new service:

- `pdf.generateProjectReport` - Generate and store PDF
- `pdf.generateInvoice` - Generate and store PDF
- `pdf.createShareLink` - Create shareable link

## Environment Variables

Add to `.env`:

```env
PDF_SERVICE_URL=https://pdf-service-withered-star-4195.fly.dev/render
PDF_SERVICE_SECRET=dh763h76ytrdnskdi7fiwufg9w8rypq9834q8y048yq04
```

## Frontend Usage

### View PDF (opens in new tab)

```typescript
const handleViewPDF = () => {
  window.open(`/api/projects/${projectId}/pdf`, '_blank');
};
```

### Download PDF

```typescript
const handleDownloadPDF = async () => {
  try {
    const response = await fetch(`/api/projects/${projectId}/pdf`);
    if (!response.ok) throw new Error('Failed to generate PDF');
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-${projectId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    toast.error('Failed to download PDF');
  }
};
```

### Using tRPC (for stored PDFs)

```typescript
const { mutate: generatePDF } = trpc.pdf.generateProjectReport.useMutation({
  onSuccess: (data) => {
    window.open(data.shareUrl, '_blank');
  },
  onError: (error) => {
    toast.error(error.message);
  },
});

// Generate PDF
generatePDF({ projectId: 123 });
```

## Error Handling

The PDF service throws `PDFServiceError` with:
- `statusCode` - HTTP status
- `message` - User-friendly message
- `originalError` - Original error for logging

**Common errors:**
- `408` - Timeout (retry)
- `503` - Service unavailable (retry)
- `500` - Generation failed (check logs)

## Extending for New Document Types

1. **Create renderer** in `server/templates/`:
   ```typescript
   export function generateMyDocHTML(data: MyDocData): string {
     return `<!DOCTYPE html>...`;
   }
   ```

2. **Add REST endpoint** in `server/_core/index.ts`:
   ```typescript
   app.get("/api/mydocs/:id/pdf", async (req, res) => {
     const user = await supabaseAuth.authenticateRequest(req);
     // Load data, render HTML, call renderPDF, stream
   });
   ```

3. **Or add tRPC procedure** in `server/pdfRouter.ts`:
   ```typescript
   generateMyDoc: protectedProcedure
     .input(z.object({ id: z.number() }))
     .mutation(async ({ input, ctx }) => {
       // Generate HTML, call renderPDF, store, return shareUrl
     })
   ```

## Design Principles

- ✅ **Server-side only** - No client PDF generation
- ✅ **Single service** - One PDF client, many document types
- ✅ **Pure renderers** - HTML only, no side effects
- ✅ **Streaming** - Direct PDF streaming for performance
- ✅ **Type-safe** - Full TypeScript coverage
- ✅ **Error handling** - Structured errors, user-friendly messages


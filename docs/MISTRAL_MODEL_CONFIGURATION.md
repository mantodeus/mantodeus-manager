# Mistral Model Configuration

## Overview

Mantodeus Manager uses Mistral AI for two distinct purposes, each with specialized models:

1. **AI Assistant (Manto)** - Interactive chat assistant for helping users
2. **OCR / Document Extraction** - Automated invoice/receipt data extraction

## Model Usage

### AI Assistant (Manto)
- **Model**: `mistral-medium-latest` (default)
- **Usage**: Interactive AI assistant in the app
- **Configuration**: `AI_ASSISTANT_MODEL` environment variable
- **Code Reference**: `server/aiRouter.ts` - Uses `ENV.aiAssistantModel`

### OCR / Document Extraction
- **Model**: `mistral-ocr-latest` (default)
- **Usage**: 
  - Step 1: OCR API extracts markdown from documents
  - Step 2: Chat API extracts structured invoice data from markdown
- **Configuration**: `OCR_EXTRACTION_MODEL` environment variable
- **Code Reference**: `server/services/ai/document/documentOcrClient.ts` - Uses `ENV.ocrExtractionModel`

## Why Different Models?

**mistral-ocr-latest** is specifically optimized for:
- Document understanding and OCR tasks
- Invoice/receipt data extraction
- Structured data parsing from documents
- High accuracy for financial documents

**mistral-medium-latest** is optimized for:
- Interactive chat conversations
- General-purpose assistance
- Natural language understanding
- Creative responses and guidance

## Environment Variables

Add to your `.env` file:

```bash
# AI Assistant (Manto) - for interactive chat
AI_ASSISTANT_MODEL=mistral-medium-latest
AI_ASSISTANT_ENABLED=true
AI_ASSISTANT_TIMEOUT_MS=15000

# OCR / Document Extraction - for invoice processing
OCR_EXTRACTION_MODEL=mistral-ocr-latest

# Shared API Key
MISTRAL_API_KEY=your_mistral_api_key_here
```

## Code Architecture

### Environment Configuration
**File**: `server/_core/env.ts`

```typescript
export const ENV = {
  // AI Assistant (OPTIONAL)
  mistralApiKey: process.env.MISTRAL_API_KEY || "",
  aiAssistantEnabled: process.env.AI_ASSISTANT_ENABLED === "true",
  aiAssistantModel: process.env.AI_ASSISTANT_MODEL || "mistral-medium-latest",
  aiAssistantTimeoutMs: Number(process.env.AI_ASSISTANT_TIMEOUT_MS) || 15000,
  
  // OCR / Document Extraction (uses mistral-ocr-latest by default)
  ocrExtractionModel: process.env.OCR_EXTRACTION_MODEL || "mistral-ocr-latest",
};
```

### AI Assistant Usage
**File**: `server/aiRouter.ts`

```typescript
const response = await callMistralChat({
  model: ENV.aiAssistantModel, // mistral-medium-latest
  messages: [...],
});
```

### OCR Document Extraction
**File**: `server/services/ai/document/documentOcrClient.ts`

```typescript
// Step 1: OCR API (always uses mistral-ocr-latest)
const model = "mistral-ocr-latest";

// Step 2: Structured extraction (uses OCR model)
const model = ENV.ocrExtractionModel || "mistral-ocr-latest";
```

## Model Comparison

| Feature | mistral-ocr-latest | mistral-medium-latest |
|---------|-------------------|----------------------|
| **Primary Use** | Document OCR & extraction | Interactive chat assistant |
| **Specialization** | Financial documents, invoices, receipts | General conversation, guidance |
| **Output Format** | Structured JSON data | Natural language responses |
| **Temperature** | 0.1 (deterministic) | 0.7 (creative) |
| **Use in Mantodeus** | Invoice upload & processing | Walter AI assistant panel |

## Cost Optimization

Using specialized models ensures:
- **Better accuracy** for each use case
- **Lower costs** by using appropriate model sizes
- **Faster processing** with task-optimized models
- **Improved reliability** with specialized training

## Testing

To verify the correct models are being used:

1. **Check AI Assistant (Manto)**:
   - Open AI assistant panel
   - Check logs: `[AI] Calling Mistral for invoice_detail, model: mistral-medium-latest`

2. **Check OCR Extraction**:
   - Upload an invoice document
   - Check logs: `[Mistral OCR] Using model: mistral-ocr-latest`

## Troubleshooting

### Issue: OCR extraction not working
- Verify `MISTRAL_API_KEY` is set
- Check logs for `[Mistral OCR]` messages
- Confirm `OCR_EXTRACTION_MODEL` is `mistral-ocr-latest`

### Issue: AI Assistant not responding
- Verify `AI_ASSISTANT_ENABLED=true`
- Check `AI_ASSISTANT_MODEL` is set to `mistral-medium-latest`
- Verify `MISTRAL_API_KEY` is valid

### Issue: Wrong model being used
- Check environment variables in `.env`
- Restart server after changing `.env`
- Verify with logs which model is being called

## Future Enhancements

Potential model upgrades to consider:
- **mistral-large-latest**: For complex reasoning in AI assistant
- **mistral-small-latest**: For simple extraction tasks (cost optimization)
- Model selection based on document complexity
- User-configurable model preferences

## Last Updated
2026-01-10 - Separated OCR and AI Assistant model configurations

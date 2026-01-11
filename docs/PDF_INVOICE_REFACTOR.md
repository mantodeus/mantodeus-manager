# PDF Invoice Refactor - Premium v4 Final

## Latest Update: Premium v4 Restoration

Restored the premium aesthetic with proper print mechanics:

### Key Changes
1. **Repeating footer** - Footer appears on every page via Puppeteer's `footerTemplate`
2. **Premium card styling** - AN/VON cards with `box-shadow: 0 6px 20px rgba(0,0,0,0.04)`, 16px radii
3. **Proper margins** - PDF margins handled by Puppeteer (16mm sides, 28mm bottom)
4. **No in-body footer** - Footer removed from HTML template to avoid duplication
5. **Totals protection** - Totals + VAT note never orphan to page 2

### Margin Configuration
- Top: 16mm
- Right: 16mm
- Bottom: 28mm (reserves space for footer)
- Left: 16mm

### Footer Template
- 3 columns: Kontakt | Adresse | Bankverbindung
- Page numbers: "Seite X von Y"
- Premium typography matching v4 aesthetic
- ~20mm total height

---

# PDF Invoice Refactor - Premium Look Restoration

## Summary

This refactor restores the premium look of invoice PDFs while maintaining all print hardening improvements. Key changes:

1. **Footer moved to Puppeteer footerTemplate** - Proper page footer implementation
2. **AN/VON converted to letterhead blocks** - Clean, minimal styling (not oversized cards)
3. **Subtle shadows restored** - Only on key containers (table, totals)
4. **Totals + VAT note protected** - Never orphaned on page 2
5. **Kanit fonts embedded** - Static weights served from `/fonts/Kanit/`

## Changes Made

### 1. Footer Implementation (Task A)

**PDF Service (`services/pdf-service/index.js`)**
- Supports `headerTemplate` and `footerTemplate` from options
- Default bottom margin: `22mm` (sufficient for footer)
- Options are passed through to Puppeteer

**Invoice Template (`server/templates/invoice.ts`)**
- Returns `{ html, footerTemplate }` instead of just HTML string
- Footer template includes:
  - Kontakt | Adresse | Bankverbindung (left→right)
  - Page numbers: "Seite X von Y"
- In-body footer removed (no duplication)

**PDF Service Client (`server/services/pdfService.ts`)**
- `PDFOptions` interface extended with:
  - `displayHeaderFooter?: boolean`
  - `headerTemplate?: string`
  - `footerTemplate?: string`
- Options passed through to PDF service

**All Callers Updated**
- `server/_core/index.ts` (2 endpoints)
- `server/pdfRouter.ts`
- All now pass `footerTemplate` to `renderPDF()`

### 2. Totals + VAT Note Protection (Task B)

**HTML Structure**
```html
<div class="totals-wrapper">
  <div class="totals-with-vat-note">
    <div class="totals">...</div>
    ${kleinunternehmerCardHTML}
  </div>
</div>
```

**CSS**
```css
.totals-wrapper {
  break-inside: avoid;
  page-break-inside: avoid;
}

.totals-with-vat-note {
  break-inside: avoid;
  page-break-inside: avoid;
}
```

**Result**: Totals and Kleinunternehmer note stay together, never orphaned on page 2.

### 3. Premium Look Restoration (Task C)

**AN/VON Letterhead Blocks**
- Removed card styling (no background, border, padding)
- Clean letterhead format:
  - Small uppercase label (8px, muted)
  - Bold name (500 weight)
  - Address lines below
- Reduced visual weight and height

**Subtle Shadows**
- Applied ONLY to:
  - `.table-wrapper`: `box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04)`
  - `.totals`: `box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04)`
- No shadows on cards or other elements

**Green Divider**
- Thickness: `0.5px` (already correct)
- Enhanced gradient fade (30%→70% center range)

**Kleinunternehmer Note**
- No card styling
- Appears directly under totals
- Centered, muted text

### 4. Font Embedding (Task D)

**Current Implementation**
- Static Kanit fonts in `services/pdf-service/fonts/Kanit/`:
  - `Kanit-Thin.woff2` (weight 100)
  - `Kanit-Light.woff2` (weight 300)
  - `Kanit-Regular.woff2` (weight 400)
  - `Kanit-Medium.woff2` (weight 500)
- Served via Express static route: `/fonts`
- Font-face declarations in template CSS
- Puppeteer waits for fonts: `await page.evaluateHandle("document.fonts.ready")`

**Note**: Fonts are currently served from filesystem. For production, consider:
- Base64 embedding in CSS (larger HTML but no external fetch)
- Or ensure fonts are deployed with PDF service

## Verification Steps

### 1. Verify Embedded Fonts

**macOS Preview:**
1. Open generated PDF
2. Tools → Show Inspector → Fonts tab
3. Verify "Kanit" appears in font list
4. Check that weights 100, 300, 400, 500 are available

**Windows Edge/Chrome:**
1. Open PDF
2. Right-click → Inspect (if available)
3. Or use PDF viewer's font inspection

**Command Line (if available):**
```bash
pdffonts invoice.pdf | grep -i kanit
```

### 2. Verify Totals Never Orphaned

**Test with short invoice:**
1. Create invoice with 1-2 line items
2. Generate PDF
3. Verify totals + Kleinunternehmer note appear on page 1
4. They should NOT appear alone on page 2

**Test with long invoice:**
1. Create invoice with 15+ line items
2. Generate PDF
3. If totals don't fit on page 1, entire block should move to page 2
4. Totals and VAT note should never split

### 3. Verify Footer

**Check footer appears:**
1. Generate PDF
2. Verify footer at bottom of every page:
   - Kontakt (left)
   - Adresse (center)
   - Bankverbindung (right)
   - Page numbers (right, below)
3. Footer should be consistent across all pages

### 4. Verify Premium Look

**Visual checks:**
- AN/VON should be clean letterhead blocks (not big cards)
- Table should have subtle shadow
- Totals should have subtle shadow
- Green divider should be thin (0.5px) with fade
- Overall should feel premium, not flat

## Files Modified

1. `services/pdf-service/index.js` - Footer template support
2. `server/templates/invoice.ts` - Template refactor
3. `server/services/pdfService.ts` - Options interface
4. `server/_core/index.ts` - Caller updates (2 endpoints)
5. `server/pdfRouter.ts` - Caller update

## Print Hardening Preserved

✅ A4 page lock (`width: 210mm; min-height: 297mm`)
✅ @page rules (`size: A4; margin: 0`)
✅ print-color-adjust (`exact`)
✅ Font embedding (Kanit static weights)
✅ Font readiness waits (`document.fonts.ready`)
✅ Unit normalization (px)
✅ No heavy shadows everywhere

## Breaking Changes

**API Change:**
- `generateInvoiceHTML()` now returns `{ html: string; footerTemplate: string }` instead of `string`
- All callers updated accordingly

**Migration:**
- If you have custom code calling `generateInvoiceHTML()`, update to destructure the return value:
  ```typescript
  // Before
  const html = generateInvoiceHTML(data);
  
  // After
  const { html, footerTemplate } = generateInvoiceHTML(data);
  ```

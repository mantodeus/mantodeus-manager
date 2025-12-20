# Theme System Audit Report

## Hard-Coded Colors Found

### 1. Settings.tsx
- Line with `style={{ background: '#0CF57E' }}` - Theme preview swatch
- **Action**: Replace with CSS variable

### 2. DataExportImportDialog.tsx
- `bg-[#0D0E10]/10` - Hard-coded dark background
- **Action**: Replace with `bg-surface/10` or semantic token

### 3. ImageGallery.tsx
- `bg-black/40` - Overlay background
- `bg-black/70` - Caption background
- **Action**: Replace with semantic overlay tokens

### 4. ImageLightbox.tsx
- `bg-black/95` - Lightbox background
- `bg-black/50` - Thumbnail strip background
- **Action**: Replace with semantic overlay tokens

### 5. PDFPreviewModal.tsx
- Multiple instances of `bg-[#0D0E10]` and `border-[#0D0E10]`
- `bg-black` - PDF viewer background
- **Action**: Replace with `bg-surface` and `border-subtle` tokens

### 6. ProjectFileGallery.tsx
- `bg-black/50` - Overlay background
- `bg-black/70` - Caption background
- **Action**: Replace with semantic overlay tokens

### 7. ProjectFileLightbox.tsx
- `bg-black/95` - Lightbox background
- **Action**: Replace with semantic overlay token

## Summary

**Total Files with Hard-Coded Colors**: 7
**Total Instances**: ~20

**Categories**:
1. Lightbox/Modal overlays (bg-black/95, bg-black/50)
2. PDF viewer backgrounds (bg-[#0D0E10])
3. Theme preview swatches (inline styles)
4. Image gallery overlays (bg-black/40, bg-black/70)

**Strategy**:
- Add overlay tokens: `--overlay-light`, `--overlay-dark`, `--overlay-heavy`
- Replace all `bg-[#0D0E10]` with `bg-surface`
- Replace all `border-[#0D0E10]` with `border-subtle`
- Update Settings theme preview to use CSS variables

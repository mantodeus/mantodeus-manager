# Delete Operation Safeguards

## Critical Issue: ON DELETE CASCADE

The database uses `ON DELETE CASCADE` foreign key constraints, which means:
- **Deleting a project** automatically deletes all associated jobs and files
- **Deleting a project job** automatically deletes all associated files
- **Deleting a job** automatically deletes all associated tasks and images

This is a **destructive operation** that cannot be undone.

## Safeguards Implemented

### 1. DeleteConfirmDialog Component
Created a reusable confirmation dialog (`DeleteConfirmDialog`) that:
- Uses proper AlertDialog instead of browser `confirm()`
- Shows clear warnings about what will be deleted
- **Requires typing the item name** to confirm (for projects/jobs)
- Displays file/job counts that will be affected
- Prevents accidental confirmation

### 2. Protected Delete Operations

#### Project Deletion (`ProjectDetail.tsx`)
- ✅ Requires typing the project name to confirm
- ✅ Shows count of jobs and files that will be deleted
- ✅ Clear warning: "This action cannot be undone"
- ✅ Uses AlertDialog (cannot be accidentally confirmed)

#### Project Job Deletion (`ProjectJobDetail.tsx`)
- ✅ Requires typing the job title to confirm
- ✅ Shows count of files that will be deleted
- ✅ Clear warning: "This action cannot be undone"
- ✅ Uses AlertDialog

#### File Deletion (`ProjectFileGallery.tsx`, `ImageGallery.tsx`)
- ✅ Uses AlertDialog confirmation
- ✅ Clear warning: "This action cannot be undone"
- ✅ Shows which file will be deleted

### 3. Remaining Simple Confirmations

The following still use `confirm()` dialogs but are less critical:
- Notes deletion (no cascade)
- Contacts deletion (no cascade)
- Locations deletion (no cascade)
- Tasks deletion (no cascade)
- Invoices deletion (no cascade)

These can be upgraded to DeleteConfirmDialog if needed, but they don't have cascade delete risks.

## Prevention Measures

### What Changed
1. **Replaced simple `confirm()` dialogs** with proper AlertDialog components
2. **Added "type to confirm"** requirement for destructive operations
3. **Added file/job count warnings** so users know what will be deleted
4. **Made delete buttons more explicit** with proper destructive styling

### Best Practices Going Forward

1. **Never use `confirm()` for destructive operations** - Always use DeleteConfirmDialog
2. **Always show what will be deleted** - Display counts and affected items
3. **Require explicit confirmation** - Type-to-confirm for critical operations
4. **Use AlertDialog** - More visible and harder to accidentally confirm than browser confirm()
5. **Consider soft delete** - Future enhancement: add trash/archive instead of hard delete

## Database Schema Notes

The cascade delete is defined in `drizzle/schema.ts`:
- `fileMetadata.projectId` → `projects.id` with `onDelete: "cascade"`
- `fileMetadata.jobId` → `projectJobs.id` with `onDelete: "cascade"`

This means file deletions happen automatically when parent entities are deleted. The safeguards ensure users are fully aware before triggering these operations.

## Future Enhancements

1. **Trash/Recycle Bin** - Soft delete with recovery option
2. **Audit Log** - Track all delete operations with user and timestamp
3. **Bulk Delete Protection** - Additional safeguards for multi-select deletions
4. **Undo Functionality** - Time-limited undo for accidental deletions

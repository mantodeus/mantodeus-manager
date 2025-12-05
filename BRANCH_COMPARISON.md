# Branch Comparison Report

## Summary

**GOOD NEWS**: Both branches already use Supabase authentication! The divergence is primarily in:
1. Schema field naming (`userId` vs `supabaseId`)
2. Feature additions (53 commits of new features on remote)
3. Documentation files

## Authentication Comparison

### Local Backup Branch (backup/local-main-supabase)
- **Auth System**: Supabase ✅
- **Schema Field**: `userId VARCHAR(64)`
- **Files**:
  - `server/_core/auth.ts` - Custom auth routes
  - `server/_core/supabase.ts` - Supabase client
  - `client/src/pages/Login.tsx` - Login page

### Remote/Repair Branch (origin/main → repair/git-cleanup)
- **Auth System**: Supabase ✅
- **Schema Field**: `supabaseId VARCHAR(36)` (proper UUID length)
- **Files**:
  - `server/_core/oauth.ts` - Supabase auth callback (confusing name, but it's Supabase!)
  - `server/_core/sdk.ts` - Manus SDK wrapper (for other services, not auth)
  - `server/_core/supabase.ts` - Supabase client
  - Login page integrated into main flow

## Key Differences

### 1. Database Schema
**Local**: `userId VARCHAR(64)`
**Remote**: `supabaseId VARCHAR(36)`

**Decision**: Use `supabaseId` (remote) - proper UUID length, clearer naming

### 2. New Features on Remote (53 commits)
- ✅ Image upload/download pipeline improvements
- ✅ Client-side image compression
- ✅ HEIC/HEIF image support
- ✅ Image lightbox with annotations
- ✅ Server-side file uploads (CORS bypass)
- ✅ ItemActionsMenu component (UI refactor)
- ✅ DeleteConfirmDialog (safer deletions)
- ✅ Data export/import functionality
- ✅ GitHub webhook integration
- ✅ Project-based file management
- ✅ Multiple test files added
- ✅ CI/CD workflows

### 3. Documentation Files

**Only on Local**:
- `FIXES_APPLIED.md`
- `INFOMANIAK_DEPLOY.md`
- `QUICK_START.md`

**Only on Remote**:
- `AUTO_DEPLOY.md`
- `CACHE_CLEAR_FIX.md`
- `CHANGES_SUMMARY.md`
- `DEBUG_AUTH.md`
- `DELETE_SAFEGUARDS.md`
- `DEPLOYMENT_COMPLETE.md`
- `DEPLOYMENT_INFOMANIAK.md`
- `DEPLOYMENT_STEPS.md`
- `HOW_TO_CHECK_LOGS.md`
- `ITEM_ACTIONS_PATTERNS_ANALYSIS.md`
- `PM2_DEPLOYMENT.md`
- `S3_DEBUG.md`
- `S3_ENV_SETUP.md`
- `S3_INTEGRATION.md`
- `SETUP_AWS_CLI.md`
- `SSH_TROUBLESHOOTING.md`

**Modified on Both**:
- `ENV_VARS_REQUIRED.md`
- `MIGRATION_SUMMARY.md`
- `SUPABASE_MIGRATION.md`

### 4. Code Changes

**Client Components Added on Remote**:
- `CreateProjectDialog.tsx`
- `CreateProjectJobDialog.tsx`
- `DataExportImportDialog.tsx`
- `DeleteConfirmDialog.tsx`
- `EditProjectDialog.tsx`
- `EditProjectJobDialog.tsx`
- `ItemActionsMenu.tsx`
- `ProjectFileGallery.tsx`
- `ProjectFileLightbox.tsx`
- `ProjectJobList.tsx`

**Server Files Added on Remote**:
- `imagePipeline.ts` - Image processing pipeline
- `imageProcessing.ts` - Image manipulation
- `projectFilesRouter.ts` - Project file management
- `projectsRouter.ts` - Projects API
- Multiple test files

**Server Files Removed on Remote**:
- `auth.ts` - Replaced by `oauth.ts` (which is actually Supabase, just poorly named)

## Merge Strategy

### Phase 1: Use Remote as Base ✅
- Remote has all the features
- Remote already has Supabase
- Remote has better schema naming

### Phase 2: Cherry-pick Useful Docs from Local
- Keep unique documentation from local branch
- Merge updated versions of shared docs

### Phase 3: Verify Everything Works
- Check schema migration path
- Test authentication flow
- Verify all new features work
- Run build and tests

### Phase 4: Clean Up
- Remove obsolete feature branches
- Update .gitignore
- Fix any remaining issues

## Conflicts to Resolve

### 1. Schema Field Name
**Resolution**: Use `supabaseId` (remote version)
**Action**: Update any local-only code that references `userId`

### 2. Documentation Merges
**Files to merge**:
- `ENV_VARS_REQUIRED.md` - Combine both versions
- `MIGRATION_SUMMARY.md` - Keep remote, add local notes
- `SUPABASE_MIGRATION.md` - Merge both versions

### 3. Auth Route Naming
**Issue**: Remote uses `oauth.ts` for Supabase auth (confusing)
**Resolution**: Keep as-is (already deployed), add comment clarifying it's Supabase

## Migration Path for Users

### Database Migration
Users need to rename column if they used local version:
```sql
ALTER TABLE users CHANGE COLUMN userId supabaseId VARCHAR(36);
```

### Environment Variables
Both versions use same variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_USER_ID` (local) → `OWNER_SUPABASE_ID` (remote)

## Recommendation

**Use remote branch (repair/git-cleanup) as final version** because:
1. ✅ Already has Supabase (same as local)
2. ✅ Has 53 commits of new features
3. ✅ Better schema naming (`supabaseId` vs `userId`)
4. ✅ More comprehensive documentation
5. ✅ Already tested and deployed
6. ✅ Has CI/CD workflows
7. ✅ Has extensive test coverage

**Cherry-pick from local**:
- Any unique documentation that's valuable
- Any fixes not present in remote

## Next Steps

1. ✅ Verify remote branch builds successfully
2. ✅ Cherry-pick useful docs from local
3. ✅ Update .gitignore
4. ✅ Clean up obsolete branches
5. ✅ Create PR documenting the merge
6. ✅ Test thoroughly

---

**Conclusion**: The "conflict" is actually minimal. Both branches use Supabase. Remote is more advanced. We just need to adopt remote and cherry-pick any useful local documentation.

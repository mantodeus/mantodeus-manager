# Environment Cleanup Summary

**Commit**: f9e3984  
**Date**: December 21, 2025

## Objective Completed

Eliminated all staging/preview/development environment logic. Mantodeus Manager is now a **production-only system by design**.

---

## Files Deleted (24 files)

### Deployment Scripts
- `deploy.sh` (root)
- `deploy.ps1`
- `quick-deploy.ps1`
- `watch-and-deploy.ps1`
- `deploy-server.sh`
- `infra/preview/deploy-preview.sh`
- `infra/production/deploy-production.sh`
- `scripts/deploy-preview-local.sh`
- `scripts/deploy-production-local.sh`

### Environment Files
- `.env.local.example`

### Documentation
- `docs/INFOMANIAK_ENVIRONMENTS.md`
- `BEREITSTELLUNG.md`
- `BRANCH_COMPARISON.md`
- `DEBUG_INFOMANIAK.md`
- `DEPLOYMENT_COMPLETE.md`
- `DEPLOYMENT_INFOMANIAK.md`
- `DEPLOYMENT_STEPS.md`
- `ENV_VARS_REQUIRED.md`
- `INFOMANIAK_CHECKLIST.md`
- `INFOMANIAK_DEPLOYMENT.md`
- `INFOMANIAK_FIX.md`
- `LOCAL_BUILD_SETUP.md`
- `MIGRATION_TO_INFOMANIAK_PROCESS_CONTROL.md`
- `PM2_DEPLOYMENT.md`

---

## Files Modified (13 files)

### Core Server Files
| File | Changes |
|------|---------|
| `server/_core/env.ts` | Removed `appEnv`, `runtimeEnv`, `isProduction`. Added fail-fast validation for all required vars. |
| `server/_core/load-env.ts` | Removed `.env.local` loading, development mode logic. Single `.env` file only. |
| `server/_core/cookies.ts` | Removed `NODE_ENV === "development"` logging. |
| `server/_core/index.ts` | Removed `NODE_ENV === "production"` conditional. Always serve static files. |

### Client Files
| File | Changes |
|------|---------|
| `client/src/lib/supabase.ts` | Removed `isDev` logging. Simplified to fail-fast only. |
| `client/src/main.tsx` | Removed service worker dev/prod conditional. |

### Configuration
| File | Changes |
|------|---------|
| `package.json` | Removed `NODE_ENV=development` from dev script. |
| `.env.example` | Rewritten with all required variables documented. |
| `.gitignore` | Simplified to just `.env` (removed multi-env patterns). |

### Deployment
| File | Changes |
|------|---------|
| `infra/deploy/deploy.sh` | Rewritten as the canonical deploy script. |

### Documentation
| File | Changes |
|------|---------|
| `README.md` | Rewritten for production-only system. |
| `DEPLOYMENT.md` | Rewritten for single deploy path. |
| `infra/README.md` | Simplified for production-only. |

---

## Confirmation Checklist

| Requirement | Status |
|-------------|--------|
| One `.env` file | ✅ |
| One deploy path (`infra/deploy/deploy.sh`) | ✅ |
| One database | ✅ |
| One domain (`manager.mantodeus.com`) | ✅ |
| Zero staging logic | ✅ |
| Zero preview logic | ✅ |
| Zero development conditionals | ✅ |
| Fail-fast on missing env vars | ✅ |

---

## Architecture After Cleanup

```
git push origin main
       ↓
GitHub Webhook
       ↓
infra/deploy/deploy.sh
       ↓
PM2 restart mantodeus-manager
       ↓
https://manager.mantodeus.com
```

---

## Breaking Changes

1. **No more `.env.local`** - Only `.env` is loaded
2. **No more dev mode** - Server always serves static files
3. **No more preview environment** - Single production deployment
4. **Fail-fast on startup** - App exits if required env vars missing

---

## Stats

- **Files changed**: 37
- **Insertions**: 685
- **Deletions**: 4,669
- **Net reduction**: ~4,000 lines

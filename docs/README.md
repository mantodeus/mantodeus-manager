# Mantodeus Manager Documentation

Welcome to the Mantodeus Manager documentation. This directory contains all technical and user documentation for the project.

## Quick Links

### For Developers

- **[Deployment Guide](DEPLOYMENT.md)** - How to deploy, manage PM2, SSH access, and troubleshoot production issues
- **[Database Guide](DATABASE.md)** - Schema management, migrations, backups, and database operations
- **[Technical Overview](TECHNICAL_OVERVIEW.md)** - Complete architecture, tech stack, and codebase structure
- **[S3 Integration](S3_INTEGRATION.md)** - File storage implementation and configuration
- **[Backup & Migration](BACKUP_AND_MIGRATION.md)** - Data backup and migration procedures

### For End Users

- **[User Guide](USER_GUIDE.md)** - How to use Mantodeus Manager features

### Design & Features

- **[Theme System](THEME_SYSTEM.md)** - Design system, theming, and CSS architecture
- **[Theme Tokens Reference](THEME_TOKENS_REFERENCE.md)** - Complete design token documentation
- **[Item Actions Patterns](ITEM_ACTIONS_PATTERNS_ANALYSIS.md)** - UI patterns for item actions
- **[Delete Safeguards](DELETE_SAFEGUARDS.md)** - Delete confirmation patterns
- **[Cache Clear Fix](CACHE_CLEAR_FIX.md)** - Cache invalidation implementation

## Document Organization

| Document | Purpose | Audience |
|----------|---------|----------|
| **DEPLOYMENT.md** | Deployment procedures, PM2, SSH, troubleshooting | DevOps, Developers |
| **DATABASE.md** | Schema management, migrations, backups | Developers |
| **TECHNICAL_OVERVIEW.md** | Architecture, tech stack, codebase walkthrough | New developers, Technical leads |
| **USER_GUIDE.md** | Feature documentation and usage instructions | End users, Product team |
| **S3_INTEGRATION.md** | File storage configuration and implementation | Developers |
| **THEME_SYSTEM.md** | Design system and theming architecture | Frontend developers, Designers |
| **THEME_TOKENS_REFERENCE.md** | Complete design token reference | Frontend developers, Designers |
| **BACKUP_AND_MIGRATION.md** | Backup and data migration procedures | DevOps, System administrators |
| **DELETE_SAFEGUARDS.md** | Delete confirmation UX patterns | Frontend developers |
| **CACHE_CLEAR_FIX.md** | Cache invalidation implementation details | Developers |
| **ITEM_ACTIONS_PATTERNS_ANALYSIS.md** | UI patterns for item actions | Frontend developers |

## Quick Start

### For New Developers

1. Start with [README.md](../README.md) in the root directory
2. Read [TECHNICAL_OVERVIEW.md](TECHNICAL_OVERVIEW.md) for architecture
3. Review [DATABASE.md](DATABASE.md) for schema management
4. Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment procedures

### For Deployment Issues

1. [DEPLOYMENT.md](DEPLOYMENT.md) - Troubleshooting section
2. Check PM2 logs: `pm2 logs mantodeus-manager`
3. Verify environment variables: `cat .env`
4. Test database connection: `pnpm db:check-url`

### For Database Changes

1. Edit `drizzle/schema.ts`
2. Generate migration: `pnpm db:generate`
3. Review SQL: Check `drizzle/XXXX_*.sql`
4. Apply locally: `pnpm db:migrate`
5. Commit both files
6. After deployment: SSH and run `pnpm db:migrate`

See [DATABASE.md](DATABASE.md) for complete details.

## Philosophy

**Mantodeus Manager is a production-only system by design.**

- ONE domain: `manager.mantodeus.com`
- ONE database
- ONE S3 bucket
- ONE `.env` file
- ONE deployment path: `git push main`

> Complexity is the enemy. Safety comes from clarity, not environments.
> If something breaks, we fix it directly in production — fast, deliberately, and cleanly.

## Contributing

When adding new documentation:

1. **Create a descriptive filename** using SCREAMING_SNAKE_CASE.md
2. **Add it to this README** in the appropriate section
3. **Update the table** with purpose and audience
4. **Link from the main README** if it's a primary document
5. **Keep it focused** - one topic per document

## Need Help?

- Check the relevant documentation above
- Review [DEPLOYMENT.md](DEPLOYMENT.md) troubleshooting section
- Check application logs: `pm2 logs mantodeus-manager`
- Verify environment setup in `.env`

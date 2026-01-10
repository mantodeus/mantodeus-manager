# Mantodeus Manager

A comprehensive construction project management application for tracking projects, jobs, contacts, invoices, and documentation.

**Mantodeus Manager is a production-only system by design.**

![Mantodeus Manager](client/public/mantodeus-logo.png)

## Features

- **Project Management** - Organize work under projects with clients, dates, and locations
- **Job Management** - Track jobs within projects with status, assignments, and workflows
- **File Attachments** - Upload files to projects and jobs via S3 storage
- **Contact Management** - Manage clients and contractors
- **Invoice Management** - Upload and preview invoice PDFs
- **Image Gallery** - Upload progress photos with captions
- **Calendar** - Visualize project and job timelines
- **Reports & Export** - Generate professional PDF reports
- **Maps Integration** - Google Maps integration for project locations
- **PWA Support** - Install as a Progressive Web App

## Tech Stack

- **Frontend**: React 19 + Tailwind CSS 4 + Vite 7
- **Backend**: Node.js 22 + Express + tRPC
- **Database**: MySQL 8.0 / MariaDB 10.5+
- **Storage**: AWS S3 compatible (Infomaniak)
- **Authentication**: Supabase Auth
- **Hosting**: Infomaniak (manager.mantodeus.com)

## Architecture

This is a **single-environment, production-only system**:

- **ONE** domain: `manager.mantodeus.com`
- **ONE** database
- **ONE** S3 bucket
- **ONE** `.env` file
- **ONE** deployment path: `git push main` → webhook → `scripts/deploy.sh`

There is no staging, no preview, no dev/prod branching.

## Quick Start

### Prerequisites

- Node.js 22.x or higher
- pnpm (recommended) or npm
- MySQL 8.0 or MariaDB 10.5+
- S3-compatible storage

### Installation

```bash
# Clone the repository
git clone https://github.com/mantodeus/mantodeus-manager.git
cd mantodeus-manager

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your production credentials

# Run database migrations
pnpm db:push

# Build and start
pnpm build
pnpm start
```

The application will be available at `http://localhost:3000`

## Environment Variables

Create a `.env` file in the root directory. **All variables are required** unless marked optional:

```env
# Database (REQUIRED)
DATABASE_URL=mysql://user:password@host:3306/mantodeus_manager

# Authentication (REQUIRED)
JWT_SECRET=generate_a_random_32_character_string
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OWNER_SUPABASE_ID=your_owner_supabase_id

# OAuth (REQUIRED)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your_app_id

# S3 Storage (REQUIRED)
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key

# Application (REQUIRED)
PORT=3000
VITE_APP_TITLE=Mantodeus Manager
VITE_APP_URL=https://manager.mantodeus.com

# Optional
# VITE_APP_LOGO=/mantodeus-logo.png
# PDF_SERVICE_URL=https://pdf-service-withered-star-4195.fly.dev/render
```

The app **fails fast** if any required variable is missing.

## Deployment

### The Only Deployment Path

```
git push origin main → GitHub Webhook → scripts/deploy.sh → PM2 restart
```

### Manual Deployment

```bash
ssh mantodeus-server
cd /srv/customer/sites/manager.mantodeus.com
bash scripts/deploy.sh
```

### What the Deploy Script Does

1. Fetches latest code from `origin/main`
2. Installs dependencies
3. Builds the application
4. Restarts PM2 process

## Scripts

```bash
# Development (local testing only)
pnpm dev              # Start server with file watching

# Production
pnpm build            # Build frontend and backend
pnpm start            # Start production server

# Database
pnpm db:push          # Generate and run migrations
pnpm db:migrate       # Run existing migrations only

# Quality
pnpm check            # TypeScript type checking
pnpm format           # Format code with Prettier
pnpm test             # Run test suite
```

## Project Structure

```
mantodeus-manager/
├── client/                 # Frontend React application
│   ├── src/               # Source code
│   └── public/            # Static assets
├── server/                # Backend Express + tRPC
│   ├── _core/            # Core server modules
│   └── routers/          # tRPC routers
├── drizzle/              # Database schema and migrations
├── infra/                # Infrastructure and deployment
│   └── deploy/           # Canonical deploy script
├── docs/                 # Documentation
├── .env.example          # Environment template
└── package.json          # Dependencies and scripts
```

## Image Upload Pipeline

1. **Client-side** - Photos converted to JPEG, constrained to 2000px, targeted 300-800KB
2. **Server-side** - Sharp generates three variants: `thumb_300.jpg`, `preview_1200.jpg`, `full.jpg`
3. **Delivery** - Signed URLs for each variant

## Database

- **One production database** - No test/dev/staging databases
- **Migrations via Drizzle** - `pnpm db:push` generates and runs migrations
- **Direct push blocked** - Use `db:push` workflow, not `drizzle-kit push`

## Documentation

- **[Deployment Guide](docs/DEPLOYMENT.md)** - Deployment, PM2, SSH, troubleshooting
- **[Database Guide](docs/DATABASE.md)** - Schema management, migrations, backups
- **[Golden Path Workflows](docs/GOLDEN_PATH_WORKFLOWS.md)** - Canonical daily workflows
- **[Technical Overview](docs/TECHNICAL_OVERVIEW.md)** - Architecture and codebase structure
- **[User Guide](docs/USER_GUIDE.md)** - End-user documentation
- **[Theme System](docs/THEME_SYSTEM.md)** - Design system and theming
- **[S3 Integration](docs/S3_INTEGRATION.md)** - File storage implementation

## Philosophy

> Complexity is the enemy. Safety comes from clarity, not environments.
> If something breaks, we fix it directly in production — fast, deliberately, and cleanly.

## License

MIT

# Mantodeus Manager

A comprehensive construction project management application for tracking projects, jobs, contacts, invoices, and documentation.

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
- **Storage**: AWS S3 compatible
- **Authentication**: OAuth 2.0 (Manus)

## Quick Start

### Prerequisites

- Node.js 22.x or higher
- pnpm (recommended) or npm
- MySQL 8.0 or MariaDB 10.5+
- S3-compatible storage (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/mantodeus/mantodeus-manager.git
cd mantodeus-manager

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3000`

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/mantodeus_manager

# JWT Secret
JWT_SECRET=your_random_jwt_secret_here

# OAuth Configuration
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your_app_id

# Application
VITE_APP_TITLE=Mantodeus Manager
VITE_APP_LOGO=/mantodeus-logo.png
PORT=3000
NODE_ENV=production

# S3 Storage (optional)
S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key

# Owner
OWNER_OPEN_ID=your_owner_open_id
OWNER_NAME=Your Name
```

## Image Upload Pipeline

User-facing photo uploads now follow a two-step optimization process:

1. **Client-side preparation** – Photos are converted to high-quality JPEG with EXIF removed, constrained to 2000px on the long edge, and targeted to 300–800KB before they ever leave the browser. This keeps uploads snappy on mobile connections.
2. **Server-side processing** – The tRPC upload handlers feed every image through Sharp to auto-orient, strip metadata, and generate three responsive variants (`thumb_300.jpg`, `preview_1200.jpg`, `full.jpg`). Objects are stored under `projects/{projectId}/images/project_<projectId>_<timestamp>/`.
3. **Signed delivery** – The API returns short-lived signed URLs for each variant. The UI uses thumbs for grids, previews for lightboxes, and fetches the full asset only on explicit download, ensuring fast browsing with correct MIME types.

Legacy proxy endpoints have been removed; all consumers should rely on `projects.files.*` and `images.*` procedures for generating signed URLs.

## Deployment

### Option 1: Railway (Recommended for Quick Deployment)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

1. Click the button above
2. Configure environment variables
3. Railway will automatically provision MySQL and deploy your app

### Option 2: Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm start`
4. Add a MySQL database from Render's dashboard
5. Set environment variables in Render dashboard

### Option 3: Vercel + PlanetScale

1. Deploy frontend to Vercel:
   ```bash
   vercel
   ```

2. Set up PlanetScale database:
   ```bash
   pscale database create mantodeus-manager
   pscale connect mantodeus-manager main
   ```

3. Configure environment variables in Vercel dashboard

### Option 4: Self-Hosted VPS

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed self-hosting instructions.

## Scripts

```bash
# Development
pnpm dev              # Start development server with hot reload

# Production
pnpm build            # Build frontend and backend for production
pnpm start            # Start production server

# Database
pnpm db:push          # Generate and run database migrations

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
│   ├── public/            # Static assets
│   └── index.html         # Entry HTML
├── server/                # Backend Node.js/Express application
│   ├── _core/            # Core server functionality
│   ├── routers.ts        # tRPC routers
│   ├── projectsRouter.ts # Projects & Jobs CRUD
│   ├── projectFilesRouter.ts # File upload/download
│   └── db.ts             # Database queries
├── shared/               # Shared types and constants
├── drizzle/              # Database schema and migrations
├── scripts/              # Utility scripts (backfill, etc.)
├── dist/                 # Production build output
└── docs/                 # Documentation
```

## Database Schema

The application uses a hierarchical data model:

```
┌─────────────────────────────────────────────────────────────┐
│                         PROJECTS                            │
│  - id, name, client, description                           │
│  - status (planned|active|completed|archived)              │
│  - start_date, end_date, address, geo (lat/lng)            │
│  - created_by → users.id                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ has many
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      PROJECT_JOBS                           │
│  - id, project_id → projects.id                            │
│  - title, category, description                            │
│  - status (pending|in_progress|done|cancelled)             │
│  - assigned_users (JSON array)                             │
│  - start_time, end_time                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ has many
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      FILE_METADATA                          │
│  - id, project_id → projects.id                            │
│  - job_id → project_jobs.id (nullable)                     │
│  - s3_key, original_name, mime_type                        │
│  - uploaded_by → users.id                                  │
│  - uploaded_at                                             │
└─────────────────────────────────────────────────────────────┘
```

### Legacy Tables (Deprecated)

The following tables are deprecated and will be removed after data migration:
- `jobs` - Use `projects` instead
- `tasks` - Use `project_jobs` instead

See [docs/BACKUP_AND_MIGRATION.md](docs/BACKUP_AND_MIGRATION.md) for migration instructions.

## API Routes (tRPC Procedures)

### Projects

| Procedure | Description |
|-----------|-------------|
| `projects.list` | List all projects for current user |
| `projects.getById` | Get project by ID |
| `projects.create` | Create a new project |
| `projects.update` | Update project details |
| `projects.archive` | Archive a project (soft delete) |
| `projects.delete` | Delete a project permanently |

### Jobs (nested under projects)

| Procedure | Description |
|-----------|-------------|
| `projects.jobs.list` | List jobs for a project |
| `projects.jobs.get` | Get job by ID |
| `projects.jobs.create` | Create a job under a project |
| `projects.jobs.update` | Update job details |
| `projects.jobs.delete` | Delete a job |

### Files (nested under projects)

| Procedure | Description |
|-----------|-------------|
| `projects.files.presignUpload` | Get presigned URL for upload |
| `projects.files.register` | Register uploaded file metadata |
| `projects.files.getPresignedUrl` | Get presigned URL for viewing |
| `projects.files.listByProject` | List files for a project |
| `projects.files.listByJob` | List files for a job |
| `projects.files.delete` | Delete a file |
| `projects.files.upload` | Server-side upload (base64) |

## S3 Key Conventions

Files are stored in S3 with the following key pattern:

```
projects/{projectId}/jobs/{jobId}/{timestamp}-{uuid}-{filename}
```

- `{projectId}` - The project ID (integer)
- `{jobId}` - The job ID, or `_project` if file is project-level
- `{timestamp}` - Unix timestamp in milliseconds
- `{uuid}` - 12-character unique identifier
- `{filename}` - Sanitized original filename

Example:
```
projects/42/jobs/123/1701432000000-abc123def456-document.pdf
projects/42/_project/1701432000000-xyz789abc012-project-plan.pdf
```

## File Upload Flow

```
┌──────────┐     ┌────────────┐     ┌─────────────┐     ┌────────────┐
│  Client  │────▶│ presignUp  │────▶│   S3 PUT    │────▶│  register  │
│          │     │   load     │     │   Upload    │     │    file    │
└──────────┘     └────────────┘     └─────────────┘     └────────────┘
     │                │                    │                  │
     │                ▼                    ▼                  ▼
     │         { uploadUrl,          Direct upload     { id, s3Key,
     │           s3Key }             to S3 bucket       originalName,
     │                                                  mimeType, ... }
     │
     └─────────────────────────────────────────────────────────────────▶
                              File ready to view via
                            getPresignedUrl → S3 GET
```

1. **presignUpload** - Client requests a presigned URL for upload
2. **S3 PUT** - Client uploads file directly to S3 using the URL
3. **register** - Client registers the uploaded file in the database
4. **getPresignedUrl** - To view, client requests a presigned GET URL

### Supported File Types

- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
- Documents: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-*`
- Text: `text/plain`, `text/csv`
- Archives: `application/zip`, `application/gzip`

Max file size: **50 MB**

## Deployment

### Pre-Deployment Checklist

1. **Backup Database**
   ```bash
   mysqldump -u root -p mantodeus_manager > backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Run Migrations**
   ```bash
   npm run db:migrate
   ```

3. **Run Backfill (if migrating from legacy)**
   ```bash
   npm run db:backfill:dry  # Preview changes
   npm run db:backfill       # Execute migration
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Build Application**
   ```bash
   npm run build
   ```

### Staging vs Production

| Environment | Actions |
|-------------|---------|
| Staging | Run migrations, run backfill with `--dry-run`, verify |
| Production | Backup DB, run migrations, run backfill, health check |

**Important**: CI only builds, tests, and prepares PRs. Deployment is manual.

## Documentation

- **[User Guide](USER_GUIDE.md)** - End-user documentation
- **[Deployment Guide](DEPLOYMENT.md)** - Detailed deployment instructions
- **[Backup & Migration](docs/BACKUP_AND_MIGRATION.md)** - Database backup and data migration guide
- **[Todo List](todo.md)** - Development history and roadmap

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
- Open an issue on GitHub
- Check the documentation
- Review the deployment guide

## Acknowledgments

Built with modern web technologies and best practices for construction project management.

---

**Version**: 2.0.0  
**Last Updated**: December 2025

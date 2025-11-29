# Mantodeus Manager

A comprehensive construction project management application for tracking jobs, tasks, contacts, invoices, and documentation.

![Mantodeus Manager](client/public/mantodeus-logo.png)

## Features

- **Job Management** - Track construction projects with status, dates, and locations
- **Task Management** - Assign and track tasks with priorities and workflows
- **Contact Management** - Manage clients and contractors
- **Invoice Management** - Upload and preview invoice PDFs
- **Image Gallery** - Upload progress photos with captions
- **Calendar** - Visualize job timelines
- **Reports & Export** - Generate professional PDF reports
- **Maps Integration** - Google Maps integration for job locations
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
│   └── db.ts             # Database queries
├── shared/               # Shared types and constants
├── drizzle/              # Database schema and migrations
├── dist/                 # Production build output
└── docs/                 # Documentation
```

## Documentation

- **[User Guide](USER_GUIDE.md)** - End-user documentation
- **[Deployment Guide](DEPLOYMENT.md)** - Detailed deployment instructions
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

**Version**: 1.0.0  
**Last Updated**: November 2025

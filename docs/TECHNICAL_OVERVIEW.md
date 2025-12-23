# Mantodeus Manager - Technical Overview

**Generated:** 2025-01-XX  
**Purpose:** Comprehensive codebase analysis for fresh development

---

## 1. Architecture & Tech Stack

### Frontend Structure (React/Vite/Tailwind)

**Framework & Build:**
- **React 19.1.1** - Latest React with concurrent features
- **Vite 5.4.0** - Fast build tool with HMR
- **Tailwind CSS 4.1.14** - Utility-first CSS framework
- **TypeScript 5.9.3** - Full type safety

**Routing:**
- **Wouter 3.3.5** - Lightweight React router (patched for compatibility)
- Routes defined in `client/src/App.tsx`
- Protected routes handled via `DashboardLayout` wrapper

**State Management:**
- **TanStack Query 5.90.2** - Server state management
- **tRPC React Query** - Type-safe API client
- Local state via React hooks (`useState`, `useContext`)

**UI Components:**
- **Radix UI** - Headless component primitives (53 components)
- **Lucide React** - Icon library
- **Sonner** - Toast notifications
- **Framer Motion** - Animations
- Custom component library in `client/src/components/ui/`

**Key Frontend Files:**
```
client/
├── src/
│   ├── App.tsx              # Main router & layout
│   ├── main.tsx             # Entry point, Supabase auth listener
│   ├── pages/               # Route components
│   │   ├── Jobs.tsx         # ✅ Complete
│   │   ├── JobDetail.tsx    # ✅ Complete
│   │   ├── Contacts.tsx     # ✅ Complete
│   │   ├── Invoices.tsx     # ✅ Complete
│   │   ├── Notes.tsx        # ✅ Complete
│   │   ├── Reports.tsx      # ✅ Partial (list only)
│   │   ├── Maps.tsx         # ✅ Complete
│   │   ├── Calendar.tsx    # ✅ Complete (component, not page)
│   │   ├── Login.tsx        # ✅ Complete
│   │   └── Home.tsx         # ⚠️  Placeholder/example
│   ├── components/          # Reusable components
│   │   ├── DashboardLayout.tsx
│   │   ├── CreateJobDialog.tsx
│   │   ├── EditJobDialog.tsx
│   │   ├── TaskList.tsx
│   │   ├── ImageGallery.tsx
│   │   ├── ImageLightbox.tsx
│   │   ├── Calendar.tsx
│   │   ├── Map.tsx
│   │   └── ui/              # 53 Radix-based components
│   ├── lib/
│   │   ├── trpc.ts          # tRPC client setup
│   │   ├── supabase.ts      # Supabase client
│   │   └── utils.ts         # Utility functions
│   └── _core/
│       └── hooks/
│           └── useAuth.ts    # Authentication hook
```

### Backend Structure (Node.js, Express, tRPC)

**Runtime & Framework:**
- **Node.js 22+** - Runtime
- **Express 4.21.2** - HTTP server
- **tRPC 11.6.0** - End-to-end typesafe APIs
- **TypeScript** - Full type safety

**Server Entry:**
- `server/_core/index.ts` - Express app setup
- Development: Vite dev server with HMR
- Production: Static file serving from `dist/public/`

**API Structure:**
```
server/
├── _core/
│   ├── index.ts             # Express server entry
│   ├── context.ts           # tRPC context (auth, req/res)
│   ├── trpc.ts              # tRPC setup (procedures)
│   ├── supabase.ts          # Supabase auth integration
│   ├── oauth.ts             # Auth callback handler
│   ├── env.ts               # Environment variables
│   ├── cookies.ts           # Cookie utilities
│   ├── vite.ts              # Vite dev server setup
│   ├── geocoding.ts         # Google Maps geocoding
│   ├── map.ts               # Map utilities
│   ├── storage.ts           # S3 storage helpers
│   ├── pdfExport.ts         # PDF generation
│   ├── llm.ts               # AI/LLM integration (unused?)
│   ├── imageGeneration.ts   # Image generation (unused?)
│   ├── voiceTranscription.ts # Voice transcription (unused?)
│   └── systemRouter.ts      # System health/notifications
├── routers.ts               # Main tRPC router (all modules)
├── db.ts                    # Database query functions
├── storage.ts               # S3 file storage
├── exportRouter.ts          # PDF export router
└── *.test.ts                # Vitest test files
```

**tRPC Routers:**
- `system` - Health checks, owner notifications
- `auth` - User authentication (me, logout)
- `users` - User management (list)
- `jobs` - Job CRUD + geocoding
- `tasks` - Task CRUD
- `images` - Image upload/management
- `reports` - Report CRUD
- `calendar` - Calendar events query
- `comments` - Comments on jobs/tasks
- `contacts` - Contact CRUD + geocoding
- `invoices` - Invoice file management
- `notes` - Notes CRUD
- `locations` - Map location markers
- `export` - PDF export

### Database Layer (Drizzle + Schema)

**ORM:**
- **Drizzle ORM 0.44.5** - Type-safe SQL query builder
- **MySQL2 3.15.0** - MySQL driver
- **Drizzle Kit 0.31.4** - Migration tool

**Schema Location:**
- `drizzle/schema.ts` - All table definitions
- `drizzle/relations.ts` - Table relationships (if any)
- `drizzle/migrations/` - Migration SQL files

**Database:**
- **MySQL 8.0 / MariaDB 10.5+**
- Connection via `DATABASE_URL` environment variable
- Lazy connection initialization (works without DB for tooling)

**Key Database Functions:**
- `server/db.ts` - All database queries
- Functions organized by entity (jobs, tasks, contacts, etc.)
- Uses Drizzle's type-safe query builder

### Shared Types

**Location:**
- `shared/types.ts` - Re-exports from `drizzle/schema.ts`
- `shared/_core/errors.ts` - Error types
- `shared/const.ts` - Shared constants

**Type System:**
- Full TypeScript end-to-end
- Types inferred from Drizzle schema
- tRPC provides type safety between client/server

### Build/Deploy Scripts

**Package Scripts:**
```json
{
  "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
  "build": "node build-debug.js",
  "build:split": "npm run build:frontend && npm run build:backend",
  "build:frontend": "vite build",
  "build:backend": "esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "start": "NODE_ENV=production node dist/index.js",
  "check": "tsc --noEmit",
  "format": "prettier --write .",
  "test": "vitest run",
  "db:push": "drizzle-kit generate && drizzle-kit migrate"
}
```

**Build Process:**
1. Frontend: Vite bundles React app → `dist/public/`
2. Backend: esbuild bundles Express server → `dist/index.js`
3. Combined: `build-debug.js` orchestrates both with logging

**Deployment:**
- Production: Static files served by Express
- Development: Vite dev server with HMR
- Infomaniak: Custom deployment scripts (`deploy-server.sh`, `rebuild-and-verify.sh`)

---

## 2. Routing & Module Overview

### Frontend Routes (`client/src/App.tsx`)

| Route | Component | Status | Notes |
|-------|-----------|--------|-------|
| `/login` | `Login.tsx` | ✅ Complete | Supabase email/password auth |
| `/` | `Jobs` | ✅ Complete | Redirects to jobs list |
| `/jobs` | `Jobs` | ✅ Complete | List view with filters |
| `/jobs/:id` | `JobDetail` | ✅ Complete | Full job details, tasks, images |
| `/contacts` | `Contacts` | ✅ Complete | CRUD with map integration |
| `/invoices` | `Invoices` | ✅ Complete | File upload, PDF preview |
| `/notes` | `Notes` | ✅ Complete | CRUD with job/contact linking |
| `/reports` | `Reports` | ⚠️ Partial | List view only, no creation UI |
| `/calendar` | `Calendar` | ✅ Complete | Monthly/weekly/daily views |
| `/maps` | `Maps` | ✅ Complete | Google Maps with markers |
| `/404` | `NotFound` | ✅ Complete | 404 page |

### tRPC Routes (`server/routers.ts`)

**Complete Modules:**
- ✅ **jobs** - `list`, `getById`, `create`, `update`, `delete`
- ✅ **tasks** - `listByJob`, `getById`, `create`, `update`, `delete`
- ✅ **images** - `listByJob`, `listByTask`, `upload`, `delete`
- ✅ **contacts** - `list`, `getById`, `create`, `update`, `delete`, `linkToJob`, `unlinkFromJob`, `getJobContacts`
- ✅ **invoices** - `list`, `getByJob`, `getByContact`, `create`, `delete`
- ✅ **notes** - `list`, `getById`, `getByJob`, `getByContact`, `create`, `update`, `delete`
- ✅ **locations** - `list`, `getByType`, `getByJob`, `getByContact`, `create`, `update`, `delete`, `geocode`
- ✅ **comments** - `listByJob`, `listByTask`, `create`, `delete`
- ✅ **calendar** - `getEvents` (date range query)

**Partial Modules:**
- ⚠️ **reports** - `listByJob`, `create`, `delete` (no frontend creation UI)
- ⚠️ **users** - `list` only (no CRUD)
- ⚠️ **export** - `jobPDF` only (PDF generation)

**System Routes:**
- ✅ **system** - `health`, `notifyOwner`
- ✅ **auth** - `me`, `logout`

### Module Completeness Matrix

| Module | Backend | Frontend | Database | Status |
|--------|---------|----------|----------|--------|
| **Jobs** | ✅ Complete | ✅ Complete | ✅ Complete | **Production Ready** |
| **Tasks** | ✅ Complete | ✅ Complete | ✅ Complete | **Production Ready** |
| **Contacts** | ✅ Complete | ✅ Complete | ✅ Complete | **Production Ready** |
| **Invoices** | ✅ Complete | ✅ Complete | ✅ Complete | **Production Ready** |
| **Notes** | ✅ Complete | ✅ Complete | ✅ Complete | **Production Ready** |
| **Images** | ✅ Complete | ✅ Complete | ✅ Complete | **Production Ready** |
| **Maps** | ✅ Complete | ✅ Complete | ✅ Complete | **Production Ready** |
| **Calendar** | ✅ Complete | ✅ Complete | ✅ Complete | **Production Ready** |
| **Reports** | ⚠️ Partial | ⚠️ Partial | ✅ Complete | **Needs Frontend UI** |
| **Comments** | ✅ Complete | ❌ Missing | ✅ Complete | **Needs Frontend UI** |
| **Users** | ⚠️ Partial | ❌ Missing | ✅ Complete | **Needs Admin UI** |
| **Settings** | ❌ Missing | ❌ Missing | ❌ Missing | **Not Started** |

---

## 3. Database Schema

### Current Tables (`drizzle/schema.ts`)

**Core Tables:**
1. **users** - User accounts (Supabase auth integration)
   - `id`, `supabaseId`, `name`, `email`, `loginMethod`, `role`, `createdAt`, `updatedAt`, `lastSignedIn`

2. **jobs** - Construction projects
   - `id`, `title`, `description`, `location`, `latitude`, `longitude`, `status`, `dateMode`, `startDate`, `endDate`, `contactId`, `createdBy`, `createdAt`, `updatedAt`

3. **jobDates** - Individual dates for jobs (when `dateMode = 'individual'`)
   - `id`, `jobId`, `date`, `createdAt`

4. **tasks** - Tasks within jobs
   - `id`, `jobId`, `title`, `description`, `status`, `priority`, `assignedTo`, `dueDate`, `createdBy`, `createdAt`, `updatedAt`

5. **images** - Uploaded images
   - `id`, `jobId`, `taskId`, `fileKey`, `url`, `filename`, `mimeType`, `fileSize`, `caption`, `uploadedBy`, `createdAt`

6. **reports** - Generated reports
   - `id`, `jobId`, `title`, `type`, `content`, `startDate`, `endDate`, `createdBy`, `createdAt`

7. **comments** - Comments on jobs/tasks
   - `id`, `jobId`, `taskId`, `content`, `createdBy`, `createdAt`, `updatedAt`

8. **contacts** - Client/contractor contacts
   - `id`, `name`, `email`, `phone`, `address`, `latitude`, `longitude`, `notes`, `createdBy`, `createdAt`, `updatedAt`

9. **jobContacts** - Many-to-many job-contact relationships
   - `id`, `jobId`, `contactId`, `role`, `createdAt`

10. **invoices** - Invoice file references
    - `id`, `filename`, `fileKey`, `fileSize`, `mimeType`, `jobId`, `contactId`, `uploadDate`, `uploadedBy`, `createdAt`

11. **notes** - User notes
    - `id`, `title`, `content`, `tags`, `jobId`, `contactId`, `createdBy`, `createdAt`, `updatedAt`

12. **locations** - Map location markers
    - `id`, `name`, `latitude`, `longitude`, `address`, `type`, `jobId`, `contactId`, `createdBy`, `createdAt`

### Schema Health

**✅ Well-Designed:**
- Proper foreign key relationships
- Timestamps on all tables (`createdAt`, `updatedAt`)
- User tracking (`createdBy`, `uploadedBy`)
- Flexible date handling (`dateMode` for jobs)
- Geocoding support (`latitude`, `longitude`)

**⚠️ Potential Issues:**
- `tags` in `notes` is a single `varchar(500)` - should be JSON or separate table for multi-tag support
- `content` in `reports` is `text` - no structured format (could be JSON)
- No soft deletes (hard deletes only)
- No audit trail for updates
- No file versioning for invoices/images

**❌ Missing Tables:**
- **settings** - User/application settings
- **notifications** - User notifications
- **activity_log** - Audit trail
- **tags** - Separate tags table (if multi-tag support needed)
- **file_versions** - File versioning
- **permissions** - Role-based permissions (beyond simple `role` enum)

### Unused/Incomplete Schemas

**Referenced but Not Fully Implemented:**
- `reports.content` - Stored but no rich text editor
- `notes.tags` - Single string, not parsed/used in UI
- `jobContacts.role` - Stored but not displayed in UI

---

## 4. Code Health

### Unused Files

**Potentially Unused:**
- `client/src/pages/Home.tsx` - Placeholder/example page (not linked in router)
- `client/src/components/ManusDialog.tsx` - Legacy Manus component (should be removed)
- `server/_core/sdk.ts` - Legacy Manus SDK (replaced by Supabase)
- `server/_core/types/manusTypes.ts` - Legacy Manus types (should be removed)
- `server/_core/llm.ts` - AI/LLM integration (not used in routers)
- `server/_core/imageGeneration.ts` - Image generation (not used)
- `server/_core/voiceTranscription.ts` - Voice transcription (not used)
- `client/src/components/AIChatBox.tsx` - AI chat component (not used)

**Test Files (Keep):**
- `server/*.test.ts` - Vitest test files (should be maintained)

### Dead Code

**Legacy Manus OAuth:**
- `server/_core/sdk.ts` - Entire file (replaced by `supabase.ts`)
- `server/_core/types/manusTypes.ts` - Type definitions
- References in comments/docs mentioning "Manus OAuth"

**Unused Server Functions:**
- `server/_core/llm.ts` - No tRPC routes use this
- `server/_core/imageGeneration.ts` - No tRPC routes use this
- `server/_core/voiceTranscription.ts` - No tRPC routes use this

**Unused Frontend Components:**
- `AIChatBox.tsx` - Not imported anywhere
- `ManusDialog.tsx` - Legacy component

### Errors or Warnings

**Potential Issues:**
1. **Type Safety:**
   - Some `any` types in `server/routers.ts` (line 110, 142, 154)
   - Date handling in `jobDates` (normalized to UTC midnight)

2. **Error Handling:**
   - Inconsistent error handling across tRPC procedures
   - Some mutations don't return detailed error messages

3. **Performance:**
   - No pagination on list queries (could be slow with many records)
   - No database indexes defined (rely on primary keys)

4. **Security:**
   - File upload size limit (50MB) but no file type validation
   - No rate limiting on API endpoints
   - No CSRF protection (relies on cookie-based auth)

### Duplicated Logic

**Geocoding:**
- Duplicated in `jobs.create`, `jobs.update`, `contacts.create`, `contacts.update`
- Should be extracted to shared utility

**Location Creation:**
- Auto-creation of map markers duplicated in job/contact create/update
- Should be extracted to shared function

**Error Messages:**
- Toast error messages duplicated across components
- Could use shared error handler

### Outdated/Inconsistent Patterns

**Inconsistent:**
- Some components use `trpc.useUtils()` directly, others use `trpc.useContext()`
- Mix of `useState` and `useQuery` for loading states
- Some dialogs use controlled state, others use uncontrolled

**Outdated:**
- README mentions "OAuth 2.0 (Manus)" - should be updated to Supabase
- Environment variable docs reference old Manus vars
- Some comments reference "Manus" instead of "Supabase"

---

## 5. Missing Core Features

### Projects Module

**Status:** ✅ **COMPLETE** (called "Jobs" in the app)

The "Jobs" module IS the Projects module. It's fully implemented:
- ✅ CRUD operations
- ✅ Status tracking
- ✅ Date management (range or individual dates)
- ✅ Contact linking
- ✅ Task management
- ✅ Image gallery
- ✅ Map integration
- ✅ PDF export

**Recommendation:** Consider renaming "Jobs" to "Projects" for clarity, or keep "Jobs" if it's industry-standard terminology.

### Tasks

**Status:** ✅ **COMPLETE**

- ✅ Full CRUD
- ✅ Status workflow (todo → in_progress → review → completed)
- ✅ Priority levels
- ✅ Assignment to users
- ✅ Due dates
- ✅ Linked to jobs

### Contacts

**Status:** ✅ **COMPLETE**

- ✅ Full CRUD
- ✅ Contact information (name, email, phone, address)
- ✅ Geocoding integration
- ✅ Map markers
- ✅ Job linking (many-to-many)
- ✅ Invoice linking

### Invoices

**Status:** ✅ **COMPLETE**

- ✅ File upload to S3
- ✅ PDF preview modal
- ✅ Job/contact linking
- ✅ List view with filters
- ⚠️ No invoice generation (only file upload)

### Image Uploads

**Status:** ✅ **COMPLETE**

- ✅ Upload to S3
- ✅ Gallery view
- ✅ Lightbox with annotation tools
- ✅ Drawing, highlighting, erasing
- ✅ Pan & zoom
- ✅ Save edited images
- ✅ Linked to jobs/tasks

### Reports

**Status:** ⚠️ **PARTIAL**

**Backend:** ✅ Complete
- `create`, `listByJob`, `delete` procedures
- Database schema complete

**Frontend:** ⚠️ Incomplete
- List view exists (`Reports.tsx`)
- No creation UI
- No editing UI
- No report generation UI

**Missing:**
- Report creation form
- Report template selection
- Report content editor
- Report preview
- Report download/export

### Calendar

**Status:** ✅ **COMPLETE**

- ✅ Monthly/weekly/daily views
- ✅ Job date display
- ✅ Clickable dates
- ✅ Event list popup
- ✅ Navigation to job details
- ✅ Green accent color (brand)

### Settings

**Status:** ❌ **MISSING**

**No Settings Module:**
- No user profile settings
- No application settings
- No preferences
- No notification settings
- No theme toggle (hardcoded dark mode)

**Recommendation:** Create settings module for:
- User profile (name, email, avatar)
- Application preferences
- Notification preferences
- Theme toggle (if needed)

### Authentication Flows

**Status:** ✅ **COMPLETE**

- ✅ Supabase email/password authentication
- ✅ Login page
- ✅ Session management (cookies)
- ✅ Protected routes
- ✅ Logout functionality
- ✅ User context (`useAuth` hook)

**Missing:**
- Password reset flow
- Email verification
- Social login (Google, etc.)
- Two-factor authentication

---

## 6. Suggestions for Project Structure

### Current Structure Analysis

**✅ Good:**
- Clear separation of `client/`, `server/`, `shared/`
- Component library in `components/ui/`
- Type-safe end-to-end with tRPC
- Consistent naming (camelCase for functions, PascalCase for components)

**⚠️ Could Improve:**
- `server/_core/` has mixed concerns (auth, storage, geocoding, etc.)
- No feature-based organization (all routers in one file)
- Test files scattered (`server/*.test.ts`)

### Recommended Improvements

#### 1. Directory Layout

**Current:**
```
server/
├── _core/          # Mixed concerns
├── routers.ts     # All routers in one file
└── db.ts          # All queries in one file
```

**Recommended:**
```
server/
├── _core/              # Core infrastructure only
│   ├── index.ts
│   ├── context.ts
│   ├── trpc.ts
│   ├── supabase.ts
│   └── env.ts
├── modules/            # Feature-based organization
│   ├── jobs/
│   │   ├── router.ts
│   │   ├── db.ts
│   │   └── types.ts
│   ├── tasks/
│   ├── contacts/
│   └── ...
├── services/           # Shared services
│   ├── geocoding.ts
│   ├── storage.ts
│   └── pdfExport.ts
└── routers.ts          # Aggregate all module routers
```

#### 2. Naming Conventions

**Current Issues:**
- "Jobs" vs "Projects" (unclear)
- Some files use `createX`, others use `addX`
- Inconsistent error message formats

**Recommendations:**
- Standardize on "Projects" or "Jobs" (pick one)
- Use consistent verb patterns: `create`, `update`, `delete`, `get`, `list`
- Standardize error messages: `"Failed to {action}: {reason}"`

#### 3. Module Boundaries

**Current:**
- All routers in `routers.ts` (700 lines)
- All DB queries in `db.ts` (574 lines)
- Mixed concerns in `_core/`

**Recommended:**
- Split routers by feature module
- Co-locate DB queries with routers
- Extract shared services to `services/`
- Keep `_core/` minimal (only infrastructure)

#### 4. Maintainability Improvements

**Code Organization:**
1. **Feature Modules:** Group related code (router + DB + types)
2. **Shared Services:** Extract reusable logic (geocoding, storage)
3. **Type Safety:** Use Zod schemas consistently for validation
4. **Error Handling:** Centralized error handling middleware

**Testing:**
- Move tests to `server/modules/*/__tests__/`
- Add integration tests for critical flows
- Add E2E tests for user journeys

**Documentation:**
- Add JSDoc comments to public APIs
- Document environment variables
- Add architecture decision records (ADRs)

**Performance:**
- Add pagination to list queries
- Add database indexes for foreign keys
- Implement query result caching where appropriate

---

## 7. Recommended Starting Point for Development

### Assumption: Building Projects Module First

**Note:** The Projects module (called "Jobs") is **already complete**. If you want to rebuild it from scratch, here's the recommended approach:

### Phase 1: Database Schema

1. **Create schema** (`drizzle/schema.ts`):
   ```typescript
   export const projects = mysqlTable("projects", {
     id: int("id").autoincrement().primaryKey(),
     title: varchar("title", { length: 255 }).notNull(),
     description: text("description"),
     status: mysqlEnum("status", ["planning", "active", "on_hold", "completed", "cancelled"]),
     // ... other fields
   });
   ```

2. **Run migration:**
   ```bash
   npm run db:push
   ```

### Phase 2: Backend (tRPC Router)

1. **Create DB functions** (`server/modules/projects/db.ts`):
   ```typescript
   export async function createProject(data: InsertProject) {
     const db = await getDb();
     return await db.insert(projects).values(data);
   }
   // ... other functions
   ```

2. **Create tRPC router** (`server/modules/projects/router.ts`):
   ```typescript
   export const projectsRouter = router({
     list: protectedProcedure.query(async () => {
       return await db.getAllProjects();
     }),
     create: protectedProcedure
       .input(z.object({ title: z.string().min(1) }))
       .mutation(async ({ input, ctx }) => {
         return await db.createProject({ ...input, createdBy: ctx.user.id });
       }),
     // ... other procedures
   });
   ```

3. **Add to main router** (`server/routers.ts`):
   ```typescript
   import { projectsRouter } from "./modules/projects/router";
   
   export const appRouter = router({
     projects: projectsRouter,
     // ... other routers
   });
   ```

### Phase 3: Frontend (React Components)

1. **Create list page** (`client/src/pages/Projects.tsx`):
   ```typescript
   export default function Projects() {
     const { data: projects } = trpc.projects.list.useQuery();
     // ... render list
   }
   ```

2. **Create detail page** (`client/src/pages/ProjectDetail.tsx`):
   ```typescript
   export default function ProjectDetail() {
     const [, params] = useRoute("/projects/:id");
     const { data: project } = trpc.projects.getById.useQuery({ id: parseInt(params.id) });
     // ... render details
   }
   ```

3. **Add routes** (`client/src/App.tsx`):
   ```typescript
   <Route path="/projects">
     <DashboardLayout>
       <Projects />
     </DashboardLayout>
   </Route>
   ```

### Phase 4: Testing

1. **Unit tests** (`server/modules/projects/__tests__/db.test.ts`):
   ```typescript
   describe("createProject", () => {
     it("should create a project", async () => {
       // ... test
     });
   });
   ```

2. **Integration tests** (`server/modules/projects/__tests__/router.test.ts`):
   ```typescript
   describe("projects.list", () => {
     it("should return projects", async () => {
       // ... test
     });
   });
   ```

### Development Workflow

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Make changes:**
   - Backend: Edit `server/` files (auto-reloads)
   - Frontend: Edit `client/` files (HMR)

3. **Test:**
   ```bash
   npm run test
   ```

4. **Type check:**
   ```bash
   npm run check
   ```

5. **Build:**
   ```bash
   npm run build
   ```

---

## Summary

### What's Complete ✅
- **Jobs/Projects** - Fully functional
- **Tasks** - Complete with workflow
- **Contacts** - Complete with geocoding
- **Invoices** - File management complete
- **Images** - Upload + annotation tools
- **Maps** - Google Maps integration
- **Calendar** - Full calendar views
- **Notes** - CRUD complete
- **Authentication** - Supabase integration

### What's Partial ⚠️
- **Reports** - Backend complete, frontend UI missing
- **Comments** - Backend complete, frontend UI missing
- **Users** - List only, no admin UI

### What's Missing ❌
- **Settings** - No settings module
- **Password Reset** - No password reset flow
- **Email Verification** - Not implemented
- **Social Login** - Only email/password

### Recommended Next Steps

1. **If rebuilding Projects:** Follow the phase-by-phase guide above
2. **If enhancing existing:** Focus on Reports frontend UI first
3. **If adding features:** Start with Settings module
4. **If improving codebase:** Refactor to feature-based modules

---

**End of Technical Overview**



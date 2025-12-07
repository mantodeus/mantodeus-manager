import type * as RealDbModule from "../db";
import type {
  Comment,
  Contact,
  FileMetadata,
  Image,
  InsertComment,
  InsertContact,
  InsertFileMetadata,
  InsertImage,
  InsertInvoice,
  InsertJob,
  InsertJobContact,
  InsertJobDate,
  InsertLocation,
  InsertNote,
  InsertProject,
  InsertProjectJob,
  InsertReport,
  InsertTask,
  Invoice,
  Job,
  JobContact,
  JobDate,
  Location,
  Note,
  Project,
  ProjectJob,
  Report,
  Task,
} from "../../drizzle/schema";
import { UI_DEV_USER, UI_DEV_USER_ID } from "./mockData";

type DbModule = typeof RealDbModule;

type InsertResult = Array<{ insertId: number }>;

type ProjectClientContact = Pick<
  Contact,
  "id" | "name" | "address" | "latitude" | "longitude"
>;
type ProjectWithClient = Project & {
  clientContact: ProjectClientContact | null;
};

const fixedNow = new Date("2024-01-05T12:00:00Z");

const ensureDate = (value?: Date | null): Date | null =>
  value ? new Date(value) : null;

const insertResult = (id: number): InsertResult => [{ insertId: id }];

const idCounters = {
  project: 2,
  projectJob: 3,
  fileMetadata: 2,
  job: 2,
  jobDate: 1,
  task: 3,
  image: 3,
  report: 2,
  comment: 3,
  contact: 3,
  invoice: 2,
  note: 3,
  location: 3,
  jobContact: 1,
};

const nextId = <T extends keyof typeof idCounters>(key: T): number => {
  idCounters[key] += 1;
  return idCounters[key];
};

const uiUser = UI_DEV_USER;

const contacts: Contact[] = [
  {
    id: 1,
    name: "Acme Construction",
    email: "hello@acme.example",
    phone: "555-0100",
    address: "123 Market St, San Francisco, CA",
    latitude: "37.7749",
    longitude: "-122.4194",
    notes: "Main client contact",
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 2,
    name: "Northwind Partners",
    email: "projects@northwind.example",
    phone: "555-0101",
    address: "62 Harbor Blvd, Oakland, CA",
    latitude: "37.8044",
    longitude: "-122.2711",
    notes: "Prefers SMS updates",
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
];

const projects: Project[] = [
  {
    id: 1,
    name: "Downtown Plaza Revamp",
    client: "Acme Construction",
    clientId: 1,
    description: "Facade refresh, lobby overhaul, and signage package.",
    startDate: new Date("2024-01-10T08:00:00Z"),
    endDate: new Date("2024-03-05T17:00:00Z"),
    address: "123 Market St, San Francisco, CA",
    geo: { lat: 37.7749, lng: -122.4194 },
    scheduledDates: null,
    status: "active",
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 2,
    name: "Northwind HQ Expansion",
    client: "Northwind Partners",
    clientId: 2,
    description: "New wing and updated conference center.",
    startDate: new Date("2024-02-01T08:00:00Z"),
    endDate: new Date("2024-04-15T17:00:00Z"),
    address: "62 Harbor Blvd, Oakland, CA",
    geo: { lat: 37.8044, lng: -122.2711 },
    scheduledDates: null,
    status: "planned",
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
];

const projectJobs: ProjectJob[] = [
  {
    id: 1,
    projectId: 1,
    title: "Lobby Renovation",
    category: "Interior",
    description: "Lighting, finishes, and concierge desk.",
    assignedUsers: [UI_DEV_USER_ID],
    status: "in_progress",
    startTime: new Date("2024-01-12T08:00:00Z"),
    endTime: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 2,
    projectId: 1,
    title: "Exterior Signage",
    category: "Branding",
    description: "Replace monument signage and wayfinding.",
    assignedUsers: [UI_DEV_USER_ID],
    status: "pending",
    startTime: null,
    endTime: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 3,
    projectId: 2,
    title: "Conference Wing Buildout",
    category: "Structure",
    description: "Steel framing and enclosure.",
    assignedUsers: [UI_DEV_USER_ID],
    status: "pending",
    startTime: null,
    endTime: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
];

const fileMetadata: FileMetadata[] = [
  {
    id: 1,
    projectId: 1,
    jobId: 1,
    s3Key: "projects/1/jobs/1/mock-progress-report.pdf",
    originalName: "progress-report.pdf",
    mimeType: "application/pdf",
    fileSize: 120_000,
    uploadedBy: UI_DEV_USER_ID,
    uploadedAt: fixedNow,
    imageMetadata: null,
  },
  {
    id: 2,
    projectId: 1,
    jobId: null,
    s3Key: "projects/1/_project/site-plan.png",
    originalName: "site-plan.png",
    mimeType: "image/png",
    fileSize: 45_000,
    uploadedBy: UI_DEV_USER_ID,
    uploadedAt: fixedNow,
    imageMetadata: null,
  },
];

const jobs: Job[] = [
  {
    id: 1,
    title: "Highrise Inspection Sprint",
    description: "Weekly structural walk-through and punch list.",
    location: "200 Howard St, San Francisco, CA",
    latitude: "37.7890",
    longitude: "-122.3917",
    status: "active",
    dateMode: "range",
    startDate: new Date("2024-01-08T08:00:00Z"),
    endDate: new Date("2024-01-20T17:00:00Z"),
    contactId: 1,
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 2,
    title: "Warehouse Retrofit",
    description: "Seismic retrofit and mezzanine install.",
    location: "845 Marina Blvd, Richmond, CA",
    latitude: "37.9123",
    longitude: "-122.3541",
    status: "planning",
    dateMode: "range",
    startDate: new Date("2024-02-05T08:00:00Z"),
    endDate: new Date("2024-03-10T17:00:00Z"),
    contactId: 2,
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
];

const tasks: Task[] = [
  {
    id: 1,
    jobId: 1,
    title: "Review steel welds",
    description: "Focus on podium level connections.",
    status: "in_progress",
    priority: "high",
    assignedTo: UI_DEV_USER_ID,
    dueDate: new Date("2024-01-12T17:00:00Z"),
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 2,
    jobId: 1,
    title: "Capture punch list photos",
    description: "North stairwell and penthouse.",
    status: "todo",
    priority: "medium",
    assignedTo: UI_DEV_USER_ID,
    dueDate: new Date("2024-01-15T17:00:00Z"),
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 3,
    jobId: 2,
    title: "Coordinate permit set",
    description: "Submit updated structural sheets.",
    status: "todo",
    priority: "urgent",
    assignedTo: UI_DEV_USER_ID,
    dueDate: new Date("2024-02-12T17:00:00Z"),
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
];

const jobDates: JobDate[] = [];

const images: Image[] = [
  {
    id: 1,
    jobId: 1,
    taskId: 2,
    projectId: null,
    fileKey: "legacy/images/job-1/photo-1.jpg",
    url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e",
    filename: "lobby-before.jpg",
    mimeType: "image/jpeg",
    fileSize: 150_000,
    caption: "Lobby before demolition",
    uploadedBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    imageMetadata: null,
  },
  {
    id: 2,
    jobId: 1,
    taskId: 2,
    projectId: null,
    fileKey: "legacy/images/job-1/photo-2.jpg",
    url: "https://images.unsplash.com/photo-1505739775417-85f6c92fb3ab",
    filename: "lobby-progress.jpg",
    mimeType: "image/jpeg",
    fileSize: 180_000,
    caption: "Progress shot - framing complete",
    uploadedBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    imageMetadata: null,
  },
  {
    id: 3,
    jobId: null,
    taskId: null,
    projectId: 1,
    fileKey: "projects/1/images/mock.jpg",
    url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e",
    filename: "project-overview.jpg",
    mimeType: "image/jpeg",
    fileSize: 210_000,
    caption: "Project moodboard shot",
    uploadedBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    imageMetadata: null,
  },
];

const reports: Report[] = [
  {
    id: 1,
    jobId: 1,
    title: "Week 1 Summary",
    type: "weekly",
    content: "Structural inspections completed for podium floors.",
    startDate: new Date("2024-01-08T08:00:00Z"),
    endDate: new Date("2024-01-12T17:00:00Z"),
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
  },
];

const comments: Comment[] = [
  {
    id: 1,
    jobId: 1,
    taskId: 1,
    content: "Waiting on updated weld schedule from GC.",
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 2,
    jobId: 1,
    taskId: null,
    content: "Uploaded new progress photos today.",
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 3,
    jobId: 2,
    taskId: null,
    content: "Permit set review scheduled with city next Wednesday.",
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
];

const invoices: Invoice[] = [
  {
    id: 1,
    filename: "acme-lobby-invoice.pdf",
    fileKey: "invoices/1/acme-lobby-invoice.pdf",
    fileSize: 250_000,
    mimeType: "application/pdf",
    jobId: 1,
    contactId: 1,
    uploadDate: new Date("2024-01-09T12:00:00Z"),
    uploadedBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
  },
];

const notes: Note[] = [
  {
    id: 1,
    title: "Site logistics",
    content: "Delivery window best between 10am-2pm.",
    tags: "logistics",
    jobId: 1,
    contactId: null,
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 2,
    title: "Owner preferences",
    content: "Prefers matte brass fixtures for lobby.",
    tags: "design",
    jobId: null,
    contactId: 1,
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 3,
    title: "Northwind kickoff",
    content: "Schedule stakeholder walkthrough before permit submission.",
    tags: "meeting",
    jobId: 2,
    contactId: 2,
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
];

const locations: Location[] = [
  {
    id: 1,
    name: "Downtown Plaza",
    latitude: "37.7749",
    longitude: "-122.4194",
    address: "123 Market St, San Francisco, CA",
    type: "job",
    jobId: 1,
    contactId: null,
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
  },
  {
    id: 2,
    name: "Northwind HQ",
    latitude: "37.8044",
    longitude: "-122.2711",
    address: "62 Harbor Blvd, Oakland, CA",
    type: "job",
    jobId: 2,
    contactId: null,
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
  },
  {
    id: 3,
    name: "Acme HQ",
    latitude: "37.7850",
    longitude: "-122.4010",
    address: "50 Main St, San Francisco, CA",
    type: "contact",
    jobId: null,
    contactId: 1,
    createdBy: UI_DEV_USER_ID,
    createdAt: fixedNow,
  },
];

const jobContacts: JobContact[] = [
  {
    id: 1,
    jobId: 1,
    contactId: 1,
    role: "Owner",
    createdAt: fixedNow,
  },
];

const withClientContact = (project: Project): ProjectWithClient => {
  const contact =
    (project.clientId &&
      contacts.find((contact) => contact.id === project.clientId)) ||
    null;
  const clientContact: ProjectClientContact | null = contact
    ? {
        id: contact.id,
        name: contact.name,
        address: contact.address,
        latitude: contact.latitude,
        longitude: contact.longitude,
      }
    : null;
  return { ...project, clientContact };
};

const findProject = (id: number) => projects.find((project) => project.id === id);
const findProjectJob = (id: number) =>
  projectJobs.find((job) => job.id === id) || null;

const addProject = (payload: InsertProject) => {
  const id = nextId("project");
  const now = new Date();
  const project: Project = {
    id,
    name: payload.name,
    client: payload.client ?? null,
    clientId: payload.clientId ?? null,
    description: payload.description ?? null,
    startDate: ensureDate(payload.startDate),
    endDate: ensureDate(payload.endDate),
    address: payload.address ?? null,
    geo: payload.geo ?? null,
    scheduledDates: payload.scheduledDates ?? null,
    status: payload.status ?? "planned",
    createdBy: payload.createdBy ?? UI_DEV_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  projects.push(project);
  return project;
};

const addProjectJob = (payload: InsertProjectJob) => {
  const id = nextId("projectJob");
  const now = new Date();
  const job: ProjectJob = {
    id,
    projectId: payload.projectId,
    title: payload.title,
    category: payload.category ?? null,
    description: payload.description ?? null,
    assignedUsers: payload.assignedUsers ?? null,
    status: payload.status ?? "pending",
    startTime: ensureDate(payload.startTime),
    endTime: ensureDate(payload.endTime),
    createdAt: now,
    updatedAt: now,
  };
  projectJobs.push(job);
  return job;
};

const addJob = (payload: InsertJob) => {
  const id = nextId("job");
  const now = new Date();
  const job: Job = {
    id,
    title: payload.title ?? "Untitled Job",
    description: payload.description ?? null,
    location: payload.location ?? null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    status: payload.status ?? "planning",
    dateMode: payload.dateMode ?? "range",
    startDate: ensureDate(payload.startDate),
    endDate: ensureDate(payload.endDate),
    contactId: payload.contactId ?? null,
    createdBy: payload.createdBy ?? UI_DEV_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  jobs.push(job);
  return job;
};

const addTask = (payload: InsertTask) => {
  const id = nextId("task");
  const now = new Date();
  const task: Task = {
    id,
    jobId: payload.jobId,
    title: payload.title ?? "Untitled task",
    description: payload.description ?? null,
    status: payload.status ?? "todo",
    priority: payload.priority ?? "medium",
    assignedTo: payload.assignedTo ?? null,
    dueDate: ensureDate(payload.dueDate),
    createdBy: payload.createdBy ?? UI_DEV_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  return task;
};

const addImage = (payload: InsertImage) => {
  const id = nextId("image");
  const now = new Date();
  const image: Image = {
    id,
    jobId: payload.jobId ?? null,
    taskId: payload.taskId ?? null,
    projectId: payload.projectId ?? null,
    fileKey: payload.fileKey ?? `mock/image-${id}.jpg`,
    url:
      payload.url ??
      "https://images.unsplash.com/photo-1505739775417-85f6c92fb3ab",
    filename: payload.filename ?? `image-${id}.jpg`,
    mimeType: payload.mimeType ?? "image/jpeg",
    fileSize: payload.fileSize ?? 150_000,
    caption: payload.caption ?? null,
    uploadedBy: payload.uploadedBy ?? UI_DEV_USER_ID,
    createdAt: now,
    imageMetadata: (payload as Image).imageMetadata ?? null,
  };
  images.push(image);
  return image;
};

const addReport = (payload: InsertReport) => {
  const id = nextId("report");
  const now = new Date();
  const report: Report = {
    id,
    jobId: payload.jobId,
    title: payload.title ?? "Report",
    type: payload.type ?? "custom",
    content: payload.content ?? null,
    startDate: ensureDate(payload.startDate),
    endDate: ensureDate(payload.endDate),
    createdBy: payload.createdBy ?? UI_DEV_USER_ID,
    createdAt: now,
  };
  reports.push(report);
  return report;
};

const addComment = (payload: InsertComment) => {
  const id = nextId("comment");
  const now = new Date();
  const comment: Comment = {
    id,
    jobId: payload.jobId ?? null,
    taskId: payload.taskId ?? null,
    content: payload.content,
    createdBy: payload.createdBy ?? UI_DEV_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  comments.push(comment);
  return comment;
};

const addContact = (payload: InsertContact) => {
  const id = nextId("contact");
  const now = new Date();
  const contact: Contact = {
    id,
    name: payload.name ?? "New Contact",
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    address: payload.address ?? null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    notes: payload.notes ?? null,
    createdBy: payload.createdBy ?? UI_DEV_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  contacts.push(contact);
  return contact;
};

const addLocation = (payload: InsertLocation) => {
  const id = nextId("location");
  const now = new Date();
  const location: Location = {
    id,
    name: payload.name ?? "Location",
    latitude: payload.latitude,
    longitude: payload.longitude,
    address: payload.address ?? null,
    type: payload.type ?? "custom",
    jobId: payload.jobId ?? null,
    contactId: payload.contactId ?? null,
    createdBy: payload.createdBy ?? UI_DEV_USER_ID,
    createdAt: now,
  };
  locations.push(location);
  return location;
};

const addInvoice = (payload: InsertInvoice) => {
  const id = nextId("invoice");
  const now = new Date();
  const invoice: Invoice = {
    id,
    filename: payload.filename ?? `invoice-${id}.pdf`,
    fileKey: payload.fileKey ?? `invoices/${id}/invoice.pdf`,
    fileSize: payload.fileSize ?? 100_000,
    mimeType: payload.mimeType ?? "application/pdf",
    jobId: payload.jobId ?? null,
    contactId: payload.contactId ?? null,
    uploadDate: ensureDate(payload.uploadDate),
    uploadedBy: payload.uploadedBy ?? UI_DEV_USER_ID,
    createdAt: now,
  };
  invoices.push(invoice);
  return invoice;
};

const addNote = (payload: InsertNote) => {
  const id = nextId("note");
  const now = new Date();
  const note: Note = {
    id,
    title: payload.title ?? "Untitled Note",
    content: payload.content ?? null,
    tags: payload.tags ?? null,
    jobId: payload.jobId ?? null,
    contactId: payload.contactId ?? null,
    createdBy: payload.createdBy ?? UI_DEV_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  return note;
};

const addJobDate = (payload: InsertJobDate) => {
  const id = nextId("jobDate");
  const jobDate: JobDate = {
    id,
    jobId: payload.jobId,
    date: payload.date,
    createdAt: new Date(),
  };
  jobDates.push(jobDate);
  return jobDate;
};

const addJobContact = (payload: InsertJobContact) => {
  const id = nextId("jobContact");
  const jobContact: JobContact = {
    id,
    jobId: payload.jobId,
    contactId: payload.contactId,
    role: payload.role ?? null,
    createdAt: new Date(),
  };
  jobContacts.push(jobContact);
  return jobContact;
};

const addFileMetadata = (payload: InsertFileMetadata) => {
  const id = nextId("fileMetadata");
  const record: FileMetadata = {
    id,
    projectId: payload.projectId,
    jobId: payload.jobId ?? null,
    s3Key: payload.s3Key,
    originalName: payload.originalName,
    mimeType: payload.mimeType,
    fileSize: payload.fileSize ?? null,
    uploadedBy: payload.uploadedBy ?? UI_DEV_USER_ID,
    uploadedAt: new Date(),
    imageMetadata: payload.imageMetadata ?? null,
  };
  fileMetadata.push(record);
  return record;
};

const baseMock: Partial<DbModule> = {
  getAllUsers: async () => [uiUser],
  upsertUser: async () => {},
  getUserBySupabaseId: async (supabaseId: string) =>
    supabaseId === uiUser.supabaseId ? uiUser : undefined,

  // Projects
  getAllProjects: async () => projects.map(withClientContact),
  getProjectsByUser: async (userId: number) =>
    projects.filter((project) => project.createdBy === userId).map(withClientContact),
  getProjectById: async (projectId: number) => {
    const project = findProject(projectId);
    return project ? withClientContact(project) : null;
  },
  createProject: async (payload: InsertProject) => insertResult(addProject(payload).id),
  updateProject: async (projectId: number, updates: Partial<InsertProject>) => {
    const project = findProject(projectId);
    if (!project) return;
    Object.assign(project, updates, {
      updatedAt: new Date(),
      startDate:
        updates.startDate !== undefined ? ensureDate(updates.startDate) : project.startDate,
      endDate:
        updates.endDate !== undefined ? ensureDate(updates.endDate) : project.endDate,
      scheduledDates:
        updates.scheduledDates !== undefined
          ? updates.scheduledDates
          : project.scheduledDates,
      geo: updates.geo !== undefined ? updates.geo : project.geo,
    });
  },
  archiveProject: async (projectId: number) => {
    const project = findProject(projectId);
    if (project) project.status = "archived";
  },
  deleteProject: async (projectId: number) => {
    const index = projects.findIndex((project) => project.id === projectId);
    if (index >= 0) {
      projects.splice(index, 1);
    }
  },

  getProjectJobsByProjectId: async (projectId: number) =>
    projectJobs.filter((job) => job.projectId === projectId),
  getProjectJobById: async (jobId: number) => findProjectJob(jobId),
  createProjectJob: async (payload: InsertProjectJob) =>
    insertResult(addProjectJob(payload).id),
  updateProjectJob: async (jobId: number, updates: Partial<InsertProjectJob>) => {
    const job = projectJobs.find((entry) => entry.id === jobId);
    if (!job) return;
    Object.assign(job, updates, {
      updatedAt: new Date(),
      startTime:
        updates.startTime !== undefined ? ensureDate(updates.startTime) : job.startTime,
      endTime: updates.endTime !== undefined ? ensureDate(updates.endTime) : job.endTime,
    });
  },
  deleteProjectJob: async (jobId: number) => {
    const idx = projectJobs.findIndex((entry) => entry.id === jobId);
    if (idx >= 0) {
      projectJobs.splice(idx, 1);
    }
  },

  getFileMetadataById: async (id: number) =>
    fileMetadata.find((file) => file.id === id) ?? null,
  getFileMetadataByS3Key: async (s3Key: string) =>
    fileMetadata.find((file) => file.s3Key === s3Key) ?? null,
  createFileMetadata: async (payload: InsertFileMetadata) =>
    insertResult(addFileMetadata(payload).id),
  getFilesByProjectId: async (projectId: number) =>
    fileMetadata.filter((file) => file.projectId === projectId),
  getFilesByJobId: async (projectId: number, jobId: number) =>
    fileMetadata.filter(
      (file) => file.projectId === projectId && file.jobId === jobId
    ),
  deleteFileMetadata: async (id: number) => {
    const idx = fileMetadata.findIndex((file) => file.id === id);
    if (idx >= 0) fileMetadata.splice(idx, 1);
  },

  // Legacy jobs
  getAllJobs: async () => jobs,
  getJobById: async (jobId: number) =>
    jobs.find((job) => job.id === jobId) ?? null,
  createJob: async (payload: InsertJob) => insertResult(addJob(payload).id),
  updateJob: async (jobId: number, updates: Partial<InsertJob>) => {
    const job = jobs.find((entry) => entry.id === jobId);
    if (!job) return;
    Object.assign(job, updates, {
      updatedAt: new Date(),
      startDate:
        updates.startDate !== undefined ? ensureDate(updates.startDate) : job.startDate,
      endDate: updates.endDate !== undefined ? ensureDate(updates.endDate) : job.endDate,
    });
  },
  deleteJob: async (jobId: number) => {
    const idx = jobs.findIndex((entry) => entry.id === jobId);
    if (idx >= 0) jobs.splice(idx, 1);
  },

  // Job dates
  deleteJobDates: async (jobId: number) => {
    for (let i = jobDates.length - 1; i >= 0; i -= 1) {
      if (jobDates[i].jobId === jobId) jobDates.splice(i, 1);
    }
  },
  createJobDate: async (payload: InsertJobDate) => insertResult(addJobDate(payload).id),
  getJobDates: async (jobId: number) =>
    jobDates.filter((entry) => entry.jobId === jobId),

  // Tasks
  getTasksByJobId: async (jobId: number) =>
    tasks.filter((task) => task.jobId === jobId),
  getTaskById: async (taskId: number) =>
    tasks.find((task) => task.id === taskId) ?? null,
  createTask: async (payload: InsertTask) => insertResult(addTask(payload).id),
  updateTask: async (taskId: number, updates: Partial<InsertTask>) => {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task) return;
    Object.assign(task, updates, {
      updatedAt: new Date(),
      dueDate:
        updates.dueDate !== undefined ? ensureDate(updates.dueDate) : task.dueDate,
    });
  },
  deleteTask: async (taskId: number) => {
    const idx = tasks.findIndex((entry) => entry.id === taskId);
    if (idx >= 0) tasks.splice(idx, 1);
  },

  // Images
  getImagesByJobId: async (jobId: number) =>
    images.filter((image) => image.jobId === jobId),
  getImagesByTaskId: async (taskId: number) =>
    images.filter((image) => image.taskId === taskId),
  createImage: async (payload: InsertImage) => insertResult(addImage(payload).id),
  getImageById: async (id: number) => images.find((image) => image.id === id) ?? null,
  deleteImage: async (id: number) => {
    const idx = images.findIndex((image) => image.id === id);
    if (idx >= 0) images.splice(idx, 1);
  },

  // Reports
  getReportsByJobId: async (jobId: number) =>
    reports.filter((report) => report.jobId === jobId),
  createReport: async (payload: InsertReport) => insertResult(addReport(payload).id),
  deleteReport: async (id: number) => {
    const idx = reports.findIndex((report) => report.id === id);
    if (idx >= 0) reports.splice(idx, 1);
  },

  // Calendar
  getCalendarEvents: async (startDate: Date, endDate: Date) => {
    const rangeStart = startDate.getTime();
    const rangeEnd = endDate.getTime();
    return jobs
      .map((job) => ({
        id: job.id,
        title: job.title,
        date: job.startDate ?? job.endDate ?? new Date(),
        type: "job" as const,
        status: job.status,
        description: job.description,
      }))
      .concat(
        tasks.map((task) => ({
          id: task.id,
          title: task.title,
          date: task.dueDate ?? new Date(),
          type: "task" as const,
          status: task.status,
          description: task.description,
        }))
      )
      .filter((event) => {
        const time = new Date(event.date ?? new Date()).getTime();
        return time >= rangeStart && time <= rangeEnd;
      })
      .sort((a, b) => {
        const at = new Date(a.date ?? new Date()).getTime();
        const bt = new Date(b.date ?? new Date()).getTime();
        return at - bt;
      });
  },

  // Comments
  getCommentsByJobId: async (jobId: number) =>
    comments.filter((comment) => comment.jobId === jobId),
  getCommentsByTaskId: async (taskId: number) =>
    comments.filter((comment) => comment.taskId === taskId),
  createComment: async (payload: InsertComment) => insertResult(addComment(payload).id),
  deleteComment: async (id: number) => {
    const idx = comments.findIndex((comment) => comment.id === id);
    if (idx >= 0) comments.splice(idx, 1);
  },

  // Contacts
  getContactsByUser: async (userId: number) =>
    contacts.filter((contact) => contact.createdBy === userId),
  getContactById: async (id: number) =>
    contacts.find((contact) => contact.id === id) ?? null,
  createContact: async (payload: InsertContact) => insertResult(addContact(payload).id),
  updateContact: async (contactId: number, updates: Partial<InsertContact>) => {
    const contact = contacts.find((entry) => entry.id === contactId);
    if (!contact) return;
    Object.assign(contact, updates, {
      updatedAt: new Date(),
    });
  },
  deleteContact: async (contactId: number) => {
    const idx = contacts.findIndex((entry) => entry.id === contactId);
    if (idx >= 0) contacts.splice(idx, 1);
  },

  // Job contacts
  getJobContacts: async (jobId: number) =>
    jobContacts.filter((entry) => entry.jobId === jobId),
  linkJobContact: async (jobId: number, contactId: number, role?: string) =>
    addJobContact({ jobId, contactId, role: role ?? null }),
  unlinkJobContact: async (jobId: number, contactId: number) => {
    const idx = jobContacts.findIndex(
      (entry) => entry.jobId === jobId && entry.contactId === contactId
    );
    if (idx >= 0) jobContacts.splice(idx, 1);
  },

  // Invoices
  getInvoicesByUser: async (userId: number) =>
    invoices.filter((invoice) => invoice.uploadedBy === userId),
  getInvoicesByJob: async (jobId: number) =>
    invoices.filter((invoice) => invoice.jobId === jobId),
  getInvoicesByContact: async (contactId: number) =>
    invoices.filter((invoice) => invoice.contactId === contactId),
  createInvoice: async (payload: InsertInvoice) => insertResult(addInvoice(payload).id),
  getInvoiceById: async (id: number) =>
    invoices.find((invoice) => invoice.id === id) ?? null,
  deleteInvoice: async (id: number) => {
    const idx = invoices.findIndex((invoice) => invoice.id === id);
    if (idx >= 0) invoices.splice(idx, 1);
  },

  // Notes
  getNotesByUser: async (userId: number) =>
    notes.filter((note) => note.createdBy === userId),
  getNotesByJob: async (jobId: number) =>
    notes.filter((note) => note.jobId === jobId),
  getNotesByContact: async (contactId: number) =>
    notes.filter((note) => note.contactId === contactId),
  getNoteById: async (id: number) => notes.find((note) => note.id === id) ?? undefined,
  createNote: async (payload: InsertNote) => insertResult(addNote(payload).id),
  updateNote: async (noteId: number, updates: Partial<InsertNote>) => {
    const note = notes.find((entry) => entry.id === noteId);
    if (!note) return;
    Object.assign(note, updates, {
      updatedAt: new Date(),
    });
  },
  deleteNote: async (noteId: number) => {
    const idx = notes.findIndex((entry) => entry.id === noteId);
    if (idx >= 0) notes.splice(idx, 1);
  },

  // Locations
  getLocationsByUser: async (userId: number) =>
    locations.filter((location) => location.createdBy === userId),
  getLocationsByType: async (type: Location["type"]) =>
    locations.filter((location) => location.type === type),
  getLocationsByJob: async (jobId: number) =>
    locations.filter((location) => location.jobId === jobId),
  getLocationsByContact: async (contactId: number) =>
    locations.filter((location) => location.contactId === contactId),
  createLocation: async (payload: InsertLocation) => insertResult(addLocation(payload).id),
  updateLocation: async (locationId: number, updates: Partial<InsertLocation>) => {
    const location = locations.find((entry) => entry.id === locationId);
    if (!location) return;
    Object.assign(location, updates);
  },
  deleteLocation: async (locationId: number) => {
    const idx = locations.findIndex((entry) => entry.id === locationId);
    if (idx >= 0) locations.splice(idx, 1);
  },

  // Export helpers
  getAllJobsByUser: async (userId: number) =>
    jobs.filter((job) => job.createdBy === userId),
  getAllTasksByUser: async (userId: number) =>
    tasks.filter((task) => task.createdBy === userId),
  getAllCommentsByUser: async (userId: number) =>
    comments.filter((comment) => comment.createdBy === userId),
  getAllReportsByUser: async (userId: number) =>
    reports.filter((report) => report.createdBy === userId),
  getAllJobDatesByUser: async (userId: number) => {
    const userJobIds = new Set(
      jobs.filter((job) => job.createdBy === userId).map((job) => job.id)
    );
    return jobDates.filter((date) => userJobIds.has(date.jobId));
  },
  getAllJobContactsByUser: async (userId: number) => {
    const userJobIds = new Set(
      jobs.filter((job) => job.createdBy === userId).map((job) => job.id)
    );
    return jobContacts.filter((entry) => userJobIds.has(entry.jobId));
  },
  getInvoicesByJob: async (jobId: number) =>
    invoices.filter((invoice) => invoice.jobId === jobId),
  getInvoicesByContact: async (contactId: number) =>
    invoices.filter((invoice) => invoice.contactId === contactId),
};

export const mockDb = new Proxy(baseMock, {
  get(target, prop: string) {
    if (prop in target) {
      return target[prop as keyof typeof target];
    }
    return async (...args: unknown[]) => {
      console.warn(`[DEV_MODE=ui] db.${prop} is not implemented`, args);
      return undefined;
    };
  },
}) as DbModule;

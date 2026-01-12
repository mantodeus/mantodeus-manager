/**
 * Preview Router - Public access version of the app with mock/test data
 * All procedures are public (no authentication required)
 * Returns sample data for demonstration purposes
 */

import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

// Mock data generators
const mockUser = {
  id: 999,
  supabaseId: "preview-user",
  name: "Preview User",
  email: "preview@mantodeus.com",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const mockProjects = [
  {
    id: 1,
    userId: 999,
    name: "Sample Rope Access Project",
    client: "Demo Client",
    clientId: null,
    description: "This is a sample project for preview purposes",
    startDate: new Date(),
    endDate: null,
    address: "123 Main St, Berlin, Germany",
    geo: { lat: 52.52, lng: 13.405 },
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: 2,
    userId: 999,
    name: "Building Inspection",
    client: "Another Client",
    clientId: null,
    description: "Inspection of building facade",
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    address: "456 Oak Ave, Munich, Germany",
    geo: { lat: 48.1351, lng: 11.582 },
    status: "completed" as const,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    archivedAt: null,
    trashedAt: null,
  },
];

const mockContacts = [
  {
    id: 1,
    userId: 999,
    name: "Demo Client",
    email: "client@example.com",
    phone: "+49 123 456789",
    address: "123 Client St, Berlin, Germany",
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    trashedAt: null,
  },
];

const mockInvoices = [
  {
    id: 1,
    userId: 999,
    invoiceNumber: "RE-2024-0001",
    status: "sent" as const,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    subtotal: 1000,
    vatAmount: 190,
    total: 1190,
    contactId: 1,
    clientId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    trashedAt: null,
  },
];

// Preview router - mirrors main router structure but with public procedures
export const previewRouter = router({
  auth: router({
    me: publicProcedure.query(() => mockUser),
    logout: publicProcedure.mutation(() => ({ success: true })),
  }),

  projects: router({
    list: publicProcedure.query(() => mockProjects),
    listArchived: publicProcedure.query(() => []),
    listTrashed: publicProcedure.query(() => []),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        const project = mockProjects.find((p) => p.id === input.id);
        if (!project) {
          throw new Error("Project not found");
        }
        return project;
      }),
    create: publicProcedure
      .input(z.any())
      .mutation(() => ({ id: 999, ...mockProjects[0] })),
    update: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    archive: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    archiveProject: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    restoreArchivedProject: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    restore: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    trash: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    moveProjectToTrash: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    restoreProjectFromTrash: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    deleteProject: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    deleteProjectPermanently: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    delete: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    duplicate: publicProcedure
      .input(z.any())
      .mutation(() => ({ id: 999, ...mockProjects[0] })),
    jobs: router({
      list: publicProcedure
        .input(z.object({ projectId: z.number() }))
        .query(() => []),
      getById: publicProcedure
        .input(z.object({ projectId: z.number(), jobId: z.number() }))
        .query(() => null),
      create: publicProcedure
        .input(z.any())
        .mutation(() => ({ id: 1 })),
      update: publicProcedure
        .input(z.any())
        .mutation(() => ({ success: true })),
      delete: publicProcedure
        .input(z.any())
        .mutation(() => ({ success: true })),
    }),
    checkIn: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true, checkInId: 1 })),
    checkOut: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
  }),

  contacts: router({
    list: publicProcedure.query(() => mockContacts),
    listArchived: publicProcedure.query(() => []),
    listTrashed: publicProcedure.query(() => []),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        const contact = mockContacts.find((c) => c.id === input.id);
        if (!contact) {
          throw new Error("Contact not found");
        }
        return contact;
      }),
    create: publicProcedure
      .input(z.any())
      .mutation(() => ({ id: 999, ...mockContacts[0] })),
    update: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    archive: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    restore: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    trash: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    delete: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
  }),

  invoices: router({
    list: publicProcedure.query(() => mockInvoices),
    listArchived: publicProcedure.query(() => []),
    listTrashed: publicProcedure.query(() => []),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => {
        const invoice = mockInvoices.find((i) => i.id === input.id);
        if (!invoice) {
          throw new Error("Invoice not found");
        }
        return invoice;
      }),
    create: publicProcedure
      .input(z.any())
      .mutation(() => ({ id: 999, ...mockInvoices[0] })),
    update: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    delete: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
  }),

  notes: router({
    list: publicProcedure.query(() => []),
    listArchived: publicProcedure.query(() => []),
    listTrashed: publicProcedure.query(() => []),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(() => null),
    create: publicProcedure
      .input(z.any())
      .mutation(() => ({ id: 1 })),
    update: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    archive: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    restore: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    trash: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
    delete: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
  }),

  // Add other routers with empty/mock implementations
  system: router({
    health: publicProcedure.query(() => ({ status: "ok", mode: "preview" })),
  }),

  settings: router({
    getCompany: publicProcedure.query(() => null),
    updateCompany: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: true })),
  }),

  inspections: router({
    list: publicProcedure.query(() => []),
    getById: publicProcedure
      .input(z.any())
      .query(() => null),
    create: publicProcedure
      .input(z.any())
      .mutation(() => ({ id: 1 })),
  }),

  expenses: router({
    list: publicProcedure.query(() => []),
    getById: publicProcedure
      .input(z.any())
      .query(() => null),
    create: publicProcedure
      .input(z.any())
      .mutation(() => ({ id: 1 })),
  }),

  ai: router({
    chat: publicProcedure
      .input(z.any())
      .mutation(() => ({ message: "Preview mode - AI disabled" })),
  }),

  documents: router({
    process: publicProcedure
      .input(z.any())
      .mutation(() => ({ success: false, message: "Preview mode - OCR disabled" })),
  }),

  pdf: router({
    generateInvoice: publicProcedure
      .input(z.any())
      .mutation(() => ({ url: "" })),
    generateProjectReport: publicProcedure
      .input(z.any())
      .mutation(() => ({ url: "" })),
  }),

  export: router({
    exportData: publicProcedure
      .input(z.any())
      .mutation(() => ({ url: "" })),
  }),
});

export type PreviewRouter = typeof previewRouter;

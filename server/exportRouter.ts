import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { generateJobPDFHTML } from "./pdfExport";
import type { Job, Task } from "../drizzle/schema";
import { normalizeExportPayload } from "../shared/importNormalizer";

// Schema for imported data
const importDataSchema = z.object({
  version: z.string(),
  exportedAt: z.string(),
  jobs: z.array(z.object({
    title: z.string(),
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    latitude: z.string().nullable().optional(),
    longitude: z.string().nullable().optional(),
    status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]),
    dateMode: z.enum(["range", "individual"]).optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    contactId: z.number().nullable().optional(),
    tasks: z.array(z.object({
      title: z.string(),
      description: z.string().nullable().optional(),
      status: z.enum(["todo", "in_progress", "review", "completed"]),
      priority: z.enum(["low", "medium", "high", "urgent"]),
      dueDate: z.string().nullable().optional(),
    })).optional(),
    comments: z.array(z.object({
      content: z.string(),
    })).optional(),
    reports: z.array(z.object({
      title: z.string(),
      type: z.enum(["daily", "weekly", "task_summary", "progress", "custom"]),
      content: z.string().nullable().optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
    })).optional(),
    individualDates: z.array(z.string()).optional(),
  })).optional(),
  contacts: z.array(z.object({
    name: z.string(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    latitude: z.string().nullable().optional(),
    longitude: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })).optional(),
  notes: z.array(z.object({
    title: z.string(),
    content: z.string().nullable().optional(),
    tags: z.string().nullable().optional(),
  })).optional(),
  locations: z.array(z.object({
    name: z.string(),
    latitude: z.string(),
    longitude: z.string(),
    address: z.string().nullable().optional(),
    type: z.enum(["job", "contact", "custom"]),
  })).optional(),
});

export const exportRouter = router({
  jobPDF: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const job = await db.getJobById(input.jobId);
      if (!job) throw new Error("Job not found");
      
      const tasks = await db.getTasksByJobId(input.jobId);
      const images = await db.getImagesByJobId(input.jobId);
      
      const jobData = {
        ...job,
        tasks,
        images: images.map(img => ({
          id: img.id,
          url: img.url,
          caption: img.caption || undefined,
        })),
      };
      
      const html = generateJobPDFHTML(jobData, "/mantodeus-logo.png", "Mantodeus Manager");
      const filename = job.title.replace(/\s+/g, "_") + "_report.pdf";
      
      return { html, filename };
    }),

  // Export all user data as JSON
  userData: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;

      // Fetch all user data in parallel
      const [
        jobs,
        tasks,
        contacts,
        notes,
        locations,
        comments,
        reports,
        jobDates,
        jobContacts,
      ] = await Promise.all([
        db.getAllJobsByUser(userId),
        db.getAllTasksByUser(userId),
        db.getContactsByUser(userId),
        db.getNotesByUser(userId),
        db.getLocationsByUser(userId),
        db.getAllCommentsByUser(userId),
        db.getAllReportsByUser(userId),
        db.getAllJobDatesByUser(userId),
        db.getAllJobContactsByUser(userId),
      ]);

      // Organize jobs with their related data
      const jobsWithRelations = jobs.map(job => {
        const jobTasks = tasks.filter(t => t.jobId === job.id).map(t => ({
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString() || null,
        }));

        const jobComments = comments.filter(c => c.jobId === job.id).map(c => ({
          content: c.content,
        }));

        const jobReports = reports.filter(r => r.jobId === job.id).map(r => ({
          title: r.title,
          type: r.type,
          content: r.content,
          startDate: r.startDate?.toISOString() || null,
          endDate: r.endDate?.toISOString() || null,
        }));

        const individualDates = jobDates
          .filter(jd => jd.jobId === job.id)
          .map(jd => jd.date.toISOString());

        return {
          title: job.title,
          description: job.description,
          location: job.location,
          latitude: job.latitude,
          longitude: job.longitude,
          status: job.status,
          dateMode: job.dateMode,
          startDate: job.startDate?.toISOString() || null,
          endDate: job.endDate?.toISOString() || null,
          tasks: jobTasks,
          comments: jobComments,
          reports: jobReports,
          individualDates: individualDates.length > 0 ? individualDates : undefined,
        };
      });

      // Export contacts (without relational IDs)
      const exportContacts = contacts.map(c => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
        notes: c.notes,
      }));

      // Export notes (without relational IDs for now, we'll link them by name if needed)
      const exportNotes = notes.map(n => ({
        title: n.title,
        content: n.content,
        tags: n.tags,
      }));

      // Export custom locations only (job/contact locations will be auto-created)
      const exportLocations = locations
        .filter(l => l.type === "custom")
        .map(l => ({
          name: l.name,
          latitude: l.latitude,
          longitude: l.longitude,
          address: l.address,
          type: l.type,
        }));

      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        jobs: jobsWithRelations,
        contacts: exportContacts,
        notes: exportNotes,
        locations: exportLocations,
      };

      return exportData;
    }),

  // Import user data from JSON
  importUserData: protectedProcedure
    .input(z.any())
    .mutation(async ({ input, ctx }) => {
      const normalizedInput = normalizeExportPayload(input);
      const parsedInput = importDataSchema.parse(normalizedInput);
      const userId = ctx.user.id;
      const results = {
        jobs: 0,
        tasks: 0,
        contacts: 0,
        notes: 0,
        locations: 0,
        comments: 0,
        reports: 0,
      };

      // 1. Import contacts first (jobs may reference them)
      if (parsedInput.contacts && parsedInput.contacts.length > 0) {
        for (const contact of parsedInput.contacts) {
          const result = await db.createContact({
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            address: contact.address || null,
            latitude: contact.latitude || null,
            longitude: contact.longitude || null,
            notes: contact.notes || null,
            createdBy: userId,
          });
          results.contacts++;

          // Auto-create location for contact if coordinates exist
          if (contact.latitude && contact.longitude) {
            await db.createLocation({
              name: contact.name,
              latitude: contact.latitude,
              longitude: contact.longitude,
              address: contact.address || null,
              type: "contact",
              jobId: null,
              contactId: result[0].id,
              createdBy: userId,
            });
          }
        }
      }

      // 2. Import jobs with their related data
      if (parsedInput.jobs && parsedInput.jobs.length > 0) {
        for (const job of parsedInput.jobs) {
          const jobResult = await db.createJob({
            title: job.title,
            description: job.description || null,
            location: job.location || null,
            latitude: job.latitude || null,
            longitude: job.longitude || null,
            status: job.status,
            dateMode: job.dateMode || "range",
            startDate: job.startDate ? new Date(job.startDate) : null,
            endDate: job.endDate ? new Date(job.endDate) : null,
            contactId: null, // We don't preserve contact relationships for simplicity
            createdBy: userId,
          });
          const newJobId = jobResult[0].id;
          results.jobs++;

          // Auto-create location for job if coordinates exist
          if (job.latitude && job.longitude) {
            await db.createLocation({
              name: job.title,
              latitude: job.latitude,
              longitude: job.longitude,
              address: job.location || null,
              type: "job",
              jobId: newJobId,
              contactId: null,
              createdBy: userId,
            });
          }

          // Import individual dates for this job
          if (job.individualDates && job.individualDates.length > 0) {
            for (const dateStr of job.individualDates) {
              await db.createJobDate({
                jobId: newJobId,
                date: new Date(dateStr),
              });
            }
          }

          // Import tasks for this job
          if (job.tasks && job.tasks.length > 0) {
            for (const task of job.tasks) {
              await db.createTask({
                jobId: newJobId,
                title: task.title,
                description: task.description || null,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate ? new Date(task.dueDate) : null,
                assignedTo: null,
                createdBy: userId,
              });
              results.tasks++;
            }
          }

          // Import comments for this job
          if (job.comments && job.comments.length > 0) {
            for (const comment of job.comments) {
              await db.createComment({
                jobId: newJobId,
                taskId: null,
                content: comment.content,
                createdBy: userId,
              });
              results.comments++;
            }
          }

          // Import reports for this job
          if (job.reports && job.reports.length > 0) {
            for (const report of job.reports) {
              await db.createReport({
                jobId: newJobId,
                title: report.title,
                type: report.type,
                content: report.content || null,
                startDate: report.startDate ? new Date(report.startDate) : null,
                endDate: report.endDate ? new Date(report.endDate) : null,
                createdBy: userId,
              });
              results.reports++;
            }
          }
        }
      }

      // 3. Import standalone notes
      if (parsedInput.notes && parsedInput.notes.length > 0) {
        for (const note of parsedInput.notes) {
          await db.createNote({
            title: note.title,
            content: note.content || null,
            tags: note.tags || null,
            jobId: null,
            contactId: null,
            createdBy: userId,
          });
          results.notes++;
        }
      }

      // 4. Import custom locations
      if (parsedInput.locations && parsedInput.locations.length > 0) {
        for (const location of parsedInput.locations) {
          if (location.type === "custom") {
            await db.createLocation({
              name: location.name,
              latitude: location.latitude,
              longitude: location.longitude,
              address: location.address || null,
              type: "custom",
              jobId: null,
              contactId: null,
              createdBy: userId,
            });
            results.locations++;
          }
        }
      }

      return {
        success: true,
        imported: results,
      };
    }),
});

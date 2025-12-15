import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { 
  storagePut, 
  createPresignedUploadUrl, 
  deleteFromStorage,
  createPresignedReadUrl,
  generateFileKey,
  storageList,
  getContentType,
  storageGet,
} from "./storage";
import { exportRouter } from "./exportRouter";
import { projectsRouter } from "./projectsRouter";
import { pdfRouter } from "./pdfRouter";
import { settingsRouter } from "./settingsRouter";
import { geocodeAddress } from "./_core/geocoding";
import { shouldProcessImage } from "./_core/imageProcessing";
import { 
  processAndUploadImageVariants,
  generateSignedVariantUrls,
  deleteImageVariants,
  type ImageVariant,
} from "./_core/imagePipeline";
import type { StoredImageMetadata } from "../drizzle/schema";

async function hydrateImageRecord<T extends { imageMetadata: StoredImageMetadata | null }>(
  image: T
): Promise<T & { imageUrls: Record<ImageVariant, string> | null }> {
  const imageUrls = await generateSignedVariantUrls(image.imageMetadata);
  return {
    ...image,
    imageUrls,
  };
}

export const appRouter = router({
  system: systemRouter,
  export: exportRouter,
  pdf: pdfRouter,
  settings: settingsRouter,
  
  // New project-based structure
  projects: projectsRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  users: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllUsers();
    }),
  }),

  jobs: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllJobs();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getJobById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).default("planning"),
        contactId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Geocode address if location is provided
        let latitude: string | undefined;
        let longitude: string | undefined;
        if (input.location) {
          const geocodeResult = await geocodeAddress(input.location);
          if (geocodeResult) {
            latitude = geocodeResult.latitude;
            longitude = geocodeResult.longitude;
          }
        }

        const result = await db.createJob({
          ...input,
          latitude,
          longitude,
          createdBy: ctx.user.id,
        });
        
        const jobId = result[0].id;

        // Auto-create map marker if coordinates exist
        if (latitude && longitude) {
          await db.createLocation({
            name: input.title,
            latitude,
            longitude,
            address: input.location,
            type: "job",
            jobId,
            contactId: undefined,
            createdBy: ctx.user.id,
          });
        }

        return { success: true, id: jobId };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).optional(),
        contactId: z.number().optional(),
        dateMode: z.enum(["range", "individual"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        individualDates: z.array(z.date()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...updates } = input;
        
        // Geocode address if location is being updated
        if (updates.location) {
          const geocodeResult = await geocodeAddress(updates.location);
          if (geocodeResult) {
            (updates as any).latitude = geocodeResult.latitude;
            (updates as any).longitude = geocodeResult.longitude;
            
            // Update or create map marker
            const existingLocations = await db.getLocationsByJob(id);
            const job = await db.getJobById(id);
            
            if (existingLocations.length > 0) {
              // Update existing marker
              await db.updateLocation(existingLocations[0].id, {
                name: updates.title || job?.title,
                latitude: geocodeResult.latitude,
                longitude: geocodeResult.longitude,
                address: updates.location,
              });
            } else {
              // Create new marker
              await db.createLocation({
                name: updates.title || job?.title || "Job Location",
                latitude: geocodeResult.latitude,
                longitude: geocodeResult.longitude,
                address: updates.location,
                type: "job",
                jobId: id,
                contactId: undefined,
                createdBy: ctx.user.id,
              });
            }
          }
        }
        
        // Handle individual dates if dateMode is individual
        if (updates.dateMode === 'individual' && (updates as any).individualDates) {
          // Delete existing individual dates
          await db.deleteJobDates(id);
          // Create new individual dates
          const dates = (updates as any).individualDates as Date[];
          for (const date of dates) {
            // Normalize date to midnight UTC to avoid timezone issues
            const normalizedDate = new Date(date);
            normalizedDate.setUTCHours(0, 0, 0, 0);
            await db.createJobDate({ jobId: id, date: normalizedDate });
          }
          // Remove individualDates from updates as it's not a job field
          delete (updates as any).individualDates;
        }
        
        await db.updateJob(id, updates);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteJob(input.id);
        return { success: true };
      }),
  }),

  tasks: router({
    listByJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTasksByJobId(input.jobId);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getTaskById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        status: z.enum(["todo", "in_progress", "review", "completed"]).default("todo"),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        assignedTo: z.number().optional(),
        dueDate: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createTask({
          ...input,
          createdBy: ctx.user.id,
        });
        return { success: true, id: result[0].id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        status: z.enum(["todo", "in_progress", "review", "completed"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assignedTo: z.number().optional(),
        dueDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateTask(id, updates);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTask(input.id);
        return { success: true };
      }),
  }),

  images: router({
    // List images by job
    listByJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        const images = await db.getImagesByJobId(input.jobId);
        return await Promise.all(images.map((image) => hydrateImageRecord(image)));
      }),
    
    // List images by task
    listByTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        const images = await db.getImagesByTaskId(input.taskId);
        return await Promise.all(images.map((image) => hydrateImageRecord(image)));
      }),

    // Get a presigned URL for viewing an image (for private S3 buckets)
    getReadUrl: protectedProcedure
      .input(z.object({ fileKey: z.string() }))
      .query(async ({ input }) => {
        const url = await createPresignedReadUrl(input.fileKey, 60 * 60); // 1 hour
        return { url };
      }),

    // Get presigned URLs for multiple images (batch)
    getReadUrls: protectedProcedure
      .input(z.object({ fileKeys: z.array(z.string()) }))
      .query(async ({ input }) => {
        const urls = await Promise.all(
          input.fileKeys.map(async (fileKey) => ({
            fileKey,
            url: await createPresignedReadUrl(fileKey, 60 * 60),
          }))
        );
        return { urls };
      }),

    // Server-side image proxy (bypasses CORS)
    // Fetches the image from S3 and returns it as base64
    getImageBlob: protectedProcedure
      .input(z.object({ fileKey: z.string() }))
      .query(async ({ input }) => {
        try {
          const { data, contentType } = await storageGet(input.fileKey);
          return {
            base64: data.toString("base64"),
            contentType,
            size: data.length,
          };
        } catch (error) {
          console.error("[Images] Failed to fetch image from S3:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch image from storage",
          });
        }
      }),
    
    // Server-side upload (bypasses CORS - browser sends to server, server uploads to S3)
    upload: protectedProcedure
      .input(
        z.object({
          jobId: z.number().optional(),
          taskId: z.number().optional(),
          projectId: z.number().optional().nullable(),
          filename: z.string(),
          mimeType: z.string(),
          fileSize: z.number(),
          base64Data: z.string(),
          caption: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        let { filename, mimeType, fileSize, base64Data } = input;
        const { jobId, taskId, caption } = input;

        if (!shouldProcessImage(mimeType, filename)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only image uploads are supported by this endpoint.",
          });
        }

        // Convert base64 to buffer for processing
        let buffer: Buffer = Buffer.from(base64Data, "base64");

        const metadata = await processAndUploadImageVariants(buffer, { projectId: input.projectId ?? null });
        mimeType = metadata.mimeType;
        fileSize = metadata.variants.full.size;
        const fileKey = metadata.variants.full.key;
        const url = metadata.variants.full.url;

        // Save metadata to database
        const result = await db.createImage({
          jobId: jobId || null,
          taskId: taskId || null,
          projectId: input.projectId ?? null,
          fileKey,
          url,
          filename,
          mimeType,
          fileSize,
          caption: caption || null,
          uploadedBy: ctx.user.id,
          imageMetadata: metadata,
        });

        const image = await db.getImageById(result[0].id);
        if (!image) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Image metadata not found after upload",
          });
        }

        return { success: true, image: await hydrateImageRecord(image) };
      }),

    // Get a presigned URL for direct browser upload (requires CORS on bucket)
    getUploadUrl: protectedProcedure
      .input(
        z.object({
          jobId: z.number().optional(),
          taskId: z.number().optional(),
          filename: z.string(),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { filename, mimeType } = input;
        if (shouldProcessImage(mimeType, filename)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Direct uploads are disabled for images. Use the server-side uploader.",
          });
        }
        const fileKey = generateFileKey("uploads", ctx.user.id, filename);

        const { uploadUrl, publicUrl } = await createPresignedUploadUrl(
          fileKey,
          mimeType
        );

        return {
          uploadUrl,
          fileKey,
          publicUrl,
        };
      }),

    // Confirm direct upload and save metadata
    confirmUpload: protectedProcedure
      .input(
        z.object({
          jobId: z.number().optional(),
          taskId: z.number().optional(),
          fileKey: z.string(),
          url: z.string(),
          filename: z.string(),
          mimeType: z.string(),
          fileSize: z.number(),
          caption: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { jobId, taskId, fileKey, url, filename, mimeType, fileSize, caption } =
          input;
        if (shouldProcessImage(mimeType, filename)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Direct uploads are disabled for images. Use the server-side uploader.",
          });
        }

        const result = await db.createImage({
          jobId: jobId || null,
          taskId: taskId || null,
          fileKey,
          url,
          filename,
          mimeType,
          fileSize,
          caption: caption || null,
          uploadedBy: ctx.user.id,
        });

        return { success: true, id: result[0].id };
      }),

    // Update image caption
    updateCaption: protectedProcedure
      .input(z.object({ id: z.number(), caption: z.string().optional() }))
      .mutation(async ({ input }) => {
        // Note: You'll need to add this DB function
        // await db.updateImageCaption(input.id, input.caption);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const image = await db.getImageById(input.id);
        if (image?.fileKey) {
          try {
            if (image.imageMetadata) {
              await deleteImageVariants(image.imageMetadata);
            } else {
              await deleteFromStorage(image.fileKey);
            }
          } catch (error) {
            console.error("[Images] Failed to delete from S3:", error);
            // Continue with DB delete even if S3 delete fails
          }
        }

        await db.deleteImage(input.id);
        return { success: true };
      }),
  }),

  reports: router({
    listByJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        return await db.getReportsByJobId(input.jobId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        jobId: z.number(),
        title: z.string().min(1),
        type: z.enum(["daily", "weekly", "task_summary", "progress", "custom"]).default("custom"),
        content: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createReport({
          ...input,
          createdBy: ctx.user.id,
        });
        return { success: true, id: result[0].id };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteReport(input.id);
        return { success: true };
      }),
  }),

  calendar: router({
    getEvents: protectedProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date() }))
      .query(async ({ input }) => {
        return await db.getCalendarEvents(input.startDate, input.endDate);
      }),
  }),

  comments: router({
    listByJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCommentsByJobId(input.jobId);
      }),
    
    listByTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCommentsByTaskId(input.taskId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        jobId: z.number().optional(),
        taskId: z.number().optional(),
        content: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createComment({
          jobId: input.jobId || null,
          taskId: input.taskId || null,
          content: input.content,
          createdBy: ctx.user.id,
        });
        return { success: true, id: result[0].id };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteComment(input.id);
        return { success: true };
      }),
   }),
  
  contacts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getContactsByUser(ctx.user.id);
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getContactById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Geocode address if provided and no coordinates given
        let latitude = input.latitude;
        let longitude = input.longitude;
        
        if (input.address && (!latitude || !longitude)) {
          const geocodeResult = await geocodeAddress(input.address);
          if (geocodeResult) {
            latitude = geocodeResult.latitude;
            longitude = geocodeResult.longitude;
          }
        }

        const result = await db.createContact({
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          address: input.address || null,
          latitude: latitude || null,
          longitude: longitude || null,
          notes: input.notes || null,
          createdBy: ctx.user.id,
        });
        
        const contactId = result[0].id;

        // Auto-create map marker if coordinates exist
        if (latitude && longitude) {
          await db.createLocation({
            name: input.name,
            latitude,
            longitude,
            address: input.address,
            type: "contact",
            jobId: undefined,
            contactId,
            createdBy: ctx.user.id,
          });
        }

        return { success: true, id: contactId };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        
        // Geocode address if being updated and no coordinates provided
        if (data.address && (!data.latitude || !data.longitude)) {
          const geocodeResult = await geocodeAddress(data.address);
          if (geocodeResult) {
            (data as any).latitude = geocodeResult.latitude;
            (data as any).longitude = geocodeResult.longitude;
            
            // Update or create map marker
            const existingLocations = await db.getLocationsByContact(id);
            const contact = await db.getContactById(id);
            
            if (existingLocations.length > 0) {
              // Update existing marker
              await db.updateLocation(existingLocations[0].id, {
                name: data.name || contact?.name,
                latitude: geocodeResult.latitude,
                longitude: geocodeResult.longitude,
                address: data.address,
              });
            } else {
              // Create new marker
              await db.createLocation({
                name: data.name || contact?.name || "Contact Location",
                latitude: geocodeResult.latitude,
                longitude: geocodeResult.longitude,
                address: data.address,
                type: "contact",
                jobId: undefined,
                contactId: id,
                createdBy: ctx.user.id,
              });
            }
          }
        }
        
        await db.updateContact(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteContact(input.id);
        return { success: true };
      }),
    
    linkToJob: protectedProcedure
      .input(z.object({ jobId: z.number(), contactId: z.number(), role: z.string().optional() }))
      .mutation(async ({ input }) => {
        await db.linkJobContact(input.jobId, input.contactId, input.role);
        return { success: true };
      }),
    
    unlinkFromJob: protectedProcedure
      .input(z.object({ jobId: z.number(), contactId: z.number() }))
      .mutation(async ({ input }) => {
        await db.unlinkJobContact(input.jobId, input.contactId);
        return { success: true };
      }),
    
    getJobContacts: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        return await db.getJobContacts(input.jobId);
      }),
  }),
  
  invoices: router({
    // List all invoices for current user
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getInvoicesByUser(ctx.user.id);
    }),
    
    // List invoices by job
    getByJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInvoicesByJob(input.jobId);
      }),
    
    // List invoices by contact
    getByContact: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInvoicesByContact(input.contactId);
      }),

    // Get presigned read URL for viewing/downloading an invoice
    getReadUrl: protectedProcedure
      .input(z.object({ fileKey: z.string() }))
      .query(async ({ input }) => {
        const url = await createPresignedReadUrl(input.fileKey, 60 * 60); // 1 hour
        return { url };
      }),

    // Server-side upload (bypasses CORS - browser sends to server, server uploads to S3)
    upload: protectedProcedure
      .input(
        z.object({
          filename: z.string().min(1),
          mimeType: z.string().optional(),
          fileSize: z.number(),
          base64Data: z.string(),
          jobId: z.number().optional(),
          contactId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { filename, mimeType, fileSize, base64Data, jobId, contactId } = input;
        const contentType = mimeType || getContentType(filename);

        // Generate unique file key
        const fileKey = generateFileKey("invoices", ctx.user.id, filename);

        // Upload to S3 via server (no CORS needed)
        const { url } = await storagePut(fileKey, base64Data, contentType);

        // Save metadata to database
        const result = await db.createInvoice({
          filename,
          fileKey,
          fileSize,
          mimeType: contentType,
          jobId: jobId || null,
          contactId: contactId || null,
          uploadDate: new Date(),
          uploadedBy: ctx.user.id,
        });

        return { success: true, id: result[0].id, url, fileKey };
      }),

    // Get a presigned URL for direct browser upload (requires CORS on bucket)
    getUploadUrl: protectedProcedure
      .input(
        z.object({
          filename: z.string().min(1),
          mimeType: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const fileKey = generateFileKey("invoices", ctx.user.id, input.filename);
        const contentType = input.mimeType || getContentType(input.filename);

        const { uploadUrl, publicUrl } = await createPresignedUploadUrl(
          fileKey,
          contentType
        );

        return {
          uploadUrl,
          fileKey,
          publicUrl,
        };
      }),
    
    // Confirm direct upload and save metadata
    confirmUpload: protectedProcedure
      .input(
        z.object({
          filename: z.string().min(1),
          fileKey: z.string().min(1),
          url: z.string().min(1),
          fileSize: z.number().optional(),
          mimeType: z.string().optional(),
          jobId: z.number().optional(),
          contactId: z.number().optional(),
          uploadDate: z.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await db.createInvoice({
          filename: input.filename,
          fileKey: input.fileKey,
          fileSize: input.fileSize || null,
          mimeType: input.mimeType || null,
          jobId: input.jobId || null,
          contactId: input.contactId || null,
          uploadDate: input.uploadDate || new Date(),
          uploadedBy: ctx.user.id,
        });
        return { success: true, id: result[0].id };
      }),
    
    // Delete an invoice
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const invoice = await db.getInvoiceById(input.id);
        if (invoice?.fileKey) {
          try {
            await deleteFromStorage(invoice.fileKey);
          } catch (error) {
            console.error("[Invoices] Failed to delete from S3:", error);
            // Continue with DB delete even if S3 delete fails
          }
        }

        await db.deleteInvoice(input.id);
        return { success: true };
      }),
  }),

  // Unified file management endpoints
  files: router({
    // List all files for a job (images + invoices)
    listByJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        const [images, invoices] = await Promise.all([
          db.getImagesByJobId(input.jobId),
          db.getInvoicesByJob(input.jobId),
        ]);

        // Combine and normalize to common file type
        const files = [
          ...images.map((img) => ({
            id: img.id,
            type: "image" as const,
            filename: img.filename || "Unknown",
            fileKey: img.fileKey,
            mimeType: img.mimeType || "image/jpeg",
            fileSize: img.fileSize || 0,
            caption: img.caption,
            uploadedBy: img.uploadedBy,
            createdAt: img.createdAt,
          })),
          ...invoices.map((inv) => ({
            id: inv.id,
            type: "invoice" as const,
            filename: inv.filename,
            fileKey: inv.fileKey,
            mimeType: inv.mimeType || "application/pdf",
            fileSize: inv.fileSize || 0,
            caption: null,
            uploadedBy: inv.uploadedBy,
            createdAt: inv.createdAt,
          })),
        ];

        // Sort by createdAt descending
        return files.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }),

    // Get presigned read URLs for multiple files
    getReadUrls: protectedProcedure
      .input(z.object({ fileKeys: z.array(z.string()) }))
      .query(async ({ input }) => {
        const urls = await Promise.all(
          input.fileKeys.map(async (fileKey) => ({
            fileKey,
            url: await createPresignedReadUrl(fileKey, 60 * 60),
          }))
        );
        return urls;
      }),

    // Delete a file (auto-detects type from fileKey)
    delete: protectedProcedure
      .input(z.object({ 
        id: z.number(), 
        type: z.enum(["image", "invoice"]) 
      }))
      .mutation(async ({ input }) => {
        if (input.type === "image") {
          const image = await db.getImageById(input.id);
          if (image?.fileKey) {
            try {
              await deleteFromStorage(image.fileKey);
            } catch (error) {
              console.error("[Files] Failed to delete image from S3:", error);
            }
          }
          await db.deleteImage(input.id);
        } else {
          const invoice = await db.getInvoiceById(input.id);
          if (invoice?.fileKey) {
            try {
              await deleteFromStorage(invoice.fileKey);
            } catch (error) {
              console.error("[Files] Failed to delete invoice from S3:", error);
            }
          }
          await db.deleteInvoice(input.id);
        }
        return { success: true };
      }),

    // List files in S3 (raw S3 listing, for admin purposes)
    listS3: protectedProcedure
      .input(z.object({ prefix: z.string().optional() }))
      .query(async ({ input }) => {
        const files = await storageList(input.prefix || "", 100);
        return files;
      }),
  }),
  
  notes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getNotesByUser(ctx.user.id);
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getNoteById(input.id);
      }),
    
    getByJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        return await db.getNotesByJob(input.jobId);
      }),
    
    getByContact: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input }) => {
        return await db.getNotesByContact(input.contactId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        tags: z.string().optional(),
        jobId: z.number().optional(),
        contactId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createNote({
          title: input.title,
          content: input.content || null,
          tags: input.tags || null,
          jobId: input.jobId || null,
          contactId: input.contactId || null,
          createdBy: ctx.user.id,
        });
        return { success: true, id: result[0].id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        tags: z.string().optional(),
        jobId: z.number().optional(),
        contactId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateNote(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteNote(input.id);
        return { success: true };
      }),
  }),
  
  locations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getLocationsByUser(ctx.user.id);
    }),
    
    getByType: protectedProcedure
      .input(z.object({ type: z.enum(["job", "contact", "custom"]) }))
      .query(async ({ input }) => {
        return await db.getLocationsByType(input.type);
      }),
    
    getByJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLocationsByJob(input.jobId);
      }),
    
    getByContact: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input }) => {
        return await db.getLocationsByContact(input.contactId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        latitude: z.string(),
        longitude: z.string(),
        address: z.string().optional(),
        type: z.enum(["job", "contact", "custom"]).default("custom"),
        jobId: z.number().optional(),
        contactId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createLocation({
          name: input.name,
          latitude: input.latitude,
          longitude: input.longitude,
          address: input.address || null,
          type: input.type,
          jobId: input.jobId || null,
          contactId: input.contactId || null,
          createdBy: ctx.user.id,
        });
        return { success: true, id: result[0].id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        address: z.string().optional(),
        type: z.enum(["job", "contact", "custom"]).optional(),
        jobId: z.number().optional(),
        contactId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateLocation(id, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLocation(input.id);
        return { success: true };
      }),
    
    geocode: protectedProcedure
      .input(z.object({ address: z.string() }))
      .mutation(async ({ input }) => {
        const result = await geocodeAddress(input.address);
        return result;
      }),
  }),
});
export type AppRouter = typeof appRouter;

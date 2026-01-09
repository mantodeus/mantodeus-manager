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
import { invoiceRouter } from "./invoiceRouter";
import { inspectionRouter } from "./inspectionRouter";
import { expenseRouter } from "./expenseRouter";
import { aiRouter } from "./aiRouter";
import { geocodeAddress } from "./_core/geocoding";
import { shouldProcessImage } from "./_core/imageProcessing";
import { 
  processAndUploadImageVariants,
  generateSignedVariantUrls,
  deleteImageVariants,
  type ImageVariant,
} from "./_core/imagePipeline";
import type { StoredImageMetadata } from "../drizzle/schema";

function deriveInvoiceNameFromFilename(filename: string) {
  const trimmed = filename.trim();
  const lastDotIndex = trimmed.lastIndexOf(".");
  if (lastDotIndex > 0) {
    return trimmed.slice(0, lastDotIndex);
  }
  return trimmed;
}

function normalizeNullableString(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildContactAddress(fields: {
  streetName?: string | null;
  streetNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}): string | null {
  const streetLine = [fields.streetName, fields.streetNumber].filter(Boolean).join(" ").trim();
  const cityLine = [fields.postalCode, fields.city].filter(Boolean).join(" ").trim();
  const parts = [streetLine, cityLine, fields.country].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(", ");
}

function resolveContactName(input: { clientName?: string | null; name?: string | null; contactPerson?: string | null }) {
  return input.clientName || input.name || input.contactPerson || "Contact";
}

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
  invoices: invoiceRouter,
  
  // New project-based structure
  projects: projectsRouter,
  
  // Inspection module
  inspections: inspectionRouter,
  
  // Expenses module
  expenses: expenseRouter,
  
  // AI Assistant
  ai: aiRouter,
  
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

    listArchived: protectedProcedure.query(async ({ ctx }) => {
      return await db.getArchivedContactsByUser(ctx.user.id);
    }),

    listTrashed: protectedProcedure.query(async ({ ctx }) => {
      return await db.getTrashedContactsByUser(ctx.user.id);
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getContactById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        clientName: z.string().min(1),
        type: z.enum(["business", "private"]),
        contactPerson: z.string().optional(),
        streetName: z.string().min(1),
        streetNumber: z.string().min(1),
        postalCode: z.string().min(1),
        city: z.string().min(1),
        country: z.string().min(1),
        vatStatus: z.enum(["subject_to_vat", "not_subject_to_vat"]),
        vatNumber: z.string().optional(),
        taxNumber: z.string().optional(),
        leitwegId: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        phoneNumber: z.string().optional(),
        phone: z.string().optional(),
        /** Array of email objects with label and value */
        emails: z.array(z.object({
          label: z.string().optional(),
          value: z.string().email(),
        })).optional(),
        /** Array of phone objects with label and value */
        phoneNumbers: z.array(z.object({
          label: z.string().optional(),
          value: z.string().min(1),
        })).optional(),
        address: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const clientName = normalizeNullableString(input.clientName);
          const contactPerson = normalizeNullableString(input.contactPerson);
          const streetName = normalizeNullableString(input.streetName);
          const streetNumber = normalizeNullableString(input.streetNumber);
          const postalCode = normalizeNullableString(input.postalCode);
          const city = normalizeNullableString(input.city);
          const country = normalizeNullableString(input.country);
          const vatNumber = normalizeNullableString(input.vatNumber);
          const taxNumber = normalizeNullableString(input.taxNumber);
          const leitwegId = normalizeNullableString(input.leitwegId);
          // Handle emails: prefer new array format, fallback to single email
          // Filter out empty emails and ensure at least one valid email exists
          let emails: Array<{ label: string; value: string }> | null = null;
          if (input.emails && input.emails.length > 0) {
            // Filter out entries with empty values and normalize labels
            const validEmails = input.emails
              .filter(e => e.value && e.value.trim().length > 0)
              .map(e => ({
                label: (e.label?.trim() || "Email"),
                value: e.value.trim(),
              }));
            if (validEmails.length > 0) {
              emails = validEmails;
            }
          }
          
          // Fallback to single email field if no valid emails in array
          if (!emails && input.email && input.email.trim()) {
            emails = [{ label: "Email", value: input.email.trim() }];
          }
          
          // At least one email is required
          if (!emails || emails.length === 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "At least one valid email is required",
            });
          }
          
          // Handle phone numbers: prefer new array format, fallback to single phone
          let phoneNumbers: Array<{ label: string; value: string }> | null = null;
          if (input.phoneNumbers && input.phoneNumbers.length > 0) {
            // Filter out entries with empty values and normalize labels
            const validPhones = input.phoneNumbers
              .filter(p => p.value && p.value.trim().length > 0)
              .map(p => ({
                label: (p.label?.trim() || "Phone"),
                value: p.value.trim(),
              }));
            if (validPhones.length > 0) {
              phoneNumbers = validPhones;
            }
          }
          
          // Fallback to single phone field if no valid phones in array
          if (!phoneNumbers && (input.phoneNumber || input.phone)) {
            const phoneValue = (input.phoneNumber || input.phone || "").trim();
            if (phoneValue) {
              phoneNumbers = [{ label: "Phone", value: phoneValue }];
            }
          }
          
          // Keep single email/phone for backward compatibility
          const email = normalizeNullableString(input.email);
          const phoneNumber = normalizeNullableString(input.phoneNumber ?? input.phone);
          const phone = normalizeNullableString(input.phone ?? input.phoneNumber);
          const notes = normalizeNullableString(input.notes);

          const resolvedName = resolveContactName({
            clientName,
            name: normalizeNullableString(input.name),
            contactPerson,
          });

          const addressFromFields = buildContactAddress({
            streetName,
            streetNumber,
            postalCode,
            city,
            country,
          });
          const address = normalizeNullableString(input.address) ?? addressFromFields;

          // Geocode address if provided and no coordinates given
          let latitude = normalizeNullableString(input.latitude);
          let longitude = normalizeNullableString(input.longitude);
          
          if (address && (!latitude || !longitude)) {
            const geocodeResult = await geocodeAddress(address);
            if (geocodeResult) {
              latitude = geocodeResult.latitude;
              longitude = geocodeResult.longitude;
            }
          }

          const result = await db.createContact({
            name: resolvedName,
            clientName: clientName,
            type: input.type,
            contactPerson: contactPerson,
            email: email,
            phone: phone,
            phoneNumber: phoneNumber,
            emails: emails,
            phoneNumbers: phoneNumbers,
            address: address,
            streetName: streetName,
            streetNumber: streetNumber,
            postalCode: postalCode,
            city: city,
            country: country,
            vatStatus: input.vatStatus,
            vatNumber: vatNumber,
            taxNumber: taxNumber,
            leitwegId: leitwegId,
            latitude: latitude || null,
            longitude: longitude || null,
            notes: notes,
            createdBy: ctx.user.id,
          });
          
          if (!result || !result[0] || !result[0].id) {
            console.error("[Contacts] createContact returned invalid result:", result);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create contact: invalid response from database",
            });
          }
          
          const contactId = result[0].id;

          // Auto-create map marker if coordinates exist
          if (latitude && longitude) {
            try {
              await db.createLocation({
                name: resolvedName,
                latitude,
                longitude,
                address: address,
                type: "contact",
                jobId: undefined,
                contactId,
                createdBy: ctx.user.id,
              });
            } catch (locationError) {
              // Don't fail contact creation if location creation fails
              console.warn("[Contacts] Failed to create location for contact:", locationError);
            }
          }

          return { success: true, id: contactId };
        } catch (error) {
          console.error("[Contacts] createContact error:", error);
          if (error instanceof TRPCError) {
            throw error;
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Failed to create contact",
          });
        }
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().nullable().optional(),
        clientName: z.string().nullable().optional(),
        type: z.enum(["business", "private"]).optional(),
        contactPerson: z.string().nullable().optional(),
        streetName: z.string().nullable().optional(),
        streetNumber: z.string().nullable().optional(),
        postalCode: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
        vatStatus: z.enum(["subject_to_vat", "not_subject_to_vat"]).optional(),
        vatNumber: z.string().nullable().optional(),
        taxNumber: z.string().nullable().optional(),
        leitwegId: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        phoneNumber: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        /** Array of email objects with label and value */
        emails: z.array(z.object({
          label: z.string().optional(),
          value: z.string().email(),
        })).nullable().optional(),
        /** Array of phone objects with label and value */
        phoneNumbers: z.array(z.object({
          label: z.string().optional(),
          value: z.string().min(1),
        })).nullable().optional(),
        address: z.string().nullable().optional(),
        latitude: z.string().nullable().optional(),
        longitude: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const existing = await db.getContactById(id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to update this contact" });
        }
        
        const hasField = (field: keyof typeof input) =>
          Object.prototype.hasOwnProperty.call(input, field);

        const nameUpdateRequested = hasField("clientName") || hasField("name");
        const addressUpdateRequested =
          hasField("streetName") ||
          hasField("streetNumber") ||
          hasField("postalCode") ||
          hasField("city") ||
          hasField("country") ||
          hasField("address");
        const phoneUpdateRequested = hasField("phoneNumber") || hasField("phone") || hasField("phoneNumbers");
        const emailUpdateRequested = hasField("email") || hasField("emails");
        const notesUpdateRequested = hasField("notes");

        const clientName = normalizeNullableString(data.clientName);
        const contactPerson = normalizeNullableString(data.contactPerson);
        const streetName = normalizeNullableString(data.streetName);
        const streetNumber = normalizeNullableString(data.streetNumber);
        const postalCode = normalizeNullableString(data.postalCode);
        const city = normalizeNullableString(data.city);
        const country = normalizeNullableString(data.country);
        const vatNumber = normalizeNullableString(data.vatNumber);
        const taxNumber = normalizeNullableString(data.taxNumber);
        const leitwegId = normalizeNullableString(data.leitwegId);
        // Handle emails: prefer new array format, fallback to single email
        let emails: Array<{ label: string; value: string }> | null | undefined = undefined;
        if (hasField("emails")) {
          if (data.emails && Array.isArray(data.emails) && data.emails.length > 0) {
            // Filter out entries with empty values and normalize labels
            const validEmails = data.emails
              .filter((e: { label?: string; value: string }) => e.value && e.value.trim().length > 0)
              .map((e: { label?: string; value: string }) => ({
                label: (e.label?.trim() || "Email"),
                value: e.value.trim(),
              }));
            emails = validEmails.length > 0 ? validEmails : null;
          } else {
            // If it's an empty array or null/undefined, set to null (explicitly clearing)
            emails = null;
          }
        } else if (emailUpdateRequested && data.email) {
          const emailValue = data.email.trim();
          if (emailValue) {
            emails = [{ label: "Email", value: emailValue }];
          }
          // If emailValue is empty, leave emails as undefined (don't update it)
        }
        
        // Handle phone numbers: prefer new array format, fallback to single phone
        let phoneNumbers: Array<{ label: string; value: string }> | null | undefined = undefined;
        if (hasField("phoneNumbers")) {
          if (data.phoneNumbers && Array.isArray(data.phoneNumbers) && data.phoneNumbers.length > 0) {
            // Filter out entries with empty values and normalize labels
            const validPhones = data.phoneNumbers
              .filter((p: { label?: string; value: string }) => p.value && p.value.trim().length > 0)
              .map((p: { label?: string; value: string }) => ({
                label: (p.label?.trim() || "Phone"),
                value: p.value.trim(),
              }));
            phoneNumbers = validPhones.length > 0 ? validPhones : null;
          } else {
            // If it's an empty array or null/undefined, set to null
            phoneNumbers = null;
          }
        } else if (phoneUpdateRequested && (data.phoneNumber || data.phone)) {
          const phoneValue = (data.phoneNumber || data.phone || "").trim();
          if (phoneValue) {
            phoneNumbers = [{ label: "Phone", value: phoneValue }];
          }
          // If phoneValue is empty, leave phoneNumbers as undefined (don't update it)
        }
        
        // Keep single email/phone for backward compatibility
        const email = normalizeNullableString(data.email);
        const phoneNumber = normalizeNullableString(data.phoneNumber ?? data.phone);
        const phone = normalizeNullableString(data.phone ?? data.phoneNumber);
        const notes = normalizeNullableString(data.notes);

        const resolvedName = resolveContactName({
          clientName,
          name: normalizeNullableString(data.name),
          contactPerson,
        });

        const normalizedUpdate: Record<string, unknown> = {
          ...(data.type ? { type: data.type } : {}),
          ...(data.vatStatus ? { vatStatus: data.vatStatus } : {}),
        };

        if (hasField("clientName") || hasField("name")) {
          normalizedUpdate.name = resolvedName;
          normalizedUpdate.clientName = clientName ?? resolvedName;
        }

        if (hasField("contactPerson")) {
          normalizedUpdate.contactPerson = contactPerson;
        }

        if (emailUpdateRequested) {
          normalizedUpdate.email = email;
          // Only update emails if:
          // 1. It was explicitly provided in the input (hasField("emails")), OR
          // 2. We're migrating from old format and have a valid value (emails is an array, not null)
          if (hasField("emails") || (emails !== undefined && emails !== null && Array.isArray(emails))) {
            normalizedUpdate.emails = emails;
          }
        }

        if (phoneUpdateRequested) {
          normalizedUpdate.phoneNumber = phoneNumber;
          normalizedUpdate.phone = phone;
          // Only update phoneNumbers if:
          // 1. It was explicitly provided in the input (hasField("phoneNumbers")), OR
          // 2. We're migrating from old format and have a valid value (phoneNumbers is an array, not null)
          if (hasField("phoneNumbers") || (phoneNumbers !== undefined && phoneNumbers !== null && Array.isArray(phoneNumbers))) {
            normalizedUpdate.phoneNumbers = phoneNumbers;
          }
        }

        if (hasField("streetName")) normalizedUpdate.streetName = streetName;
        if (hasField("streetNumber")) normalizedUpdate.streetNumber = streetNumber;
        if (hasField("postalCode")) normalizedUpdate.postalCode = postalCode;
        if (hasField("city")) normalizedUpdate.city = city;
        if (hasField("country")) normalizedUpdate.country = country;
        if (hasField("vatNumber")) normalizedUpdate.vatNumber = vatNumber;
        if (hasField("taxNumber")) normalizedUpdate.taxNumber = taxNumber;
        if (hasField("leitwegId")) normalizedUpdate.leitwegId = leitwegId;
        if (notesUpdateRequested) normalizedUpdate.notes = notes;
        if (hasField("latitude")) normalizedUpdate.latitude = normalizeNullableString(data.latitude);
        if (hasField("longitude")) normalizedUpdate.longitude = normalizeNullableString(data.longitude);

        const addressFromFields = buildContactAddress({
          streetName,
          streetNumber,
          postalCode,
          city,
          country,
        });
        const address = normalizeNullableString(data.address) ?? addressFromFields;

        if (addressUpdateRequested) {
          normalizedUpdate.address = address;
        }

        // Geocode address if being updated and no coordinates provided
        if (addressUpdateRequested && address && (!data.latitude || !data.longitude)) {
          const geocodeResult = await geocodeAddress(address);
          if (geocodeResult) {
            normalizedUpdate.latitude = geocodeResult.latitude;
            normalizedUpdate.longitude = geocodeResult.longitude;
            
            // Update or create map marker
            const existingLocations = await db.getLocationsByContact(id);
            const contact = await db.getContactById(id);
            const locationName = nameUpdateRequested ? resolvedName : contact?.name;
            
            if (existingLocations.length > 0) {
              // Update existing marker
              await db.updateLocation(existingLocations[0].id, {
                name: locationName,
                latitude: geocodeResult.latitude,
                longitude: geocodeResult.longitude,
                address: address,
              });
            } else {
              // Create new marker
              await db.createLocation({
                name: locationName || "Contact Location",
                latitude: geocodeResult.latitude,
                longitude: geocodeResult.longitude,
                address: address,
                type: "contact",
                jobId: undefined,
                contactId: id,
                createdBy: ctx.user.id,
              });
            }
          }
        }
        
        // Clean up the update object - remove undefined values and ensure arrays are null if empty
        const cleanedUpdate: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(normalizedUpdate)) {
          if (value !== undefined) {
            // For JSON columns (emails, phoneNumbers), handle carefully
            if (key === 'emails' || key === 'phoneNumbers') {
              // Only include if:
              // 1. It's an array with items (valid data), OR
              // 2. It's explicitly null AND the field was provided in the input (to clear it)
              if (value === null) {
                // Only include null if the field was explicitly provided (user wants to clear it)
                if (hasField(key)) {
                  cleanedUpdate[key] = null;
                }
                // Otherwise skip - don't update this field
                continue;
              }
              // Convert empty arrays to null for JSON columns (only if field was provided)
              if (Array.isArray(value)) {
                if (value.length === 0) {
                  // Empty array - only set to null if field was explicitly provided
                  if (hasField(key)) {
                    cleanedUpdate[key] = null;
                  }
                  // Otherwise skip it
                } else {
                  // Array with items - include it
                  cleanedUpdate[key] = value;
                }
              } else {
                // Not an array and not null - include it (shouldn't happen, but be safe)
                cleanedUpdate[key] = value;
              }
            } else {
              // Non-JSON columns - include as-is
              cleanedUpdate[key] = value;
            }
          }
        }
        
        try {
          console.log("[Contacts] updateContact - cleanedUpdate keys:", Object.keys(cleanedUpdate));
          console.log("[Contacts] updateContact - cleanedUpdate:", JSON.stringify(cleanedUpdate, null, 2));
          await db.updateContact(id, cleanedUpdate);
          return { success: true };
        } catch (error) {
          console.error("[Contacts] updateContact error:", error);
          if (error instanceof Error) {
            console.error("[Contacts] updateContact error message:", error.message);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Failed to update contact: ${error.message}`,
            });
          }
          throw error;
        }
      }),
    
    archive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getContactById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to archive this contact" });
        }
        await db.archiveContact(input.id);
        return { success: true };
      }),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getContactById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to duplicate this contact" });
        }
        return await db.duplicateContact(input.id, ctx.user.id);
      }),

    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getContactById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to restore this contact" });
        }
        await db.restoreArchivedContact(input.id);
        return { success: true };
      }),

    restoreFromTrash: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getContactById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to restore this contact" });
        }
        await db.restoreContactFromTrash(input.id);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getContactById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to delete this contact" });
        }
        await db.moveContactToTrash(input.id);
        return { success: true };
      }),

    deletePermanently: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getContactById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to delete this contact" });
        }
        if (!existing.trashedAt) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Permanent delete is only allowed from Rubbish" });
        }
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
  
  // Legacy invoice file upload endpoints (kept for backward compatibility)
  invoiceFiles: router({
    // List invoices by job (legacy)
    getByJob: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInvoicesByJob(input.jobId);
      }),
    
    // List invoices by contact (legacy)
    getByContact: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ input }) => {
        return await db.getInvoicesByContact(input.contactId);
      }),

    // Get presigned read URL for viewing/downloading an invoice file
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

        const issueDate = new Date();
        const originalFileName = filename;
        const invoiceName = deriveInvoiceNameFromFilename(originalFileName);
        if (!invoiceName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice name cannot be empty." });
        }

        try {
          await db.ensureUniqueInvoiceName(ctx.user.id, invoiceName);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invoice name must be unique.";
          throw new TRPCError({ code: "BAD_REQUEST", message });
        }

        // Save metadata to database (as legacy file upload)
        const uploadDate = new Date();
        const invoice = await db.createInvoice({
          filename,
          fileKey,
          fileSize,
          mimeType: contentType,
          jobId: jobId || null,
          contactId: contactId || null,
          clientId: contactId || null,
          issueDate,
          uploadDate,
          uploadedBy: ctx.user.id,
          uploadedAt: uploadDate,
          userId: ctx.user.id,
          type: "standard",
          source: "uploaded",
          needsReview: true,
          originalPdfS3Key: fileKey,
          originalFileName,
          invoiceName,
          subtotal: "0.00",
          vatAmount: "0.00",
          total: "0.00",
          items: [],
        });

        return { success: true, id: invoice.id, url, fileKey };
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
        const issueDate = input.uploadDate || new Date();
        const originalFileName = input.filename;
        const invoiceName = deriveInvoiceNameFromFilename(originalFileName);
        if (!invoiceName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice name cannot be empty." });
        }

        try {
          await db.ensureUniqueInvoiceName(ctx.user.id, invoiceName);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invoice name must be unique.";
          throw new TRPCError({ code: "BAD_REQUEST", message });
        }

        // Create invoice as 'draft' (constitution requirement)
        // Uploaded invoices remain in needs-review until confirmed
        const invoice = await db.createInvoice({
          filename: input.filename,
          fileKey: input.fileKey,
          fileSize: input.fileSize || null,
          mimeType: input.mimeType || null,
          jobId: input.jobId || null,
          contactId: input.contactId || null,
          clientId: input.contactId || null,
          issueDate: issueDate instanceof Date ? issueDate : new Date(issueDate),
          uploadDate: input.uploadDate || new Date(),
          uploadedBy: ctx.user.id,
          uploadedAt: input.uploadDate || new Date(),
          userId: ctx.user.id,
          status: "draft", // Always 'draft' on creation (constitution)
          items: [],
          subtotal: "0.00",
          vatAmount: "0.00",
          total: "0.00",
          source: "uploaded",
          needsReview: true,
          originalPdfS3Key: input.fileKey,
          originalFileName,
          invoiceName,
        });
        
        return { success: true, id: invoice.id };
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

    listArchived: protectedProcedure.query(async ({ ctx }) => {
      return await db.getArchivedNotesByUser(ctx.user.id);
    }),

    listTrashed: protectedProcedure.query(async ({ ctx }) => {
      return await db.getTrashedNotesByUser(ctx.user.id);
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const note = await db.getNoteById(input.id);
        if (!note) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && note.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to view this note" });
        }
        // Get files, but don't fail if table doesn't exist yet
        let files = [];
        try {
          files = await db.getNoteFilesByNoteId(input.id);
        } catch (error: any) {
          // If table doesn't exist, return empty array (migration not run yet)
          if (error?.message?.includes("doesn't exist") || error?.code === "ER_NO_SUCH_TABLE") {
            console.warn("note_files table does not exist. Returning empty files array.");
            files = [];
          } else {
            throw error;
          }
        }
        return { ...note, files };
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
        clientCreationKey: z.string().optional(), // For idempotent creation
      }))
      .mutation(async ({ input, ctx }) => {
        const sessionKey = `user_${ctx.user.id}_${Date.now()}`;
        const timestamp = new Date().toISOString();
        
        // Log create request
        console.log(`[NOTES_CREATE] ${timestamp} | session: ${sessionKey} | user: ${ctx.user.id} | key: ${input.clientCreationKey || 'none'}`);
        
        // Idempotent creation: if clientCreationKey provided, check for existing note
        if (input.clientCreationKey) {
          const existing = await db.getNoteByClientCreationKey(input.clientCreationKey, ctx.user.id);
          if (existing) {
            console.log(`[NOTES_CREATE] ${timestamp} | session: ${sessionKey} | IDEMPOTENT: returning existing note ${existing.id}`);
            return { success: true, id: existing.id };
          }
        }
        
        // Create new note
        const result = await db.createNote({
          title: input.title,
          content: input.content || null,
          tags: input.tags || null,
          jobId: input.jobId || null,
          contactId: input.contactId || null,
          clientCreationKey: input.clientCreationKey || null,
          createdBy: ctx.user.id,
        });
        
        console.log(`[NOTES_CREATE] ${timestamp} | session: ${sessionKey} | CREATED: new note ${result[0].id}`);
        return { success: true, id: result[0].id };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        body: z.string().optional(), // Markdown content (stored as 'content' in DB)
        tags: z.string().optional(),
        jobId: z.number().optional(),
        contactId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const timestamp = new Date().toISOString();
        const { id, body, ...data } = input;
        
        // Log update request
        console.log(`[NOTES_UPDATE] ${timestamp} | note: ${id} | user: ${ctx.user.id}`);
        
        const existing = await db.getNoteById(id);
        if (!existing) {
          console.log(`[NOTES_UPDATE] ${timestamp} | note: ${id} | ERROR: not found`);
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          console.log(`[NOTES_UPDATE] ${timestamp} | note: ${id} | ERROR: forbidden`);
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to update this note" });
        }
        // Map 'body' to 'content' for database storage
        const updateData = body !== undefined ? { ...data, content: body } : data;
        await db.updateNote(id, updateData);
        
        console.log(`[NOTES_UPDATE] ${timestamp} | note: ${id} | SUCCESS`);
        return { success: true };
      }),

    archive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getNoteById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to archive this note" });
        }
        await db.archiveNote(input.id);
        return { success: true };
      }),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getNoteById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to duplicate this note" });
        }
        return await db.duplicateNote(input.id, ctx.user.id);
      }),

    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getNoteById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to restore this note" });
        }
        await db.restoreArchivedNote(input.id);
        return { success: true };
      }),

    restoreFromTrash: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getNoteById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to restore this note" });
        }
        await db.restoreNoteFromTrash(input.id);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getNoteById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to delete this note" });
        }
        await db.moveNoteToTrash(input.id);
        return { success: true };
      }),

    deletePermanently: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getNoteById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && existing.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to delete this note" });
        }
        if (!existing.trashedAt) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Permanent delete is only allowed from Rubbish" });
        }
        await db.deleteNote(input.id);
        return { success: true };
      }),

    // File attachment endpoints
    uploadNoteFile: protectedProcedure
      .input(z.object({
        noteId: z.number(),
        filename: z.string().min(1),
        mimeType: z.string(),
        base64Data: z.string(), // Base64-encoded file content (without data:xxx;base64, prefix)
      }))
      .mutation(async ({ input, ctx }) => {
        const note = await db.getNoteById(input.noteId);
        if (!note) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && note.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to attach files to this note" });
        }

        // Convert base64 to buffer
        let buffer: Buffer;
        try {
          buffer = Buffer.from(input.base64Data, "base64");
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid base64 data",
          });
        }

        const fileSize = buffer.length;

        // Validate file size (15MB max)
        const MAX_FILE_SIZE = 15 * 1024 * 1024;
        if (fileSize > MAX_FILE_SIZE) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          });
        }

        // Validate MIME type
        const ALLOWED_MIME_TYPES = [
          "application/pdf",
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/heic",
          "image/heif",
          "image/webp",
        ];
        if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
          });
        }

        // Generate S3 key
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
        const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const s3Key = `notes/${input.noteId}/${dateStr}-${safeFilename}`;

        // Upload directly to S3 (server-side upload bypasses CORS)
        await storagePut(s3Key, buffer, input.mimeType);

        // Register file in database
        const result = await db.createNoteFile({
          noteId: input.noteId,
          s3Key,
          mimeType: input.mimeType,
          originalFilename: input.filename,
          fileSize,
        });

        const file = await db.getNoteFileById(result[0].id);
        if (!file) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "File metadata not found after upload",
          });
        }

        return file;
      }),

    registerNoteFile: protectedProcedure
      .input(z.object({
        noteId: z.number(),
        s3Key: z.string(),
        mimeType: z.string(),
        originalFilename: z.string(),
        fileSize: z.number().int().positive(),
      }))
      .mutation(async ({ input, ctx }) => {
        const note = await db.getNoteById(input.noteId);
        if (!note) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && note.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to attach files to this note" });
        }

        const result = await db.createNoteFile({
          noteId: input.noteId,
          s3Key: input.s3Key,
          mimeType: input.mimeType,
          originalFilename: input.originalFilename,
          fileSize: input.fileSize,
        });

        const file = await db.getNoteFileById(result[0].id);
        if (!file) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "File metadata not found after registration",
          });
        }

        return file;
      }),

    getNoteFileUrl: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ input, ctx }) => {
        const file = await db.getNoteFileById(input.fileId);
        
        if (!file) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note file not found" });
        }

        // Verify note ownership
        const note = await db.getNoteById(file.noteId);
        if (!note) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && note.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to access this file" });
        }

        const url = await createPresignedReadUrl(file.s3Key, 60 * 60); // 1 hour

        return { url, file };
      }),

    deleteNoteFile: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Get file before delete for ownership check and S3 cleanup
        const file = await db.getNoteFileById(input.id);
        
        if (!file) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note file not found" });
        }

        // Verify note ownership
        const note = await db.getNoteById(file.noteId);
        if (!note) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && note.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to delete this file" });
        }

        // Delete from DB
        await db.deleteNoteFile(input.id);

        // Best-effort S3 cleanup
        try {
          await deleteFromStorage(file.s3Key);
        } catch (error) {
          console.error(`[Notes] Failed to delete S3 file ${file.s3Key}:`, error);
        }

        return { success: true };
      }),

    getNoteFiles: protectedProcedure
      .input(z.object({ noteId: z.number() }))
      .query(async ({ input, ctx }) => {
        const note = await db.getNoteById(input.noteId);
        if (!note) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }
        if (ctx.user.role !== "admin" && note.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to view this note's files" });
        }
        return await db.getNoteFilesByNoteId(input.noteId);
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

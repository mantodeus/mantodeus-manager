import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { generateJobPDFHTML } from "./pdfExport";
import type { Job, Task } from "../drizzle/schema";

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
});

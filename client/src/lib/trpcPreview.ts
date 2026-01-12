import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { PreviewRouter } from "../../../server/previewRouter";

export const trpcPreview = createTRPCReact<PreviewRouter>();
export type PreviewRouterOutputs = inferRouterOutputs<PreviewRouter>;

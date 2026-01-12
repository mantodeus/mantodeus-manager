import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { trpcPreview } from "@/lib/trpcPreview";

/**
 * Hook that returns the appropriate tRPC client based on preview mode
 * Components should use this instead of importing trpc directly when they need to work in preview mode
 */
export function useTrpc() {
  const [location] = useLocation();
  const isPreview = location.startsWith("/preview");
  
  const trpcClient = trpc.useContext();
  const trpcPreviewClient = trpcPreview.useContext();
  
  return isPreview ? trpcPreviewClient : trpcClient;
}

/**
 * Hook that returns the appropriate tRPC utils based on preview mode
 */
export function useTrpcUtils() {
  const [location] = useLocation();
  const isPreview = location.startsWith("/preview");
  
  const trpcUtils = trpc.useUtils();
  const trpcPreviewUtils = trpcPreview.useUtils();
  
  return isPreview ? trpcPreviewUtils : trpcUtils;
}

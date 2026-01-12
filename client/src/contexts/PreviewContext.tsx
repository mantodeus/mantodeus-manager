import { createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { trpcPreview } from "@/lib/trpcPreview";

type TrpcClient = ReturnType<typeof trpc.useContext>;
type PreviewTrpcClient = ReturnType<typeof trpcPreview.useContext>;

interface PreviewContextValue {
  isPreview: boolean;
  trpc: TrpcClient;
  trpcPreview: PreviewTrpcClient;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isPreview = location.startsWith("/preview");
  
  const trpcClient = trpc.useContext();
  const trpcPreviewClient = trpcPreview.useContext();

  return (
    <PreviewContext.Provider
      value={{
        isPreview,
        trpc: trpcClient,
        trpcPreview: trpcPreviewClient,
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreviewContext() {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error("usePreviewContext must be used within PreviewProvider");
  }
  return context;
}

// Hook that returns the appropriate tRPC client based on preview mode
export function useTrpc() {
  const { isPreview, trpc: trpcClient, trpcPreview: previewClient } = usePreviewContext();
  return isPreview ? previewClient : trpcClient;
}

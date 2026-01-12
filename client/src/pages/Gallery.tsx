import { useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PageContainer } from "@/components/PageContainer";

export default function Gallery() {
  useEffect(() => {
    toast.info("Gallery is coming soon.");
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Gallery"
        subtitle="View and manage your photos and images"
      />
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </div>
    </PageContainer>
  );
}

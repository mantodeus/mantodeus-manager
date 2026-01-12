import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: React.ReactNode;
  /** Layout variant controlling max-width */
  variant?: "default" | "narrow" | "fullscreen";
  /** Whether multi-select bar is active (adds extra bottom padding) */
  multiSelectActive?: boolean;
  /** Additional CSS classes */
  className?: string;
};

/**
 * PageContainer - Enforces consistent page-level spacing and width constraints
 * 
 * Variants:
 * - default: max-w-7xl (1280px) with responsive horizontal padding
 * - narrow: max-w-3xl (768px) for Settings, forms
 * - fullscreen: 100% width, no horizontal padding (content manages own layout)
 * 
 * Bottom padding automatically accounts for:
 * - Tab bar height (56px on mobile)
 * - Safe area insets (iOS notch/home indicator)
 * - Multi-select bar when active (+72px)
 */
export function PageContainer({
  children,
  variant = "default",
  multiSelectActive = false,
  className,
}: PageContainerProps) {
  const variantClasses = {
    default: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
    narrow: "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8",
    fullscreen: "w-full",
  };

  return (
    <div
      className={cn(variantClasses[variant], className)}
      style={{
        paddingBottom: multiSelectActive
          ? 'var(--bottom-safe-area-with-select)'
          : 'var(--bottom-safe-area)',
      }}
      data-multi-select-active={multiSelectActive || undefined}
    >
      <div 
        className="flex flex-col"
        style={{ gap: 'var(--space-section-gap, 24px)' }}
      >
        {children}
      </div>
    </div>
  );
}

export type { PageContainerProps };

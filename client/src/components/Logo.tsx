import { getLogoPath } from "@/lib/logo";
import { useEffect, useState } from "react";

interface LogoProps {
  className?: string;
  alt?: string;
  [key: string]: any;
}

/**
 * Theme-aware Logo component
 * Automatically updates when theme changes between green-mantis and orchid-mantis
 */
export function Logo({ className, alt = "Logo", ...props }: LogoProps) {
  const [logoPath, setLogoPath] = useState(getLogoPath());

  useEffect(() => {
    // Watch for theme changes
    const observer = new MutationObserver(() => {
      setLogoPath(getLogoPath());
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    
    return () => observer.disconnect();
  }, []);

  return (
    <img
      src={logoPath}
      alt={alt}
      className={className}
      {...props}
    />
  );
}


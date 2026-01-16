import { useState, useEffect } from "react";

/**
 * Hook to get the portal root element for Radix portals.
 * This prevents iOS PWA viewport jumps by keeping portals inside the app shell.
 */
export function usePortalRoot(): HTMLElement | undefined {
  const [el, setEl] = useState<HTMLElement | undefined>();

  useEffect(() => {
    const portalRoot = document.getElementById("portal-root");
    setEl(portalRoot ?? undefined);
  }, []);

  return el;
}

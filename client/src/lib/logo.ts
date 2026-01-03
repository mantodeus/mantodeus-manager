/**
 * Theme-aware logo utilities
 * Returns the appropriate logo based on the current theme
 */

/**
 * Get the logo path based on the current theme
 * Green logo for green-mantis (dark mode)
 * Pink logo for orchid-mantis (light mode)
 */
export function getLogoPath(): string {
  if (typeof window === "undefined") {
    return "/logo_green.PNG"; // Default for SSR
  }

  const theme = document.documentElement.getAttribute("data-theme");
  
  if (theme === "orchid-mantis") {
    return "/logo_pink.PNG";
  }
  
  // Default to green for green-mantis or any other theme
  return "/logo_green.PNG";
}

/**
 * Get the favicon path based on the current theme
 */
export function getFaviconPath(): string {
  return getLogoPath();
}

/**
 * Update favicon dynamically based on theme
 */
export function updateFavicon(): void {
  if (typeof window === "undefined") return;

  const faviconPath = getFaviconPath();
  const favicons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]');
  
  favicons.forEach(favicon => {
    const currentHref = new URL(favicon.href, window.location.origin).pathname;
    if (currentHref !== faviconPath) {
      favicon.href = faviconPath;
    }
  });
  
  // Create if doesn't exist
  if (favicons.length === 0) {
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = faviconPath;
    document.head.appendChild(favicon);
  }
}

/**
 * Update app icons dynamically based on theme
 */
export function updateAppIcons(): void {
  if (typeof window === "undefined") return;

  const iconPath = getLogoPath();
  
  // Update all apple-touch-icon links
  const appleIcons = document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  appleIcons.forEach(link => {
    if (!link.href.endsWith(iconPath)) {
      link.href = iconPath;
    }
  });
  
  // Create if doesn't exist
  if (appleIcons.length === 0) {
    const appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    appleIcon.href = iconPath;
    document.head.appendChild(appleIcon);
  }
}

/**
 * Initialize logo system - call this on app startup
 */
export function initializeLogos(): void {
  updateFavicon();
  updateAppIcons();
  
  // Watch for theme changes
  const observer = new MutationObserver(() => {
    updateFavicon();
    updateAppIcons();
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  
  return () => observer.disconnect();
}


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
 * Get the PWA app icon path based on the current theme
 * Green app icon for green-mantis (dark mode)
 * Pink app icon for orchid-mantis (light mode)
 */
export function getAppIconPath(): string {
  if (typeof window === "undefined") {
    return "/app_icon_green.PNG"; // Default for SSR
  }

  const theme = document.documentElement.getAttribute("data-theme");
  
  if (theme === "orchid-mantis") {
    return "/app_icon_pink.PNG";
  }
  
  // Default to green for green-mantis or any other theme
  return "/app_icon_green.PNG";
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

// Store the current manifest blob URL for cleanup
let currentManifestBlobUrl: string | null = null;

/**
 * Update PWA manifest dynamically based on theme
 */
function updatePwaManifest(): void {
  if (typeof window === "undefined") return;

  const appIconPath = getAppIconPath();
  const origin = window.location.origin;
  const resolveUrl = (path: string) => new URL(path, origin).toString();
  
  // Get current theme to set appropriate colors
  const theme = document.documentElement.getAttribute("data-theme");
  const isOrchidMantis = theme === "orchid-mantis";
  
  // Theme colors: Green Mantis (dark) or Orchid Mantis (light)
  // Use neutral monochrome backgrounds (no blue tint)
  // Dark mode: neutral black/grey matching surface-0 from index.css (oklch(0.10 0 0) ≈ #1A1A1A)
  // Light mode: warm white matching surface-0 from index.css (oklch(0.98 0.01 85) ≈ #FAFAF8)
  const backgroundColor = isOrchidMantis ? "#FAFAF8" : "#1A1A1A";
  const themeColor = isOrchidMantis ? "#FAFAF8" : "#1A1A1A";
  
  // Base manifest structure
  const manifest = {
    name: "Mantodeus Manager",
    short_name: "Mantodeus",
    description: "Job management system for construction teams to log jobs, create reports, and manage tasks",
    start_url: resolveUrl("/"),
    display: "standalone",
    background_color: backgroundColor,
    theme_color: themeColor,
    orientation: "portrait-primary",
    icons: [
      {
        src: resolveUrl(appIconPath),
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: resolveUrl(appIconPath),
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ],
    categories: ["productivity", "business"],
    screenshots: [
      {
        src: resolveUrl("/screenshot-mobile.png"),
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow"
      }
    ]
  };

  // Revoke previous blob URL if it exists
  if (currentManifestBlobUrl) {
    URL.revokeObjectURL(currentManifestBlobUrl);
    currentManifestBlobUrl = null;
  }

  // Find or create manifest link
  let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  
  if (!manifestLink) {
    manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    document.head.appendChild(manifestLink);
  }

  // Create new blob URL for manifest
  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  currentManifestBlobUrl = URL.createObjectURL(manifestBlob);
  manifestLink.href = currentManifestBlobUrl;
}

/**
 * Update app icons dynamically based on theme
 */
export function updateAppIcons(): void {
  if (typeof window === "undefined") return;

  const iconPath = getLogoPath();
  const appIconPath = getAppIconPath();
  
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

  // Update PWA manifest with app icons
  updatePwaManifest();
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

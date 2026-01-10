/**
 * Route Tracking Hook
 *
 * Tracks route changes and updates activeTab and lastUsedModuleByTab
 * based on the current route.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMobileNav } from './MobileNavProvider';
import { MODULE_REGISTRY } from './constants';
import type { TabId } from './types';

/**
 * Determines which tab a route belongs to by checking the MODULE_REGISTRY
 */
function getTabForRoute(path: string): TabId | null {
  // Check each tab's modules to find which tab this route belongs to
  for (const [tabId, modules] of Object.entries(MODULE_REGISTRY)) {
    for (const module of modules) {
      // Check if the path starts with the module path
      // This handles both exact matches and nested routes (e.g., /projects/:id)
      if (path === module.path || path.startsWith(module.path + '/')) {
        return tabId as TabId;
      }
    }
  }
  return null;
}

/**
 * Hook to track route changes and update mobile navigation state
 * Should only be used on mobile devices
 */
export function useRouteTracking() {
  const [location] = useLocation();
  const { setActiveTab, setLastUsedModule, activeTab, lastUsedModuleByTab } = useMobileNav();

  useEffect(() => {
    const tab = getTabForRoute(location);
    
    if (tab) {
      // Update active tab if it changed
      if (tab !== activeTab) {
        setActiveTab(tab);
      }
      
      // Update last used module for this tab
      // Track the actual path visited so users can return to detail pages
      // e.g., if user visits /projects/123, clicking the tab again should go back to /projects/123
      const matchingModule = MODULE_REGISTRY[tab].find(
        module => location === module.path || location.startsWith(module.path + '/')
      );
      
      if (matchingModule && lastUsedModuleByTab[tab] !== location) {
        // Track the actual path visited (could be a detail page)
        setLastUsedModule(tab, location);
      }
    }
  }, [location, setActiveTab, setLastUsedModule, activeTab, lastUsedModuleByTab]);
}


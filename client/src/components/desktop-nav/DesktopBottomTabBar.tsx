/**
 * Desktop Bottom Tab Bar Component
 *
 * Fixed navigation bar for desktop with:
 * - Left: Office, Action, Tools (navigation tabs)
 * - Right: Chat (assistant toggle)
 */

import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useManto } from '@/contexts/MantoContext';
import { BugAnt, PencilSquareIcon, WrenchScrewdriver } from '@/components/ui/Icon';

/**
 * Navigation tabs (left side)
 */
const NAV_TABS = [
  { id: 'office' as const, icon: PencilSquareIcon, label: 'Office' },
  { id: 'action' as const, icon: BugAnt, label: 'Action' },
  { id: 'tools' as const, icon: WrenchScrewdriver, label: 'Tools' },
] as const;

export function DesktopBottomTabBar() {
  const [location, setLocation] = useLocation();
  const { isOpen: isChatOpen, toggleManto } = useManto();

  const handleNavTabClick = (tabId: typeof NAV_TABS[number]['id']) => {
    // Office and Tools tabs - navigate to first module in group
    // This will be replaced with proper navigation logic in future phases
    if (tabId === 'office') {
      // Navigate to first Office module (Projects)
      setLocation('/projects');
    } else if (tabId === 'tools') {
      // Navigate to first Tools module (Calendar)
      setLocation('/calendar');
    }
    // Action tab - reserved for future actions (capture/record)
    // No action for now
  };

  // Determine if a nav tab is active based on current route
  const isNavTabActive = (tabId: typeof NAV_TABS[number]['id']): boolean => {
    // Action tab is never "active" (reserved for future actions)
    if (tabId === 'action') {
      return false;
    }
    
    // Office tab active for: /projects, /invoices, /expenses, /reports, /notes, /inspections
    if (tabId === 'office') {
      return location.startsWith('/projects') ||
             location.startsWith('/invoices') ||
             location.startsWith('/expenses') ||
             location.startsWith('/reports') ||
             location.startsWith('/notes') ||
             location.startsWith('/inspections');
    }
    
    // Tools tab active for: /calendar, /contacts, /gallery, /maps, /settings, /weather
    if (tabId === 'tools') {
      return location.startsWith('/calendar') ||
             location.startsWith('/contacts') ||
             location.startsWith('/gallery') ||
             location.startsWith('/maps') ||
             location.startsWith('/settings') ||
             location.startsWith('/weather');
    }
    
    return false;
  };

  return (
    <div
      data-desktop-nav="bottom-tab-bar"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[50]', // Above content
        'bg-background/95 backdrop-blur-md', // Glass effect matching Mantodeus style
        'border-t border-border',
        'hidden md:flex', // Desktop only (opposite of mobile)
        'select-none', // Prevent text selection
        'pointer-events-auto' // Ensure tab bar always receives pointer events
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)', // Safe area for notched devices
        height: '44px', // Reduced height for dock-like feel
      }}
    >
      <div className="flex h-11 items-center justify-between px-6 py-2 w-full">
        {/* Left: Navigation Tabs (Office, Action, Tools) */}
        <div className="flex items-center justify-start gap-16">
          {NAV_TABS.map((tab) => {
            const isActive = isNavTabActive(tab.id);
            const isAction = tab.id === 'action';

            return (
              <button
                key={tab.id}
                data-desktop-nav="nav-tab"
                data-tab-id={tab.id}
                className={cn(
                  'relative flex items-center justify-center',
                  'px-4 py-2',
                  'transition-all duration-200 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'select-none',
                  // Text styling - uppercase, light weight, tracking
                  'text-xs uppercase tracking-[0.15em] font-extralight',
                  // Hover state - subtle background bloom, opacity shift
                  'hover:bg-foreground/3 hover:opacity-100',
                  // Active state
                  isActive
                    ? 'text-foreground opacity-100'
                    : 'text-muted-foreground opacity-60',
                  // Action tab - slightly stronger presence when not active
                  isAction && !isActive && 'opacity-75',
                )}
                onClick={() => handleNavTabClick(tab.id)}
                aria-label={`${tab.label} tab`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Text label - text-only on desktop, no icons */}
                <span>{tab.label}</span>
                
                {/* Active indicator - subtle underline with glow */}
                {isActive && (
                  <span 
                    className="absolute bottom-0 left-0 right-0 h-px bg-primary/40"
                    style={{
                      boxShadow: '0 0 8px hsl(var(--primary) / 0.3)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Chat Button */}
        <div className="flex items-center justify-end">
          <button
            data-desktop-nav="chat-button"
            className={cn(
              'relative flex items-center justify-center',
              'px-4 py-2',
              'transition-all duration-200 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'select-none',
              // Text styling - uppercase, light weight, tracking (matching nav tabs)
              'text-xs uppercase tracking-[0.15em] font-extralight',
              // Hover state - subtle background bloom, opacity shift
              'hover:bg-foreground/3 hover:opacity-100',
              // Active state - subtle accent when chat is open
              isChatOpen
                ? 'text-foreground opacity-100'
                : 'text-muted-foreground opacity-60',
            )}
            onClick={toggleManto}
            aria-label="Chat"
            aria-pressed={isChatOpen}
          >
            {/* Text label */}
            <span>CHAT</span>
            
            {/* Active indicator - subtle underline with glow when chat is open */}
            {isChatOpen && (
              <span 
                className="absolute bottom-0 left-0 right-0 h-px bg-primary/40"
                style={{
                  boxShadow: '0 0 8px hsl(var(--primary) / 0.3)',
                }}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

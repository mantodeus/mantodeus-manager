/**
 * Desktop Navigation Rail
 * 
 * 60px vertical strip with tab group icons, Manto button, and user profile.
 * Hovering or clicking a tab reveals the flyout module scroller.
 */

import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useDesktopNav } from './DesktopNavProvider';
import { TABS, TIMING, LAYOUT } from './constants';
import type { TabId } from './types';
import { useAuth } from '@/_core/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BugAnt, LogOut, FileJson } from '@/components/ui/Icon';
import { useManto } from '@/contexts/MantoContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Logo } from '@/components/Logo';

interface DesktopNavRailProps {
  onDataExport?: () => void;
}

export function DesktopNavRail({ onDataExport }: DesktopNavRailProps) {
  const { user, logout } = useAuth();
  const { toggleManto } = useManto();
  const { activeTab, flyoutState, openFlyout, closeFlyout, lockFlyout } = useDesktopNav();
  
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTabMouseEnter = useCallback((tabId: TabId) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // If already showing a flyout (locked or hovering), switch immediately
    if (flyoutState !== 'closed') {
      openFlyout(tabId, flyoutState === 'locked');
      return;
    }

    // Otherwise, delay before showing
    hoverTimeoutRef.current = setTimeout(() => {
      openFlyout(tabId, false);
    }, TIMING.HOVER_DELAY);
  }, [flyoutState, openFlyout]);

  const handleTabMouseLeave = useCallback(() => {
    // Clear pending hover
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handleTabClick = useCallback((tabId: TabId) => {
    // Clear any pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (activeTab === tabId && flyoutState === 'locked') {
      // Clicking same locked tab closes it
      closeFlyout();
    } else {
      // Lock the flyout open
      openFlyout(tabId, true);
    }
  }, [activeTab, flyoutState, openFlyout, closeFlyout]);

  return (
    <div
      data-desktop-nav="rail"
      className={cn(
        "fixed left-0 top-0 bottom-0 z-[50]",
        "flex flex-col items-center",
        "bg-background/80 backdrop-blur-xl",
        "border-r border-border/50",
        "py-3"
      )}
      style={{ width: LAYOUT.RAIL_WIDTH }}
      onMouseLeave={handleTabMouseLeave}
    >
      {/* Logo */}
      <div className="mb-4">
        <Logo
          className="h-9 w-9 rounded-lg object-cover ring-1 ring-border/50"
          alt="Mantodeus"
        />
      </div>

      {/* Tab Icons */}
      <div className="flex-1 flex flex-col items-center gap-1 py-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  data-desktop-nav="tab"
                  data-tab-id={tab.id}
                  className={cn(
                    "relative w-11 h-11 flex items-center justify-center",
                    "rounded-xl transition-all duration-150",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive ? [
                      "bg-primary/15 text-primary",
                      "shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)]",
                    ] : [
                      "text-muted-foreground hover:text-foreground",
                      "hover:bg-muted/50",
                    ]
                  )}
                  onMouseEnter={() => handleTabMouseEnter(tab.id)}
                  onClick={() => handleTabClick(tab.id)}
                  aria-label={tab.label}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-150",
                      isActive && "scale-110"
                    )}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  
                  {/* Active indicator dot */}
                  {isActive && (
                    <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-l-full" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {tab.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-2 pt-2 border-t border-border/30 mt-2">
        {/* Manto Assistant */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "w-11 h-11 flex items-center justify-center",
                "rounded-xl transition-all duration-150",
                "text-muted-foreground hover:text-primary",
                "hover:bg-primary/10",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              onClick={() => toggleManto()}
              aria-label="Open Manto Assistant"
            >
              <BugAnt className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Manto Assistant
          </TooltipContent>
        </Tooltip>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-11 h-11 flex items-center justify-center",
                "rounded-xl transition-all duration-150",
                "hover:bg-muted/50",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8 border border-border/50">
                <AvatarFallback className="text-xs font-medium bg-muted">
                  {user?.name?.charAt(0).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-56">
            <div className="px-2 py-2 mb-1">
              <p className="text-sm font-medium">{user?.name || '-'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{user?.email || '-'}</p>
            </div>
            <DropdownMenuSeparator />
            {onDataExport && (
              <>
                <DropdownMenuItem onClick={onDataExport} className="cursor-pointer">
                  <FileJson className="mr-2 h-4 w-4" />
                  <span>Export / Import Data</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

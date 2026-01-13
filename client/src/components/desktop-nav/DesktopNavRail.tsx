/**
 * Desktop Navigation Rail
 * 
 * 60px vertical strip:
 * - Logo at top (click to open Ask Mantodeus)
 * - Tab icons: Office (flyout), Action (flyout), Tools (flyout)
 * - User profile at bottom
 */

import { useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useDesktopNav } from './DesktopNavProvider';
import { TABS, TIMING, LAYOUT } from './constants';
import type { TabId } from './types';
import { useAuth } from '@/_core/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, FileJson } from '@/components/ui/Icon';
import { useManto } from '@/contexts/MantoContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/Logo';

interface DesktopNavRailProps {
  onDataExport?: () => void;
}

export function DesktopNavRail({ onDataExport }: DesktopNavRailProps) {
  const { user, logout } = useAuth();
  const { toggleManto } = useManto();
  const [location, setLocation] = useLocation();
  const { activeTab, flyoutState, openFlyout, closeFlyout } = useDesktopNav();
  
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTabMouseEnter = useCallback((tab: typeof TABS[0]) => {
    // Only handle hover for flyout tabs
    if (tab.type !== 'flyout') return;

    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // If already showing a flyout (locked or hovering), switch immediately
    if (flyoutState !== 'closed') {
      openFlyout(tab.id as 'office' | 'action' | 'tools', flyoutState === 'locked', 'rail');
      return;
    }

    // Otherwise, delay before showing
    hoverTimeoutRef.current = setTimeout(() => {
      openFlyout(tab.id as 'office' | 'action' | 'tools', false, 'rail');
    }, TIMING.HOVER_DELAY);
  }, [flyoutState, openFlyout]);

  const handleTabMouseLeave = useCallback(() => {
    // Clear pending hover
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handleTabClick = useCallback((tab: typeof TABS[0]) => {
    // Clear any pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (tab.type === 'direct' && tab.path) {
      // Direct navigation (Capture, Record)
      setLocation(tab.path);
      closeFlyout(); // Close any open flyout
    } else if (tab.type === 'flyout') {
      // Flyout tabs (Office, Tools)
      if (activeTab === tab.id && flyoutState === 'locked') {
        // Clicking same locked tab closes it
        closeFlyout();
      } else {
        // Lock the flyout open
        openFlyout(tab.id as 'office' | 'action' | 'tools', true, 'rail');
      }
    }
  }, [activeTab, flyoutState, openFlyout, closeFlyout, setLocation]);

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
      {/* Logo - Click to open Ask Mantodeus */}
      <button
        className={cn(
          "mb-4 rounded-lg transition-all duration-150",
          "hover:scale-105 hover:ring-2 hover:ring-primary/30",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        onClick={() => toggleManto()}
        aria-label="Ask Mantodeus"
      >
        <Logo
          className="h-9 w-9 rounded-lg object-cover ring-1 ring-border/50"
          alt="Ask Mantodeus"
        />
      </button>

      {/* Tab Icons */}
      <div className="flex-1 flex flex-col items-center gap-1 py-2">
        {TABS.map((tab) => {
          // For direct navigation tabs, check current location
          // For flyout tabs, check activeTab state
          const isActive = tab.type === 'direct' 
            ? location === tab.path || (tab.path && location.startsWith(tab.path + '/'))
            : activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              data-desktop-nav="tab"
              data-tab-id={tab.id}
              className={cn(
                "relative w-11 h-11 flex items-center justify-center",
                "rounded-xl transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "text-muted-foreground hover:text-foreground",
                isActive ? [
                  "bg-foreground/5 dark:bg-foreground/7",
                ] : [
                  "hover:bg-foreground/5 active:bg-foreground/8",
                  "dark:hover:bg-foreground/7 dark:active:bg-foreground/10",
                ],
                "border border-transparent hover:border-border/70",
              )}
              onMouseEnter={() => handleTabMouseEnter(tab)}
              onClick={() => handleTabClick(tab)}
              aria-label={tab.label}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors duration-150",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
                strokeWidth={isActive ? 2 : 1.5}
              />
            </button>
          );
        })}
      </div>

      {/* User Profile */}
      <div className="pt-2 border-t border-border/30 mt-2">
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

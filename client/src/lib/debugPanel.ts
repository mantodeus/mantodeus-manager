/**
 * Debug Panel Utilities
 * Controls visibility of the debug panel button
 */

const DEBUG_PANEL_ENABLED_KEY = 'debug-panel-enabled';

/**
 * Get whether the debug panel is enabled
 * Defaults to false (disabled) for production
 */
export function isDebugPanelEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(DEBUG_PANEL_ENABLED_KEY);
  // Default to false (disabled) - user must explicitly enable it
  return stored === 'true';
}

/**
 * Set whether the debug panel is enabled
 */
export function setDebugPanelEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEBUG_PANEL_ENABLED_KEY, enabled ? 'true' : 'false');
  
  // Update button visibility immediately
  const button = document.getElementById('debug-panel-toggle');
  if (button) {
    button.style.display = enabled ? 'flex' : 'none';
  }
  
  // Dispatch custom event for same-tab updates
  window.dispatchEvent(new CustomEvent('debug-panel-setting-changed', {
    detail: { enabled }
  }));
}

/**
 * Toggle debug panel visibility
 */
export function toggleDebugPanelEnabled(): boolean {
  const current = isDebugPanelEnabled();
  setDebugPanelEnabled(!current);
  return !current;
}

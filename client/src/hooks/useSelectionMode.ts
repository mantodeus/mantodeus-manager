import { useCallback, useEffect, useState } from "react";

interface UseSelectionModeOptions<T extends string | number> {
  /** Called when selection mode changes */
  onSelectionModeChange?: (isActive: boolean) => void;
  /** Called when selection changes */
  onSelectionChange?: (selectedIds: Set<T>) => void;
}

interface UseSelectionModeResult<T extends string | number> {
  /** Whether selection mode is currently active */
  isSelectionMode: boolean;
  /** Set of currently selected item IDs */
  selectedIds: Set<T>;
  /** Number of selected items */
  selectedCount: number;
  /** Enter selection mode, optionally with an initial selection */
  enterSelectionMode: (initialId?: T) => void;
  /** Exit selection mode and clear all selections */
  exitSelectionMode: () => void;
  /** Toggle selection of a single item */
  toggleSelection: (id: T) => void;
  /** Select a single item (additive) */
  selectItem: (id: T) => void;
  /** Deselect a single item */
  deselectItem: (id: T) => void;
  /** Select multiple items at once */
  selectMultiple: (ids: T[]) => void;
  /** Clear all selections (but stay in selection mode) */
  clearSelection: () => void;
  /** Check if an item is selected */
  isSelected: (id: T) => boolean;
  /** Handle shift+click for range selection (desktop) */
  handleShiftClick: (id: T, allIds: T[]) => void;
}

/**
 * Hook for managing multi-select mode with keyboard support.
 * Designed for list/grid selection patterns (Notion/Linear style).
 */
export function useSelectionMode<T extends string | number>(
  options: UseSelectionModeOptions<T> = {}
): UseSelectionModeResult<T> {
  const { onSelectionModeChange, onSelectionChange } = options;

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<T | null>(null);

  // Exit selection mode when no items are selected
  useEffect(() => {
    if (isSelectionMode && selectedIds.size === 0) {
      setIsSelectionMode(false);
      onSelectionModeChange?.(false);
    }
  }, [isSelectionMode, selectedIds.size, onSelectionModeChange]);

  // Notify on selection change
  useEffect(() => {
    onSelectionChange?.(selectedIds);
  }, [selectedIds, onSelectionChange]);

  // Keyboard handler for Escape to exit selection mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectionMode) {
        e.preventDefault();
        setIsSelectionMode(false);
        setSelectedIds(new Set());
        setLastSelectedId(null);
        onSelectionModeChange?.(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectionMode, onSelectionModeChange]);

  const enterSelectionMode = useCallback(
    (initialId?: T) => {
      setIsSelectionMode(true);
      if (initialId !== undefined) {
        setSelectedIds(new Set([initialId]));
        setLastSelectedId(initialId);
      }
      onSelectionModeChange?.(true);
    },
    [onSelectionModeChange]
  );

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    setLastSelectedId(null);
    onSelectionModeChange?.(false);
  }, [onSelectionModeChange]);

  const toggleSelection = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setLastSelectedId(id);
      }
      return next;
    });
  }, []);

  const selectItem = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      setLastSelectedId(id);
      return next;
    });
  }, []);

  const deselectItem = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const selectMultiple = useCallback((ids: T[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      if (ids.length > 0) {
        setLastSelectedId(ids[ids.length - 1]);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  const isSelected = useCallback(
    (id: T) => selectedIds.has(id),
    [selectedIds]
  );

  const handleShiftClick = useCallback(
    (id: T, allIds: T[]) => {
      if (!lastSelectedId) {
        toggleSelection(id);
        return;
      }

      const lastIndex = allIds.indexOf(lastSelectedId);
      const currentIndex = allIds.indexOf(id);

      if (lastIndex === -1 || currentIndex === -1) {
        toggleSelection(id);
        return;
      }

      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);
      const rangeIds = allIds.slice(start, end + 1);

      selectMultiple(rangeIds);
    },
    [lastSelectedId, toggleSelection, selectMultiple]
  );

  return {
    isSelectionMode,
    selectedIds,
    selectedCount: selectedIds.size,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectItem,
    deselectItem,
    selectMultiple,
    clearSelection,
    isSelected,
    handleShiftClick,
  };
}

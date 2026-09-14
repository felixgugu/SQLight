export const STORAGE_EXPLORER_FILTER_HISTORY_KEY = 'sqlight_explorer_filter_history';
export const MAX_FILTER_HISTORY_ITEMS = 30;

function getSafeStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // LocalStorage might be disabled or restricted in sandboxed environments
  }
  return null;
}

/**
 * Load the saved filter history from storage.
 * Always returns an array of strings, capped at MAX_FILTER_HISTORY_ITEMS.
 */
export function loadFilterHistory(storage?: Storage): string[] {
  const store = getSafeStorage(storage);
  if (!store) return [];

  try {
    const raw = store.getItem(STORAGE_EXPLORER_FILTER_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, MAX_FILTER_HISTORY_ITEMS);
    }
  } catch (e) {
    console.warn('Failed to parse explorer filter history from storage:', e);
  }
  return [];
}

/**
 * Save the filter history to storage.
 */
export function saveFilterHistory(history: string[], storage?: Storage): void {
  const store = getSafeStorage(storage);
  if (!store) return;

  try {
    const capped = history
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .slice(0, MAX_FILTER_HISTORY_ITEMS);
    store.setItem(STORAGE_EXPLORER_FILTER_HISTORY_KEY, JSON.stringify(capped));
  } catch (e) {
    console.warn('Failed to save explorer filter history to storage:', e);
  }
}

/**
 * Add a new query to history.
 * - Trims whitespace.
 * - Deduplicates case-insensitively while preserving the latest entered casing.
 * - Promotes the query to the front (index 0 - LRU).
 * - Caps at MAX_FILTER_HISTORY_ITEMS (30).
 */
export function addFilterHistoryItem(history: string[], query: string): string[] {
  const trimmed = (query || '').trim();
  if (!trimmed) return history;

  const filtered = history.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
  const updated = [trimmed, ...filtered];
  return updated.slice(0, MAX_FILTER_HISTORY_ITEMS);
}

/**
 * Remove a specific query item from history (case-insensitive).
 */
export function removeFilterHistoryItem(history: string[], query: string): string[] {
  const target = (query || '').trim().toLowerCase();
  return history.filter((item) => item.trim().toLowerCase() !== target);
}

/**
 * Clear all filter history from storage.
 */
export function clearFilterHistory(storage?: Storage): void {
  const store = getSafeStorage(storage);
  if (!store) return;

  try {
    store.removeItem(STORAGE_EXPLORER_FILTER_HISTORY_KEY);
  } catch (e) {
    console.warn('Failed to clear explorer filter history:', e);
  }
}

import { useEffect, useRef } from "react";

/**
 * Register a keyboard shortcut globally on the document.
 * Treats ⌘ (Mac) and Ctrl (Win/Linux) as equivalent when cmdOrCtrl is true.
 *
 * @param key        - Key name (e.g. "s", "Enter", "k", "Escape")
 * @param callback   - Called when the shortcut fires
 * @param options.cmdOrCtrl - Require Cmd or Ctrl modifier
 * @param options.shift     - Require Shift modifier
 * @param options.enabled   - Disable without removing the hook (default true)
 */
export function useShortcut(
  key: string,
  callback: () => void,
  options: { cmdOrCtrl?: boolean; shift?: boolean; enabled?: boolean } = {}
) {
  const { cmdOrCtrl = false, shift = false, enabled = true } = options;

  // Keep the latest callback in a ref so the effect never needs to re-run for it
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; });

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const hasCmd = e.metaKey || e.ctrlKey;
      if (cmdOrCtrl && !hasCmd) return;
      if (!cmdOrCtrl && hasCmd) return; // don't steal Cmd+X combos for non-cmd shortcuts
      if (shift && !e.shiftKey) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      e.preventDefault();
      cbRef.current();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [key, cmdOrCtrl, shift, enabled]);
}

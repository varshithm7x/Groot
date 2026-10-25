/** Stable preferences retain missing plugin IDs so reinstalling restores their position. */
export function normalizePinnedTools(value: unknown): string[] {
  if (!Array.isArray(value))
    return ["library", "search", "forge", "canvas", "ai"];
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ).map((id) => id === "graph" ? "forge" : id),
    ),
  ];
}

/** Built-in right sidebar panels remain available without a plugin view. */
export function isBuiltInRightSidebarTab(tab: string): boolean {
  return tab === "outline" || tab === "backlinks" || tab === "outgoing" || tab === "ai" || tab === "forge";
}

export function fitDockTools<T extends { label: string }>(
  tools: T[],
  width: number,
): T[] {
  let remaining = Math.max(0, width - 96); // More is always reachable.
  const result: T[] = [];
  for (const tool of tools) {
    const size = Math.max(96, tool.label.length * 8 + 72);
    if (size > remaining) break;
    result.push(tool);
    remaining -= size;
  }
  return result;
}

/** UI preferences are device-local and remain available before a vault opens. */
export function readStudioPreference<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(`openonyx.studio.${key}`);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStudioPreference(key: string, value: unknown): void {
  try {
    localStorage.setItem(`openonyx.studio.${key}`, JSON.stringify(value));
  } catch {
    /* Storage can be disabled. Keep this session usable. */
  }
}

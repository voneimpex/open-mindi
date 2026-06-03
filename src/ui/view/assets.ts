/**
 * Asset URL resolver. The single-file download build injects a global
 * `window.__MINDI_ASSETS` map of `path -> data: URI` so the game runs fully
 * offline from one HTML file. Everywhere else this is undefined and the normal
 * relative URL (served from /public) is used.
 */
export function assetUrl(path: string, fallback: string): string {
  const map = typeof window !== 'undefined' ? (window as any).__MINDI_ASSETS : undefined;
  return map && map[path] ? map[path] : fallback;
}

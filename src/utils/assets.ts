/**
 * Safe Asset URL resolver for Electron builds.
 * In packaged Electron apps (file:// protocol), root-relative paths ("/icon.png")
 * resolve to the filesystem root (C:/icon.png).
 * This helper ensures assets always resolve relative to the app base.
 */
export function getAssetPath(assetPath: string): string {
  if (!assetPath) return "";
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://") || assetPath.startsWith("data:") || assetPath.startsWith("blob:") || assetPath.startsWith("media://")) {
    return assetPath;
  }
  const clean = assetPath.replace(/^\.?\//, "");
  const base = import.meta.env.BASE_URL || "./";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${clean}`;
}

export type InstallPlatform = "ios" | "android" | null;

/** Which phone the visitor is on, or null on desktop. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  // iPadOS reports itself as a Mac but has touch.
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return null;
}

/** The "Instalar App" button only appears on phones, and never once the app is already installed. */
export function shouldShowInstall(platform: InstallPlatform, isStandalone: boolean): boolean {
  return platform !== null && !isStandalone;
}

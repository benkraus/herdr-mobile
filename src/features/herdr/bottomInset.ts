const ANDROID_SYSTEM_BAR_FLOOR = 48;

export function safeBottomInset(
  bottom: number,
  platform: string,
  keyboardVisible: boolean,
): number {
  if (platform === "android" && keyboardVisible) return 0;
  return platform === "android" ? Math.max(bottom, ANDROID_SYSTEM_BAR_FLOOR) : bottom;
}

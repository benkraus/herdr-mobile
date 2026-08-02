const OUTPUT_FOLLOW_THRESHOLD = 48;

export function isOutputNearBottom(
  offsetY: number,
  viewportHeight: number,
  contentHeight: number,
): boolean {
  return contentHeight - viewportHeight - offsetY <= OUTPUT_FOLLOW_THRESHOLD;
}

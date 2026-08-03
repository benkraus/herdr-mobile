export function retainedRefreshMessage(
  error: string | null,
  hasRetainedRows: boolean,
  resource: string,
): string | null {
  if (!error || !hasRetainedRows) return null;
  return `Refresh failed. Showing previously loaded ${resource}. ${error}`;
}

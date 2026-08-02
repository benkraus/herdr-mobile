import { normalizeBaseUrl } from "./model";
import type { ConnectionConfig } from "./types";

export function parseConnection(value: string): ConnectionConfig | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.baseUrl !== "string") return null;
    if (candidate.session !== undefined && typeof candidate.session !== "string") return null;
    const baseUrl = normalizeBaseUrl(candidate.baseUrl);
    if (!baseUrl) return null;
    const session = candidate.session?.trim();
    return session ? { baseUrl, session } : { baseUrl };
  } catch {
    return null;
  }
}

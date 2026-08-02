import type {
  ActionResponse,
  UploadImageRequest,
  UploadImageResponse,
} from "../../lib/types";

const HERDR_UPLOAD_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isHerdrUploadMimeType(mimeType: string): boolean {
  return HERDR_UPLOAD_MIME_TYPES.has(mimeType.toLowerCase());
}

export async function stageAndPasteHerdrImages(input: {
  readonly images: ReadonlyArray<UploadImageRequest>;
  readonly upload: (image: UploadImageRequest) => Promise<UploadImageResponse>;
  readonly paste: (remotePaths: string) => Promise<ActionResponse>;
}): Promise<ActionResponse> {
  const remotePaths: string[] = [];
  for (const image of input.images) {
    const result = await input.upload(image);
    if (!result.ok) return result;
    remotePaths.push(result.path);
  }
  if (remotePaths.length === 0) {
    return { ok: false, error: "Select at least one image to attach." };
  }
  return input.paste(remotePaths.join(" "));
}

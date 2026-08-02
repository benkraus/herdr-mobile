import { describe, expect, it, vi } from "vitest";

import { isHerdrUploadMimeType, stageAndPasteHerdrImages } from "./imageAttachments";

const image = (name: string, mimeType = "image/png") => ({
  name,
  mimeType,
  dataUrl: `data:${mimeType};base64,aGVsbG8=`,
});

describe("Herdr image attachments", () => {
  it("matches the relay's supported image types", () => {
    expect(isHerdrUploadMimeType("image/png")).toBe(true);
    expect(isHerdrUploadMimeType("image/jpeg")).toBe(true);
    expect(isHerdrUploadMimeType("image/webp")).toBe(true);
    expect(isHerdrUploadMimeType("image/gif")).toBe(true);
    expect(isHerdrUploadMimeType("image/heic")).toBe(false);
    expect(isHerdrUploadMimeType("image/svg+xml")).toBe(false);
  });

  it("stages every selected image before pasting the returned remote paths", async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, path: "/tmp/herdr/one.png" })
      .mockResolvedValueOnce({ ok: true, path: "/tmp/herdr/two.jpg" });
    const paste = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      stageAndPasteHerdrImages({
        images: [image("one.png"), image("two.jpg", "image/jpeg")],
        upload,
        paste,
      }),
    ).resolves.toEqual({ ok: true });

    expect(upload).toHaveBeenCalledTimes(2);
    expect(paste).toHaveBeenCalledOnce();
    expect(paste).toHaveBeenCalledWith("/tmp/herdr/one.png /tmp/herdr/two.jpg");
  });

  it("does not paste local or partial paths when staging fails", async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, path: "/tmp/herdr/one.png" })
      .mockResolvedValueOnce({ ok: false, error: "image too large" });
    const paste = vi.fn();

    await expect(
      stageAndPasteHerdrImages({
        images: [image("one.png"), image("two.png")],
        upload,
        paste,
      }),
    ).resolves.toEqual({ ok: false, error: "image too large" });

    expect(paste).not.toHaveBeenCalled();
  });
});

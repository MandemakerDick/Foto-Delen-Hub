import { afterEach, describe, expect, it, vi } from "vitest";
import { requestUploadUrl } from "@workspace/api-client-react";
import { imageContentType, MAX_PHOTO_SIZE, storePhoto } from "./photo-upload";

vi.mock("@workspace/api-client-react", () => ({ requestUploadUrl: vi.fn() }));

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("photo draft transfer", () => {
  it("does not request storage until explicitly called, then transfers one image", async () => {
    const photo = new File(["pixels"], "frame.jpg", { type: "image/jpeg" });
    expect(requestUploadUrl).not.toHaveBeenCalled();
    vi.mocked(requestUploadUrl).mockResolvedValue({
      uploadURL: "https://storage.example/upload",
      objectPath: "/objects/frame",
    });
    const transfer = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", transfer);

    await expect(storePhoto(photo, new AbortController())).resolves.toBe("/api/storage/objects/frame");
    expect(requestUploadUrl).toHaveBeenCalledWith(
      { name: "frame.jpg", size: photo.size, contentType: "image/jpeg" },
      { signal: expect.any(AbortSignal) },
    );
    expect(transfer).toHaveBeenCalledWith("https://storage.example/upload", expect.objectContaining({
      method: "PUT", body: photo, headers: { "Content-Type": "image/jpeg" },
    }));
  });

  it("rejects non-images and images over 25 MiB before presigning", async () => {
    const text = new File(["text"], "notes.txt", { type: "text/plain" });
    expect(imageContentType(text)).toBeNull();
    await expect(storePhoto(text, new AbortController())).rejects.toThrow("Invalid image");
    const large = new File([new Uint8Array(MAX_PHOTO_SIZE + 1)], "large.jpg", { type: "image/jpeg" });
    await expect(storePhoto(large, new AbortController())).rejects.toThrow("Invalid image");
    expect(requestUploadUrl).not.toHaveBeenCalled();
  });

  it("does not transfer bytes if the presign request is cancelled", async () => {
    const controller = new AbortController();
    vi.mocked(requestUploadUrl).mockImplementation((_data, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")));
    }));
    const transfer = vi.fn();
    vi.stubGlobal("fetch", transfer);
    const pending = storePhoto(new File(["pixels"], "frame.jpg", { type: "image/jpeg" }), controller);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(transfer).not.toHaveBeenCalled();
  });
});
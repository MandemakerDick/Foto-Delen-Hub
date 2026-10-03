import { requestUploadUrl } from "@workspace/api-client-react";

export const MAX_PHOTO_SIZE = 25 * 1024 * 1024;

export function imageContentType(file: File): string | null {
  if (file.type.startsWith("image/")) return file.type;
  if (file.type) return null;
  const extension = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", heic: "image/heic", avif: "image/avif",
  };
  return extension ? types[extension] ?? null : null;
}

export class UploadTimeoutError extends Error {
  constructor() {
    super("Upload timed out");
  }
}

export async function storePhoto(file: File, controller: AbortController): Promise<string> {
  const contentType = imageContentType(file);
  if (!contentType || !file.size || file.size > MAX_PHOTO_SIZE) {
    throw new Error("Invalid image");
  }

  const withDeadline = async <T,>(operation: () => Promise<T>, milliseconds: number): Promise<T> => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, milliseconds);
    try {
      return await operation();
    } catch (error) {
      if (timedOut) throw new UploadTimeoutError();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  const signed = await withDeadline(
    () => requestUploadUrl({ name: file.name || `photo-${Date.now()}.jpg`, size: file.size, contentType }, { signal: controller.signal }),
    20_000,
  );
  if (controller.signal.aborted) throw new DOMException("Upload cancelled", "AbortError");
  const result = await withDeadline(
    () => fetch(signed.uploadURL, {
      method: "PUT", body: file, headers: { "Content-Type": contentType }, signal: controller.signal,
    }),
    120_000,
  );
  if (controller.signal.aborted) throw new DOMException("Upload cancelled", "AbortError");
  if (!result.ok) throw new Error("Storage transfer failed");
  return `/api/storage${signed.objectPath}`;
}
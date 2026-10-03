import { beforeEach, describe, expect, it, vi } from "vitest";

const storageFixture = vi.hoisted(() => ({
  bucket: vi.fn(),
  file: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket(name: string) { return storageFixture.bucket(name); }
  },
}));

import { ObjectStorageService } from "./lib/objectStorage";

const service = new ObjectStorageService();

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  storageFixture.delete.mockResolvedValue(undefined);
  storageFixture.file.mockReturnValue({ delete: storageFixture.delete });
  storageFixture.bucket.mockReturnValue({ file: storageFixture.file });
  vi.spyOn(service, "getPrivateObjectDir").mockReturnValue("uploads-test-bucket/private");
});

describe("ObjectStorageService.deleteUploadObject", () => {
  it.each(["uploads", "imports"])("deletes a canonical staged %s object from its private bucket path", async (prefix) => {
    const id = "12345678-abcd-4abc-8abc-1234567890ab";

    await service.deleteUploadObject(`/objects/${prefix}/${id}`);

    expect(storageFixture.bucket).toHaveBeenCalledExactlyOnceWith("uploads-test-bucket");
    expect(storageFixture.file).toHaveBeenCalledExactlyOnceWith(`private/${prefix}/${id}`);
    expect(storageFixture.delete).toHaveBeenCalledExactlyOnceWith({ ignoreNotFound: true });
  });

  it.each([
    "/objects/legacy/12345678-abcd-4abc-8abc-1234567890ab",
    "https://external.example.test/objects/imports/12345678-abcd-4abc-8abc-1234567890ab",
    "/objects/imports/../../etc/passwd",
    "/objects/imports/not-a-uuid",
    "/objects/uploads/../../etc/passwd",
    "/objects/uploads/not-a-uuid",
  ])("rejects unsafe or non-upload object paths: %s", async (path) => {
    await expect(service.deleteUploadObject(path)).rejects.toThrow(/only staged upload objects/i);
    expect(storageFixture.bucket).not.toHaveBeenCalled();
    expect(storageFixture.file).not.toHaveBeenCalled();
    expect(storageFixture.delete).not.toHaveBeenCalled();
  });
});
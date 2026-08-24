import { requestImageUpload, uploadImageToSignedUrl } from "@/lib/api";

const THUMBNAIL_MAX_SIZE = 256;

async function createThumbnail(
  file: File,
): Promise<{ blob: Blob; type: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    THUMBNAIL_MAX_SIZE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to create thumbnail"))),
      "image/jpeg",
      0.8,
    ),
  );

  return { blob, type: "image/jpeg" };
}

export interface UploadedImageKeys {
  imageKey: string;
  thumbnailKey: string;
}

export async function uploadChatImage(
  projectId: string,
  file: File,
): Promise<UploadedImageKeys> {
  const contentType = file.type || "image/png";
  const upload = await requestImageUpload(projectId, contentType);
  const thumbnail = await createThumbnail(file);

  await Promise.all([
    uploadImageToSignedUrl(upload.imageUploadUrl, file, contentType),
    uploadImageToSignedUrl(
      upload.thumbnailUploadUrl,
      thumbnail.blob,
      thumbnail.type,
    ),
  ]);

  return { imageKey: upload.imageKey, thumbnailKey: upload.thumbnailKey };
}

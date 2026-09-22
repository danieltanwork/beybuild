import "server-only";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const endpoint = process.env.NEON_STORAGE_ENDPOINT!;
const region = process.env.NEON_STORAGE_REGION!;
const bucket = process.env.NEON_STORAGE_BUCKET!;

const s3 = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.NEON_STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.NEON_STORAGE_SECRET_ACCESS_KEY!,
  },
  // Neon's S3-compatible endpoint doesn't support the SDK's default
  // request/response checksum trailers — without this, a direct
  // s3.send(PutObjectCommand) (used by uploadBuffer) fails with a 403.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export async function createUploadUrl(filename: string, contentType: string) {
  const ext = filename.includes(".") ? filename.split(".").pop() : undefined;
  const key = `${randomUUID()}${ext ? `.${ext}` : ""}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  );

  const publicUrl = `${endpoint}/${bucket}/${key}`;

  return { uploadUrl, publicUrl };
}

// Server-side upload for images we generate ourselves (e.g. auto-cropped
// part photos), as opposed to createUploadUrl's presigned URL for the
// browser to upload a user-picked file directly.
export async function uploadBuffer(buffer: Buffer, contentType: string) {
  const ext = contentType.split("/")[1] || "jpg";
  const key = `${randomUUID()}.${ext}`;

  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }),
  );

  return `${endpoint}/${bucket}/${key}`;
}

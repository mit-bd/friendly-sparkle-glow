import { supabase } from "@/integrations/supabase/client";

export type BucketName = "logos" | "avatars" | "signatures";

/** Upload a file to a private bucket, returns the stored object path. */
export async function uploadFile(
  bucket: BucketName,
  file: File,
  prefix = "",
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${prefix}${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

/** Create a signed URL for a stored object path. Returns null if no path. */
export async function getSignedUrl(
  bucket: BucketName,
  path: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function removeFile(bucket: BucketName, path: string | null | undefined) {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}
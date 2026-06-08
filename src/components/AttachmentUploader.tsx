import { useEffect, useRef, useState } from "react";
import { Upload, X, Loader2, FileText, Download, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_BUCKET,
  ATTACHMENT_MAX_BYTES,
} from "@/lib/expenses";
import { getDownloadUrl, getSignedUrl, removeFile, uploadFile } from "@/lib/storage";
import { cn } from "@/lib/utils";

export interface AttachmentValue {
  path: string;
  name: string;
  mime: string;
  size: number;
}

interface AttachmentUploaderProps {
  value: AttachmentValue | null;
  onChange: (value: AttachmentValue | null) => void;
  /** Storage folder prefix — must start with the current user's id for RLS. */
  prefix: string;
  disabled?: boolean;
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentUploader({
  value,
  onChange,
  prefix,
  disabled,
  className,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isImage = value?.mime.startsWith("image/");

  useEffect(() => {
    let active = true;
    if (value && isImage) {
      getSignedUrl(ATTACHMENT_BUCKET, value.path).then((u) => active && setPreviewUrl(u));
    } else {
      setPreviewUrl(null);
    }
    return () => {
      active = false;
    };
  }, [value, isImage]);

  async function handleSelect(file: File) {
    if (!ATTACHMENT_ACCEPT.split(",").includes(file.type)) {
      toast.error("Please upload a PDF, JPG, or PNG file.");
      return;
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast.error("File must be smaller than 10MB.");
      return;
    }
    setUploading(true);
    try {
      // Remove the previous file when replacing.
      if (value) await removeFile(ATTACHMENT_BUCKET, value.path);
      const path = await uploadFile(ATTACHMENT_BUCKET, file, prefix);
      onChange({ path, name: file.name, mime: file.type, size: file.size });
      toast.success("Attachment uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (value) await removeFile(ATTACHMENT_BUCKET, value.path);
    onChange(null);
  }

  async function handleOpen(download: boolean) {
    if (!value) return;
    const url = download
      ? await getDownloadUrl(ATTACHMENT_BUCKET, value.path, value.name)
      : await getSignedUrl(ATTACHMENT_BUCKET, value.path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleSelect(f);
          e.target.value = "";
        }}
      />

      {!value ? (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors hover:border-brand-to/50 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-gradient text-white shadow-brand">
              <Upload className="h-5 w-5" />
            </span>
          )}
          <span className="text-sm font-medium text-foreground">
            {uploading ? "Uploading…" : "Click to upload attachment"}
          </span>
          <span className="text-xs text-muted-foreground">PDF, JPG, or PNG. Max 10MB.</span>
        </button>
      ) : (
        <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {isImage && previewUrl ? (
              <img src={previewUrl} alt={value.name} className="h-full w-full object-cover" />
            ) : (
              <FileText className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{value.name}</p>
            <p className="text-xs text-muted-foreground">
              {value.mime.split("/")[1]?.toUpperCase()} · {formatSize(value.size)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => handleOpen(false)}>
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleOpen(true)}>
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || uploading}
                onClick={handleRemove}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
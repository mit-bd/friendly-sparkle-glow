import { useEffect, useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getSignedUrl, removeFile, uploadFile, type BucketName } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  bucket: BucketName;
  value: string | null;
  onChange: (path: string | null) => void;
  label?: string;
  /** Render preview with transparency checkerboard (signatures/logos). */
  transparent?: boolean;
  className?: string;
  disabled?: boolean;
  prefix?: string;
}

const ACCEPT = "image/png,image/jpeg,image/jpg,image/svg+xml";
const MAX_BYTES = 5 * 1024 * 1024;

export function ImageUploader({
  bucket,
  value,
  onChange,
  label = "Upload image",
  transparent,
  className,
  disabled,
  prefix = "",
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    getSignedUrl(bucket, value).then((u) => active && setPreviewUrl(u));
    return () => {
      active = false;
    };
  }, [bucket, value]);

  async function handleSelect(file: File) {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or SVG file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File must be smaller than 5MB.");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadFile(bucket, file, prefix);
      onChange(path);
      toast.success("Image uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (value) await removeFile(bucket, value);
    onChange(null);
    setPreviewUrl(null);
  }

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div
        className={cn(
          "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted",
          transparent &&
            "bg-[repeating-conic-gradient(theme(colors.muted)_0%_25%,white_0%_50%)] bg-[length:16px_16px]",
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="h-full w-full object-contain p-1" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleSelect(f);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {label}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || uploading}
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG, or SVG. Max 5MB.</p>
      </div>
    </div>
  );
}
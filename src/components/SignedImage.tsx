import { useEffect, useState } from "react";

import { getSignedUrl, type BucketName } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface SignedImageProps {
  bucket: BucketName;
  path: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

export function SignedImage({ bucket, path, alt, className, fallback }: SignedImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    getSignedUrl(bucket, path).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [bucket, path]);

  if (!path || !url) return <>{fallback ?? null}</>;
  return <img src={url} alt={alt} className={cn("object-contain", className)} />;
}
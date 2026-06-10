import { useEffect } from "react";

import { applyFavicon } from "@/lib/favicon";
import { getPublicBranding } from "@/lib/branding";

/**
 * Mounted once at the app root (outside auth) so the browser-tab favicon
 * reflects the active company logo everywhere — login page, authenticated app,
 * 404, etc. Reads the logo from the public-branding endpoint, which requires no
 * authentication. In-app logo changes are reflected instantly by the
 * BrandingProvider (see branding-context), which also calls applyFavicon.
 */
export function DynamicFavicon() {
  useEffect(() => {
    let active = true;
    getPublicBranding()
      .then((b) => {
        if (active) applyFavicon(b.logoUrl);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return null;
}

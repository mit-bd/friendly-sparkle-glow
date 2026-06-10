/**
 * Dynamic favicon manager.
 *
 * Keeps the browser-tab icon, bookmarks icon, and Apple touch icon in sync
 * with the active company logo from Company Profile → Branding. When an admin
 * changes the logo, the favicon updates automatically with no code change and
 * no redeploy — the URL is read live from the company profile.
 *
 * A single PNG is used for every declared size; browsers scale it down for the
 * 16x16 / 32x32 slots. When no company logo is set we fall back to the bundled
 * Motion IT BD brand mark shipped at /favicon.png.
 */

const FALLBACK_ICON = "/favicon.png";

/** Icon <link> rel/size slots we keep in sync. */
const SLOTS: { rel: string; sizes?: string }[] = [
  { rel: "icon", sizes: "32x32" },
  { rel: "icon", sizes: "16x16" },
  { rel: "shortcut icon" },
  { rel: "apple-touch-icon" },
];

function upsertLink(rel: string, sizes: string | undefined, href: string) {
  const selector = sizes
    ? `link[rel="${rel}"][sizes="${sizes}"]`
    : `link[rel="${rel}"]:not([sizes])`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    if (sizes) link.setAttribute("sizes", sizes);
    document.head.appendChild(link);
  }
  // Cache-bust so a changed logo replaces the previously cached favicon.
  link.type = "image/png";
  link.href = href;
}

/**
 * Apply the given logo URL to every favicon slot. Pass null/undefined to
 * restore the bundled Motion IT BD brand mark.
 */
export function applyFavicon(logoUrl: string | null | undefined) {
  const href = logoUrl && logoUrl.trim() ? logoUrl : FALLBACK_ICON;
  for (const slot of SLOTS) {
    upsertLink(slot.rel, slot.sizes, href);
  }
}

const trim = (url: string) => url.replace(/\/+$/, "");

/** Gateway base URL. Public: Vite inlines VITE_* values into the bundle. */
export const GATEWAY_URL: string = trim(import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:3000");

/** True when the app is opened on the docs host (docs.example.com): it then serves only the docs. */
export const IS_DOCS_HOST: boolean = typeof window !== "undefined" && window.location.hostname.startsWith("docs.");

/** The main site (marketing, dashboard, checkout). Links from the docs host point here. */
export const SITE_URL: string = trim(
  import.meta.env.VITE_SITE_URL ?? (typeof window !== "undefined" && !IS_DOCS_HOST ? window.location.origin : "")
);

/** Where the docs live: a docs.* host in production, /docs on the main site otherwise. */
export const DOCS_URL: string = trim(import.meta.env.VITE_DOCS_URL ?? "/docs");

/** Interactive API reference served by the gateway itself. */
export const API_REFERENCE_URL = `${GATEWAY_URL}/docs`;
export const OPENAPI_URL = `${GATEWAY_URL}/openapi.json`;

/** Hosted checkout script, served by the main site. */
export const WIDGET_SCRIPT_URL = `${SITE_URL}/widget/arc-widget.js`;

/** A path on the main site, absolute when we're on the docs host. */
export function siteHref(path: string): string {
  return IS_DOCS_HOST ? `${SITE_URL}${path}` : path;
}

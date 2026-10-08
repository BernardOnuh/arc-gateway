/** Gateway base URL. Public: Vite inlines VITE_* values into the bundle. */
export const GATEWAY_URL: string = (import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
);

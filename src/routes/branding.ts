import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireApiKey } from "../auth/apiKey.js";
import { db } from "../db/index.js";
import { partners } from "../db/schema.js";
import { errorResponseSchema, toJsonSchema } from "../schemas.js";

/** Every customer-facing string in the checkout; placeholders {amount} and {merchant}. */
export const CHECKOUT_TEXT_KEYS = [
  "title",
  "connectButton",
  "connectHint",
  "payWithLabel",
  "payButton",
  "totalLabel",
  "remainingLabel",
  "keepOpen",
  "emptyBalances",
  "successTitle",
  "successMessage",
  "footer",
] as const;

const MAX_LOGO_CHARS = 400_000; // ~300 KB of image as base64

export const brandingSchema = z.object({
  displayName: z.string().trim().max(60).nullable().optional().describe("Shown instead of the business name."),
  logo: z
    .string()
    .max(MAX_LOGO_CHARS, "logo must be under 300 KB")
    .regex(/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/, "logo must be a PNG, JPEG, WebP or SVG data URL")
    .nullable()
    .optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "accentColor must be #rrggbb").optional(),
  theme: z.enum(["light", "dark", "auto"]).optional(),
  radius: z.number().int().min(0).max(32).optional(),
  showNetworkDetails: z.boolean().optional(),
  texts: z
    .object(Object.fromEntries(CHECKOUT_TEXT_KEYS.map((k) => [k, z.string().max(140).optional()])) as Record<
      (typeof CHECKOUT_TEXT_KEYS)[number],
      z.ZodOptional<z.ZodString>
    >)
    .strict()
    .optional(),
});

export type Branding = z.infer<typeof brandingSchema>;

const err = toJsonSchema(errorResponseSchema);

export async function brandingRoutes(app: FastifyInstance) {
  app.get(
    "/v1/partners/me/branding",
    {
      onRequest: requireApiKey,
      schema: {
        tags: ["payments"],
        summary: "Checkout branding",
        description: "Logo, display name, colors and texts used by the checkout for this business.",
        security: [{ bearerAuth: [] }],
        response: { 200: { type: "object", additionalProperties: true }, 400: err, 401: err, 403: err },
      },
    },
    async (request, reply) => {
      const key = request.apiKey!;
      if (!key.partnerId) return reply.code(400).send({ error: "api key is not linked to a partner" });
      const [row] = await db.select({ branding: partners.branding }).from(partners).where(eq(partners.id, key.partnerId));
      return reply.send((row?.branding as Branding | null) ?? {});
    }
  );

  app.put(
    "/v1/partners/me/branding",
    {
      onRequest: requireApiKey,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      bodyLimit: 600_000,
      schema: {
        tags: ["payments"],
        summary: "Save checkout branding",
        description:
          "Replaces the business's checkout branding. Applies to every checkout immediately (hosted and embedded). Logo as a data URL (PNG, JPEG, WebP or SVG, under 300 KB). Text placeholders: {amount}, {merchant}. An empty footer hides it.",
        security: [{ bearerAuth: [] }],
        body: toJsonSchema(brandingSchema),
        response: { 200: { type: "object", additionalProperties: true }, 400: err, 401: err, 403: err },
      },
    },
    async (request, reply) => {
      const key = request.apiKey!;
      if (!key.partnerId) return reply.code(400).send({ error: "api key is not linked to a partner" });
      const parsed = brandingSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      // Drop empty optional values so the stored object stays minimal.
      const texts = Object.fromEntries(Object.entries(parsed.data.texts ?? {}).filter(([, v]) => v !== undefined));
      const branding: Branding = {
        ...parsed.data,
        displayName: parsed.data.displayName || null,
        logo: parsed.data.logo ?? null,
        texts,
      };
      await db.update(partners).set({ branding }).where(eq(partners.id, key.partnerId));
      return reply.send(branding);
    }
  );
}

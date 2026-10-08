import { z } from "zod";

export const quoteBodySchema = z.object({
  originChainId: z
    .number()
    .int()
    .positive()
    .describe("Origin chain ID. Supported: 1 (Ethereum), 56 (BNB), 8453 (Base), 4663 (Robinhood)."),
  destChainId: z
    .number()
    .int()
    .positive()
    .describe("Destination chain ID. Must differ from the origin and is the ARC chain (5042002)."),
  tokenIn: z
    .string()
    .nonempty()
    .describe(
      "Token sent out of the origin chain. Use a symbol (WETH, USDC, USDT, WBNB, USDG) or a real ERC-20 address from GET /v1/tokens."
    ),
  tokenOut: z.string().nonempty().describe("Token received on the destination chain (e.g. USDC)."),
  amountIn: z
    .string()
    .regex(/^\d+$/)
    .describe("Amount to swap, in base units (integer). 1 WETH = 1000000000000000000."),
  recipient: z
    .string()
    .nonempty()
    .describe("Address that receives tokenOut on the destination chain."),
  slippageBps: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Max acceptable slippage in basis points (0-100, i.e. 0-1%)."),
  deadline: z
    .number()
    .int()
    .positive()
    .refine((d) => d > Math.floor(Date.now() / 1000), {
      message: "deadline must be in the future",
    })
    .describe("Unix timestamp (seconds) by which the intent must be submitted."),
  customerId: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Optional customer id from POST /v1/customers. Attributes this transaction to an end customer of the partner for ledger reporting."
    ),
});

export const partnerCreateSchema = z.object({
  partnerName: z.string().min(1).max(120).describe("Business name, appears on dashboard/revenue."),
  email: z.string().email().optional().describe("Optional contact email, unique per partner."),
});

export const partnerResponseSchema = z.object({
  partnerId: z.string().describe("Business identifier."),
  apiKey: z
    .string()
    .describe("The business API key. Shown once — store it securely; it cannot be recovered."),
  keyPrefix: z.string(),
  feeBps: z.number().int().describe("Fee this business pays on every quote, in basis points."),
  rateLimitPerMin: z.number().int(),
});

export const customerCreateSchema = z.object({
  externalId: z.string().min(1).max(200).describe("The end customer's id in the partner's system."),
  recipientAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "must be a valid 0x address")
    .describe("Address that receives funds for this customer."),
});

export const customerResponseSchema = z.object({
  customerId: z.string(),
  externalId: z.string(),
  recipientAddress: z.string(),
  createdAt: z.string(),
});

export const ledgerResponseSchema = z.object({
  partnerId: z.string(),
  customerId: z.string().nullable().describe("Filter applied, or null for all customers."),
  totals: z.object({
    feeBps: z.number().int(),
    transactions: z.number().int().describe("Number of quoted transactions."),
    amountInTotal: z.string().describe("Sum of amountIn across transactions (base units)."),
    feeTotal: z.string().describe("Total fees earned across transactions (base units)."),
  }),
  byCustomer: z.array(
    z.object({
      customerId: z.string().nullable().describe("Attributed customer, or null for unattributed."),
      externalId: z.string().nullable(),
      recipientAddress: z.string().nullable(),
      transactions: z.number().int(),
      amountInTotal: z.string(),
      feeTotal: z.string(),
    })
  ),
});

export const submitBodySchema = z.object({
  quoteId: z
    .string()
    .nonempty()
    .describe("Quote id returned by POST /v1/quotes. Submission is idempotent per quoteId."),
  signedPayload: z
    .string()
    .nonempty()
    .describe("Hex-encoded signed payload authorizing the ARC intent."),
});

export const intentIdParamsSchema = z.object({
  id: z.string().nonempty().describe("Intent id returned by POST /v1/intents/submit."),
});

export const errorResponseSchema = z.object({
  error: z.string().describe("Human-readable reason for the failure."),
});

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  db: z.enum(["up", "down"]),
  redis: z.enum(["up", "down"]),
});

export const tokenResponseSchema = z.object({
  chainId: z.number().int().describe("Chain this token is listed on."),
  symbol: z.string().describe("Symbol, usable as tokenIn/tokenOut."),
  name: z.string(),
  address: z
    .string()
    .describe("ERC-20 address (verified on-chain). Native gas tokens use 0x00...00; ARC USDC is 0x360...0000."),
  decimals: z.number().int().describe("Token decimals. amountIn/amountOut are in these base units."),
  isNative: z.boolean().describe("True for the chain's gas/native token."),
});

export const tokensResponseSchema = z.array(tokenResponseSchema);

export const chainsResponseSchema = z.array(
  z.object({
    id: z.number().int().describe("Chain ID, used as originChainId/destChainId."),
    name: z.string().describe("Chain name."),
    symbol: z.string().describe("Native gas token symbol."),
    decimals: z.number().int().describe("Native gas token decimals."),
    isArc: z.boolean().describe("True for the ARC chain (destination)."),
    testnet: z.boolean().describe("True for testnets (only ARC testnet currently)."),
    rpcUrl: z.string().describe("Public RPC used by the gateway."),
    explorerUrl: z.string().describe("Block explorer for chain lookups."),
    nativeTokenAddress: z.string().describe("Native token address (0x00...00 for EVM chains, ERC-20 on ARC)."),
  })
);

export const quoteResponseSchema = z.object({
  quoteId: z.string().describe("Id used to submit the intent."),
  amountIn: z.string().describe("Full amountIn received (base units)."),
  feeAmount: z.string().describe("Partner fee deducted (base units)."),
  feeBps: z.number().int().describe("Fee in basis points applied by the gateway."),
  netAmount: z.string().describe("Amount forwarded upstream after fee (base units)."),
  estimatedOut: z.string().describe("Estimated tokenOut delivered (base units)."),
  minOut: z.string().describe("Minimum tokenOut guaranteed after slippage (base units)."),
  expiresAt: z.number().int().describe("Unix timestamp when the quote expires."),
  unsignedTx: z
    .string()
    .nullable()
    .describe("Unsigned origin transaction. Null until settlement wiring is enabled."),
});

export const submitResponseSchema = z.object({
  intentId: z.string().describe("Intent id for polling via GET /v1/intents/:id."),
});

export const intentResponseSchema = z.object({
  id: z.string().describe("Intent id."),
  status: z
    .string()
    .describe(
      "Lifecycle: PENDING -> ORIGIN_CONFIRMED -> FILLED -> EXECUTED_ON_ARC (or FAILED)."
    ),
  originTx: z.string().nullable().describe("Transaction hash on the origin chain."),
  destTx: z.string().nullable().describe("Transaction hash on the ARC chain."),
  upstreamId: z.string().nullable().describe("Provider-side intent reference."),
  error: z.string().nullable().describe("Failure reason, if any."),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ----- list endpoints (dashboard) -----

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50).describe("Page size (1-200, default 50)."),
  offset: z.coerce.number().int().min(0).default(0).describe("Rows to skip (default 0)."),
});

const page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().describe("Total rows matching the filters, ignoring limit/offset."),
    limit: z.number().int(),
    offset: z.number().int(),
  });

export const customerListQuerySchema = paginationQuerySchema;
export const customerListResponseSchema = page(customerResponseSchema);

export const intentStatusValues = [
  "PENDING",
  "ORIGIN_CONFIRMED",
  "FILLED",
  "EXECUTED_ON_ARC",
  "REFUNDED",
  "FAILED",
] as const;

export const quoteListQuerySchema = paginationQuerySchema.extend({
  customerId: z.string().uuid().optional().describe("Only quotes attributed to this customer."),
});

export const quoteListItemSchema = z.object({
  quoteId: z.string(),
  customerId: z.string().nullable(),
  originChainId: z.number().int(),
  destChainId: z.number().int(),
  tokenIn: z.string().describe("tokenIn as sent on POST /v1/quotes (symbol or address)."),
  tokenOut: z.string().describe("tokenOut as sent on POST /v1/quotes (symbol or address)."),
  recipient: z.string(),
  amountIn: z.string(),
  feeAmount: z.string(),
  feeBps: z.number().int(),
  netAmount: z.string(),
  estimatedOut: z.string().nullable(),
  minOut: z.string().nullable(),
  expiresAt: z.number().int(),
  createdAt: z.string(),
  intent: z
    .object({ intentId: z.string(), status: z.enum(intentStatusValues) })
    .nullable()
    .describe("Intent submitted for this quote, or null if never submitted."),
});
export const quoteListResponseSchema = page(quoteListItemSchema);

export const intentListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(intentStatusValues).optional().describe("Only intents in this status."),
  customerId: z.string().uuid().optional().describe("Only intents whose quote is attributed to this customer."),
});

export const intentListItemSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  customerId: z.string().nullable(),
  originChainId: z.number().int(),
  destChainId: z.number().int(),
  amountIn: z.string(),
  feeAmount: z.string(),
  status: z.enum(intentStatusValues),
  originTx: z.string().nullable(),
  destTx: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const intentListResponseSchema = page(intentListItemSchema);

export const partnerProfileResponseSchema = z.object({
  partnerId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  feeBps: z.number().int().describe("Fee charged on quotes made with this key, in basis points."),
  rateLimitPerMin: z.number().int().describe("Authenticated requests allowed per minute for this key."),
  createdAt: z.string(),
  apiKey: z.object({
    id: z.string(),
    keyPrefix: z.string(),
    createdAt: z.string(),
  }),
});

export type QuoteBody = z.infer<typeof quoteBodySchema>;
export type SubmitBody = z.infer<typeof submitBodySchema>;

export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}
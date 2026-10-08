export class GatewayError extends Error {
  readonly statusCode: number;
  readonly body: unknown;
  readonly url?: string;

  constructor(statusCode: number, body: unknown, url?: string) {
    super(`gateway request failed with status ${statusCode}`);
    this.name = "GatewayError";
    this.statusCode = statusCode;
    this.body = body;
    this.url = url;
  }
}
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ArcSwapWidget } from "./ArcSwapWidget.js";
import { ArcCheckout } from "./checkout/ArcCheckout.js";
import type { ArcCheckoutProps } from "./checkout/types.js";
import type { ArcSwapWidgetProps, WidgetQuote } from "./types.js";

const ATTRS = [
  "publishable-key",
  "base-url",
  "origin-chain-id",
  "dest-chain-id",
  "recipient",
  "customer-id",
  "slippage-bps",
  "theme",
  "accent-color",
  "radius",
  "title",
] as const;

/**
 * <arc-swap-widget publishable-key="pk_live_…" base-url="https://gateway…"
 *   theme="auto" accent-color="#4f46e5" radius="16" title="Top up">
 *
 * Set `element.submitIntent = async (quote) => ({ intentId })` to enable
 * submission (call your server, which submits with your secret key).
 * Events: arc-quote, arc-status, arc-intent, arc-error (detail = payload).
 */
export class ArcSwapWidgetElement extends HTMLElement {
  static observedAttributes = [...ATTRS];
  private root: Root | null = null;
  private _submitIntent: ArcSwapWidgetProps["submitIntent"];

  get submitIntent() {
    return this._submitIntent;
  }
  set submitIntent(fn: ((quote: WidgetQuote) => Promise<{ intentId: string }>) | undefined) {
    this._submitIntent = fn;
    this.render();
  }

  connectedCallback() {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    this.root ??= createRoot(shadow);
    this.render();
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }

  attributeChangedCallback() {
    this.render();
  }

  private num(name: string): number | undefined {
    const v = this.getAttribute(name);
    return v === null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v);
  }

  private emit(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private render() {
    if (!this.root) return;
    const publishableKey = this.getAttribute("publishable-key");
    if (!publishableKey) {
      this.root.render(createElement("p", null, "arc-swap-widget: set the publishable-key attribute."));
      return;
    }
    const props: ArcSwapWidgetProps = {
      publishableKey,
      baseUrl: this.getAttribute("base-url") ?? undefined,
      originChainId: this.num("origin-chain-id"),
      destChainId: this.num("dest-chain-id"),
      recipient: this.getAttribute("recipient") ?? undefined,
      customerId: this.getAttribute("customer-id") ?? undefined,
      slippageBps: this.num("slippage-bps"),
      theme: (["light", "dark", "auto"] as const).find((t) => t === this.getAttribute("theme")),
      accentColor: this.getAttribute("accent-color") ?? undefined,
      radius: this.num("radius"),
      title: this.getAttribute("title") ?? undefined,
      submitIntent: this._submitIntent,
      onQuote: (q) => this.emit("arc-quote", q),
      onStatus: (i) => this.emit("arc-status", i),
      onIntent: (i) => this.emit("arc-intent", i),
      onError: (e) => this.emit("arc-error", e),
    };
    this.root.render(createElement(ArcSwapWidget, props));
  }
}

/** Registers <arc-swap-widget> once. Safe to call repeatedly. */
export function defineArcSwapWidget(tagName = "arc-swap-widget") {
  if (typeof customElements !== "undefined" && !customElements.get(tagName)) {
    customElements.define(tagName, class extends ArcSwapWidgetElement {});
  }
}

const CHECKOUT_ATTRS = [
  "publishable-key",
  "base-url",
  "payment-id",
  "theme",
  "accent-color",
  "radius",
  "title",
  "show-network-details",
] as const;

/**
 * <stableflowr-checkout publishable-key="pk_live_…" payment-id="…" base-url="https://api…">
 *
 * Events: stableflowr-paid, stableflowr-status (detail = payment), stableflowr-error (detail = Error).
 */
export class ArcCheckoutElement extends HTMLElement {
  static observedAttributes = [...CHECKOUT_ATTRS];
  private root: Root | null = null;

  connectedCallback() {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    this.root ??= createRoot(shadow);
    this.render();
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }

  attributeChangedCallback() {
    this.render();
  }

  private emit(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private render() {
    if (!this.root) return;
    const publishableKey = this.getAttribute("publishable-key");
    if (!publishableKey) {
      this.root.render(createElement("p", null, `${this.localName}: set the publishable-key attribute.`));
      return;
    }
    const radius = this.getAttribute("radius");
    const props: ArcCheckoutProps = {
      publishableKey,
      baseUrl: this.getAttribute("base-url") ?? undefined,
      paymentId: this.getAttribute("payment-id") ?? undefined,
      theme: (["light", "dark", "auto"] as const).find((t) => t === this.getAttribute("theme")),
      accentColor: this.getAttribute("accent-color") ?? undefined,
      radius: radius === null || Number.isNaN(Number(radius)) ? undefined : Number(radius),
      title: this.getAttribute("title") ?? undefined,
      showNetworkDetails: this.hasAttribute("show-network-details") ? true : undefined,
      onPaid: (p) => this.emit("stableflowr-paid", p),
      onStatus: (p) => this.emit("stableflowr-status", p),
      onError: (e) => this.emit("stableflowr-error", e),
    };
    this.root.render(createElement(ArcCheckout, props));
  }
}

/** Registers <stableflowr-checkout> once. Safe to call repeatedly. */
export function defineArcCheckout(tagName = "stableflowr-checkout") {
  if (typeof customElements !== "undefined" && !customElements.get(tagName)) {
    customElements.define(tagName, class extends ArcCheckoutElement {});
  }
}

export { defineArcCheckout as defineStableflowrCheckout };

// Script-tag build: bundles React and registers <stableflowr-checkout> and <arc-swap-widget> on load.
import { defineArcCheckout, defineArcSwapWidget } from "./element.js";

defineArcCheckout();
defineArcSwapWidget();

export { defineArcCheckout, defineArcSwapWidget };

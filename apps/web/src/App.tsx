import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { MarketingLayout } from "./layouts/MarketingLayout";
import { Home } from "./pages/marketing/Home";
import { HowItWorks } from "./pages/marketing/HowItWorks";
import { Developers } from "./pages/marketing/Developers";
import { Pricing } from "./pages/marketing/Pricing";
import { Signup } from "./pages/marketing/Signup";
import { NotFound } from "./pages/NotFound";
import { IS_DOCS_HOST } from "./lib/env";

const DashboardRoutes = lazy(() => import("./pages/app/DashboardRoutes"));
const Checkout = lazy(() => import("./pages/Checkout").then((m) => ({ default: m.Checkout })));
const AccountRoutes = lazy(() => import("./pages/account/AccountRoutes"));
const Docs = lazy(() => import("./pages/docs/Docs").then((m) => ({ default: m.Docs })));

const loading = <div className="p-8 text-sm text-ink-600">Loading…</div>;

export function App() {
  // docs.example.com serves only the docs, at its root.
  if (IS_DOCS_HOST) {
    return (
      <Suspense fallback={loading}>
        <Docs />
      </Suspense>
    );
  }
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<Home />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="developers" element={<Developers />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="signup" element={<Signup />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route
        path="docs/*"
        element={
          <Suspense fallback={loading}>
            <Docs />
          </Suspense>
        }
      />
      <Route
        path="app/*"
        element={
          <Suspense fallback={<div className="p-8 text-sm text-ink-600">Loading…</div>}>
            <DashboardRoutes />
          </Suspense>
        }
      />
      <Route
        path="checkout/:paymentId"
        element={
          <Suspense fallback={<div className="p-8 text-sm text-ink-600">Loading…</div>}>
            <Checkout />
          </Suspense>
        }
      />
      <Route
        path="account/*"
        element={
          <Suspense fallback={<div className="p-8 text-sm text-ink-600">Loading…</div>}>
            <AccountRoutes />
          </Suspense>
        }
      />
    </Routes>
  );
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { Providers } from "./Providers";
import { routerFuture } from "./lib/router";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter future={routerFuture}>
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
  </StrictMode>
);

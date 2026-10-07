import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { consumeSignIn } from "./drive";
import { ToastHost } from "./ui";
import "./styles.css";

try {
  const t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch {
  /* storage blocked: follow the phone */
}

// Back from Google's sign-in (#access_token=…): read it before the tabs read the hash.
consumeSignIn();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("./sw.js"));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastHost>
      <App />
    </ToastHost>
  </StrictMode>,
);

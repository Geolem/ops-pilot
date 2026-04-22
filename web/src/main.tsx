import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import { applyTheme } from "./store/theme";
import "./index.css";

// apply stored theme before first paint to avoid flash
try {
  const saved = JSON.parse(localStorage.getItem("ops-pilot-theme") ?? "{}");
  applyTheme(saved?.state?.theme ?? "dark");
} catch {
  applyTheme("dark");
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function ThemedToaster() {
  const theme = document.documentElement.classList.contains("light") ? "light" : "dark";
  return <Toaster theme={theme} position="top-right" richColors closeButton />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ThemedToaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

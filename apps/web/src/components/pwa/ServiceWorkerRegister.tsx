"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // Novo SW disponível — pode notificar o usuário se quiser
                  console.info("[SW] Nova versão disponível — recarregue para atualizar.");
                }
              });
            }
          });
        })
        .catch((err) => console.warn("[SW] Falha no registro:", err));
    }
  }, []);

  return null;
}

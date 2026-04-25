import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CRM",
    short_name: "CRM",
    description: "Plataforma CRM multi-tenant com IA para equipes comerciais",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    lang: "pt-BR",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: "Novo Lead",
        url: "/leads/new",
        description: "Cadastrar novo lead",
      },
      {
        name: "Dashboard",
        url: "/dashboard",
        description: "Ver painel operacional",
      },
      {
        name: "Pipeline",
        url: "/pipeline",
        description: "Abrir funil de vendas",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "阿寶 Abao",
    short_name: "阿寶",
    description: "A personal AI agent for your parents. It checks with family before money moves.",
    // No start_url: an installed app opens on the page it was added from, which keeps a family member on their own page.
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff7ed",
    theme_color: "#f97316",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

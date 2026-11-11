// Per-member manifest: an installed family app opens straight on that member's alerts (iOS does not share
// browser storage with home-screen apps, so identity has to travel in the start URL).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const f = (q.get("f") ?? "").replace(/[^a-z0-9]/g, "");
  const m = (q.get("m") ?? "").replace(/[^a-z0-9]/g, "");
  return new Response(
    JSON.stringify({
      name: "阿寶 Abao",
      short_name: "阿寶",
      start_url: f && m ? `/family?f=${f}&m=${m}` : "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#fff7ed",
      theme_color: "#f97316",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    }),
    { headers: { "content-type": "application/manifest+json" } },
  );
}

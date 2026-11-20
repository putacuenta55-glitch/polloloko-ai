import { createFileRoute } from "@tanstack/react-router";

import { isFalMediaUrl } from "@/lib/fal-models";

// Streams a finished fal.ai video back from this site so the browser saves it as an MP4.
export const Route = createFileRoute("/api/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const target = params.get("url") ?? "";
        if (!isFalMediaUrl(target)) return new Response("URL no permitida", { status: 400 });

        const rawName = (params.get("name") ?? "polloloko").replace(/[^a-z0-9-_]/gi, "").slice(0, 60);
        const filename = `${rawName || "polloloko"}.mp4`;

        const upstream = await fetch(target);
        if (!upstream.ok || !upstream.body) {
          return new Response("No se pudo descargar el vídeo", { status: 502 });
        }
        const headers = new Headers({
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, max-age=3600",
        });
        const len = upstream.headers.get("content-length");
        if (len) headers.set("Content-Length", len);
        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});

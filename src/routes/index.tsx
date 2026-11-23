
import { createFileRoute } from "@tanstack/react-router";
import { Generator } from "@/components/polloloko/Generator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "polloloko — Genera vídeos IA con texto, fotos y audio" },
      {
        name: "description",
        content:
          "Combina texto, fotos y audio para crear vídeos con IA de 5 segundos. Prueba gratuita disponible y descarga en MP4.",
      },
      { property: "og:title", content: "polloloko — Vídeo IA con texto, fotos y audio" },
      {
        property: "og:description",
        content: "Crea vídeos con IA usando texto, imágenes y audio. Empieza con una prueba gratuita.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <Generator
      code="PUBLIC"
      onLock={() => {}}
    />
  );
}

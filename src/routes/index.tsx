
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
    <div className="min-h-screen bg-[#101010] text-white">
      <Generator
        code="PUBLIC"
        onLock={() => {}}
      />
      <section className="max-w-3xl mx-auto px-4 py-12 space-y-10 text-sm text-zinc-300">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Cómo crear vídeos con inteligencia artificial en 3 pasos</h2>
          <ol className="space-y-3 list-decimal list-inside">
            <li><strong className="text-white">Escribe tu idea (Texto a Vídeo):</strong> Describe la escena que imaginas en segundos.</li>
            <li><strong className="text-white">Anima fotos o añade audio:</strong> Sube una imagen o pista de música para darle ritmo y movimiento.</li>
            <li><strong className="text-white">Descarga en HD:</strong> Obtén tu vídeo listo para TikTok, Instagram Reels o YouTube Shorts sin marca de agua.</li>
          </ol>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-4">Preguntas Frecuentes sobre Polloloko AI</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-white">¿Cómo funciona el generador de vídeos con IA?</h3>
              <p>Transforma tus descripciones de texto, fotografías y archivos de audio en clips de vídeo fluidos de 5 segundos usando modelos avanzados de inteligencia artificial.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white">¿Puedo compartir los vídeos en redes sociales?</h3>
              <p>Sí, todos los vídeos generados se descargan en alta definición sin marca de agua para usarlos libremente en TikTok, Instagram o YouTube.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white">¿Qué formatos de archivo acepta?</h3>
              <p>Es compatible con imágenes JPG, PNG o WEBP y pistas de audio habituales como MP3 o WAV.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}


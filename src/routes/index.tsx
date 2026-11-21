import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Generator } from "@/components/polloloko/Generator";
import { LockScreen } from "@/components/polloloko/LockScreen";

const CODE_STORAGE = "polloloko:access";

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
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState<string

  useEffect(() => {
    const saved = sessionStorage.getItem(CODE_STORAGE);
    if (saved) {
      setCode(saved);
    }
    setReady(true);
  }, []);

  if (!ready) return <div className="min-h-dvh bg-background" />;

  if (!code) {
    return (
      <LockScreen
        onUnlock={(c) => {
          sessionStorage.setItem(CODE_STORAGE, c);
          setCode(c);
        }}
      />
    );
  }

  return (
    <Generator
      code={code}
      onLock={() => {
        sessionStorage.removeItem(CODE_STORAGE);
        setCode(null);
      }}
    />
  );
}

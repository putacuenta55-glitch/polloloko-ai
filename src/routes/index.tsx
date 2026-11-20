import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Generator } from "@/components/polloloko/Generator";
import { LockScreen } from "@/components/polloloko/LockScreen";

const CODE_STORAGE = "polloloko:access";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "polloloko — Genera vídeos de 5 s con Wan o Luma" },
      {
        name: "description",
        content:
          "Escribe una idea y conviértela en un vídeo de 5 segundos con Wan o Luma usando tu propia clave de fal.ai. Descárgalo en MP4.",
      },
      { property: "og:title", content: "polloloko — Texto a vídeo en 5 segundos" },
      {
        property: "og:description",
        content: "Genera clips de 5 segundos con Wan o Luma usando tu clave de fal.ai y descárgalos en MP4.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    setCode(sessionStorage.getItem(CODE_STORAGE));
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

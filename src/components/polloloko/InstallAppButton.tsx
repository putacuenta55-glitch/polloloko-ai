import { useEffect, useState } from "react";
import { MoreVertical, Share, SquarePlus, Smartphone, X } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { detectPlatform, shouldShowInstall, type InstallPlatform } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "polloloko:install-dismissed";

// Android fires this early, sometimes before React mounts: capture it at module load.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton() {
  const [platform, setPlatform] = useState<InstallPlatform>(null);
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const p = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
    setPlatform(p);
    setVisible(shouldShowInstall(p, isStandalone()) && !sessionStorage.getItem(DISMISS_KEY));

    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (deferredPrompt) {
      const ev = deferredPrompt;
      deferredPrompt = null;
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      if (outcome === "accepted") setVisible(false);
      return;
    }
    setHelpOpen(true);
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed right-3 z-40 flex items-center rounded-full border border-border bg-surface/90 shadow-card backdrop-blur"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <button
          type="button"
          onClick={install}
          className="flex items-center gap-1.5 py-2 pl-3 pr-1.5 font-mono text-[11px] uppercase tracking-widest text-foreground/80 transition hover:text-yolk"
        >
          <Smartphone className="size-3.5 text-yolk" />
          Instalar App
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ocultar botón de instalar"
          className="py-2 pl-1 pr-2.5 text-muted-foreground transition hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-surface pb-10">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl font-extrabold tracking-tighter text-yolk">
              Instala Polloloko AI
            </SheetTitle>
            <SheetDescription>
              Tenlo en tu pantalla de inicio y ábrelo como una app, a pantalla completa.
            </SheetDescription>
          </SheetHeader>
          <ol className="mt-6 space-y-4 text-sm text-foreground">
            {platform === "ios" ? (
              <>
                <Step n={1}>
                  Pulsa <Share className="mx-1 inline size-4 text-yolk" /> <b>Compartir</b> en la barra de Safari.
                </Step>
                <Step n={2}>
                  Elige <SquarePlus className="mx-1 inline size-4 text-yolk" /> <b>Añadir a pantalla de inicio</b>.
                </Step>
                <Step n={3}>
                  Pulsa <b>Añadir</b>. ¡Listo, el pollo ya vive en tu móvil!
                </Step>
              </>
            ) : (
              <>
                <Step n={1}>
                  Abre el menú <MoreVertical className="mx-1 inline size-4 text-yolk" /> del navegador.
                </Step>
                <Step n={2}>
                  Pulsa <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.
                </Step>
                <Step n={3}>Confirma. ¡Listo, el pollo ya vive en tu móvil!</Step>
              </>
            )}
          </ol>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-yolk font-mono text-xs font-medium text-yolk-foreground">
        {n}
      </span>
      <span className="pt-0.5 leading-relaxed">{children}</span>
    </li>
  );
}

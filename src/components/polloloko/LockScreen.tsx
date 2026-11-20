import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Lock } from "lucide-react";

import mascot from "@/assets/polloloko-mascot.webp";
import { Button } from "@/components/ui/button";
import { verifyAccess } from "@/lib/video.functions";
import { cn } from "@/lib/utils";

export const GUMROAD_URL = "https://putacuenta.gumroad.com/l/polloloko";

export function LockScreen({ onUnlock }: { onUnlock: (code: string) => void }) {
  const verify = useServerFn(verifyAccess);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await verify({ data: { code } });
      if (res.ok) {
        onUnlock(code);
      } else {
        setError("Código incorrecto. El pollo no te deja pasar.");
        setShakeKey((k) => k + 1);
      }
    } catch {
      setError("No se pudo comprobar el código. Inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-glow flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <img
          src={mascot}
          alt="Mascota de polloloko: un pollo loco con gafas de sol"
          width={640}
          height={640}
          className="animate-wobble mask-soft size-48 sm:size-56"
        />
        <h1 className="font-display mt-2 text-6xl font-extrabold leading-none tracking-tighter text-yolk">
          polloloko
        </h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
          texto → vídeo · 5 segundos
        </p>

        <form
          key={shakeKey}
          onSubmit={submit}
          className={cn(
            "mt-10 w-full rounded-3xl border border-border bg-surface p-5 shadow-card",
            shakeKey > 0 && "animate-shake",
          )}
        >
          <label
            htmlFor="access-code"
            className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            <Lock className="size-3.5" /> Código de acceso
          </label>
          <input
            id="access-code"
            type="password"
            autoComplete="off"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="••••••••"
            className="mt-3 h-14 w-full rounded-2xl border border-input bg-background px-4 text-center font-mono text-xl tracking-[0.3em] text-foreground outline-none transition focus:border-yolk focus:ring-2 focus:ring-yolk/30"
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-comb">
              {error}
            </p>
          )}
          <Button type="submit" variant="yolk" size="xl" className="mt-4 w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Entrar al corral
          </Button>
        </form>

        <div className="mt-6 flex w-full flex-col items-center gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            ¿No tienes código?
          </p>
          <Button asChild variant="surface" size="lg" className="w-full rounded-2xl">
            <a href={GUMROAD_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Comprar código de acceso (5,99 €)
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}

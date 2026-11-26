import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  CreditCard,
  Download,
  ImagePlus,
  Loader2,
  LockKeyhole,
  Music,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import mascot from "@/assets/polloloko-mascot.webp";
import { Button } from "@/components/ui/button";
import {
  ASPECT_RATIOS,
  PROMPT_MAX,
  VIDEO_MODELS,
  type AspectRatio,
  type ModelId,
} from "@/lib/fal-models";
import { checkVideo, submitVideo } from "@/lib/video.functions";
import { cn } from "@/lib/utils";
const STRIPE_URL = "https://buy.stripe.com"/ + "bJeaEXbjncu8bxM4sP0gw02";
const STRIPE_PRO_URL = "https://buy.stripe.com"/ + "00weVd87b1PucBQ4sP0gw03";
const STRIPE_PLANS = [
  {
    id: "single",
    title: "1 vídeo IA en HD",
    price: "2,49 €",
    subtitle: "Pago único · Descarga MP4 sin marca de agua",
    url: STRIPE_URL,
  },
  {
    id: "pro",
    title: "Suscripción Mensual Pro",
    price: "5,99 €/mes",
    subtitle: "Hasta 10 vídeos IA al mes sin marca de agua",
    url: STRIPE_PRO_URL,
  },
];

const LAST_VIDEO_STORAGE = "polloloko:last_video";
const CREDITS_STORAGE = "polloloko:credits";
const PRO_STORAGE = "polloloko:pro";
const DEMO_VIDEO_URL = "/VID_20261126_193439.mp4";
const POLL_MS = 2500;
const MAX_WAIT_MS = 180_000;
const panel = "rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6";
const fieldLabel =
  "font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground";

const IDEAS = [
  "Un pollo con gafas de sol surfeando una ola gigante al atardecer, cámara lenta",
  "Anima esta foto con movimiento de cámara cinematográfico y luces cálidas",
  "Un astronauta bailando flamenco al ritmo de la música, polvo flotando",
];

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | {
      kind: "waiting";
      queued: boolean;
      position: number | null;
      startedAt: number;
    }
  | {
      kind: "done";
      videoUrl: string;
      prompt: string;
      model: ModelId;
      demo?: "manual";
    }
  | { kind: "error"; message: string };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Generator({
  code,
  onLock,
}: {
  code: string;
  onLock: () => void;
}) {
  const submit = useServerFn(submitVideo);
  const check = useServerFn(checkVideo);

  const [model, setModel] = useState<ModelId>("seedance");
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const [prompt, setPrompt] = useState("");

  const [imageFile, setImageFile] = useState<{
    name: string;
    dataUrl: string;
  } | null>(null);
  const [audioFile, setAudioFile] = useState<{
    name: string;
    dataUrl: string;
  } | null>(null);

  const [paid, setPaid] = useState(false);
  const [credits, setCredits] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const cancelled = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedCredits = Number(localStorage.getItem(CREDITS_STORAGE) || 0);
    const savedPro = localStorage.getItem(PRO_STORAGE) === "true";

    if (params.get("pagado") === "true") {
      const creditosComprados = Number(params.get("creditos") || 0);
      const compraPro = params.get("pro") === "true";

      if (compraPro) {
        localStorage.setItem(PRO_STORAGE, "true");
        setIsPro(true);
        setPaid(true);
      } else if (creditosComprados > 0) {
        const total = savedCredits + creditosComprados;
        localStorage.setItem(CREDITS_STORAGE, String(total));
        setCredits(total);
        setPaid(true);
      }

      const saved = localStorage.getItem(LAST_VIDEO_STORAGE);
      if (saved) {
        try {
          setPhase(JSON.parse(saved));
        } catch {}
      }
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      setCredits(savedCredits);
      setIsPro(savedPro);
      if (savedPro || savedCredits > 0) {
        setPaid(true);
      }
    }

    return () => {
      cancelled.current = true;
    };
  }, []);

  useEffect(() => {
    if (phase.kind !== "waiting") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase.kind]);

  const busy = phase.kind === "submitting" || phase.kind === "waiting";
  const hasAccess = isPro || credits > 0;
  const canGenerate = prompt.trim().length >= 3 && !busy;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.item(0);
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      setPhase({
        kind: "error",
        message: "La foto pesa más de 4.5 MB. Usa una imagen más ligera.",
      });
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setImageFile({ name: file.name, dataUrl });
  }

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.item(0);
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      setPhase({
        kind: "error",
        message: "El audio pesa más de 4.5 MB. Usa un clip más corto.",
      });
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setAudioFile({ name: file.name, dataUrl });
    setModel("seedance");
  }

  function showDemo() {
    cancelled.current = true;
    setPhase({
      kind: "done",
      videoUrl: DEMO_VIDEO_URL,
      prompt: prompt.trim() || "Vídeo de demostración",
      model,
      demo: "manual",
    });
  }

  async function generate() {
    if (!canGenerate) return;

    if (!hasAccess) {
    setShowPayModal(true);
      return;
    }

    cancelled.current = false;
    const usedPrompt = prompt.trim();
    const usedModel = model;

    setPhase({ kind: "submitting" });
    try {
      const job = await submit({
        data: {
          code,
          model: usedModel,
          prompt: usedPrompt,
          aspectRatio: ratio,
          imageDataUrl: imageFile?.dataUrl,
          audioDataUrl: audioFile?.dataUrl,
        },
      });
      if ("error" in job) {
        if ("locked" in job) return onLock();
        if ("noBalance" in job) {
          return setPhase({
            kind: "error",
            message:
              "Nuestros servidores están saturados ahora mismo. Inténtalo de nuevo en un par de minutos.",
          });
        }
        return setPhase({ kind: "error", message: job.error });
      }
      const startedAt = Date.now();
      setNow(startedAt);
      setPhase({ kind: "waiting", queued: true, position: null, startedAt });

      while (!cancelled.current) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (cancelled.current) return;
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          return setPhase({
            kind: "error",
            message:
              "El servidor está tardando demasiado. Vuelve a intentarlo en unos minutos.",
          });
        }
        const s = await check({
          data: {
            code,
            statusUrl: job.statusUrl,
            responseUrl: job.responseUrl,
          },
        });
        if (s.state === "done") {
          const donePhase: Phase = {
            kind: "done",
            videoUrl: s.videoUrl,
            prompt: usedPrompt,
            model: usedModel,
          };
          localStorage.setItem(LAST_VIDEO_STORAGE, JSON.stringify(donePhase));

          if (isPro) {
            setPaid(true);
          } else if (credits > 0) {
            const nextCredits = credits - 1;
            setCredits(nextCredits);
            localStorage.setItem(CREDITS_STORAGE, String(nextCredits));
            setPaid(true);
          }

          return setPhase(donePhase);
        }
        if (s.state === "error") {
          if (s.locked) return onLock();
          if (s.noBalance) {
            return setPhase({
              kind: "error",
              message:
                "Nuestros servidores están saturados ahora mismo. Inténtalo de nuevo en un par de minutos.",
            });
          }
          return setPhase({ kind: "error", message: s.message });
        }
        setPhase({
          kind: "waiting",
          queued: s.state === "queued",
          position: s.state === "queued" ? s.position : null,
          startedAt,
        });
      }
    } catch (err) {
      console.error(err);
      setPhase({
        kind: "error",
        message: "Algo ha fallado al generar. Inténtalo de nuevo.",
      });
    }
  }

  function reset() {
    cancelled.current = true;
    setPhase({ kind: "idle" });
  }

  return (
    <main className="bg-glow min-h-dvh px-4 pb-16 pt-5 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img
              src={mascot}
              alt=""
              width={640}
              height={640}
              className="mask-soft size-11"
            />
            <span className="font-display text-2xl font-extrabold tracking-tighter text-yolk">
              polloloko
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-yolk/40 bg-yolk/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-yolk">
              {isPro
                ? "Plan Pro · Ilimitado"
                : credits > 0
                  ? `${credits} ${credits === 1 ? "crédito" : "créditos"}`
                  : "1 vídeo · 2,49 €"}
            </span>
                        <Button
              variant="surface"
              size="sm"
              onClick={() => setShowPayModal(true)}
              className="border-yolk/40 text-yolk hover:bg-yolk/10"
            >
              <CreditCard className="size-4" /> Comprar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLock}
              title="Tengo un código VIP"
              className="px-2 text-muted-foreground"
            >
              <LockKeyhole className="size-4" />
            </Button>
          </div>
        </header>

        <section className="animate-rise mt-8">
          <h1 className="font-display text-4xl font-extrabold leading-[0.95] tracking-tighter sm:text-5xl">
            Texto, foto y audio.
            <br />
            <span className="text-outline-yolk">Sale un vídeo IA.</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Crea vídeos con inteligencia artificial en segundos. Descarga en HD
            sin marca de agua por 2,49 €.
          </p>
        </section>

        <div className="mt-8 space-y-4">
          <section className={panel}>
            <div className="flex items-center justify-between">
              <label htmlFor="prompt" className={fieldLabel}>
                1. Describe tu vídeo (Texto)
              </label>
              <span className="font-mono text-[11px] text-muted-foreground">
                {prompt.length}/{PROMPT_MAX}
              </span>
            </div>
            <textarea
              id="prompt"
              value={prompt}
              disabled={busy}
              maxLength={PROMPT_MAX}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Ej: Un pollo con gafas de sol bailando bajo luces de neón, movimiento suave..."
              className="mt-3 w-full resize-none rounded-2xl border border-input bg-background p-4 text-base leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-yolk focus:ring-2 focus:ring-yolk/30"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  disabled={busy}
                  onClick={() => setPrompt(idea)}
                  className="max-w-full truncate rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition hover:border-yolk/60 hover:text-yolk"
                >
                  {idea}
                </button>
              ))}
            </div>

            <p className={cn(fieldLabel, "mt-6")}>
              2. Añade foto y audio (Opcional)
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-dashed border-border bg-background p-3">
                {imageFile ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <img
                        src={imageFile.dataUrl}
                        alt="Vista previa"
                        className="size-10 rounded-lg object-cover"
                      />
                      <span className="truncate text-xs text-foreground">
                        {imageFile.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImageFile(null)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-comb"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-yolk">
                    <ImagePlus className="size-4 text-yolk" />
                    <span>Subir foto de referencia</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={busy}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="rounded-2xl border border-dashed border-border bg-background p-3">
                {audioFile ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Music className="size-5 shrink-0 text-yolk" />
                      <span className="truncate text-xs text-foreground">
                        {audioFile.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAudioFile(null)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-comb"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-yolk">
                    <Music className="size-4 text-yolk" />
                    <span>Subir pista de audio</span>
                    <input
                      type="file"
                      accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg"
                      disabled={busy}
                      onChange={handleAudioUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </section>

          <section className={panel}>
            <p className={fieldLabel}>3. Motor IA y formato</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                Object.values(VIDEO_MODELS) as (typeof VIDEO_MODELS)[ModelId][]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setModel(m.id)}
                  aria-pressed={model === m.id}
                  className={cn(
                    "rounded-2xl border p-3.5 text-left transition",
                    model === m.id
                      ? "border-yolk bg-yolk/10 shadow-yolk"
                      : "border-border bg-background hover:border-yolk/50",
                  )}
                >
                  <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m.lab}
                  </span>
                  <span
                    className={cn(
                      "font-display mt-1 block text-base font-bold leading-tight",
                      model === m.id && "text-yolk",
                    )}
                  >
                    {m.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {m.blurb}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={busy}
                  onClick={() => setRatio(r)}
                  aria-pressed={ratio === r}
                  className={cn(
                    "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border font-mono text-sm transition",
                    ratio === r
                      ? "border-yolk bg-yolk text-yolk-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-yolk/50",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "rounded-[3px] border-2 border-current",
                      r === "16:9" && "h-2.5 w-4",
                      r === "9:16" && "h-4 w-2.5",
                      r === "1:1" && "size-3.5",
                    )}
                  />
                  {r}
                </button>
              ))}
            </div>
          </section>

          <div className="space-y-2">
            <Button
              variant="yolk"
              size="xl"
              className="w-full"
              onClick={generate}
              disabled={!canGenerate}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {busy
                ? "Generando tu vídeo…"
                : hasAccess
                  ? "Generar vídeo ahora (5 s)"
                  : "Generar vídeo con IA — 2,49 €"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Entrega instantánea en MP4 HD sin marca de agua · Pago seguro con
              Stripe.
            </p>
          </div>

          <Button
            variant="surface"
            size="lg"
            className="w-full"
            onClick={showDemo}
            disabled={busy}
          >
            <PlayCircle /> Ver vídeo de ejemplo
          </Button>

          <ResultPanel
            phase={phase}
            now={now}
            paid={paid}
            onOpenPay={() => setShowPayModal(true)}
            onReset={reset}
            onRetry={generate}
          />
        </div>
      </div>

      {showPayModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="animate-rise relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-card">
            <button
              type="button"
              onClick={() => setShowPayModal(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <h2 className="font-display text-2xl font-extrabold tracking-tight">
              Desbloquea tu vídeo IA
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generación instantánea en calidad HD y descarga MP4 sin marca de
              agua.
            </p>

            <div className="mt-5 space-y-3">
              {STRIPE_PLANS.map((plan) => (
                <a
                  key={plan.id}
                  href={plan.url}
                  className="flex items-center justify-between rounded-2xl border border-border bg-background p-4 transition hover:border-yolk hover:bg-yolk/5"
                >
                  <div>
                    <p className="font-display font-bold text-foreground">
                      {plan.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {plan.subtitle}
                    </p>
                  </div>
                  <span className="rounded-xl bg-yolk px-3 py-1.5 font-mono text-sm font-bold text-yolk-foreground">
                    {plan.price}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ResultPanel({
  phase,
  now,
  paid,
  onOpenPay,
  onReset,
  onRetry,
}: {
  phase: Phase;
  now: number;
  paid: boolean;
  onOpenPay: () => void;
  onReset: () => void;
  onRetry: () => void;
}) {
  if (phase.kind === "idle") return null;

  if (phase.kind === "error") {
    return (
      <section className="animate-rise rounded-3xl border border-comb/50 bg-comb/10 p-5">
        <p className="font-display text-lg font-bold text-comb">
          Vaya, algo ha salido mal
        </p>
        <p className="mt-1 text-sm text-foreground/90">{phase.message}</p>
        <Button variant="surface" className="mt-4" onClick={onRetry}>
          <RotateCcw /> Reintentar
        </Button>
      </section>
    );
  }

  if (phase.kind === "submitting" || phase.kind === "waiting") {
    const secs = Math.max(
      0,
      Math.round(
        (now - (phase.kind === "waiting" ? phase.startedAt : now)) / 1000,
      ),
    );
    const label =
      phase.kind === "submitting"
        ? "Enviando al pollo..."
        : phase.queued
          ? phase.position
            ? `En cola (puesto ${phase.position})...`
            : "En cola..."
          : "Generando tu vídeo...";

    return (
      <section
        aria-live="polite"
        className="animate-rise flex flex-col items-center gap-2 rounded-3xl border border-border bg-card p-8 text-center"
      >
        <Loader2 className="h-8 w-8 animate-spin text-yolk" />
        <p className="font-display mt-4 text-lg font-bold">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {secs}s · Suele tardar entre 20 y 45 segundos
        </p>
      </section>
    );
  }

  if (phase.kind === "done") {
    const canDownload = paid || Boolean(phase.demo);

    return (
      <section className="animate-rise rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2 pb-4">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-yolk">
            <CheckCircle2 className="h-4 w-4" />
            {phase.demo ? "Vídeo de ejemplo" : "Vídeo listo"}
          </span>
          {phase.demo && (
            <span className="rounded-full border border-yolk/40 bg-yolk/10 px-2.5 py-0.5 font-mono text-[11px] text-yolk">
              Ejemplo HD
            </span>
          )}
        </div>

        <video
          key={phase.videoUrl}
          ref={(el) => {
            if (!el) return;
            el.muted = Boolean(phase.demo);
            el.play().catch(() => {});
          }}
          src={phase.videoUrl}
          controls
          autoPlay
          loop
          playsInline
          className="w-full rounded-2xl bg-black"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          {canDownload ? (
            <a
              href={phase.videoUrl}
              download="polloloko.mp4"
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-yolk px-4 py-3 font-display text-sm font-bold text-yolk-foreground transition hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Descargar MP4
            </a>
          ) : (
            <Button variant="yolk" className="flex-1" onClick={onOpenPay}>
              <CreditCard className="h-4 w-4" />
              Desbloquear descarga (2,49 €)
            </Button>
          )}
          <Button variant="surface" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Crear otro
          </Button>
        </div>
      </section>
    );
  }

  return null;
}

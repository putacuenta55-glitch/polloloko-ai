import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  LockKeyhole,
  RotateCcw,
  Sparkles,
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

const KEY_STORAGE = "polloloko:fal-key";
const POLL_MS = 4000;
const MAX_WAIT_MS = 12 * 60 * 1000;

const IDEAS = [
  "Un pollo con gafas de sol surfeando una ola gigante al atardecer, cámara lenta",
  "Calle de Tokio de noche bajo la lluvia, neones reflejados, travelling suave",
  "Un astronauta bailando flamenco en la Luna, polvo flotando, plano general",
];

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "waiting"; queued: boolean; position: number | null; startedAt: number }
  | { kind: "done"; videoUrl: string; prompt: string; model: ModelId }
  | { kind: "error"; message: string };

const fieldLabel = "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground";
const panel = "rounded-3xl border border-border bg-surface p-5 shadow-card";

export function Generator({ code, onLock }: { code: string; onLock: () => void }) {
  const submit = useServerFn(submitVideo);
  const check = useServerFn(checkVideo);

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [remember, setRemember] = useState(false);
  const [model, setModel] = useState<ModelId>("wan");
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const cancelled = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) {
      setApiKey(saved);
      setRemember(true);
    }
    return () => {
      cancelled.current = true;
    };
  }, []);

  useEffect(() => {
    if (remember && apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
    else localStorage.removeItem(KEY_STORAGE);
  }, [remember, apiKey]);

  useEffect(() => {
    if (phase.kind !== "waiting") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase.kind]);

  const busy = phase.kind === "submitting" || phase.kind === "waiting";
  const canGenerate = apiKey.trim().length >= 8 && prompt.trim().length >= 3 && !busy;

  async function generate() {
    if (!canGenerate) return;
    cancelled.current = false;
    const usedPrompt = prompt.trim();
    const usedModel = model;
    setPhase({ kind: "submitting" });
    try {
      const job = await submit({
        data: { code, apiKey: apiKey.trim(), model, prompt: usedPrompt, aspectRatio: ratio },
      });
      if ("error" in job) {
        if ("locked" in job) return onLock();
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
            message: "fal.ai está tardando demasiado. Revisa tu panel de fal.ai o vuelve a intentarlo.",
          });
        }
        const s = await check({
          data: {
            code,
            apiKey: apiKey.trim(),
            statusUrl: job.statusUrl,
            responseUrl: job.responseUrl,
          },
        });
        if (s.state === "done") {
          return setPhase({ kind: "done", videoUrl: s.videoUrl, prompt: usedPrompt, model: usedModel });
        }
        if (s.state === "error") {
          if (s.locked) return onLock();
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
      setPhase({ kind: "error", message: "Algo ha fallado. Revisa tu clave y vuelve a intentarlo." });
    }
  }

  function reset() {
    cancelled.current = true;
    setPhase({ kind: "idle" });
  }

  return (
    <main className="bg-glow min-h-dvh px-4 pb-16 pt-5 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={mascot} alt="" width={640} height={640} className="mask-soft size-11" />
            <span className="font-display text-2xl font-extrabold tracking-tighter text-yolk">
              polloloko
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLock} className="text-muted-foreground">
            <LockKeyhole /> Bloquear
          </Button>
        </header>

        <section className="animate-rise mt-8">
          <h1 className="font-display text-4xl font-extrabold leading-[0.95] tracking-tighter sm:text-5xl">
            Escribe una idea.
            <br />
            <span className="text-outline-yolk">Sale un vídeo.</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Clips de 5 segundos con Wan o Luma, usando tu propia cuenta de fal.ai.
          </p>
        </section>

        <div className="mt-8 space-y-4">
          {/* API key */}
          <section className={panel}>
            <div className="flex items-center justify-between">
              <label htmlFor="fal-key" className={fieldLabel}>
                <KeyRound className="mr-1.5 inline size-3.5 align-[-2px]" />
                Tu clave de fal.ai
              </label>
              <a
                href="https://fal.ai/dashboard/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-yolk hover:underline"
              >
                Conseguir clave <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="relative mt-3">
              <input
                id="fal-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="xxxxxxxx-xxxx-xxxx:xxxxxxxxxxxx"
                className="h-12 w-full rounded-2xl border border-input bg-background pl-4 pr-12 font-mono text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-yolk focus:ring-2 focus:ring-yolk/30"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Ocultar clave" : "Mostrar clave"}
                className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 accent-yolk"
              />
              Recordar en este dispositivo
            </label>
            <p className="mt-2 text-xs text-muted-foreground/80">
              La clave solo se usa para hablar con fal.ai; no la guardamos en ningún servidor. Cada
              vídeo se cobra en tu cuenta de fal.ai.
            </p>
          </section>

          {/* Model + ratio */}
          <section className={panel}>
            <p className={fieldLabel}>Modelo</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(Object.values(VIDEO_MODELS) as (typeof VIDEO_MODELS)[ModelId][]).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setModel(m.id)}
                  aria-pressed={model === m.id}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
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
                      "font-display mt-1 block text-lg font-bold leading-tight",
                      model === m.id && "text-yolk",
                    )}
                  >
                    {m.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{m.blurb}</span>
                </button>
              ))}
            </div>

            <p className={cn(fieldLabel, "mt-5")}>Formato</p>
            <div className="mt-3 flex gap-2">
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

          {/* Prompt */}
          <section className={panel}>
            <div className="flex items-center justify-between">
              <label htmlFor="prompt" className={fieldLabel}>
                Describe tu vídeo
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
              rows={5}
              placeholder="Un pollo con gafas de sol corriendo por una playa al amanecer, cámara siguiéndolo en slow motion…"
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
          </section>

          <Button
            variant="yolk"
            size="xl"
            className="w-full"
            onClick={generate}
            disabled={!canGenerate}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? "Generando…" : "Generar vídeo de 5 s"}
          </Button>
          {!apiKey.trim() && (
            <p className="text-center text-xs text-muted-foreground">
              Pega tu clave de fal.ai para empezar.
            </p>
          )}

          <ResultPanel phase={phase} now={now} onReset={reset} onRetry={generate} />
        </div>
      </div>
    </main>
  );
}

function ResultPanel({
  phase,
  now,
  onReset,
  onRetry,
}: {
  phase: Phase;
  now: number;
  onReset: () => void;
  onRetry: () => void;
}) {
  if (phase.kind === "idle") return null;

  if (phase.kind === "error") {
    return (
      <section className="animate-rise rounded-3xl border border-comb/50 bg-comb/10 p-5">
        <p className="font-display text-lg font-bold text-comb">Vaya, el pollo se ha liado</p>
        <p className="mt-1 text-sm text-foreground/90">{phase.message}</p>
        <Button variant="surface" className="mt-4" onClick={onRetry}>
          <RotateCcw /> Reintentar
        </Button>
      </section>
    );
  }

  if (phase.kind === "submitting" || phase.kind === "waiting") {
    const secs = phase.kind === "waiting" ? Math.max(0, Math.floor((now - phase.startedAt) / 1000)) : 0;
    const label =
      phase.kind === "submitting"
        ? "Enviando a fal.ai…"
        : phase.queued
          ? phase.position != null && phase.position > 0
            ? `En cola · posición ${phase.position}`
            : "En cola…"
          : "Generando tu vídeo…";
    return (
      <section
        aria-live="polite"
        className="animate-rise flex flex-col items-center rounded-3xl border border-yolk/40 bg-surface p-8 text-center shadow-card"
      >
        <img src={mascot} alt="" width={640} height={640} className="animate-peck mask-soft size-24" />
        <p className="font-display mt-3 text-xl font-bold text-yolk">{label}</p>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
        </p>
        <p className="mt-3 max-w-xs text-xs text-muted-foreground">
          Suele tardar entre 1 y 4 minutos. No cierres esta página.
        </p>
      </section>
    );
  }

  const fileName = `polloloko-${phase.model}-${Date.now().toString(36)}`;
  const downloadHref = `/api/download?url=${encodeURIComponent(phase.videoUrl)}&name=${fileName}`;
  return (
    <section className="animate-rise overflow-hidden rounded-3xl border border-yolk/50 bg-surface shadow-yolk">
      <video
        src={phase.videoUrl}
        controls
        autoPlay
        loop
        muted
        playsInline
        className="w-full bg-background"
      />
      <div className="p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {VIDEO_MODELS[phase.model].name} · 5 s
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-foreground/90">{phase.prompt}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="yolk" size="xl" className="flex-1">
            <a href={downloadHref} download={`${fileName}.mp4`}>
              <Download /> Descargar MP4
            </a>
          </Button>
          <Button variant="surface" size="xl" onClick={onReset}>
            <RotateCcw /> Otro vídeo
          </Button>
        </div>
      </div>
    </section>
  );
}

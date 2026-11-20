import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  Gift,
  ImagePlus,
  KeyRound,
  Loader2,
  LockKeyhole,
  Music,
  RotateCcw,
  Sparkles,
  Trash2,
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
const TRIAL_USED_STORAGE = "polloloko:trial-used";
const POLL_MS = 4000;
const MAX_WAIT_MS = 12 * 60 * 1000;

const IDEAS = [
  "Un pollo con gafas de sol surfeando una ola gigante al atardecer, cámara lenta",
  "Anima esta foto con movimiento de cámara cinematográfico y luces cálidas",
  "Un astronauta bailando flamenco al ritmo de la música, polvo flotando",
];

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }

  | { kind: "waiting"; queued: boolean; position: number | null; startedAt: number }
  | { kind: "done"; videoUrl: string; prompt: string; model: ModelId }
  | { kind: "error"; message: string };

const fieldLabel = "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground";
const panel = "rounded-3xl border border-border bg-surface p-5 shadow-card";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function Generator({ code, onLock }: { code: string; onLock: () => void }) {
  const submit = useServerFn(submitVideo);
  const check = useServerFn(checkVideo);

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [remember, setRemember] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);

  const [model, setModel] = useState<ModelId>("seedance");
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const [prompt, setPrompt] = useState("");

  const [imageFile, setImageFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [audioFile, setAudioFile] = useState<{ name: string; dataUrl: string } | null>(null);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const cancelled = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) {
      setApiKey(saved);
      setRemember(true);
    }
    if (localStorage.getItem(TRIAL_USED_STORAGE) === "1") {
      setTrialUsed(true);
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
  const hasOwnKey = apiKey.trim().length >= 8;
  const usingFreeTrial = !hasOwnKey && !trialUsed;
  const canGenerate = (hasOwnKey || usingFreeTrial) && prompt.trim().length >= 3 && !busy;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      setPhase({ kind: "error", message: "La foto pesa más de 4.5 MB. Usa una imagen más ligera." });
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setImageFile({ name: file.name, dataUrl });
  }

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      setPhase({ kind: "error", message: "El audio pesa más de 4.5 MB. Usa un clip más corto." });
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setAudioFile({ name: file.name, dataUrl });
    setModel("seedance");
  }

  async function generate() {
    if (!canGenerate) return;
    cancelled.current = false;
    const usedPrompt = prompt.trim();
    const usedModel = model;
    const isTrialRun = usingFreeTrial;

    setPhase({ kind: "submitting" });
    try {
      const job = await submit({
        data: {
          code,
          apiKey: apiKey.trim(),
          isFreeTrial: isTrialRun,
          model: usedModel,
          prompt: usedPrompt,
          aspectRatio: ratio,
          imageDataUrl: imageFile?.dataUrl,
          audioDataUrl: audioFile?.dataUrl,
        },
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
            message: "fal.ai está tardando demasiado. Vuelve a intentarlo en unos minutos.",
          });
        }
        const s = await check({
          data: {
            code,
            apiKey: apiKey.trim(),
            isFreeTrial: isTrialRun,
            statusUrl: job.statusUrl,
            responseUrl: job.responseUrl,
          },
        });
        if (s.state === "done") {
          if (isTrialRun) {
            localStorage.setItem(TRIAL_USED_STORAGE, "1");
            setTrialUsed(true);
          }
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
      setPhase({ kind: "error", message: "Algo ha fallado al generar. Inténtalo de nuevo." });
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
            Texto, foto y audio.
            <br />
            <span className="text-outline-yolk">Sale un vídeo IA.</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Combina tus ideas, imágenes y sonido en clips de 5 segundos listos para descargar.
          </p>
        </section>

        <div className="mt-8 space-y-4">
          {!trialUsed && !hasOwnKey ? (
            <section className="rounded-3xl border border-yolk/60 bg-yolk/10 p-5 shadow-yolk">
              <div className="flex items-center gap-2 font-display text-lg font-bold text-yolk">
                <Gift className="size-5" />
                ¡Tienes 1 vídeo de prueba gratuita disponible!
              </div>
              <p className="mt-1 text-sm text-foreground/90">
                No necesitas configurar nada ni meter tarjeta. Escribe tu idea, sube una foto o audio
                si quieres y pulsa generar.
              </p>
            </section>
          ) : (
            <section className={panel}>
              <div className="flex items-center justify-between">
                <label htmlFor="fal-key" className={fieldLabel}>
                  <KeyRound className="mr-1.5 inline size-3.5 align-[-2px]" />
                  {trialUsed ? "Prueba agotada · Tu clave de fal.ai" : "Tu clave de fal.ai (opcional)"}
                </label>
                <a
                  href="https://fal.ai"
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
                Recordar clave en este dispositivo
              </label>
            </section>
          )}

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

            <p className={cn(fieldLabel, "mt-6")}>2. Añade foto y audio (Opcional)</p>
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
                      <span className="truncate text-xs text-foreground">{imageFile.name}</span>
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
                      <span className="truncate text-xs text-foreground">{audioFile.name}</span>
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
              {(Object.values(VIDEO_MODELS) as (typeof VIDEO_MODELS)[ModelId][]).map((m) => (
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
                  <span className="mt-1 block text-xs text-muted-foreground">{m.blurb}</span>
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
              : usingFreeTrial
                ? "Generar vídeo de prueba gratis"
                : "Generar vídeo de 5 s"}
          </Button>

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
        

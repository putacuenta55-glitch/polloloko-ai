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

const STRIPE_PAYMENT_LINK = "https://stripe.com";
const LAST_VIDEO_STORAGE = "polloloko:last_video";
const DEMO_VIDEO_URL = "https://googleapis.com";
const POLL_MS = 2500;
const MAX_WAIT_MS = 180_000;

const panel = "rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6";
const fieldLabel = "font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground";

const IDEAS = [
  "Un pollo con gafas de sol surfeando una ola gigante al atardecer, cámara lenta",
  "Anima esta foto con movimiento de cámara cinematográfico y luces cálidas",
  "Un astronauta bailando flamenco al ritmo de la música, polvo flotando",
];

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }

  | { kind: "waiting"; queued: boolean; position: number | null; startedAt: number }
  | {
      kind: "done";
      videoUrl: string;
      prompt: string;
      model: ModelId;
      demo?: "manual" | "noBalance";
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

export function Generator({ code, onLock }: { code: string; onLock: () => void }) {
  const submit = useServerFn(submitVideo);
  const check = useServerFn(checkVideo);

  const [model, setModel] = useState<ModelId>("seedance");
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const [prompt, setPrompt] = useState("");

  const [imageFile, setImageFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [audioFile, setAudioFile] = useState<{ name: string; dataUrl: string } | null>(null);

  const [paid, setPaid] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const cancelled = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pagado") === "true") {
      setPaid(true);
      const saved = localStorage.getItem(LAST_VIDEO_STORAGE);
      if (saved) {
        try {
          setPhase(JSON.parse(saved));
        } catch {}
      }
      window.history.replaceState({}, "", window.location.pathname);
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
  const canGenerate = prompt.trim().length >= 3 && !busy;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
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

  function showDemo(reason: "manual" | "noBalance", usedPrompt = prompt.trim()) {
    cancelled.current = true;
    setPhase({
      kind: "done",
      videoUrl: DEMO_VIDEO_URL,
      prompt: usedPrompt,
      model,
      demo: reason,
    });
  }

  async function generate() {
    if (!canGenerate) return;

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
        if ("noBalance" in job) return showDemo("noBalance", usedPrompt);
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
          setPaid(false);
          return setPhase(donePhase);
        }
        if (s.state === "error") {
          if (s.locked) return onLock();
          if (s.noBalance) return showDemo("noBalance", usedPrompt);
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
    setPaid(false);
    setPhase({ kind: "idle" });
  }

  return (
    <main className="bg-glow min-h-dvh px-4 pb-16 pt-5 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src={mascot} alt="" width={640} height={640} className="mask-soft size-11" />
            <span className="font-display text-2xl font-extrabold tracking-tighter text-yolk">
              polloloko
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-yolk/40 bg-yolk/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-yolk">
              Prueba gratis · Descarga 0,78 €
            </span>
            <Button
              variant="surface"
              size="sm"
              onClick={() => setShowPayModal(true)}
              className="border-yolk/40 text-yolk hover:bg-yolk/10"
            >
              <CreditCard className="size-4" /> Precio
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
            Crea tu vídeo gratis en segundos. Paga 0,78 € solo si quieres descargarlo sin marca de agua.
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
                  

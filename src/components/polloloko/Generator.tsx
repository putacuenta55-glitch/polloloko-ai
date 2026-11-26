
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

const STRIPE_PLANS = [
  {
    id: "single",
    title: "1 vídeo",
    price: "1,49 €",
    subtitle: "Pago único · 1 descarga HD sin marca de agua",
    url: "https://stripe.com",
  },
  {
    id: "pack5",
    title: "Pack 5 vídeos",
    price: "4,99 €",
    subtitle: "1,00 €/vídeo · Ahorra un 33%",
    url: "https://stripe.com",
  },
  {
    id: "pack10",
    title: "Pack 10 vídeos",
    price: "8,99 €",
    subtitle: "Más popular · 0,90 €/vídeo",
    url: "https://stripe.com",
  },
  {
    id: "pro",
    title: "Plan Pro Mensual",
    price: "12,99 €/mes",
    subtitle: "Vídeos ilimitados sin marca de agua",
    url: "https://stripe.com",
  },
];

const LAST_VIDEO_STORAGE = "polloloko:last_video";
const CREDITS_STORAGE = "polloloko:credits";
const PRO_STORAGE = "polloloko:pro";
const DEMO_VIDEO_URL =
  "https://mozilla.net";
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
      } else if (creditosComprados > 0) {
        const restantes = Math.max(0, savedCredits + creditosComprados - 1);
        localStorage.setItem(CREDITS_STORAGE, String(restantes));
        setCredits(restantes);
      }

      setPaid(true);
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
      if (savedPro) {
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
            message:
              "fal.ai está tardando demasiado. Vuelve a intentarlo en unos minutos.",
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
          } else {
            setPaid(false);
          }

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
      setPhase({
        kind: "error",
        message: "Algo ha fallado al generar. Inténtalo de nuevo.",
      });
    }
  }

  function reset() {
    cancelled.current = true;
    setPaid(isPro);
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
                  : "Prueba gratis · Desde 1,49 €"}
            </span>
            <Button

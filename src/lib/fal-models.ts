export type ModelId = "wan" | "luma" | "seedance";
export type AspectRatio = "16:9" | "9:16" | "1:1";

export interface VideoModel {
  id: ModelId;
  name: string;
  lab: string;
  endpoint: string;
  imageEndpoint?: string;
  supportsAudio?: boolean;
  blurb: string;
}

export const VIDEO_MODELS: Record<ModelId, VideoModel> = {
  seedance: {
    id: "seedance",
    name: "Seedance 2.5",
    lab: "ByteDance",
    endpoint: "fal-ai/bytedance/seedance/v1/pro/text-to-video",
    imageEndpoint: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    supportsAudio: true,
    blurb: "Texto + Foto + Audio sincronizado",
  },
  wan: {
    id: "wan",
    name: "Wan 2.7",
    lab: "Alibaba",
    endpoint: "fal-ai/wan/v2.7/text-to-video",
    imageEndpoint: "fal-ai/wan/v2.7/image-to-video",
    blurb: "Anima tus fotos con movimiento fluido",
  },
  luma: {
    id: "luma",
    name: "Luma Ray 3.2",
    lab: "Luma AI",
    endpoint: "luma/agent/ray/v3.2/text-to-video",
    imageEndpoint: "luma/agent/ray/v3.2/image-to-video",
    blurb: "Look cinematográfico y luz realista",
  },
};

export const ASPECT_RATIOS: AspectRatio[] = ["16:9", "9:16", "1:1"];
export const VIDEO_SECONDS = 5;
export const PROMPT_MAX = 1500;

export function buildModelInput(
  model: ModelId,
  prompt: string,
  aspectRatio: AspectRatio,
  imageDataUrl?: string,
  audioDataUrl?: string,
) {
  const base: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    resolution: "720p",
  };

  if (model === "luma") {
    base.duration = `${VIDEO_SECONDS}s`;
  } else {
    base.duration = VIDEO_SECONDS;
  }

  if (imageDataUrl) {
    base.image_url = imageDataUrl;
  }
  if (audioDataUrl && VIDEO_MODELS[model].supportsAudio) {
    base.audio_url = audioDataUrl;
  }

  return base;
}

function hostMatches(raw: string, host: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function isFalMediaUrl(raw: string): boolean {
  return hostMatches(raw, "fal.media");
}

export function isFalQueueUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol === "https:" && new URL(raw).hostname === "queue.fal.run";
  } catch {
    return false;
  }
}

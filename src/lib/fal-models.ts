// Client-safe catalogue of the fal.ai text-to-video models polloloko offers.
// Every model is asked for a 5-second clip.

export type ModelId = "wan" | "luma";
export type AspectRatio = "16:9" | "9:16" | "1:1";

export interface VideoModel {
  id: ModelId;
  name: string;
  lab: string;
  endpoint: string;
  blurb: string;
}

export const VIDEO_MODELS: Record<ModelId, VideoModel> = {
  wan: {
    id: "wan",
    name: "Wan 2.7",
    lab: "Alibaba",
    endpoint: "fal-ai/wan/v2.7/text-to-video",
    blurb: "Movimiento fluido y escenas detalladas",
  },
  luma: {
    id: "luma",
    name: "Luma Ray 3.2",
    lab: "Luma AI",
    endpoint: "luma/agent/ray/v3.2/text-to-video",
    blurb: "Look cinematográfico y luz realista",
  },
};

export const ASPECT_RATIOS: AspectRatio[] = ["16:9", "9:16", "1:1"];
export const VIDEO_SECONDS = 5;
export const PROMPT_MAX = 1500;

/** Builds the fal.ai request body for a 5-second clip on the chosen model. */
export function buildModelInput(model: ModelId, prompt: string, aspectRatio: AspectRatio) {
  if (model === "luma") {
    return { prompt, aspect_ratio: aspectRatio, duration: `${VIDEO_SECONDS}s`, resolution: "720p" };
  }
  return { prompt, aspect_ratio: aspectRatio, duration: VIDEO_SECONDS, resolution: "720p" };
}

function hostMatches(raw: string, host: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/** Only fal.ai's own media CDN may be downloaded through polloloko. */
export function isFalMediaUrl(raw: string): boolean {
  return hostMatches(raw, "fal.media");
}

/** Only fal.ai's queue may be polled with the user's key. */
export function isFalQueueUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol === "https:" && new URL(raw).hostname === "queue.fal.run";
  } catch {
    return false;
  }
}

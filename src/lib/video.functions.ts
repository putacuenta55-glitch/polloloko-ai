
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { checkAccessCode } from "./access.server";
import {
  ASPECT_RATIOS,
  PROMPT_MAX,
  VIDEO_MODELS,
  buildModelInput,
  isFalQueueUrl,
  type ModelId,
} from "./fal-models";

const codeSchema = z.string().min(1).max(200);
const keySchema = z.string().trim().max(400);

function resolveApiKey(userKey: string, isFreeTrial: boolean): string | null {
  if (isFreeTrial) {
    return process.env.FAL_KEY || null;
  }
  return userKey.length >= 8 ? userKey : null;
}

export const verifyAccess = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => z.object({ code: codeSchema }).parse(data))
  .handler(async ({ data }) => ({
    ok: data.code === "PRUEBA-GRATIS" || checkAccessCode(data.code),
  }));

function falError(status: number): string {
  if (status === 401) return "La clave de fal.ai no es válida. Revísala e inténtalo de nuevo.";
  if (status === 403) return "fal.ai ha rechazado la petición: revisa el saldo o los permisos de la cuenta.";
  if (status === 422) return "fal.ai no ha aceptado los archivos o el texto. Prueba con una imagen más ligera u otro texto.";
  if (status === 429) return "Demasiadas peticiones a fal.ai. Espera un momento y reintenta.";
  return "fal.ai no ha respondido bien. Inténtalo de nuevo en unos segundos.";
}

type Locked = { error: string; locked: true };
const LOCKED: Locked = { error: "Código de acceso caducado. Vuelve a introducirlo.", locked: true };

export const submitVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: codeSchema,
        apiKey: keySchema,
        isFreeTrial: z.boolean().optional().default(false),
        model: z.enum(["wan", "luma", "seedance"]),
        prompt: z.string().trim().min(3).max(PROMPT_MAX),
        aspectRatio: z.enum(ASPECT_RATIOS as [string, ...string[]]),
        imageDataUrl: z.string().optional(),
        audioDataUrl: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const allowed = data.code === "PRUEBA-GRATIS" || checkAccessCode(data.code);
    if (!allowed) return LOCKED;

    const activeKey = resolveApiKey(data.apiKey, data.isFreeTrial);
    if (!activeKey) {
      return {
        error: data.isFreeTrial
          ? "La prueba gratuita aún no tiene clave configurada en el servidor (FAL_KEY). Introduce tu clave de fal.ai."
          : "Introduce tu clave de fal.ai para generar el vídeo.",
      };
    }

    const model = VIDEO_MODELS[data.model as ModelId];
    const endpoint = data.imageDataUrl && model.imageEndpoint ? model.imageEndpoint : model.endpoint;

    try {
      const res = await fetch(`https://fal.run{endpoint}`, {
        method: "POST",
        headers: { Authorization: `Key ${activeKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          buildModelInput(
            data.model as ModelId,
            data.prompt,
            data.aspectRatio as "16:9",
            data.imageDataUrl,
            data.audioDataUrl,
          ),
        ),
      });
      if (!res.ok) {
        console.error("fal submit failed", res.status, await res.text().catch(() => ""));
        return { error: falError(res.status) };
      }
      const json = (await res.json()) as {
        request_id?: string;
        status_url?: string;
        response_url?: string;
      };
      if (!json.request_id || !json.status_url || !json.response_url) {
        return { error: "fal.ai devolvió una respuesta inesperada." };
      }
      return {
        requestId: json.request_id,
        statusUrl: json.status_url,
        responseUrl: json.response_url,
      };
    } catch (err) {
      console.error("fal submit error", err);
      return { error: "No se pudo contactar con fal.ai." };
    }
  });

export type VideoStatus =

  | { state: "queued"; position: number | null }
  | { state: "running" }
  | { state: "done"; videoUrl: string }
  | { state: "error"; message: string; locked?: true };

export const checkVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: codeSchema,
        apiKey: keySchema,
        isFreeTrial: z.boolean().optional().default(false),
        statusUrl: z.string().url().refine(isFalQueueUrl),
        responseUrl: z.string().url().refine(isFalQueueUrl),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<VideoStatus> => {
    const allowed = data.code === "PRUEBA-GRATIS" || checkAccessCode(data.code);
    if (!allowed) return { state: "error", message: LOCKED.error, locked: true };

    const activeKey = resolveApiKey(data.apiKey, data.isFreeTrial);
    if (!activeKey) return { state: "error", message: "Falta la clave de fal.ai." };

    const headers = { Authorization: `Key ${activeKey}` };
    try {
      const statusRes = await fetch(data.statusUrl, { headers });
      if (!statusRes.ok) {
        console.error("fal status failed", statusRes.status);
        return { state: "error", message: falError(statusRes.status) };
      }
      const status = (await statusRes.json()) as { status?: string; queue_position?: number };
      if (status.status === "IN_QUEUE") {
        return { state: "queued", position: status.queue_position ?? null };
      }
      if (status.status !== "COMPLETED") return { state: "running" };

      const resultRes = await fetch(data.responseUrl, { headers });
      if (!resultRes.ok) {
        console.error("fal result failed", resultRes.status, await resultRes.text().catch(() => ""));
        return {
          state: "error",
          message:
            resultRes.status === 422
              ? "El modelo no pudo generar este vídeo (puede que el filtro de contenido lo bloquease). Prueba otro texto."
              : falError(resultRes.status),
        };
      }
      const result = (await resultRes.json()) as { video?: { url?: string } };
      const url = result.video?.url;
      if (!url) return { state: "error", message: "fal.ai no devolvió ningún vídeo." };
      return { state: "done", videoUrl: url };
    } catch (err) {
      console.error("fal status error", err);
      return { state: "error", message: "No se pudo consultar el estado en fal.ai." };
    }
  });

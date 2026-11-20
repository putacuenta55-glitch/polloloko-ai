import { describe, expect, it } from "vitest";

import { checkAccessCode } from "@/lib/access.server";
import { buildModelInput, isFalMediaUrl, isFalQueueUrl } from "@/lib/fal-models";
import { detectPlatform, shouldShowInstall } from "@/lib/pwa";

describe("access code", () => {
  it("unlocks with the right code", () => {
    expect(checkAccessCode("pollo2026", "pollo2026")).toBe(true);
  });
  it("stays locked with a wrong code", () => {
    expect(checkAccessCode("pollo2025", "pollo2026")).toBe(false);
    expect(checkAccessCode("", "pollo2026")).toBe(false);
  });
});

describe("5-second videos", () => {
  it("asks Wan for 5 seconds", () => {
    expect(buildModelInput("wan", "x", "16:9").duration).toBe(5);
  });
  it("asks Luma for 5 seconds", () => {
    expect(buildModelInput("luma", "x", "16:9").duration).toBe("5s");
  });
});

describe("allowed fal.ai URLs", () => {
  it("only downloads from fal.ai's media CDN", () => {
    expect(isFalMediaUrl("https://v3.fal.media/files/a/b.mp4")).toBe(true);
    expect(isFalMediaUrl("https://evil.com/fal.media.mp4")).toBe(false);
    expect(isFalMediaUrl("http://v3.fal.media/files/a/b.mp4")).toBe(false);
  });
  it("only polls fal.ai's queue", () => {
    expect(isFalQueueUrl("https://queue.fal.run/fal-ai/wan/requests/1/status")).toBe(true);
    expect(isFalQueueUrl("https://169.254.169.254/latest")).toBe(false);
  });
});

describe("install app button", () => {
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
  const DESKTOP =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

  it("shows on iPhone", () => {
    expect(shouldShowInstall(detectPlatform(IPHONE), false)).toBe(true);
  });
  it("shows on Android", () => {
    expect(shouldShowInstall(detectPlatform(ANDROID), false)).toBe(true);
  });
  it("hides on desktop", () => {
    expect(shouldShowInstall(detectPlatform(DESKTOP), false)).toBe(false);
  });
  it("hides once the app is installed", () => {
    expect(shouldShowInstall(detectPlatform(ANDROID), true)).toBe(false);
  });
});

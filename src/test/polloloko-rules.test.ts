import { describe, expect, it } from "vitest";

import { checkAccessCode } from "@/lib/access.server";
import { buildModelInput, isFalMediaUrl, isFalQueueUrl } from "@/lib/fal-models";

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

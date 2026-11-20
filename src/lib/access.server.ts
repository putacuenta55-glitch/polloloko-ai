// Server-only: the access code never reaches the browser bundle.
const DEFAULT_ACCESS_CODE = "pollo2026";

export function getAccessCode(): string {
  return process.env["ACCESS_CODE"]?.trim() || DEFAULT_ACCESS_CODE;
}

/** Compares an entered code with the expected one, ignoring surrounding spaces and letter case. */
export function checkAccessCode(entered: string, expected: string = getAccessCode()): boolean {
  const a = entered.trim().toLowerCase();
  const b = expected.trim().toLowerCase();
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

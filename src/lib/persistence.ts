/**
 * URL-safe encoding / decoding for DhwInputs. Uses base64url so that share
 * links can travel through email, Slack, and copy/paste without escape issues.
 */
import type { DhwInputs } from "./calc/inputs";

export function encodeInputs(inputs: DhwInputs): string {
  const json = JSON.stringify(inputs);
  if (typeof window === "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }
  // Browser: btoa handles latin1, so go via encodeURIComponent
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeInputs(encoded: string): Partial<DhwInputs> | null {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    let json: string;
    if (typeof window === "undefined") {
      json = Buffer.from(normalized, "base64").toString("utf8");
    } else {
      const binary = atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      json = new TextDecoder().decode(bytes);
    }
    return JSON.parse(json) as Partial<DhwInputs>;
  } catch {
    return null;
  }
}

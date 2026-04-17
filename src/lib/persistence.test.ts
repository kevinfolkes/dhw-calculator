import { describe, it, expect } from "vitest";
import { DEFAULT_INPUTS } from "./calc/inputs";
import { decodeInputs, encodeInputs } from "./persistence";

describe("persistence encode/decode round-trip", () => {
  it("round-trips DEFAULT_INPUTS", () => {
    const encoded = encodeInputs(DEFAULT_INPUTS);
    const decoded = decodeInputs(encoded);
    expect(decoded).toEqual(DEFAULT_INPUTS);
  });

  it("produces URL-safe strings (no '+', '/', '=')", () => {
    const encoded = encodeInputs(DEFAULT_INPUTS);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns null for malformed input", () => {
    expect(decodeInputs("not-valid-base64!@#")).toBeNull();
    expect(decodeInputs("")).toBeNull();
  });
});

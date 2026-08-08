import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH } from "@bookcsi/shared";
import { generatePairingCode } from "./pairing-code";

describe("generatePairingCode", () => {
  it("is the length the shared contract declares", () => {
    expect(generatePairingCode()).toHaveLength(PAIRING_CODE_LENGTH);
  });

  it("draws only from the ambiguity-free alphabet", () => {
    const allowed = new Set(PAIRING_CODE_ALPHABET);

    for (let i = 0; i < 200; i += 1) {
      for (const char of generatePairingCode()) {
        expect(allowed.has(char)).toBe(true);
      }
    }
  });

  it("excludes the characters that are easy to misread off a screen", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePairingCode()).not.toMatch(/[0O1IL]/);
    }
  });

  it("is not the same code every time", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generatePairingCode()));

    expect(codes.size).toBeGreaterThan(1);
  });
});

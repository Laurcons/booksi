import { randomInt } from "node:crypto";
import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH } from "@bookcsi/shared";

/**
 * A fresh code, drawn from the alphabet `shared/` defines (no `0`/`O`,
 * `1`/`I`/`L` — read on one screen, typed on another). Collisions are handled
 * by the caller retrying on the unique-constraint violation, not by checking
 * here: a check-then-insert has the same race either way, and the alphabet is
 * wide enough (32^6) that a retry is a cold-path, not a budget item.
 */
export function generatePairingCode(): string {
  let code = "";

  for (let i = 0; i < PAIRING_CODE_LENGTH; i += 1) {
    code += PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)];
  }

  return code;
}

import { describe, expect, it } from "vitest";
import { captureHeaderFacts, headerValue, INTERESTING_HEADERS } from "./facts";

function fakeRequest(headers: Record<string, string | string[]>) {
  return { headers } as Parameters<typeof headerValue>[0];
}

describe("headerValue", () => {
  it("reports an absent header rather than throwing", () => {
    expect(headerValue(fakeRequest({}), "user-agent")).toBe("— absent —");
  });

  it("joins a repeated header", () => {
    expect(headerValue(fakeRequest({ accept: ["a", "b"] }), "accept")).toBe("a, b");
  });
});

describe("captureHeaderFacts", () => {
  it("never captures the cookie header", () => {
    // The session JWT lives there. A capture that echoed it would put a
    // 30-day token into a diagnostic file on disk.
    expect(INTERESTING_HEADERS).not.toContain("cookie");
  });

  it("captures one entry per interesting header", () => {
    const facts = captureHeaderFacts(fakeRequest({ "user-agent": "Kobo" }));

    expect(facts["user-agent"]).toBe("Kobo");
    expect(Object.keys(facts)).toHaveLength(INTERESTING_HEADERS.length);
  });
});

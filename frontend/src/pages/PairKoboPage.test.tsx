import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { failWith, renderWithQuery, stubApi } from "../test/helpers";
import { PairKoboPage } from "./PairKoboPage";

describe("PairKoboPage (§D37, docs/kobo_design.md §Autentificare)", () => {
  it("sends the typed code to the approve endpoint", async () => {
    const calls = stubApi(() => undefined);
    const { user } = renderWithQuery(<PairKoboPage />);

    await user.type(screen.getByLabelText("Codul de pe Kobo"), "abc234");
    await user.click(screen.getByRole("button", { name: "Aprobă" }));

    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST")).toBe(true),
    );
    const approveCall = calls.find((call) => call.method === "POST");
    expect(approveCall?.url).toContain("/pairing/approve");
    expect(approveCall?.body).toEqual({ code: "abc234" });
  });

  it("shows the next step on the Kobo once approval succeeds", async () => {
    stubApi(() => undefined);
    const { user } = renderWithQuery(<PairKoboPage />);

    await user.type(screen.getByLabelText("Codul de pe Kobo"), "ABC234");
    await user.click(screen.getByRole("button", { name: "Aprobă" }));

    expect(await screen.findByText("Cod aprobat")).toBeInTheDocument();
    expect(screen.getByText(/Am aprobat, continuă/)).toBeInTheDocument();
  });

  it("shows the server's message when the code is wrong or expired", async () => {
    stubApi(() =>
      failWith(400, "Codul nu e valid sau a expirat. Ia un cod nou de pe dispozitiv.", "PAIRING_INVALID"),
    );
    const { user } = renderWithQuery(<PairKoboPage />);

    await user.type(screen.getByLabelText("Codul de pe Kobo"), "ZZZZZZ");
    await user.click(screen.getByRole("button", { name: "Aprobă" }));

    expect(await screen.findByText(/Codul nu e valid sau a expirat/)).toBeInTheDocument();
  });

  it("disables the button until something is typed", () => {
    stubApi(() => undefined);
    renderWithQuery(<PairKoboPage />);

    expect(screen.getByRole("button", { name: "Aprobă" })).toBeDisabled();
  });

  it("lets a reader pair a second device after the first succeeds", async () => {
    stubApi(() => undefined);
    const { user } = renderWithQuery(<PairKoboPage />);

    await user.type(screen.getByLabelText("Codul de pe Kobo"), "ABC234");
    await user.click(screen.getByRole("button", { name: "Aprobă" }));
    await screen.findByText("Cod aprobat");

    await user.click(screen.getByRole("button", { name: "Împerechează alt dispozitiv" }));

    expect(screen.getByLabelText("Codul de pe Kobo")).toHaveValue("");
  });
});

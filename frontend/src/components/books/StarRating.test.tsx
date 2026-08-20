import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { StarRating, StarRatingInput } from "./StarRating";
import { renderWithQuery } from "../../test/helpers";

describe("StarRating — the read-only stars (S2.3)", () => {
  it("says the rating in words, not in five separate glyphs", () => {
    renderWithQuery(<StarRating rating={4} />);

    // The stars are decoration; a screen reader gets one sentence.
    expect(screen.getByRole("img", { name: "4 din 5 stele" })).toBeInTheDocument();
  });

  it("shows an empty marker for an unrated book, not zero stars", () => {
    // §D5 excludes unrated books from the average — they are absent, not bad.
    renderWithQuery(<StarRating rating={null} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("fills exactly as many stars as the rating", () => {
    const { container } = renderWithQuery(<StarRating rating={3} />);

    const stars = [...container.querySelectorAll("span[aria-hidden]")];
    expect(stars).toHaveLength(5);
    expect(stars.filter((star) => star.className.includes("text-accent"))).toHaveLength(
      3,
    );
  });
});

/** The input is uncontrolled by react-hook-form in real use; this stands in. */
function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);

  return (
    <StarRatingInput
      name="rating"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe("StarRatingInput — the form control (S2.3)", () => {
  it("offers five whole stars and no halves", async () => {
    renderWithQuery(<Harness />);

    expect(screen.getAllByRole("radio")).toHaveLength(6); // five stars + "no rating"
    expect(screen.getByRole("radio", { name: "1 stea" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "5 stele" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /jum/i })).not.toBeInTheDocument();
  });

  it("selects the star that was clicked", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole("radio", { name: "4 stele" }));

    expect(screen.getByRole("radio", { name: "4 stele" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "5 stele" })).not.toBeChecked();
  });

  it("keeps an existing rating selected when it opens", () => {
    renderWithQuery(<Harness initial="2" />);

    expect(screen.getByRole("radio", { name: "2 stele" })).toBeChecked();
  });

  it("can be un-rated again", async () => {
    // The API takes `null` at any status, so removing a rating is never the
    // thing that blocks a save.
    const user = userEvent.setup();
    renderWithQuery(<Harness initial="5" />);

    await user.click(screen.getByText("fără rating"));

    expect(screen.getByRole("radio", { name: "5 stele" })).not.toBeChecked();
  });

  it("is reachable from the keyboard", async () => {
    // Real radios, so the browser's own group behaviour applies for free: one
    // tab stop for the whole group, landing on the current choice, and arrows
    // to move within it. A div with an onClick would have needed every bit of
    // that written by hand.
    const user = userEvent.setup();
    renderWithQuery(<Harness initial="3" />);

    await user.tab();
    expect(screen.getByRole("radio", { name: "3 stele" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "4 stele" })).toBeChecked();
  });

  it("does not fire when disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <StarRatingInput name="rating" value="" disabled onChange={onChange} />,
    );

    await user.click(screen.getByRole("radio", { name: "3 stele" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

import type { ChangeEventHandler, FocusEventHandler, Ref } from "react";
import { STATUS_VALUES, statusLabel, type Status } from "@bookcsi/shared";
import { STATUS_COLOR } from "../../../lib/status";
import { useLocale, useT } from "../../../i18n/locale-context";

/**
 * The five statuses, as five pills.
 *
 * It was a `<select>` until this redesign, and the swap buys two things a
 * dropdown cannot. The states are visible without opening anything — five is
 * few enough to show — and each one arrives wearing its own colour, the same
 * one the pill in the table and the dot in the gallery use (docs/DESIGN.md
 * §Statusuri). Reading "where is this book" then costs a glance rather than a
 * click.
 *
 * **Real radios, and a `ref` on every one of them.** Same shape as
 * `StarRatingInput`, for the same reason recorded in .claude/mistakes.md: a
 * radio group's value is spread across several elements, and react-hook-form
 * reads it back by asking each registered element whether it is checked. Hand
 * it one ref and it finds a single unchecked radio and concludes the field is
 * empty — whatever is lit on screen. The inputs are `sr-only` rather than
 * hidden, because the keyboard has to be able to reach them, and arrow-key
 * navigation within the group is then the browser's job rather than ours.
 */
export function StatusChooser({
  name,
  value,
  onChange,
  onBlur,
  inputRef,
}: {
  name: string;
  value: Status;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const t = useT();
  const { locale } = useLocale();

  return (
    <div role="radiogroup" aria-label={t("field.status")} className="flex flex-wrap gap-2">
      {STATUS_VALUES.map((status) => {
        const selected = status === value;
        const color = STATUS_COLOR[status];

        return (
          <label
            key={status}
            className={
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors duration-150 " +
              (selected
                ? ""
                : "border-line text-ink-3 hover:border-accent-quiet hover:text-ink-2")
            }
            style={
              selected
                ? {
                    color,
                    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`,
                  }
                : undefined
            }
          >
            <input
              type="radio"
              name={name}
              value={status}
              checked={selected}
              onChange={onChange}
              onBlur={onBlur}
              ref={inputRef}
              className="sr-only"
            />
            {/* The dot is the same mark the status pill wears everywhere else,
                so colour is never the only carrier — the label is right beside
                it (docs/DESIGN.md §Statusuri). */}
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ backgroundColor: selected ? color : "currentColor" }}
            />
            {statusLabel(status, locale)}
          </label>
        );
      })}
    </div>
  );
}

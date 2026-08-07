/**
 * Templating, such as it is.
 *
 * There is no view engine here on purpose. This repo gates CI on `typecheck`
 * and treats a spec that compiles in no configuration as a bug worth fixing;
 * a Handlebars or EJS template would be the one part of the stack where a
 * renamed field on `Book` goes unnoticed until the page renders blank. A
 * tagged template in a `.ts` file is checked like any other code, infers over
 * the Zod-derived types in `shared/`, and adds no dependency.
 *
 * The cost is that escaping is manual, so it is made impossible to forget:
 * `html` escapes every interpolation, and the only way to inject markup is to
 * say `raw()` out loud.
 */

/** Markup that has already been escaped, or was never text to begin with. */
export interface Html {
  readonly html: string;
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Single quotes are escaped along with double, because unquoted and
 * single-quoted attribute values both appear in hand-written HTML and the
 * template has no idea which context an interpolation landed in.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/**
 * An escape hatch, deliberately noisy at the call site. Anything passed here
 * is trusted verbatim — it must never be reachable from user data.
 */
export function raw(value: string): Html {
  return { html: value };
}

function isHtml(value: unknown): value is Html {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Html).html === "string"
  );
}

/**
 * `null` and `undefined` render as nothing rather than as the words "null" and
 * "undefined". Both are ordinary in this data — `totalPages` is missing often
 * enough that §D4 calls its absence the normal case — so the template should
 * not have to guard every one of them.
 */
function stringify(value: unknown): string {
  if (value === null || value === undefined || value === false) {
    return "";
  }

  if (isHtml(value)) {
    return value.html;
  }

  if (Array.isArray(value)) {
    return value.map(stringify).join("");
  }

  return escapeHtml(String(value));
}

export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Html {
  let out = strings[0] ?? "";

  for (let i = 0; i < values.length; i += 1) {
    out += stringify(values[i]) + (strings[i + 1] ?? "");
  }

  return { html: out };
}

/** The last step before the socket. Named so that `res.send(render(page))` reads as one. */
export function render(node: Html): string {
  return node.html;
}

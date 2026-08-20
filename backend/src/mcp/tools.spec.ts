import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ListBooksQuery } from "@bookcsi/shared";
import type { BooksService } from "../books/books.service";
import { registerTools, type ToolContext } from "./tools";

/**
 * §D42 — `search_library`'s new `q`, over the seam that actually carries it.
 *
 * The first spec for `tools.ts`: nothing here was covered before, because every
 * handler is a thin pass-through to a service that has its own suite. `q` is
 * the exception worth testing — it is the one place a tool *transforms* what it
 * was given (trimming, and turning a blank into "no search") rather than
 * handing it straight on, and over MCP the value comes from a model, so
 * `q: " "` is a real input rather than a hypothetical one.
 *
 * A stub `McpServer` that records registrations, and a stub `BooksService` that
 * records the query it was asked for. No Nest context: the registration
 * function takes its dependencies as a plain object, which is the whole reason
 * it can be tested like this.
 */
type Handler = (args: Record<string, unknown>) => Promise<unknown>;

function registerAndCapture() {
  const handlers = new Map<string, Handler>();
  const schemas = new Map<string, Record<string, unknown>>();
  const prose = new Map<string, { title?: string; description?: string }>();

  const server = {
    registerTool: (
      name: string,
      config: {
        inputSchema?: Record<string, unknown>;
        title?: string;
        description?: string;
      },
      handler: Handler,
    ) => {
      handlers.set(name, handler);
      schemas.set(name, config.inputSchema ?? {});
      prose.set(name, { title: config.title, description: config.description });
    },
  } as unknown as McpServer;

  const queries: ListBooksQuery[] = [];
  const books = {
    findAll: (_userId: string, query: ListBooksQuery) => {
      queries.push(query);
      return Promise.resolve([]);
    },
  } as unknown as BooksService;

  registerTools(server, {
    userId: "user-1",
    grantId: "grant-1",
    books,
    // Untouched by the tool under test; the registrations that need them are
    // never invoked here.
    stats: {},
    budget: {},
    categories: { tree: () => Promise.resolve([]) },
    openLibrary: {},
    challenges: {},
    audit: { log: () => undefined },
  } as unknown as ToolContext);

  return { handlers, schemas, queries, prose };
}

describe("search_library (§D42)", () => {
  it("offers q in its input schema", () => {
    const { schemas } = registerAndCapture();

    expect(Object.keys(schemas.get("search_library") ?? {})).toContain("q");
  });

  it("passes the search term down to the listing", async () => {
    const { handlers, queries } = registerAndCapture();

    await handlers.get("search_library")!({ q: "dune" });

    expect(queries[0].q).toBe("dune");
  });

  it("trims what the model sent", async () => {
    const { handlers, queries } = registerAndCapture();

    await handlers.get("search_library")!({ q: "  dune  " });

    expect(queries[0].q).toBe("dune");
  });

  it("treats a blank q as no search rather than as a term", async () => {
    // `contains: ""` matches every row, so an untrimmed blank would be a
    // search that silently stops narrowing — and over MCP nothing upstream
    // validates this the way the HTTP route's schema does.
    const { handlers, queries } = registerAndCapture();

    await handlers.get("search_library")!({ q: "   " });
    await handlers.get("search_library")!({ q: "" });

    expect(queries[0].q).toBeUndefined();
    expect(queries[1].q).toBeUndefined();
  });

  it("leaves q absent when the model did not search", async () => {
    const { handlers, queries } = registerAndCapture();

    await handlers.get("search_library")!({ status: ["WISHLIST"] });

    expect(queries[0].q).toBeUndefined();
    expect(queries[0].status).toEqual(["WISHLIST"]);
  });

  it("combines the search with the filters, as the HTTP route does", async () => {
    const { handlers, queries } = registerAndCapture();

    await handlers.get("search_library")!({
      q: "lem",
      status: ["WISHLIST"],
      category: ["FICTION__SF"],
      favorite: true,
    });

    expect(queries[0]).toMatchObject({
      q: "lem",
      status: ["WISHLIST"],
      category: ["FICTION__SF"],
      favorite: true,
      sort: "createdAt",
      order: "desc",
    });
  });
});

describe("what the tools say (§D44)", () => {
  /**
   * The one diacritic that belongs here: `search_library` documents that the
   * database's collation ignores them, and the only way to show that is with a
   * pair of Romanian words. Everything else being English is the decision this
   * suite guards.
   */
  const COLLATION_EXAMPLE = '"sarpe" finds "Șarpe"';

  const captured = registerAndCapture();

  /** Title, description, and every parameter's own doc — all of it model-facing. */
  function proseOf(name: string): string {
    const { title, description } = captured.prose.get(name) ?? {};
    const params = Object.values(captured.schemas.get(name) ?? {})
      .map((field) => (field as { description?: string }).description ?? "")
      .join(" ");

    return `${title ?? ""} ${description ?? ""} ${params}`;
  }

  it("describes every tool in English, so one set of routing instructions serves both readers", () => {
    expect(captured.prose.size).toBeGreaterThan(0);

    for (const name of captured.prose.keys()) {
      const text = proseOf(name).replace(COLLATION_EXAMPLE, "");

      // Romanian is the only other language in the app, and its diacritics are
      // the cheapest reliable tell that a description slipped back into it.
      // Asserted as an object so a failure names the tool.
      expect({ name, romanian: /[ăâîșțĂÂÎȘȚ]/.test(text) }).toEqual({
        name,
        romanian: false,
      });
    }
  });

  it("keeps the collation example, which needs the diacritic to make its point", () => {
    expect(proseOf("search_library")).toContain(COLLATION_EXAMPLE);
  });

  it("gives every tool a title and a description saying when to call it", () => {
    // The property docs/MCP.md §8 asks for: a description that says *when*,
    // not just *what*, because the model picks the tool from it.
    for (const [name, { title, description }] of captured.prose) {
      expect({ name, hasTitle: Boolean(title) }).toEqual({ name, hasTitle: true });
      expect({ name, saysWhen: /Call this/.test(description ?? "") }).toEqual({
        name,
        saysWhen: true,
      });
    }
  });
});

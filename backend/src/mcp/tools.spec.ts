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

  const server = {
    registerTool: (
      name: string,
      config: { inputSchema?: Record<string, unknown> },
      handler: Handler,
    ) => {
      handlers.set(name, handler);
      schemas.set(name, config.inputSchema ?? {});
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
    openLibrary: {},
    challenges: {},
    audit: { log: () => undefined },
  } as unknown as ToolContext);

  return { handlers, schemas, queries };
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
      genre: "FICTION",
      favorite: true,
    });

    expect(queries[0]).toMatchObject({
      q: "lem",
      status: ["WISHLIST"],
      genre: "FICTION",
      favorite: true,
      sort: "createdAt",
      order: "desc",
    });
  });
});

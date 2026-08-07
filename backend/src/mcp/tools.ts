import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  bookSortSchema,
  createBookSchema,
  genreSchema,
  openLibrarySearchQuerySchema,
  statusSchema,
  updateBookSchema,
  type HttpErrorBody,
  type ListBooksQuery,
} from "@bookcsi/shared";
import type { BooksService } from "../books/books.service";
import type { BudgetService } from "../budget/budget.service";
import { AppError } from "../common/app-error";
import type { OpenLibraryService } from "../openlibrary/open-library.service";
import type { StatsService } from "../stats/stats.service";

/**
 * What every tool handler needs, captured once per `/mcp` request and closed
 * over by each registration — `userId` never flows through `@CurrentUser()`,
 * which only works inside Nest's HTTP param pipeline (docs/MCP.md §7).
 */
export interface ToolContext {
  userId: string;
  books: BooksService;
  stats: StatsService;
  budget: BudgetService;
  openLibrary: OpenLibraryService;
}

function textResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * The SDK already catches whatever a handler throws and reports it as an
 * `isError` result — but only ever off `error.message`, and `AppError`'s
 * `message` is sometimes an array (`AppError.validation`, one sentence per
 * field). Nest's own `HttpException.message` only mirrors a *string*
 * response body, so an array-message `AppError` would otherwise surface here
 * as a generic "AppError", the same gap `OAuthTokenErrorFilter` closes for
 * the OAuth routes. Every tool below catches explicitly instead of trusting
 * the default, so a rejected `add_book` still tells the model which field.
 */
function errorText(error: unknown): string {
  if (error instanceof AppError) {
    const { message } = error.getResponse() as HttpErrorBody;
    return Array.isArray(message) ? message.join("; ") : message;
  }
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

/** docs/MCP.md §9 steps 4–5 — all eight tools, one `library` scope, no branching. */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  const { userId, books, stats, budget, openLibrary } = ctx;

  server.registerTool(
    "search_library",
    {
      title: "Caută în bibliotecă",
      description:
        "Apelează când utilizatorul întreabă ce cărți are, în ce stadiu e o carte, sau vrea o listă " +
        "filtrată după status, gen sau favorite — de exemplu „ce citesc acum” sau „ce am pe wishlist”. " +
        "NU caută cărți din afara bibliotecii personale — pentru asta există search_open_library.",
      inputSchema: {
        status: statusSchema
          .array()
          .min(1)
          .optional()
          .describe("Unul sau mai multe statusuri. Absent înseamnă toată biblioteca."),
        genre: genreSchema.optional().describe("O singură valoare — o carte are un singur gen."),
        favorite: z.boolean().optional().describe("true pentru doar cărțile marcate favorite."),
        sort: bookSortSchema.optional().describe("Implicit createdAt."),
        order: z.enum(["asc", "desc"]).optional().describe("Implicit desc."),
      },
    },
    async (args) => {
      const query: ListBooksQuery = {
        sort: args.sort ?? "createdAt",
        order: args.order ?? "desc",
        status: args.status,
        genre: args.genre,
        favorite: args.favorite,
      };

      const results = await books.findAll(userId, query);

      // A trimmed row per book, not the full `Book` — this tool answers "which
      // ones", and every extra field is context spent for nothing the model
      // asked (docs/MCP.md §8). `get_book` is where the detail lives.
      return textResult(
        results.map((book) => ({
          id: book.id,
          title: book.title,
          author: book.author,
          status: book.status,
          genre: book.genre,
          favorite: book.favorite,
          rating: book.rating,
        })),
      );
    },
  );

  server.registerTool(
    "get_book",
    {
      title: "Detaliile unei cărți",
      description:
        "Apelează când utilizatorul întreabă despre o carte anume și îi știi deja id-ul — de obicei " +
        "din răspunsul lui search_library. NU e o unealtă de căutare: cu un titlu sau un ISBN, dar " +
        "fără id, folosește search_library mai întâi.",
      inputSchema: {
        id: z.string().min(1).describe("Id-ul cărții, așa cum apare în search_library."),
      },
    },
    async (args) => {
      try {
        return textResult(await books.findOne(userId, args.id));
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "add_book",
    {
      title: "Adaugă o carte",
      description:
        "Apelează când utilizatorul cere explicit să adauge o carte în bibliotecă — doar titlul e " +
        "obligatoriu. NU o folosi doar pentru că a fost menționată o carte în conversație; adaugă " +
        "numai la o cerere clară de tipul „adaugă X” sau „pune X pe wishlist”.",
      inputSchema: createBookSchema,
    },
    async (args) => {
      try {
        return textResult(await books.create(userId, args));
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "update_book",
    {
      title: "Modifică o carte",
      description:
        "Apelează pentru orice schimbare pe o carte existentă, inclusiv statusul și progresul de " +
        "citire (pagesRead) — nu există o unealtă separată pentru „am mai citit din ea” sau „am " +
        "terminat-o”, e tot update_book. Trimite doar câmpurile care se schimbă; restul rămân neatinse. " +
        "Ai nevoie de id, din search_library sau get_book.",
      inputSchema: { id: z.string().min(1).describe("Id-ul cărții."), ...updateBookSchema.shape },
    },
    async (args) => {
      const { id, ...input } = args;
      try {
        return textResult(await books.update(userId, id, input));
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "delete_book",
    {
      title: "Șterge o carte",
      description:
        "Apelează doar la o cerere explicită și fără ambiguitate de ștergere — este ireversibil, " +
        "fără coș de gunoi. Dacă utilizatorul pare nesigur, confirmă mai întâi ce carte anume, prin " +
        "search_library sau get_book, înainte să ștergi.",
      inputSchema: { id: z.string().min(1).describe("Id-ul cărții de șters.") },
    },
    async (args) => {
      try {
        await books.remove(userId, args.id);
        return textResult({ deleted: true, id: args.id });
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "get_reading_stats",
    {
      title: "Statistici de citit",
      description:
        "Apelează când utilizatorul întreabă câte cărți a citit, câte pagini, sau care e nota medie — " +
        "de exemplu „câte cărți am citit anul ăsta” sau „ce notă medie dau cărților”. NU calculează " +
        "cheltuieli — pentru bani există get_budget.",
    },
    async () => {
      try {
        return textResult(await stats.overview(userId));
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "get_budget",
    {
      title: "Buget și cheltuieli",
      description:
        "Apelează când utilizatorul întreabă cât a cheltuit pe cărți, cât a mai rămas din buget luna " +
        "asta, sau vrea situația financiară a bibliotecii. NU calculează statistici de citit — pentru " +
        "asta există get_reading_stats.",
    },
    async () => {
      try {
        return textResult(await budget.summary(userId));
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "search_open_library",
    {
      title: "Caută pe Open Library",
      description:
        "Apelează când utilizatorul vrea să găsească o carte care NU e încă în biblioteca sa — " +
        "titlu, autor, o carte nouă de adăugat. NU caută în biblioteca personală — pentru asta există " +
        "search_library. Rezultatul poate fi trimis mai departe la add_book (câmpul olEditionKey aduce " +
        "și coperta).",
      inputSchema: openLibrarySearchQuerySchema,
    },
    async (args) => {
      try {
        return textResult(await openLibrary.search(args.q));
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );
}

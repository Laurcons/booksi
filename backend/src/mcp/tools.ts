import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  bookSortSchema,
  createBookSchema,
  createChallengeSchema,
  genreSchema,
  openLibrarySearchQuerySchema,
  statusSchema,
  updateBookSchema,
  updateChallengeSchema,
  type HttpErrorBody,
  type ListBooksQuery,
} from "@bookcsi/shared";
import type { BooksService } from "../books/books.service";
import type { BudgetService } from "../budget/budget.service";
import type { ChallengesService } from "../challenges/challenges.service";
import { AppError } from "../common/app-error";
import type { AuditService } from "../audit/audit.service";
import type { OpenLibraryService } from "../openlibrary/open-library.service";
import type { StatsService } from "../stats/stats.service";

/**
 * What every tool handler needs, captured once per `/mcp` request and closed
 * over by each registration — `userId` never flows through `@CurrentUser()`,
 * which only works inside Nest's HTTP param pipeline (docs/MCP.md §7).
 */
export interface ToolContext {
  userId: string;
  grantId: string;
  books: BooksService;
  stats: StatsService;
  budget: BudgetService;
  openLibrary: OpenLibraryService;
  challenges: ChallengesService;
  audit: AuditService;
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

/**
 * One JSON-RPC `/mcp` POST can carry several tool calls (docs/MCP.md §7),
 * which is exactly why `AuditInterceptor` logging that one HTTP request isn't
 * enough — it can say a grant hit `/mcp`, not which tools it ran. Every
 * mutating tool below logs itself, right where the actor (`userId`) and the
 * result already are.
 *
 * No literal HTTP status exists per tool call — every outcome, including a
 * tool that reports its own error, still rides back inside one 200 JSON-RPC
 * response — so `statusCode` here is a stand-in that mirrors `outcome`, not a
 * status this request actually received.
 */
function logToolAudit(
  ctx: Pick<ToolContext, "userId" | "grantId" | "audit">,
  action: string,
  outcome: "SUCCESS" | "FAILURE",
  metadata: Prisma.InputJsonObject,
): void {
  ctx.audit.log({
    userId: ctx.userId,
    source: "MCP",
    action,
    method: "MCP",
    route: "/mcp",
    statusCode: outcome === "SUCCESS" ? 200 : 400,
    outcome,
    metadata: { grantId: ctx.grantId, ...metadata },
  });
}

/** docs/MCP.md §9 steps 4–5 — one `library` scope, no branching. */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  const { userId, books, stats, budget, openLibrary, challenges } = ctx;

  server.registerTool(
    "search_library",
    {
      title: "Caută în bibliotecă",
      description:
        "Apelează când utilizatorul întreabă ce cărți are, în ce stadiu e o carte, sau vrea o listă " +
        "filtrată după status, categorie sau favorite — de exemplu „ce citesc acum” sau „ce am pe wishlist”. " +
        "NU caută cărți din afara bibliotecii personale — pentru asta există search_open_library.",
      inputSchema: {
        status: statusSchema
          .array()
          .min(1)
          .optional()
          .describe("Unul sau mai multe statusuri. Absent înseamnă toată biblioteca."),
        genre: genreSchema
          .optional()
          .describe("O singură valoare — o carte are o singură categorie."),
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
        const book = await books.create(userId, args);
        logToolAudit(ctx, "mcp.add_book", "SUCCESS", { bookId: book.id, title: book.title });
        return textResult(book);
      } catch (error) {
        logToolAudit(ctx, "mcp.add_book", "FAILURE", { title: args.title });
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
        const book = await books.update(userId, id, input);
        logToolAudit(ctx, "mcp.update_book", "SUCCESS", { bookId: id, changed: Object.keys(input) });
        return textResult(book);
      } catch (error) {
        logToolAudit(ctx, "mcp.update_book", "FAILURE", { bookId: id });
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
        logToolAudit(ctx, "mcp.delete_book", "SUCCESS", { bookId: args.id });
        return textResult({ deleted: true, id: args.id });
      } catch (error) {
        logToolAudit(ctx, "mcp.delete_book", "FAILURE", { bookId: args.id });
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

  server.registerTool(
    "list_challenges",
    {
      title: "Listează provocările",
      description:
        "Apelează când utilizatorul întreabă ce provocări de citit are, sau cât mai are din una " +
        "anume — de exemplu „ce provocări am” sau „cât mai am de citit din provocarea de vară”. " +
        "Întoarce un rezumat (titlu, termen, câte cărți, câte terminate), nu cărțile complete — " +
        "pentru acelea există get_challenge.",
    },
    async () => {
      try {
        return textResult(await challenges.list(userId));
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "get_challenge",
    {
      title: "Detaliile unei provocări",
      description:
        "Apelează când utilizatorul întreabă despre o provocare anume și îi știi deja id-ul — de " +
        "obicei din răspunsul lui list_challenges. Întoarce și cărțile ei, cu statusul curent al " +
        "fiecăreia, nu doar id-uri.",
      inputSchema: {
        id: z.string().min(1).describe("Id-ul provocării, așa cum apare în list_challenges."),
      },
    },
    async (args) => {
      try {
        return textResult(await challenges.findOne(userId, args.id));
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "create_challenge",
    {
      title: "Creează o provocare",
      description:
        "Apelează când utilizatorul cere explicit să creeze o provocare de citit — un titlu și un " +
        "termen (deadline) sunt obligatorii. Cărțile se pot da direct prin bookIds (id-uri din " +
        "search_library) sau adăugate ulterior cu add_book_to_challenge. NU crea o provocare doar " +
        "fiindcă a fost menționat un termen în conversație — numai la o cerere clară.",
      inputSchema: createChallengeSchema,
    },
    async (args) => {
      try {
        const challenge = await challenges.create(userId, args);
        logToolAudit(ctx, "mcp.create_challenge", "SUCCESS", {
          challengeId: challenge.id,
          title: challenge.title,
        });
        return textResult(challenge);
      } catch (error) {
        logToolAudit(ctx, "mcp.create_challenge", "FAILURE", { title: args.title });
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "update_challenge",
    {
      title: "Modifică o provocare",
      description:
        "Apelează pentru orice schimbare pe titlul, descrierea sau termenul unei provocări " +
        "existente — de exemplu „mută termenul provocării de vară la 15 septembrie”. Apartenența " +
        "cărților nu e aici: pentru asta există add_book_to_challenge și " +
        "remove_book_from_challenge. Trimite doar câmpurile care se schimbă. Ai nevoie de id, din " +
        "list_challenges.",
      inputSchema: {
        id: z.string().min(1).describe("Id-ul provocării."),
        ...updateChallengeSchema.shape,
      },
    },
    async (args) => {
      const { id, ...input } = args;
      try {
        const challenge = await challenges.update(userId, id, input);
        logToolAudit(ctx, "mcp.update_challenge", "SUCCESS", {
          challengeId: id,
          changed: Object.keys(input),
        });
        return textResult(challenge);
      } catch (error) {
        logToolAudit(ctx, "mcp.update_challenge", "FAILURE", { challengeId: id });
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "delete_challenge",
    {
      title: "Șterge o provocare",
      description:
        "Apelează doar la o cerere explicită și fără ambiguitate de ștergere a unei provocări — " +
        "ireversibil, fără coș de gunoi. Cărțile din ea NU se șterg din bibliotecă, doar " +
        "provocarea însăși. Dacă utilizatorul pare nesigur, confirmă mai întâi ce provocare anume, " +
        "prin list_challenges.",
      inputSchema: { id: z.string().min(1).describe("Id-ul provocării de șters.") },
    },
    async (args) => {
      try {
        await challenges.remove(userId, args.id);
        logToolAudit(ctx, "mcp.delete_challenge", "SUCCESS", { challengeId: args.id });
        return textResult({ deleted: true, id: args.id });
      } catch (error) {
        logToolAudit(ctx, "mcp.delete_challenge", "FAILURE", { challengeId: args.id });
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "add_book_to_challenge",
    {
      title: "Adaugă o carte la o provocare",
      description:
        "Apelează pentru a adăuga o carte deja existentă în bibliotecă la o provocare — de " +
        "exemplu „pune Dune în provocarea de vară”. Ai nevoie de id-ul cărții (din search_library " +
        "sau get_book) și de id-ul provocării (din list_challenges). NU creează cartea — dacă nu " +
        "există încă în bibliotecă, folosește întâi add_book. Idempotentă: dacă e deja acolo, nu e " +
        "o eroare.",
      inputSchema: {
        challengeId: z.string().min(1).describe("Id-ul provocării."),
        bookId: z.string().min(1).describe("Id-ul cărții de adăugat."),
      },
    },
    async (args) => {
      try {
        const challenge = await challenges.addBook(userId, args.challengeId, args.bookId);
        logToolAudit(ctx, "mcp.add_book_to_challenge", "SUCCESS", {
          challengeId: args.challengeId,
          bookId: args.bookId,
        });
        return textResult(challenge);
      } catch (error) {
        logToolAudit(ctx, "mcp.add_book_to_challenge", "FAILURE", {
          challengeId: args.challengeId,
          bookId: args.bookId,
        });
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "remove_book_from_challenge",
    {
      title: "Scoate o carte dintr-o provocare",
      description:
        "Apelează pentru a scoate o carte dintr-o provocare, fără s-o ștergi din bibliotecă — " +
        "pentru asta există delete_book, o unealtă separată și distructivă. Idempotentă la fel ca " +
        "add_book_to_challenge: o carte care nu e pe listă lasă provocarea neschimbată.",
      inputSchema: {
        challengeId: z.string().min(1).describe("Id-ul provocării."),
        bookId: z.string().min(1).describe("Id-ul cărții de scos."),
      },
    },
    async (args) => {
      try {
        const challenge = await challenges.removeBook(userId, args.challengeId, args.bookId);
        logToolAudit(ctx, "mcp.remove_book_from_challenge", "SUCCESS", {
          challengeId: args.challengeId,
          bookId: args.bookId,
        });
        return textResult(challenge);
      } catch (error) {
        logToolAudit(ctx, "mcp.remove_book_from_challenge", "FAILURE", {
          challengeId: args.challengeId,
          bookId: args.bookId,
        });
        return errorResult(errorText(error));
      }
    },
  );
}

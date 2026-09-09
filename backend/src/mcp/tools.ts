import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  bookSortSchema,
  categoryCodeSchema,
  createAuthorSchema,
  createBookSchema,
  createChallengeSchema,
  openLibrarySearchQuerySchema,
  statusSchema,
  updateAuthorSchema,
  updateBookSchema,
  updateChallengeSchema,
  type HttpErrorBody,
  type ListBooksQuery,
} from "@bookcsi/shared";
import type { AuthorsService } from "../authors/authors.service";
import type { BooksService } from "../books/books.service";
import type { BudgetService } from "../budget/budget.service";
import type { CategoriesService } from "../categories/categories.service";
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
  authors: AuthorsService;
  books: BooksService;
  stats: StatsService;
  budget: BudgetService;
  categories: CategoriesService;
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
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * One JSON-RPC `/mcp` POST can carry several tool calls (docs/MCP.md §7),
 * which is exactly why `AuditInterceptor` logging that one HTTP request isn't
 * enough — it can say a grant hit `/mcp`, not which tools it ran. Every
 * mutating tool below logs itself on success, right where the actor (`userId`)
 * and the result already are.
 *
 * Success only (§D46): a tool that fails reports the error back to the model
 * but leaves no audit row, the same rule the HTTP interceptor follows. Every
 * tool call rides back inside one 200 JSON-RPC response, so `statusCode` is a
 * constant stand-in, not a status this request actually received.
 */
function logToolAudit(
  ctx: Pick<ToolContext, "userId" | "grantId" | "audit">,
  action: string,
  metadata: Prisma.InputJsonObject,
): void {
  ctx.audit.log({
    userId: ctx.userId,
    source: "MCP",
    action,
    method: "MCP",
    route: "/mcp",
    statusCode: 200,
    metadata: { grantId: ctx.grantId, ...metadata },
  });
}

/**
 * docs/MCP.md §9 steps 4–5 — one `library` scope, no branching.
 *
 * ## Everything a tool says is in English (§D44)
 *
 * The interface has two languages; this file has one, and deliberately not the
 * user's. Titles, descriptions, parameter docs and error text here are read by a
 * **model**, not by a person: they are routing instructions ("call this when…",
 * "this does NOT search the library, use X"), and their whole job is to be
 * matched against a request in whatever language the user happens to be typing.
 * A model reads both of ours equally well, so translating them would double the
 * surface that has to stay in step — two copies of the same steering, each able
 * to drift — and buy nothing.
 *
 * The one place the user's language *does* reach in is `update_book`, which asks
 * for a book's description to be written in the language the user is writing in.
 * That is data going into their library, not instructions coming out of ours.
 *
 * The consent screen a person approves is a different matter and is translated
 * like any other screen — see `frontend/src/pages/McpConsentPage.tsx`.
 */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  const { userId, authors, books, stats, budget, categories, openLibrary, challenges } =
    ctx;

  server.registerTool(
    "list_categories",
    {
      title: "List the categories",
      description:
        "Call this to discover the category codes the library files books under, before using " +
        "`category` in search_library or `categories` in add_book / update_book. Returns the shelving " +
        "scheme as groups (headings, not selectable) each holding their categories (the shelves, the " +
        "selectable leaves). Labels are English; codes are what the other tools take. This is a small, " +
        "near-static list — fetch it once per conversation, not before every call.",
      inputSchema: {},
    },
    async () => {
      const tree = await categories.tree();
      // English labels only — a model reads this (§D44), so the ro/en split the
      // frontends need is spent context here. Flattened to (group, code, label).
      return textResult(
        tree.map((group) => ({
          group: group.labelEn,
          categories: group.categories.map((category) => ({
            code: category.code,
            label: category.labelEn,
          })),
        })),
      );
    },
  );

  /* ------------------------------------------------------------------ *
   * §D51 — authors
   * ------------------------------------------------------------------ */

  server.registerTool(
    "list_authors",
    {
      title: "List the authors",
      description:
        "Call this to find an author's id before setting `authorId` on add_book or update_book, " +
        "and to check whether an author already exists before create_author. Returns every author " +
        "in the user's library with the number of books each one has.\n\n" +
        "`q` narrows by name and ignores case and diacritics, so \"calin\" finds \"Călinescu\". " +
        "Prefer it over listing everything when you are after one person.\n\n" +
        "Biographies are not included — they can be several paragraphs. get_book returns the " +
        "biography of the author of that book.",
      inputSchema: {
        q: z
          .string()
          .optional()
          .describe("Filter by name, case- and diacritic-insensitive. Absent means every author."),
      },
    },
    async (args) => {
      // Trimmed here rather than trusted, the same as `search_library`'s `q`:
      // over MCP the value comes from a model, and `" "` would otherwise reach
      // the query as a filter that matches every row.
      const q = args.q?.trim() === "" ? undefined : args.q?.trim();

      return textResult(await authors.findAll(userId, { q }));
    },
  );

  server.registerTool(
    "create_author",
    {
      title: "Create an author",
      description:
        "Call this ONLY when the user wants a book attributed to an author who is not in " +
        "list_authors yet. **Check list_authors first, every time.** An author is a shared row: " +
        "every book by that person points at it, and one biography covers all of them, so a " +
        "second row for a name that is already there splits a shelf in two and the user has to " +
        "find and undo it.\n\n" +
        "In the interface this takes a deliberate click for exactly that reason — a misspelling " +
        "must not silently become a person (§D51). A tool call is your equivalent of that click, " +
        "so make it on purpose: if you are unsure whether \"Le Guin\" is the \"Ursula K. Le Guin\" " +
        "already in the library, ask the user rather than creating a second one.\n\n" +
        "Name only. The biography is written afterwards with update_author. Calling this with a " +
        "name that already exists returns the existing author rather than a duplicate, so a " +
        "collision is safe — but it is not a substitute for looking first.",
      inputSchema: createAuthorSchema.shape,
    },
    async (args) => {
      try {
        const author = await authors.create(userId, args);
        logToolAudit(ctx, "mcp.create_author", { authorId: author.id, name: author.name });
        return textResult(author);
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "update_author",
    {
      title: "Write an author's biography",
      description:
        "Call this to fill in or change what is known about an author. Like a book's description, " +
        "bookcsi fetches this from nowhere — you are the source: find out who the person is and " +
        "write it in **the language the user is writing to you in**, in the third person.\n\n" +
        "**It applies to every book by that author**, which is the whole point of the field and " +
        "also the care it needs: you are not annotating the book that came up in conversation, you " +
        "are writing the entry for a person. Keep it about their life and work, not about one " +
        "novel — that belongs in the book's `description`.\n\n" +
        "`null` clears it. The name cannot be changed here, or anywhere: correcting a typo and " +
        "merging two people are the same request on the wire, and the second one would rewrite " +
        "every book that pointed at the old name (§D51).",
      inputSchema: {
        id: z.string().min(1).describe("The author's id, from list_authors."),
        ...updateAuthorSchema.shape,
      },
    },
    async (args) => {
      const { id, ...input } = args;
      try {
        const author = await authors.update(userId, id, input);
        logToolAudit(ctx, "mcp.update_author", { authorId: id });
        return textResult(author);
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  /**
   * There is deliberately **no `delete_author`**.
   *
   * Deleting one is irreversible, reaches books the request never named
   * (`onDelete: SetNull`), and the interface only allows it behind a
   * confirmation that states how many books are about to lose their author —
   * a sentence a model cannot show and a user cannot answer mid-tool-call. The
   * housekeeping stays in the picker that owns it (§D51).
   */

  server.registerTool(
    "search_library",
    {
      title: "Search the library",
      description:
        "Call this when the user asks what books they own, what state a book is in, or wants a list " +
        "filtered by status, category or favourites — \"what am I reading now\", \"what is on my wishlist\". " +
        "With `q` it searches free text across title, author, publisher, ISBN and description — " +
        "\"do I have anything by Eco?\". Prefer `q` over listing the whole library when the question is " +
        "about one particular book: the answer is shorter and easier to read.\n\n" +
        "It does NOT find books outside the user's own library — use search_open_library for that.",
      inputSchema: {
        q: z
          .string()
          .optional()
          .describe(
            "Free text, matched against title, author, publisher, ISBN and description. Several " +
              "words are matched separately, each free to hit a different field (\"herbert dune\"), " +
              "and every word must appear somewhere. Case and diacritics are ignored: \"sarpe\" " +
              "finds \"Șarpe\". Combines with the filters below.",
          ),
        status: statusSchema
          .array()
          .min(1)
          .optional()
          .describe("One or more statuses. Absent means the whole library."),
        category: categoryCodeSchema
          .array()
          .min(1)
          .optional()
          .describe(
            "One or more category codes (from list_categories). A book matches if it sits on any " +
              "of them. Absent means every category.",
          ),
        favorite: z.boolean().optional().describe("true for only the books marked as favourites."),
        sort: bookSortSchema.optional().describe("Defaults to createdAt."),
        order: z.enum(["asc", "desc"]).optional().describe("Defaults to desc."),
      },
    },
    async (args) => {
      const query: ListBooksQuery = {
        sort: args.sort ?? "createdAt",
        order: args.order ?? "desc",
        status: args.status,
        category: args.category,
        favorite: args.favorite,
        // Trimmed here rather than trusted: over MCP the value comes from a
        // model, and `q: " "` would otherwise reach `searchWhere` as a term
        // that matches every row — a search that silently stops narrowing.
        // The HTTP route gets the same treatment from the schema itself.
        q: args.q?.trim() === "" ? undefined : args.q?.trim(),
      };

      const results = await books.findAll(userId, query);

      // A trimmed row per book, not the full `Book` — this tool answers "which
      // ones", and every extra field is context spent for nothing the model
      // asked (docs/MCP.md §8). `get_book` is where the detail lives.
      //
      // `description` is the field that makes this rule bite rather than merely
      // tidy (§D40): it is prose, up to 5000 characters of it, and a library
      // that answered "what books do I have" with one per book would spend more
      // context on synopses nobody asked for than on the answer.
      return textResult(
        results.map((book) => ({
          id: book.id,
          title: book.title,
          author: book.author,
          status: book.status,
          categories: book.categories,
          favorite: book.favorite,
          rating: book.rating,
        })),
      );
    },
  );

  server.registerTool(
    "get_book",
    {
      title: "One book in full",
      description:
        "Call this when the user asks about one particular book and you already know its id — " +
        "usually from search_library's answer. Returns every field, including the description and " +
        "the user's own review if they wrote one. This is NOT a search tool: given a title or an " +
        "ISBN but no id, call search_library first.",
      inputSchema: {
        id: z.string().min(1).describe("The book's id, as returned by search_library."),
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
      title: "Add a book",
      description:
        "Call this when the user explicitly asks to add a book to the library — only the title is " +
        "required, but you may also fill in description (a summary you write yourself) if asked. " +
        "Do NOT call it merely because a book came up in conversation; add only on a clear request " +
        "such as \"add X\" or \"put X on my wishlist\".\n\n" +
        "`authorId` is an **id, never a name** (§D51). Call list_authors to find the author, and " +
        "create_author only if they are genuinely not there yet — a name you half-remember or " +
        "spelled differently must not become a second person in the library. If you cannot " +
        "confidently resolve the author, add the book without one and say so; the reader fixes it " +
        "in one click, which is cheaper than a duplicate they have to find first.",
      inputSchema: createBookSchema,
    },
    async (args) => {
      try {
        const book = await books.create(userId, args);
        logToolAudit(ctx, "mcp.add_book", { bookId: book.id, title: book.title });
        return textResult(book);
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "update_book",
    {
      title: "Change a book",
      description:
        "Call this for any change to an existing book, including its status and reading progress " +
        "(pagesRead) — there is no separate tool for \"I read some more of it\" or \"I finished it\", " +
        "it is all update_book. The book's description is written here too: if the user asks you to " +
        "fill it in, find out what the book is about and write a summary in **the language the user " +
        "is writing to you in**, in the third person, with no spoilers — bookcsi fetches " +
        "descriptions from nowhere, you are the source. Send only the fields that change; the rest " +
        "are left untouched. You need the id, from search_library or get_book.\n\n" +
        "`review` is a different kind of field and the difference matters: it is what the *reader* " +
        "thought of the book, in their own voice, and you are not its author. Write it when the " +
        "user dictates or asks you to tidy up their own words, at any status — a book abandoned " +
        "halfway is worth a review and cannot take a rating. Never invent one, never summarise the " +
        "book into it (that is `description`), and never write about a book on the user\'s behalf " +
        "because it seems like something they would say.\n\n" +
        "`authorId` is an **id, never a name** (§D51) — see add_book. `null` removes the book\'s " +
        "author without touching the author itself.",
      inputSchema: { id: z.string().min(1).describe("The book's id."), ...updateBookSchema.shape },
    },
    async (args) => {
      const { id, ...input } = args;
      try {
        const book = await books.update(userId, id, input);
        logToolAudit(ctx, "mcp.update_book", { bookId: id, changed: Object.keys(input) });
        return textResult(book);
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "delete_book",
    {
      title: "Delete a book",
      description:
        "Call this only on an explicit and unambiguous request to delete — it is irreversible, " +
        "there is no wastebasket. If the user seems unsure, confirm which book is meant first, via " +
        "search_library or get_book, before deleting.",
      inputSchema: { id: z.string().min(1).describe("The id of the book to delete.") },
    },
    async (args) => {
      try {
        await books.remove(userId, args.id);
        logToolAudit(ctx, "mcp.delete_book", { bookId: args.id });
        return textResult({ deleted: true, id: args.id });
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "get_reading_stats",
    {
      title: "Reading statistics",
      description:
        "Call this when the user asks how many books they have read, how many pages, or what their " +
        "average rating is — \"how many books have I read this year\", \"what do I rate books on " +
        "average\". It does NOT work out spending — use get_budget for money.",
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
      title: "Budget and spending",
      description:
        "Call this when the user asks how much they have spent on books, how much of this month's " +
        "budget is left, or wants the library's financial picture. It does NOT work out reading " +
        "statistics — use get_reading_stats for that.",
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
      title: "Search Open Library",
      description:
        "Call this when the user wants to find a book that is NOT in their library yet — a title, " +
        "an author, something new to add. It does NOT search the personal library — use " +
        "search_library for that. A result can be passed straight on to add_book (the olEditionKey " +
        "field brings the cover with it).",
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
      title: "List the challenges",
      description:
        "Call this when the user asks what reading challenges they have, or how much of one is " +
        "left — \"what challenges do I have\", \"how much is left of the summer challenge\". Returns " +
        "a summary (title, deadline, how many books, how many finished), not the books themselves — " +
        "use get_challenge for those.",
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
      title: "One challenge in full",
      description:
        "Call this when the user asks about one particular challenge and you already know its id — " +
        "usually from list_challenges' answer. Returns its books too, each with its current status, " +
        "not just ids.",
      inputSchema: {
        id: z.string().min(1).describe("The challenge's id, as returned by list_challenges."),
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
      title: "Create a challenge",
      description:
        "Call this when the user explicitly asks to create a reading challenge — a title and a " +
        "deadline are required. Books can be given straight away through bookIds (ids from " +
        "search_library) or added later with add_book_to_challenge. Do NOT create a challenge " +
        "merely because a deadline came up in conversation — only on a clear request.",
      inputSchema: createChallengeSchema,
    },
    async (args) => {
      try {
        const challenge = await challenges.create(userId, args);
        logToolAudit(ctx, "mcp.create_challenge", {
          challengeId: challenge.id,
          title: challenge.title,
        });
        return textResult(challenge);
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "update_challenge",
    {
      title: "Change a challenge",
      description:
        "Call this for any change to an existing challenge's title, description or deadline — " +
        "\"move the summer challenge's deadline to 15 September\". Which books belong to it is not " +
        "here: use add_book_to_challenge and remove_book_from_challenge for that. Send only the " +
        "fields that change. You need the id, from list_challenges.",
      inputSchema: {
        id: z.string().min(1).describe("The challenge's id."),
        ...updateChallengeSchema.shape,
      },
    },
    async (args) => {
      const { id, ...input } = args;
      try {
        const challenge = await challenges.update(userId, id, input);
        logToolAudit(ctx, "mcp.update_challenge", {
          challengeId: id,
          changed: Object.keys(input),
        });
        return textResult(challenge);
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "delete_challenge",
    {
      title: "Delete a challenge",
      description:
        "Call this only on an explicit and unambiguous request to delete a challenge — " +
        "irreversible, no wastebasket. The books in it are NOT removed from the library, only the " +
        "challenge itself. If the user seems unsure, confirm which challenge is meant first, via " +
        "list_challenges.",
      inputSchema: { id: z.string().min(1).describe("The id of the challenge to delete.") },
    },
    async (args) => {
      try {
        await challenges.remove(userId, args.id);
        logToolAudit(ctx, "mcp.delete_challenge", { challengeId: args.id });
        return textResult({ deleted: true, id: args.id });
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "add_book_to_challenge",
    {
      title: "Add a book to a challenge",
      description:
        "Call this to add a book that already exists in the library to a challenge — \"put Dune in " +
        "the summer challenge\". You need the book's id (from search_library or get_book) and the " +
        "challenge's id (from list_challenges). It does NOT create the book — if it is not in the " +
        "library yet, call add_book first. Idempotent: a book already there is not an error.",
      inputSchema: {
        challengeId: z.string().min(1).describe("The challenge's id."),
        bookId: z.string().min(1).describe("The id of the book to add."),
      },
    },
    async (args) => {
      try {
        const challenge = await challenges.addBook(userId, args.challengeId, args.bookId);
        logToolAudit(ctx, "mcp.add_book_to_challenge", {
          challengeId: args.challengeId,
          bookId: args.bookId,
        });
        return textResult(challenge);
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );

  server.registerTool(
    "remove_book_from_challenge",
    {
      title: "Take a book out of a challenge",
      description:
        "Call this to take a book out of a challenge without deleting it from the library — " +
        "delete_book is the separate, destructive tool for that. Idempotent, like " +
        "add_book_to_challenge: a book that is not on the list leaves the challenge unchanged.",
      inputSchema: {
        challengeId: z.string().min(1).describe("The challenge's id."),
        bookId: z.string().min(1).describe("The id of the book to take out."),
      },
    },
    async (args) => {
      try {
        const challenge = await challenges.removeBook(userId, args.challengeId, args.bookId);
        logToolAudit(ctx, "mcp.remove_book_from_challenge", {
          challengeId: args.challengeId,
          bookId: args.bookId,
        });
        return textResult(challenge);
      } catch (error) {
        return errorResult(errorText(error));
      }
    },
  );
}

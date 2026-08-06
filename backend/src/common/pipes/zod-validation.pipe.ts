import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";

/**
 * Validates a body or a query against a schema from `shared/`, so that the API
 * and the form on the other side enforce the same rules from the same object.
 *
 * It is applied per parameter — `@Body(new ZodValidationPipe(createBookSchema))`
 * — rather than registered globally. A global pipe would need a second,
 * reflection-based channel to discover which schema belongs to which route;
 * naming the schema at the parameter is the same information, visible.
 *
 * Failures come back as Nest's ordinary error body, with `message` listing one
 * sentence per problem. This used to be a field-keyed object, on the reasoning
 * that react-hook-form attaches messages to inputs by path — but nothing on the
 * client ever read it: `apiFetch` takes `message` and drops the rest, so every
 * rejected save showed the literal words "Validation failed" and no indication
 * of which field. Prefixing the path onto the sentence puts that information
 * back where it is actually read.
 */
@Injectable()
export class ZodValidationPipe<Schema extends z.ZodType>
  implements PipeTransform<unknown, z.output<Schema>>
{
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.output<Schema> {
    const parsed = this.schema.safeParse(value);

    if (!parsed.success) {
      throw new BadRequestException(messages(parsed.error));
    }

    return parsed.data;
  }
}

/**
 * One sentence per issue, each naming its field. An issue on the object itself
 * — an unrecognised key, say — has an empty path and stands on its own, which
 * is why the path is prefixed rather than assumed.
 */
function messages(error: z.ZodError): string[] {
  return error.issues.map((issue) =>
    issue.path.length > 0
      ? `${issue.path.join(".")}: ${issue.message}`
      : issue.message,
  );
}

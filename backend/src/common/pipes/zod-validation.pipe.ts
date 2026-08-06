import { Injectable, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";
import { validationFailed } from "../validation-error";

/**
 * Validates a body or a query against a schema from `shared/`, so that the API
 * and the form on the other side enforce the same rules from the same object.
 *
 * It is applied per parameter — `@Body(new ZodValidationPipe(createBookSchema))`
 * — rather than registered globally. A global pipe would need a second,
 * reflection-based channel to discover which schema belongs to which route;
 * naming the schema at the parameter is the same information, visible.
 *
 * Failures come back field-keyed rather than as a flat sentence, because
 * react-hook-form attaches them to inputs by path.
 */
@Injectable()
export class ZodValidationPipe<Schema extends z.ZodType>
  implements PipeTransform<unknown, z.output<Schema>>
{
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.output<Schema> {
    const parsed = this.schema.safeParse(value);

    if (!parsed.success) {
      throw validationFailed(fieldErrors(parsed.error));
    }

    return parsed.data;
  }
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    // An issue on the object itself (an unknown key, say) has an empty path;
    // it still has to be reported somewhere the client can find it.
    const path = issue.path.length > 0 ? issue.path.join(".") : "_";
    (errors[path] ??= []).push(issue.message);
  }

  return errors;
}

import { toNestErrors, validateFieldsNatively } from "@hookform/resolvers";
import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod/v4";

/**
 * react-hook-form resolver for zod v4 schemas.
 *
 * The version of `@hookform/resolvers/zod` installed here is the zod v3
 * resolver: it reads `error.errors` and re-throws anything else. zod v4's
 * `ZodError` exposes `issues` (not `errors`), so the stock resolver throws an
 * uncaught error on validation failure. Our shared drizzle-zod schemas are zod
 * v4 (drizzle-zod >=0.8 emits v4), so the forms that consume them must use this
 * resolver instead. Local `z.object` form schemas elsewhere stay on the v3
 * `zodResolver`.
 */
export function zodV4Resolver<TFieldValues extends FieldValues = FieldValues>(
  schema: ZodType,
): Resolver<TFieldValues> {
  return async (values, _context, options) => {
    const result = await schema.safeParseAsync(values);

    if (!result.success) {
      const errors: Record<string, { type: string; message: string }> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.map((segment) => String(segment)).join(".");
        if (!errors[path]) {
          errors[path] = {
            type: issue.code ?? "validation",
            message: issue.message,
          };
        }
      }
      return {
        values: {},
        errors: toNestErrors(errors, options) as FieldErrors<TFieldValues>,
      };
    }

    if (options.shouldUseNativeValidation) {
      validateFieldsNatively({}, options);
    }

    return { values: result.data as TFieldValues, errors: {} };
  };
}

import { text } from "drizzle-orm/sqlite-core"
import { z } from "zod"

/**
 * Trimmed text with something in it. Absent text is `null`, never `""` — so a
 * missing value is one check (`== null` / `??`), not two.
 */
export function nonEmptyString({ max, error }: { max?: number; error?: string } = {}) {
  const text = z.string({ error }).trim().min(1, { error })
  return (max === undefined ? text : text.max(max)).brand<"NonEmptyString">()
}
export type NonEmptyString = z.infer<ReturnType<typeof nonEmptyString>>

function blankToNull(value: string | null | undefined): string | null {
  const text = value?.trim()
  return text ? text : null
}

/** Outside text (CSV cells, form fields): blank or missing becomes `null`. */
export function optionalText(options: { max?: number } = {}) {
  return z.preprocess(blankToNull, nonEmptyString(options).nullable())
}

/** Like `optionalText`, but blank fails with `error`. */
export function requiredText(options: { max?: number; error?: string } = {}) {
  return z.preprocess(blankToNull, nonEmptyString(options))
}

/** Nullable text column that only takes `NonEmptyString` — write `null`, never `""`. */
export function nonEmptyText(name: string) {
  return text(name).$type<NonEmptyString>()
}

import { z } from "zod";

export const bookmarkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  site: z.string(),
  slug: z.string(),
  comicProfilePic: z.string().nullable(),
  lastChapter: z.number().nullable(),
  lastCheckedAt: z.iso.datetime().nullable(),
  /** Latest chapter needs payment or early access on the source. */
  newChapterIsLocked: z.boolean().default(false),
});
export type Bookmark = z.infer<typeof bookmarkSchema>;

export const importResultSchema = z.object({
  imported: z.number().int(),
  skipped: z.number().int(),
  failedScrapes: z.number().int(),
});
export type ImportResult = z.infer<typeof importResultSchema>;

/** Result of checking a single bookmark: GET /bookmark/:id/check */
export const checkResultSchema = z.object({
  id: z.string(),
  lastChapter: z.number().nullable(),
  hasNewChapter: z.boolean(),
  checked: z.boolean(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

/** One row of a batch check. Adds the title and an optional skip reason. */
export const batchCheckItemSchema = checkResultSchema.extend({
  title: z.string().nullable(),
  skippedReason: z.literal("recently checked").optional(),
});
export type BatchCheckItem = z.infer<typeof batchCheckItemSchema>;

export const batchCheckResultSchema = z.object({
  total: z.number().int(),
  checked: z.number().int(),
  newChapters: z.array(batchCheckItemSchema),
  failed: z.number().int(),
  skipped: z.number().int(),
});
export type BatchCheckResult = z.infer<typeof batchCheckResultSchema>;

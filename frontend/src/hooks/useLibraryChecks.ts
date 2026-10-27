import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { getErrorMessage } from "../api/apiInstance.api";
import type { BatchCheckResult, Bookmark } from "../type/bookmark.type";
import type { NewChapter } from "../type/library.type";
import { bookmarkTitle, type BookmarkStatus } from "../utils/bookmarks";
import { formatChapter, pluralize } from "../utils/format";
import { useCheckAllBookmarks, useCheckBookmark } from "./useBookmark";

const withId = (set: ReadonlySet<string>, id: string) => new Set(set).add(id);
const withoutId = (set: ReadonlySet<string>, id: string) => {
  const next = new Set(set);
  next.delete(id);
  return next;
};

/**
 * Session-only state for the library: which series are being checked, which
 * failed, and which have a new chapter. The server stores the latest chapter,
 * so "new" only exists between a check and the next reload.
 */
export function useLibraryChecks(bookmarks: Bookmark[]) {
  const { mutateAsync: checkOneAsync } = useCheckBookmark();
  const { mutateAsync: checkAllAsync, isPending: isCheckingAll } = useCheckAllBookmarks();

  const [checkingIds, setCheckingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [issueIds, setIssueIds] = useState<ReadonlySet<string>>(() => new Set());
  const [updates, setUpdates] = useState<ReadonlyMap<string, NewChapter>>(() => new Map());
  const [lastRun, setLastRun] = useState<BatchCheckResult | null>(null);

  // Snapshot of chapters as the list last showed them, to work out "Prev Ch."
  const knownChapters = useRef<Map<string, number | null>>(new Map());
  useEffect(() => {
    knownChapters.current = new Map(bookmarks.map((b) => [b.id, b.lastChapter]));
  }, [bookmarks]);

  const recordUpdate = useCallback((id: string, update: NewChapter) => {
    setUpdates((current) => new Map(current).set(id, update));
  }, []);

  const checkOne = useCallback(
    async (bookmark: Bookmark) => {
      const title = bookmarkTitle(bookmark);
      setCheckingIds((ids) => withId(ids, bookmark.id));
      setIssueIds((ids) => withoutId(ids, bookmark.id));

      try {
        const result = await checkOneAsync(bookmark.id);
        if (!result.checked) {
          setIssueIds((ids) => withId(ids, bookmark.id));
          toast.error(`Couldn't check ${title}.`);
        } else if (result.hasNewChapter) {
          recordUpdate(bookmark.id, { from: bookmark.lastChapter, to: result.lastChapter });
          toast.success(`${title}: chapter ${formatChapter(result.lastChapter)} is out.`);
        } else {
          toast.success(`${title} is up to date.`);
        }
      } catch (error) {
        setIssueIds((ids) => withId(ids, bookmark.id));
        toast.error(getErrorMessage(error));
      } finally {
        setCheckingIds((ids) => withoutId(ids, bookmark.id));
      }
    },
    [checkOneAsync, recordUpdate],
  );

  /** `silent` skips the "nothing new" toasts, for the automatic check on page open. */
  const checkAll = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const before = new Map(knownChapters.current);

      try {
        const result = await checkAllAsync();
        setLastRun(result);

        for (const item of result.newChapters) {
          recordUpdate(item.id, { from: before.get(item.id) ?? null, to: item.lastChapter });
        }

        const found = result.newChapters.length;
        if (found > 0) {
          toast.success(`${found} new ${pluralize(found, "chapter")} found.`);
        } else if (!silent) {
          toast.success(
            result.checked === 0 ? "Everything was checked recently." : "No new chapters yet.",
          );
        }
        if (result.failed > 0) {
          toast.error(`${result.failed} ${pluralize(result.failed, "series", "series")} could not be checked.`);
        }
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [checkAllAsync, recordUpdate],
  );

  const markSeen = useCallback((id: string) => {
    setUpdates((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }, []);

  /** Clears every new-chapter marker found in this session. */
  const markAllSeen = useCallback(() => {
    setUpdates((current) => (current.size === 0 ? current : new Map()));
  }, []);

  const statusOf = useCallback(
    (id: string): BookmarkStatus => {
      if (isCheckingAll || checkingIds.has(id)) return "checking";
      if (issueIds.has(id)) return "issue";
      if (updates.has(id)) return "new";
      return "idle";
    },
    [isCheckingAll, checkingIds, issueIds, updates],
  );

  return {
    updates,
    lastRun,
    isCheckingAll,
    statusOf,
    checkOne,
    checkAll,
    markSeen,
    markAllSeen,
  };
}

export type LibraryChecks = ReturnType<typeof useLibraryChecks>;

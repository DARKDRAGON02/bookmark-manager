import { useEffect, useMemo, useRef, useState } from "react";
import { FiAlertCircle, FiUploadCloud } from "react-icons/fi";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { getErrorMessage } from "../api/apiInstance.api";
import BookmarkCardSkeleton from "../components/BookmarkCardSkeleton";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import Navbar from "../components/Navbar";
import NewReleasesBanner from "../components/NewReleasesBanner";
import StatusBar from "../components/StatusBar";
import { useBookmarks } from "../hooks/useBookmark";
import { useLibraryChecks } from "../hooks/useLibraryChecks";
import type { Bookmark } from "../type/bookmark.type";
import { bookmarkTitle, latestCheck, type LibraryFilter } from "../utils/bookmarks";
import { buttonStyles } from "../utils/buttonStyles";
import { pluralize } from "../utils/format";
import Library from "./Library";

const NO_BOOKMARKS: Bookmark[] = [];

const Home = () => {
  const bookmarksQuery = useBookmarks();
  const bookmarks = bookmarksQuery.data ?? NO_BOOKMARKS;

  const checks = useLibraryChecks(bookmarks);
  const { checkAll, markAllSeen, updates, lastRun } = checks;

  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [dismissedAt, setDismissedAt] = useState(0);

  // Check every series once when the library is opened. The server skips
  // anything it checked recently, so this is cheap on repeat visits.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (autoChecked.current || bookmarks.length === 0) return;
    autoChecked.current = true;
    void checkAll({ silent: true });
  }, [bookmarks.length, checkAll]);

  const releases = useMemo(
    () =>
      bookmarks
        .filter((bookmark) => updates.has(bookmark.id))
        .map((bookmark) => ({
          id: bookmark.id,
          title: bookmarkTitle(bookmark),
          chapter: updates.get(bookmark.id)?.to ?? bookmark.lastChapter,
        })),
    [bookmarks, updates],
  );

  const failed = bookmarksQuery.isError;
  const loading = !failed && bookmarksQuery.isPending;

  const retry = () => void bookmarksQuery.refetch();

  /** Clears every "new" badge for this session and hides the banner. */
  const markAllRead = () => {
    if (releases.length === 0) return;

    const count = releases.length;
    markAllSeen();
    // A future batch must surface even if the banner was dismissed earlier.
    setDismissedAt(0);
    toast.success(`${count} ${pluralize(count, "chapter")} marked as read.`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar seriesCount={bookmarks.length} newCount={releases.length} />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-6 sm:px-6">
        {releases.length > dismissedAt && (
          <NewReleasesBanner
            items={releases}
            onView={() => setFilter("new")}
            onMarkAllRead={markAllRead}
            onDismiss={() => setDismissedAt(releases.length)}
          />
        )}

        {failed ? (
          <EmptyState
            icon={<FiAlertCircle aria-hidden />}
            title="Couldn't load your library"
            description={getErrorMessage(bookmarksQuery.error)}
            action={<Button variant="secondary" onClick={retry}>Try again</Button>}
          />
        ) : loading ? (
          <div aria-busy className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <BookmarkCardSkeleton key={index} />
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <EmptyState
            icon={<FiUploadCloud aria-hidden />}
            title="Your library is empty"
            description="Import a bookmarks export to start tracking chapters."
            action={
              <Link to="/" className={buttonStyles({ variant: "primary" })}>
                Import bookmarks
              </Link>
            }
          />
        ) : (
          <Library bookmarks={bookmarks} checks={checks} filter={filter} onFilterChange={setFilter} />
        )}
      </main>

      <StatusBar total={bookmarks.length} lastCheckedAt={latestCheck(bookmarks)} lastRun={lastRun} />
    </div>
  );
};

export default Home;

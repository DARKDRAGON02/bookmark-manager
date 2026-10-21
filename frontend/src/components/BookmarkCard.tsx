import { FiAlertTriangle, FiClock, FiExternalLink, FiLock, FiRefreshCw } from "react-icons/fi";
import type { Bookmark } from "../type/bookmark.type";
import type { NewChapter } from "../type/library.type";
import { bookmarkTitle, type BookmarkStatus } from "../utils/bookmarks";
import { buttonStyles } from "../utils/buttonStyles";
import { cn } from "../utils/cn";
import { describeUpdate, formatChapter, formatSite, timeAgo } from "../utils/format";
import { safeHttpUrl } from "../utils/url";
import Badge from "./Badge";
import Button from "./Button";
import CoverImage from "./CoverImage";

interface BookmarkCardProps {
  bookmark: Bookmark;
  status: BookmarkStatus;
  update?: NewChapter;
  onCheck: (bookmark: Bookmark) => void;
  onOpen: (bookmark: Bookmark) => void;
}

const borderByStatus: Record<BookmarkStatus, string> = {
  idle: "border-ink-700",
  checking: "border-sky-500/40",
  new: "border-emerald-400/50",
  issue: "border-rose-500/50",
};

const BookmarkCard = ({ bookmark, status, update, onCheck, onOpen }: BookmarkCardProps) => {
  const title = bookmarkTitle(bookmark);
  const site = formatSite(bookmark.site);
  const href = safeHttpUrl(bookmark.url);
  const isNew = status === "new";
  const isChecking = status === "checking";
  const hasIssue = status === "issue";
  const isLocked = bookmark.newChapterIsLocked;

  const openLabel = isNew ? `Read on ${site}` : isLocked ? `Open on ${site}` : "Continue reading";

  return (
    <article
      aria-label={title}
      className={cn("flex h-full flex-col overflow-hidden rounded-xl border bg-ink-900", borderByStatus[status])}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-800">
        <CoverImage key={bookmark.comicProfilePic ?? "none"} src={safeHttpUrl(bookmark.comicProfilePic)} className="h-full w-full" />

        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {isNew && <Badge tone="success">NEW Ch. {formatChapter(update?.to ?? bookmark.lastChapter)}</Badge>}
          {isChecking && <Badge tone="info">Checking…</Badge>}
          {hasIssue && (
            <Badge tone="danger" icon={<FiAlertTriangle aria-hidden />}>
              Check failed
            </Badge>
          )}
          {isLocked && (
            <Badge tone="warning" icon={<FiLock aria-hidden />}>
              Locked
            </Badge>
          )}
        </div>
        <div className="absolute bottom-2 left-2">
          <Badge>{site}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold text-white">{title}</h3>

        <div>
          <p className="flex items-baseline gap-2">
            <span className={cn("text-2xl font-semibold", isNew ? "text-emerald-400" : "text-zinc-100")}>
              Ch. {formatChapter(bookmark.lastChapter)}
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              {isNew && update ? describeUpdate(update) : bookmark.lastChapter === null ? "No chapter found" : "Latest chapter"}
            </span>
          </p>
          <p className="mt-1 flex items-center gap-1 font-mono text-[11px] text-zinc-500">
            <FiClock aria-hidden />
            Checked {timeAgo(bookmark.lastCheckedAt)}
          </p>
        </div>

        {hasIssue && (
          <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-300">
            Couldn't read this source. Try again in a moment.
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          {hasIssue ? (
            <Button variant="secondary" className="flex-1" icon={<FiRefreshCw aria-hidden />} onClick={() => onCheck(bookmark)}>
              Retry check
            </Button>
          ) : href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpen(bookmark)}
              className={buttonStyles({ variant: isNew ? "primary" : "secondary", className: "flex-1" })}
            >
              {openLabel}
              <FiExternalLink aria-hidden />
            </a>
          ) : (
            <Button variant="secondary" className="flex-1" disabled>
              Link unavailable
            </Button>
          )}

          {hasIssue && href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${title} on ${site}`}
              className={buttonStyles({ variant: "secondary", size: "icon" })}
            >
              <FiExternalLink aria-hidden />
            </a>
          ) : (
            !hasIssue && (
              <Button
                variant="secondary"
                size="icon"
                aria-label={`Check ${title} for a new chapter`}
                loading={isChecking}
                disabled={isChecking}
                onClick={() => onCheck(bookmark)}
              >
                {!isChecking && <FiRefreshCw aria-hidden />}
              </Button>
            )
          )}
        </div>
      </div>
    </article>
  );
};

export default BookmarkCard;

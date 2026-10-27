import { FiBell, FiCheck, FiX } from "react-icons/fi";
import { formatChapter, pluralize } from "../utils/format";
import Button from "./Button";

export interface ReleaseItem {
  id: string;
  title: string;
  chapter: number | null;
}

interface NewReleasesBannerProps {
  items: ReleaseItem[];
  onView: () => void;
  onMarkAllRead: () => void;
  onDismiss: () => void;
}

const PREVIEW_COUNT = 3;

const NewReleasesBanner = ({ items, onView, onMarkAllRead, onDismiss }: NewReleasesBannerProps) => {
  const preview = items.slice(0, PREVIEW_COUNT);
  const rest = items.length - preview.length;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 sm:flex-row sm:items-center sm:p-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 text-emerald-400">
          <FiBell aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {items.length} new {pluralize(items.length, "chapter")} ready to read
          </p>
          <p className="truncate text-xs text-zinc-400">
            {preview.map((item) => `${item.title} Ch. ${formatChapter(item.chapter)}`).join(", ")}
            {rest > 0 && ` and ${rest} more`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <Button variant="secondary" size="sm" onClick={onView}>
          View updates
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<FiCheck aria-hidden />}
          onClick={onMarkAllRead}
        >
          Mark all read
        </Button>
        <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={onDismiss}>
          <FiX aria-hidden />
        </Button>
      </div>
    </div>
  );
};

export default NewReleasesBanner;

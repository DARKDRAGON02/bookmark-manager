import type { NewChapter } from "../type/library.type";

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** ["a"] -> "a", ["a","b"] -> "a and b", ["a","b","c"] -> "a, b and c" */
export function formatList(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function formatChapter(chapter: number | null): string {
  return chapter === null ? "—" : String(chapter);
}

/** "5m ago", "3h ago", "2d ago". Returns "never" for a missing date. */
export function timeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "never";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "never";

  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 45) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

/** Crockford base32 ULIDs (WeebCentral series ids) carry no readable text. */
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

/** "solo-leveling-ragnarok-4c8a1f2b" -> "Solo Leveling Ragnarok" */
export function humanizeSlug(slug: string): string {
  if (ULID_PATTERN.test(slug)) {
    return "Untitled series";
  }

  return slug
    .replace(/[-_]?[a-f0-9]{8}$/i, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const SITE_NAMES: Array<[match: string, label: string]> = [
  ["asura", "AsuraScan"],
  ["shojo", "KingOfShojo"],
  ["weeb", "WeebCentral"],
];

export function formatSite(site: string): string {
  const key = site.toLowerCase();
  return SITE_NAMES.find(([match]) => key.includes(match))?.[1] ?? site;
}

/** "Prev Ch. 141 · +1 new" text for a card that has a new chapter. */
export function describeUpdate({ from, to }: NewChapter): string {
  if (from === null || to === null) return "New chapter";
  const diff = Number((to - from).toFixed(1));
  return `Prev Ch. ${formatChapter(from)}, +${diff} new`;
}

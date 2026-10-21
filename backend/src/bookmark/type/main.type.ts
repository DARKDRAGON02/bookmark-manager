import pLimit from 'p-limit';

export type ScrapedChapter = {
  number: number;
  image?: string;
  title?: string;
  /**
   * True when the latest chapter needs payment or early-access unlock.
   * Undefined means the source does not expose lock status, which is not
   * the same as unlocked.
   */
  isChapterLocked?: boolean;
};

export type Scraper = (url: string) => Promise<ScrapedChapter | null>;

export type SiteLimiter = (site: string) => ReturnType<typeof pLimit>;

export interface ChapterInfo {
  number: number;
  url: string | undefined;
  date: string;
  image?: string;
  title?: string;
  /**
   * True when the latest chapter needs payment or early-access unlock.
   * Undefined means the source does not expose lock status, which is not
   * the same as unlocked.
   */
  isChapterLocked?: boolean;
}

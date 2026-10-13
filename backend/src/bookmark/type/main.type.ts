import pLimit from 'p-limit';

export type ScrapedChapter = {
  number: number;
  image?: string;
  title?: string;
};

export type Scraper = (url: string) => Promise<ScrapedChapter | null>;

export type SiteLimiter = (site: string) => ReturnType<typeof pLimit>;

export interface ChapterInfo {
  number: number;
  url: string | undefined;
  date: string;
  image?: string;
  title?: string;
}

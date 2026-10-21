import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  DB_WRITE_CONCURRENCY,
  SCRAPE_CACHE_TTL_SECONDS,
  STALE_AFTER_MINUTES,
} from './constants/data-map';
import { scrapeCacheKey } from './utils/scrapeCacheKey';
import { ScrapedChapter, SiteLimiter } from './type/main.type';
import { SCRAPERS } from './constants/SCRAPERS';
import { errorMessage } from './utils/errorMessage';
import { matchBookmarkToSite } from './utils/matchBookmarkToSite';
import { createSiteLimiter } from './utils/createSiteLimiter';

@Injectable()
export class BookmarksService {
  private readonly logger = new Logger(BookmarksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get the latest chapter and metadata from Redis or the site scraper.
   * Returns null if no scraper exists or scraping fails.
   */
  private async getLatestChapter(
    bookmark: { url: string; site: string; slug: string },
    limiterFor?: SiteLimiter,
  ): Promise<ScrapedChapter | null> {
    const scraper = SCRAPERS[bookmark.site];

    if (!scraper) {
      return null;
    }

    const cacheKey = scrapeCacheKey(bookmark.site, bookmark.slug);

    const cached = await this.redis
      .get<ScrapedChapter>(cacheKey)
      .catch(() => null);

    if (cached) {
      return cached;
    }

    const run = () => scraper(bookmark.url);

    const scraped = await (
      limiterFor ? limiterFor(bookmark.site)(run) : run()
    ).catch((error: unknown) => {
      this.logger.warn(
        `Chapter scrape failed for ${bookmark.url}: ${errorMessage(error)}`,
      );
      return null;
    });

    if (!scraped) {
      return null;
    }

    // Keep all fields required by the service, including title.
    const result: ScrapedChapter = {
      number: scraped.number,
      image: scraped.image,
      title: scraped.title,
      // Undefined for sources that do not expose lock status.
      isChapterLocked: scraped.isChapterLocked,
    };

    await this.redis
      .set(cacheKey, result, SCRAPE_CACHE_TTL_SECONDS)
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to cache scrape result: ${errorMessage(error)}`,
        );
      });

    return result;
  }

  async importFromHtml(html: string, firebaseUid: string) {
    const $ = cheerio.load(html);

    const links: { url: string; title: string }[] = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href');

      if (!href) {
        return;
      }

      links.push({
        url: href,
        title: $(el).text().trim(),
      });
    });

    const matched = links.flatMap((link) => {
      const match = matchBookmarkToSite(link.url);
      return match ? [{ ...link, ...match }] : [];
    });

    const deduped = Array.from(
      new Map(matched.map((bookmark) => [bookmark.url, bookmark])).values(),
    );

    const skipped = links.length - matched.length;

    if (deduped.length === 0) {
      return {
        imported: 0,
        skipped,
        failedScrapes: 0,
      };
    }

    const existing = await this.prisma.bookmark.findMany({
      where: {
        firebaseUid,
        url: {
          in: deduped.map((bookmark) => bookmark.url),
        },
      },
      select: {
        url: true,
        title: true,
        lastChapter: true,
        comicProfilePic: true,
        newChapterIsLocked: true,
      },
    });

    const existingByUrl = new Map(
      existing.map((bookmark) => [bookmark.url, bookmark]),
    );

    const limiterFor = createSiteLimiter();

    const withChapters = await Promise.all(
      deduped.map(async (bookmark) => {
        const previous = existingByUrl.get(bookmark.url);
        const existingChapter = previous?.lastChapter ?? null;
        const existingImage = previous?.comicProfilePic ?? null;

        const hasScraper = SCRAPERS[bookmark.site] !== undefined;
        const result = await this.getLatestChapter(bookmark, limiterFor);

        // Never move lastChapter backwards.
        const lastChapter = result
          ? Math.max(result.number, existingChapter ?? result.number)
          : existingChapter;

        return {
          ...bookmark,
          // Prefer the title scraped from the actual comic page.
          // Fall back to the title in the browser bookmark export.
          title:
            result?.title?.trim() || previous?.title || bookmark.title || null,
          lastChapter,
          comicProfilePic: result?.image ?? existingImage,
          lastCheckedAt: result ? new Date() : null,
          // undefined when the source does not report lock status.
          newChapterIsLocked: result?.isChapterLocked,
          scrapeFailed: hasScraper && result === null,
        };
      }),
    );

    // Bound concurrent database writes.
    const dbLimit = pLimit(DB_WRITE_CONCURRENCY);

    const results = await Promise.all(
      withChapters.map((bookmark) =>
        dbLimit(() =>
          this.prisma.bookmark.upsert({
            where: {
              firebaseUid_url: {
                firebaseUid,
                url: bookmark.url,
              },
            },
            update: {
              ...(bookmark.title ? { title: bookmark.title } : {}),
              ...(bookmark.lastChapter !== null
                ? { lastChapter: bookmark.lastChapter }
                : {}),
              ...(bookmark.lastCheckedAt
                ? { lastCheckedAt: bookmark.lastCheckedAt }
                : {}),
              ...(bookmark.comicProfilePic
                ? { comicProfilePic: bookmark.comicProfilePic }
                : {}),
              // Only overwrite when the source reported a lock status.
              ...(bookmark.newChapterIsLocked !== undefined
                ? { newChapterIsLocked: bookmark.newChapterIsLocked }
                : {}),
            },
            create: {
              firebaseUid,
              url: bookmark.url,
              title: bookmark.title,
              site: bookmark.site,
              slug: bookmark.slug,
              lastChapter: bookmark.lastChapter,
              lastCheckedAt: bookmark.lastCheckedAt,
              comicProfilePic: bookmark.comicProfilePic,
              newChapterIsLocked: bookmark.newChapterIsLocked ?? false,
            },
          }),
        ),
      ),
    );

    return {
      imported: results.length,
      skipped,
      failedScrapes: withChapters.filter((bookmark) => bookmark.scrapeFailed)
        .length,
    };
  }

  async checkOne(id: string, firebaseUid: string) {
    // Always scope the lookup to the owner.
    const bookmark = await this.prisma.bookmark.findFirst({
      where: {
        id,
        firebaseUid,
      },
    });

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    const result = await this.getLatestChapter(bookmark);

    // Failed scrape: do not modify chapter/check timestamp.
    if (!result) {
      return {
        id: bookmark.id,
        title: bookmark.title,
        lastChapter: bookmark.lastChapter,
        newChapterIsLocked: bookmark.newChapterIsLocked,
        hasNewChapter: false,
        checked: false,
      };
    }

    const hasNewChapter =
      bookmark.lastChapter === null || result.number > bookmark.lastChapter;

    // Never decrease lastChapter.
    const newLastChapter = Math.max(
      bookmark.lastChapter ?? result.number,
      result.number,
    );

    const updated = await this.prisma.bookmark.update({
      where: {
        id: bookmark.id,
      },
      data: {
        lastChapter: newLastChapter,
        lastCheckedAt: new Date(),
        comicProfilePic: result.image ?? bookmark.comicProfilePic,
        ...(result.title?.trim() ? { title: result.title.trim() } : {}),
        ...(typeof result.isChapterLocked === 'boolean'
          ? { newChapterIsLocked: result.isChapterLocked }
          : {}),
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      lastChapter: updated.lastChapter,
      newChapterIsLocked: updated.newChapterIsLocked,
      hasNewChapter,
      checked: true,
    };
  }

  async batchCheck(firebaseUid: string) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: {
        firebaseUid,
      },
      select: {
        id: true,
        url: true,
        title: true,
        site: true,
        slug: true,
        lastChapter: true,
        lastCheckedAt: true,
        comicProfilePic: true,
        newChapterIsLocked: true,
      },
    });

    const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000);

    const limiterFor = createSiteLimiter();
    const dbLimit = pLimit(DB_WRITE_CONCURRENCY);

    const results = await Promise.all(
      bookmarks.map(async (bookmark) => {
        const isFresh =
          bookmark.lastCheckedAt !== null &&
          bookmark.lastCheckedAt > staleBefore;

        if (isFresh) {
          return {
            id: bookmark.id,
            title: bookmark.title,
            lastChapter: bookmark.lastChapter,
            newChapterIsLocked: bookmark.newChapterIsLocked,
            hasNewChapter: false,
            checked: false,
            skippedReason: 'recently checked' as const,
          };
        }

        const result = await this.getLatestChapter(bookmark, limiterFor);

        // Failed scrape: leave the database unchanged.
        if (!result) {
          return {
            id: bookmark.id,
            title: bookmark.title,
            lastChapter: bookmark.lastChapter,
            newChapterIsLocked: bookmark.newChapterIsLocked,
            hasNewChapter: false,
            checked: false,
          };
        }

        const hasNewChapter =
          bookmark.lastChapter === null || result.number > bookmark.lastChapter;

        const newLastChapter = Math.max(
          bookmark.lastChapter ?? result.number,
          result.number,
        );

        const updated = await dbLimit(() =>
          this.prisma.bookmark.update({
            where: {
              id: bookmark.id,
            },
            data: {
              lastChapter: newLastChapter,
              lastCheckedAt: new Date(),
              comicProfilePic: result.image ?? bookmark.comicProfilePic,
              ...(result.title?.trim() ? { title: result.title.trim() } : {}),
              ...(typeof result.isChapterLocked === 'boolean'
                ? { newChapterIsLocked: result.isChapterLocked }
                : {}),
            },
          }),
        );

        return {
          id: updated.id,
          title: updated.title,
          lastChapter: updated.lastChapter,
          newChapterIsLocked: updated.newChapterIsLocked,
          hasNewChapter,
          checked: true,
        };
      }),
    );

    return {
      total: results.length,
      checked: results.filter((result) => result.checked).length,
      newChapters: results.filter((result) => result.hasNewChapter),
      failed: results.filter(
        (result) =>
          result.checked === false &&
          !('skippedReason' in result && result.skippedReason),
      ).length,
      skipped: results.filter(
        (result) =>
          'skippedReason' in result &&
          result.skippedReason === 'recently checked',
      ).length,
    };
  }

  async findAll(firebaseUid: string) {
    return this.prisma.bookmark.findMany({
      where: {
        firebaseUid,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        url: true,
        title: true,
        site: true,
        slug: true,
        comicProfilePic: true,
        lastChapter: true,
        lastCheckedAt: true,
        newChapterIsLocked: true,
      },
    });
  }
}

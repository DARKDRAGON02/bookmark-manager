import { load } from 'cheerio';
import type { Scraper } from '../type/main.type';

const BASE_URL = 'https://lustoon.com';

/**
 * The cover URLs in the markup are http, which browsers block as mixed
 * content on an https site.
 */
function toHttps(value: string | undefined): string | undefined {
  return value?.replace(/^http:\/\//i, 'https://');
}

export const scrapeLustToon: Scraper = async (url) => {
  try {
    const parsedUrl = new URL(url);

    if (
      parsedUrl.hostname !== 'lustoon.com' &&
      parsedUrl.hostname !== 'www.lustoon.com'
    ) {
      return null;
    }

    // Accept chapter URLs too and scrape the series they belong to; the
    // matcher resolves those to this slug, so rejecting them here would leave
    // the bookmark permanently uncheckable.
    const match = parsedUrl.pathname.match(
      /^\/comic\/([^/]+)(?:\/chapter-[^/]+)?\/?$/i,
    );

    if (!match) return null;

    const slug = decodeURIComponent(match[1]);

    const response = await fetch(
      `${BASE_URL}/comic/${encodeURIComponent(slug)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ComicMetadataScraper/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) return null;

    const html = await response.text();
    const $ = load(html);

    // The series title, not the chapter label. The service writes this over
    // the bookmark title, so "Chapter 5" here would rename every bookmark.
    const title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim() ||
      $('title')
        .text()
        .replace(/\s*\|\s*LustToon\s*$/i, '')
        .trim() ||
      undefined;

    // og:image is a generated social card (/api/og?...) that embeds the cover
    // as a query parameter, so prefer the real cover when the page has one.
    const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
    const pageCover = $('img[src*="media.lustoon.com"][src*="/covers/"]')
      .first()
      .attr('src');

    const image = toHttps(
      ogImage && !/\/api\/og\b/i.test(ogImage)
        ? ogImage
        : (pageCover ?? ogImage),
    );

    // LustToon renders chapter links in its HTML.
    const chapters = new Map<number, { number: number; url: string }>();

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      let chapterUrl: URL;

      try {
        chapterUrl = new URL(href, BASE_URL);
      } catch {
        return;
      }

      if (
        chapterUrl.hostname !== 'lustoon.com' &&
        chapterUrl.hostname !== 'www.lustoon.com'
      ) {
        return;
      }

      const chapterMatch = chapterUrl.pathname.match(
        /^\/comic\/([^/]+)\/chapter-(\d+(?:\.\d+)?)\/?$/i,
      );

      if (!chapterMatch) return;

      if (decodeURIComponent(chapterMatch[1]) !== slug) return;

      const number = Number(chapterMatch[2]);
      if (!Number.isFinite(number)) return;

      chapters.set(number, {
        number,
        url: chapterUrl.href,
      });
    });

    if (chapters.size === 0) return null;

    const latest = [...chapters.values()].sort(
      (a, b) => b.number - a.number,
    )[0];

    return {
      number: latest.number,
      title,
      image,
      // The series page carries no per-chapter lock badge, so lock status is
      // unknown rather than false.
    };
  } catch (error) {
    console.error('[LustToon scraper]', error);
    return null;
  }
};

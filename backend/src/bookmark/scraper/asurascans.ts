import axios from 'axios';
import * as cheerio from 'cheerio';
import { ChapterInfo } from '../type/main.type';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

interface EmbeddedChapter {
  number: number;
  isChapterLocked: boolean;
  slug?: string;
  publishedAt?: string;
}

/**
 * Extract chapters from the serialized ChapterListReact Astro island.
 *
 * The serialized props use Astro's [type, value] representation,
 * e.g. "number":[0,99] and "is_premium":[0,true].
 */
function extractLatestChapterFromIsland(html: string): EmbeddedChapter | null {
  const islandRegex =
    /<astro-island\b[^>]*component-url="[^"]*ChapterListReact[^"]*"[^>]*props="([^"]*)"[^>]*>/s;

  const match = html.match(islandRegex);

  if (!match?.[1]) {
    return null;
  }

  const props = decodeHtmlEntities(match[1]);

  // Match complete serialized chapter objects, rather than matching
  // number and is_premium independently across different chapters.
  const chapters: EmbeddedChapter[] = [];

  const objectRegex = /\[0,\{([\s\S]*?)\}\]/g;

  for (const objectMatch of props.matchAll(objectRegex)) {
    const object = objectMatch[1];

    const numberMatch = object.match(/"number"\s*:\s*\[0,\s*(\d+(?:\.\d+)?)\]/);

    if (!numberMatch) {
      continue;
    }

    const premiumMatch = object.match(
      /"is_premium"\s*:\s*\[0,\s*(true|false)\]/,
    );

    const slugMatch = object.match(/"slug"\s*:\s*\[0,\s*"([^"]*)"\]/);

    const publishedAtMatch = object.match(
      /"published_at"\s*:\s*\[0,\s*"([^"]*)"\]/,
    );

    // Do not silently claim a chapter is unlocked when the source
    // does not expose its premium status.
    if (!premiumMatch) {
      continue;
    }

    chapters.push({
      number: Number(numberMatch[1]),
      isChapterLocked: premiumMatch[1] === 'true',
      slug: slugMatch?.[1],
      publishedAt: publishedAtMatch?.[1],
    });
  }

  if (chapters.length === 0) {
    return null;
  }

  return chapters.reduce((latest, chapter) =>
    chapter.number > latest.number ? chapter : latest,
  );
}

/**
 * Fallback for pages that server-render chapter links directly.
 */
function extractLatestChapterFromStaticLinks(
  html: string,
  slug: string,
): EmbeddedChapter | null {
  const $ = cheerio.load(html);

  const chapters: EmbeddedChapter[] = [];

  $(`a[href*="/comics/${slug}/chapter/"]`).each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr('href');

    if (!href) {
      return;
    }

    const numberMatch = href.match(/\/chapter\/(\d+(?:\.\d+)?)(?:\/|$|\?)/);

    if (!numberMatch) {
      return;
    }

    const chapterNumber = Number(numberMatch[1]);
    const containerText = anchor.text().trim();

    // Static links alone do not reliably establish premium status.
    // Do not mark the chapter as unlocked unless its status is known.
    const premiumIndicator =
      anchor.find('[class*="amber"], [class*="premium"]').length > 0 ||
      /unlock(?:s|ed)?\s+in|early access/i.test(containerText);

    chapters.push({
      number: chapterNumber,
      isChapterLocked: premiumIndicator,
      slug: href,
    });
  });

  if (chapters.length === 0) {
    return null;
  }

  return chapters.reduce((latest, chapter) =>
    chapter.number > latest.number ? chapter : latest,
  );
}

export const scrapeAsuraScans = async (
  url: string,
): Promise<ChapterInfo | null> => {
  if (!url) {
    return null;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);

    if (
      parsedUrl.protocol !== 'https:' ||
      !/(^|\.)asurascans\.com$/i.test(parsedUrl.hostname)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  let html: string;

  try {
    const response = await axios.get<string>(parsedUrl.href, {
      timeout: 10_000,
      maxRedirects: 3,
      maxContentLength: 5 * 1024 * 1024,
      responseType: 'text',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    html = response.data;
  } catch {
    return null;
  }

  const slugMatch = parsedUrl.pathname.match(/\/comics\/([^/]+)/);
  const slug = slugMatch?.[1];

  if (!slug) {
    return null;
  }

  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() || undefined;

  const image = $('meta[property="og:image"]').attr('content') || undefined;

  // Prefer embedded data because it contains is_premium.
  const embeddedChapter = extractLatestChapterFromIsland(html);

  if (embeddedChapter) {
    const chapterUrl = embeddedChapter.slug
      ? new URL(
          `/comics/${slug}/chapter/${embeddedChapter.number}`,
          parsedUrl.origin,
        ).href
      : parsedUrl.href;

    return {
      number: embeddedChapter.number,
      url: chapterUrl,
      date: embeddedChapter.publishedAt ?? '',
      image,
      title,
      isChapterLocked: embeddedChapter.isChapterLocked,
    };
  }

  // Fall back to static links when embedded data is unavailable.
  const fallback = extractLatestChapterFromStaticLinks(html, slug);

  if (!fallback) {
    return null;
  }

  return {
    number: fallback.number,
    url: new URL(`/comics/${slug}/chapter/${fallback.number}`, parsedUrl.origin)
      .href,
    date: fallback.publishedAt ?? '',
    image,
    title,
    isChapterLocked: fallback.isChapterLocked,
  };
};

import axios from 'axios';
import * as cheerio from 'cheerio';
import { ChapterInfo } from '../type/main.type';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function extractLatestChapterFromIsland(html: string): number | null {
  const islandMatch = html.match(
    /<astro-island[^>]*component-url="\/_astro\/ChapterListReact[^"]*"[^>]*props="([^"]*)"/,
  );

  if (!islandMatch) {
    return null;
  }

  const propsJson = decodeHtmlEntities(islandMatch[1]);
  const numberMatch = propsJson.match(/"number":\[0,(\d+(?:\.\d+)?)\]/);

  if (!numberMatch) {
    return null;
  }

  const number = parseFloat(numberMatch[1]);

  return Number.isNaN(number) ? null : number;
}

/**
 * Fallback only: matches static chapter links if the site
 * server-renders them directly.
 */
function extractLatestChapterFromStaticLinks(
  html: string,
  slug: string,
): { number: number; href: string } | null {
  const $ = cheerio.load(html);
  const chapters: { number: number; href: string }[] = [];

  $(`a[href*="/comics/${slug}/chapter/"]`).each((_, el) => {
    const href = $(el).attr('href');

    if (!href) {
      return;
    }

    const numberMatch = href.match(/\/chapter\/(\d+(?:\.\d+)?)/);

    if (numberMatch) {
      chapters.push({
        number: parseFloat(numberMatch[1]),
        href,
      });
    }
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

  let html: string;

  try {
    const response = await axios.get<string>(url, {
      timeout: 10_000,
      maxRedirects: 3,
      maxContentLength: 5 * 1024 * 1024,
      responseType: 'text',
    });

    html = response.data;
  } catch {
    return null;
  }

  const slugMatch = url.match(/\/comics\/([^/?]+)/);
  const slug = slugMatch?.[1];

  if (!slug) {
    return null;
  }

  const $ = cheerio.load(html);

  // AsuraScans series title.
  const title = $('h1').first().text().trim() || undefined;

  const image = $('meta[property="og:image"]').attr('content') || undefined;

  const islandNumber = extractLatestChapterFromIsland(html);

  if (islandNumber !== null) {
    return {
      number: islandNumber,
      // The island props don't provide a reliable chapter URL here.
      url,
      date: '',
      image,
      title,
    };
  }

  // Fallback for server-rendered static chapter links.
  const fallback = extractLatestChapterFromStaticLinks(html, slug);

  if (!fallback) {
    return null;
  }

  return {
    number: fallback.number,
    url: new URL(fallback.href, url).href,
    date: '',
    image,
    title,
  };
};

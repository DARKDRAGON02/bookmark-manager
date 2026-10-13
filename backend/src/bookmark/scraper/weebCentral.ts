import axios from 'axios';
import * as cheerio from 'cheerio';
import { ChapterInfo } from '../type/main.type';

export const scrapeWeebCentral = async (
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
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    html = response.data;
  } catch {
    return null;
  }

  const $ = cheerio.load(html);

  // Extract the series title shown in the page heading.
  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    undefined;

  // Prefer the official cover metadata if present.
  const image =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    undefined;

  // WeebCentral renders chapter rows inside #chapter-list.
  const chapters = $('#chapter-list a[href*="/chapters/"]')
    .map((_, el) => {
      const chapterUrl = $(el).attr('href');

      if (!chapterUrl) {
        return null;
      }

      const chapterTitle =
        $(el).find('.grow span').first().text().trim() || $(el).text().trim();

      const match = chapterTitle.match(/(?:chapter|ch\.?)\s*(\d+(?:\.\d+)?)/i);

      if (!match) {
        return null;
      }

      const number = Number(match[1]);

      if (!Number.isFinite(number)) {
        return null;
      }

      const timeElement = $(el).find('time').first();

      return {
        number,
        url: new URL(chapterUrl, url).href,
        date: timeElement.attr('datetime') || timeElement.text().trim(),
      };
    })
    .get()
    .filter(
      (
        chapter,
      ): chapter is {
        number: number;
        url: string;
        date: string;
      } => chapter !== null,
    );

  if (chapters.length === 0) {
    return null;
  }

  const latestChapter = chapters.reduce((latest, chapter) =>
    chapter.number > latest.number ? chapter : latest,
  );

  return {
    ...latestChapter,
    title,
    image,
  };
};

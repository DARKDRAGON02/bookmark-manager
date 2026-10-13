import axios from 'axios';
import * as cheerio from 'cheerio';
import { ChapterInfo } from '../type/main.type';

export const scrapeKingOfShojo = async (
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

  const $ = cheerio.load(html);

  // Series title, based on the site's h1.entry-title element.
  const title =
    $('h1.entry-title').first().text().trim() ||
    $('h1').first().text().trim() ||
    undefined;

  const chapters = $('#chapterlist li')
    .map((_, el) => ({
      number: Number($(el).attr('data-num')),
      url: $(el).find('a').attr('href'),
      date: $(el).find('.chapterdate').text().trim(),
    }))
    .get()
    .filter((chapter) => Number.isFinite(chapter.number));

  if (chapters.length === 0) {
    return null;
  }

  const latestChapter = chapters.reduce((latest, chapter) =>
    chapter.number > latest.number ? chapter : latest,
  );

  // The cover is in the thumbnail block, not the blurred hero background.
  const image =
    $('.seriestucontl .thumb[itemprop="image"] img').attr('src') || undefined;

  return {
    ...latestChapter,
    image,
    title,
  };
};

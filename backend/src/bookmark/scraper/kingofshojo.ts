import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ChapterInfo {
  number: number;
  url: string | undefined;
  date: string;
  image?: string;
}

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

  const chapters = $('#chapterlist li')
    .map((_, el) => ({
      number: Number($(el).attr('data-num')),
      url: $(el).find('a').attr('href'),
      date: $(el).find('.chapterdate').text().trim(),
    }))
    .get()
    .filter((ch) => !Number.isNaN(ch.number));

  if (chapters.length === 0) {
    return null;
  }

  const latestChapter = chapters.reduce((latest, chapter) =>
    chapter.number > latest.number ? chapter : latest,
  );

  // Cover image lives in the .thumb block (schema.org ImageObject),
  // NOT .bigbanner — that's the blurred hero background, a different image.
  const image = $('.seriestucontl .thumb[itemprop="image"] img').attr('src');

  return {
    ...latestChapter,
    image,
  };
};
